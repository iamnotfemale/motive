"use client";

/**
 * S02·S03 추론 워크스페이스.
 *
 * 왼쪽은 레일 + 밀려나오는 패널, 오른쪽은 선택한 대상의 패널, 아래는 도구 막대.
 * 상시 AI 채팅 칼럼을 만들지 않는다 (스펙 §30.5).
 */
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Canvas } from "@/components/canvas/Canvas";
import { SOURCE_W } from "@/components/canvas/SourceChip";
import { Toolbar } from "@/components/Toolbar";
import { TutorialGuide } from "@/components/TutorialGuide";
import { LeftPanelView, LeftRail } from "@/components/LeftSide";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { Inspector } from "@/components/panels/Inspector";
import { SourcePanel } from "@/components/panels/SourcePanel";
import { ReviewPanel } from "@/components/panels/ReviewPanel";
import { DecisionPanel } from "@/components/panels/DecisionPanel";
import { RefinePanel } from "@/components/panels/RefinePanel";
import { IssuePanel } from "@/components/panels/IssuePanel";
import { CommandMenu } from "@/components/CommandMenu";
import { WideEditor } from "@/components/WideEditor";
import { extractFile } from "@/lib/extract";
import { summarize } from "@/lib/issues";
import { type Kind, kindOf } from "@/lib/labels";
import { DEFAULT_PHASE, SPOTLIGHT_KEYS, type ActionKey } from "@/lib/phases";
import { spotlightFor } from "@/lib/spotlight";
import { autoSummarize } from "@/lib/ai";
import { nextFreeSpot, useDoc } from "@/lib/store";
import { blankMd } from "@/lib/templates";
import { flashSaved, useUi } from "@/lib/ui";
import type { Phase, Source } from "@/lib/types";

export default function Workspace({ params }: { params: Promise<{ id: string }> }) {
  const { id: pid } = use(params);
  const router = useRouter();

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const unsub = useDoc.persist.onFinishHydration(() => setHydrated(true));
    if (useDoc.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  const project = useDoc((s) => s.projects.find((p) => p.id === pid));
  const doc = useDoc((s) => s.docs[pid]);
  const store = useDoc.getState;
  const ui = useUi();
  const phase: Phase = ui.phase ?? DEFAULT_PHASE;

  const [issuePanel, setIssuePanel] = useState<"issues" | "conflicts" | null>(null);
  // 레일의 `자료 첨부` 가 여는 파일 선택기. 도구 막대는 비추기만 한다.
  const fileRef = useRef<HTMLInputElement>(null);

  const { issues, conflicts } = useMemo(
    () => (doc ? summarize(doc) : { issues: [], conflicts: [] }),
    [doc],
  );

  useEffect(() => () => useUi.getState().reset(), [pid]);

  // 데모는 카드가 12장이라 60% 로 열어 전체 구조가 먼저 보이게 한다. 이후 확대는 사용자가.
  useEffect(() => {
    if (!hydrated || !(project?.demo || project?.tutorial) || !doc) return;
    const z = 0.6;
    const spots = Object.values(doc.placements);
    const minX = Math.min(...spots.map((p) => p.x));
    const minY = Math.min(...spots.map((p) => p.y));
    const maxX = Math.max(...spots.map((p) => p.x)) + 288;
    const maxY = Math.max(...spots.map((p) => p.y)) + 400;
    const w = (maxX - minX) * z;
    const h = (maxY - minY) * z;
    useUi.getState().setZoom(z);
    useUi.getState().setPan({
      x: Math.max(80, (window.innerWidth - w) / 2) - minX * z,
      y: Math.max(80, (window.innerHeight - 52 - h) / 2) - minY * z,
    });
    // pid 가 바뀔 때 한 번만. doc 변경마다 되돌리면 사용자의 이동을 덮어쓴다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, pid, project?.demo, project?.tutorial]);

  useEffect(() => {
    const sp = useUi.getState().spotlight;
    if (!sp || !doc) return;
    const fresh = spotlightFor(sp.key as ActionKey, doc);
    if (fresh && fresh.ids.join() !== sp.ids.join()) useUi.getState().setSpotlight({ key: sp.key, ko: sp.ko, ids: fresh.ids });
  }, [doc]);

  /* ── 카드 만들기 ── */
  const addCard = useCallback(
    (
      kind: Kind,
      opts?: { from?: string; edge?: "investigates" | "based_on" | "produces"; at?: { x: number; y: number } },
    ) => {
      const d = useDoc.getState().docs[pid];
      if (!d) return;
      const at = opts?.at ?? nextFreeSpot(d, opts?.from ? (d.placements[opts.from] ?? { x: 72, y: 48 }) : { x: 72, y: 48 });
      const id = store().addNode(pid, { kind, md: blankMd(kind), at });
      if (opts?.from && opts.edge) store().addEdge(pid, { from: opts.from, to: id, type: opts.edge });
      useUi.getState().select([id]);
      // 새 카드가 화면 밖에 생기면 찾지 못한다. 줌은 그대로 두고 그 카드로 이동한다.
      useUi.getState().requestCenter(id);
      useUi.getState().openPanel("inspector");
      useUi.getState().setInspTab("content");
      useUi.getState().requestCenter(id);
      flashSaved();
      return id;
    },
    [pid, store],
  );

  /* ── 자료 올리기 ── */
  const addFiles = useCallback(
    async (files: File[], at?: { x: number; y: number }, targetId?: string) => {
      const d = useDoc.getState().docs[pid];
      if (!d) return;
      let spot = at ?? nextFreeSpot(d, { x: 72, y: 48 });
      let failed = 0;
      let firstId: string | null = null;

      for (const file of files) {
        const sid = "src-" + Math.random().toString(36).slice(2, 9);
        const source: Source = {
          id: sid,
          kind: "text",
          name: file.name,
          text: "",
          state: "reading",
          attachedTo: targetId,
          createdAt: new Date().toISOString(),
        };
        store().addSource(pid, source);
        store().moveNode(pid, sid, spot);
        if (!firstId) firstId = sid;
        spot = { x: spot.x + SOURCE_W + 16, y: spot.y };

        const out = await extractFile(file);
        if (out.problem) {
          failed += 1;
          store().patchSource(pid, sid, { kind: out.kind, state: "no-text" });
        } else {
          store().patchSource(pid, sid, { kind: out.kind, text: out.text, state: "read" });
          void autoSummarize(pid, { id: sid, name: file.name, text: out.text });
        }
      }

      flashSaved();

      if (failed === files.length) {
        toast.warning(
          files.length === 1
            ? "이 파일에서 읽을 텍스트를 찾지 못했어요."
            : `${files.length}개 모두 읽지 못했어요.`,
          { description: "자료함에 남겨뒀어요. 텍스트를 직접 붙여넣을 수 있어요." },
        );
        useUi.getState().openLeft("sources");
        return;
      }
      if (failed > 0)
        toast.warning(`${files.length}개 중 ${failed}개를 읽지 못했어요.`, {
          description: "읽은 자료는 그대로 쓸 수 있어요.",
        });

      // 올리면 자료 패널만 연다. 근거 만들기는 도구 막대의 `근거 찾기`에서.
      if (firstId && files.length === 1 && !failed) {
        useUi.getState().select([firstId]);
        useUi.getState().openPanel("source");
      }
    },
    [pid, store],
  );

  const deleteSelected = useCallback(() => {
    const d = useDoc.getState().docs[pid];
    const sel = useUi.getState().sel;
    const nodes = sel.filter((id) => d?.nodes.some((n) => n.id === id));
    const sources = sel.filter((id) => d?.sources.some((s) => s.id === id));
    if (!nodes.length && !sources.length) return;
    for (const id of nodes) store().deleteNode(pid, id);
    for (const id of sources) store().deleteSource(pid, id);
    useUi.getState().select([]);
    useUi.getState().closePanel();
    flashSaved();
    toast(`${nodes.length + sources.length}개를 지웠어요`, { description: "⌘Z 로 되돌릴 수 있어요" });
  }, [pid, store]);

  /** 고른 블록을 같은 캔버스 옆자리에 복제한다. 원본은 그대로 둔다. */
  const forkSelection = useCallback(() => {
    const sel = useUi.getState().sel;
    if (sel.length < 2) return;
    const made = store().duplicateNodes(pid, sel);
    if (!made.length) return toast("복제하지 못했어요.");
    useUi.getState().select(made);
    useUi.getState().requestFit();
    flashSaved();
    toast(`${made.length}개를 복제해 새 갈래를 만들었어요`, {
      description: "원본은 그대로 남아 있어요 · ⌘Z 로 되돌릴 수 있어요",
    });
  }, [pid, store]);

  /**
   * 아래 도구 막대 — 그 단계에서 볼 블록만 남기고 나머지를 흐린다.
   * 같은 단추를 다시 누르면 전체로 돌아온다. 그래프는 건드리지 않는다.
   */
  const spotlight = useCallback(
    (key: ActionKey) => {
      const d = useDoc.getState().docs[pid];
      if (!d) return;
      if (useUi.getState().spotlight?.key === key) return useUi.getState().setSpotlight(null);

      const s = spotlightFor(key, d);
      if (!s) return;
      if (!s.ids.length) {
        useUi.getState().setSpotlight(null);
        return toast(s.empty ?? "비출 블록이 없어요.");
      }
      useUi.getState().setSpotlight({ key: s.key, ko: s.ko, ids: s.ids });
    },
    [pid],
  );

  /* ── 왼쪽 레일의 실행 동작 ── */
  const runAction = useCallback(
    (key: ActionKey) => {
      const d = useDoc.getState().docs[pid];
      if (!d) return;
      const sel = useUi.getState().sel[0];
      const node = sel ? d.nodes.find((n) => n.id === sel) : undefined;

      switch (key) {
        case "refine":
          return useUi.getState().openPanel("refine");
        case "add-claim":
          return void addCard("claim", { from: "P-01", edge: "investigates" });
        case "add-question":
          return void addCard("question", { from: node?.id ?? "P-01", edge: "investigates" });
        case "add-note":
          return void addCard("note");
        case "add-solution":
          return void addCard("solution");
        case "add-requirement": {
          const decision = node?.type === "decision" ? node : d.nodes.find((n) => n.type === "decision");
          if (!decision) return toast("먼저 결정을 만들어주세요.");
          useUi.getState().select([decision.id]);
          return useUi.getState().openPanel("decision");
        }
        case "make-decision": {
          const solution = node && kindOf(node) === "solution" ? node : d.nodes.find((n) => kindOf(n) === "solution");
          if (!solution) return toast("먼저 해결안을 추가해주세요.");
          useUi.getState().select([solution.id]);
          return useUi.getState().openPanel("decision");
        }
        case "attach":
          return fileRef.current?.click();
        case "sources":
        case "url":
          return useUi.getState().openLeft("sources");
        case "find-evidence": {
          // 자료를 골라 둔 상태면 그 자료에서, 아니면 읽은 자료 중 첫 번째에서
          const picked = d.sources.find((s) => s.id === useUi.getState().sel[0] && s.state === "read");
          const ready = picked ?? d.sources.find((s) => s.state === "read");
          if (!ready) {
            useUi.getState().openLeft("sources");
            return toast("먼저 자료를 올려주세요.");
          }
          useUi.getState().setReview({
            sourceId: ready.id,
            step: "pick-target",
            targetId: null,
            pickedLine: null,
            backTo: "candidates",
          });
          return useUi.getState().openPanel("review");
        }
        case "conflicts":
          return setIssuePanel((v) => (v === "conflicts" ? null : "conflicts"));
        case "issues":
          return setIssuePanel((v) => (v === "issues" ? null : "issues"));
        case "check-quotes": {
          const unverified = d.nodes.find((n) => n.sourceLocator && !n.sourceLocator.verified);
          if (!unverified) return toast("인용은 모두 원문과 대조됐어요.");
          useUi.getState().select([unverified.id]);
          useUi.getState().openPanel("inspector");
          return useUi.getState().setInspTab("sources");
        }
        case "handoff":
        case "export":
          return router.push(`/think/${pid}/handoff`);
      }
    },
    [pid, addCard, router],
  );

  /* ── 카드 액션 ── */
  const onNodeAction = useCallback(
    (id: string, index: 0 | 1) => {
      const d = useDoc.getState().docs[pid];
      const node = d?.nodes.find((n) => n.id === id);
      if (!node) return;
      const kind = kindOf(node);

      if (kind === "problem") {
        if (index === 0) useUi.getState().openPanel("refine");
        else addCard("claim", { from: id, edge: "investigates" });
        return;
      }
      if (kind === "claim") {
        if (index === 0) useUi.getState().openLeft("sources");
        else addCard("question", { from: id, edge: "investigates" });
        return;
      }
      if (kind === "evidence") {
        if (index === 0 && node.sourceId) {
          useUi.getState().setReview({
            sourceId: node.sourceId,
            step: "source",
            targetId: id,
            pickedLine: node.sourceLocator?.line ?? null,
            backTo: "source",
          });
          useUi.getState().openPanel("review");
        } else {
          useUi.getState().select([id]);
          useUi.getState().openPanel("inspector");
          useUi.getState().setInspTab("links");
        }
        return;
      }
      if (kind === "question") {
        if (index === 0) useUi.getState().openLeft("sources");
        else {
          useUi.getState().select([id]);
          useUi.getState().openPanel("inspector");
          useUi.getState().setInspTab("links");
        }
        return;
      }
      if (kind === "solution") {
        if (index === 0) {
          useUi.getState().select([id]);
          useUi.getState().openPanel("decision");
        } else useUi.getState().openLeft("sources");
        return;
      }
      if (kind === "decision") {
        if (index === 0) {
          useUi.getState().select([id]);
          useUi.getState().openPanel("decision");
        } else router.push(`/think/${pid}/handoff`);
        return;
      }
      useUi.getState().select([id]);
      useUi.getState().openPanel("inspector");
      useUi.getState().setInspTab(index === 1 ? "links" : "content");
    },
    [pid, addCard, router],
  );

  /* ── 키보드 ── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing = /^(INPUT|TEXTAREA)$/.test(el?.tagName ?? "") || el?.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useUi.getState().setCmdk(!useUi.getState().cmdk);
        return;
      }
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        const ok = e.shiftKey ? store().redoStep(pid) : store().undoStep(pid);
        if (!ok) toast(e.shiftKey ? "다시 실행할 변경이 없어요" : "되돌릴 변경이 없어요");
        return;
      }
      if (e.key === "Escape" && !typing) {
        useUi.getState().escape();
        setIssuePanel(null);
        return;
      }
      if (typing) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (!useUi.getState().sel.length) return;
        e.preventDefault();
        deleteSelected();
        return;
      }

      if (e.key === "v" || e.key === "V") useUi.getState().setTool("select");
      if (e.key === "h" || e.key === "H") useUi.getState().setTool("hand");
      if (e.key === "n" || e.key === "N") useUi.getState().setTool("add");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pid, store, deleteSelected]);

  if (!hydrated) return <div className="p-10 text-[14px] text-muted">불러오는 중…</div>;
  if (!project || !doc)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-[14px] text-muted">이 프로젝트를 찾을 수 없어요.</p>
        <button onClick={() => router.push("/dashboard")} className="text-[14px] text-brand underline">
          처음으로
        </button>
      </div>
    );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas">
      <WorkspaceHeader
        project={project}
        phase={phase}
        save={ui.save}
        aiOff={ui.aiOff}
        issues={issues}
        conflicts={conflicts}
        view="canvas"
        onPhase={(p: Phase) => useUi.getState().setPhase(p)}
        onIssues={() => setIssuePanel(issuePanel === "issues" ? null : "issues")}
        onConflicts={() => setIssuePanel(issuePanel === "conflicts" ? null : "conflicts")}
        onHandoff={() => router.push(`/think/${pid}/handoff`)}
        onBack={() => router.push(`/think/${pid}`)}
      />

      <div className="relative flex min-h-0 flex-1">
        <LeftRail
          phase={phase}
          open={ui.leftPanel}
          grid={ui.grid}
          onOpen={(p) => useUi.getState().openLeft(p)}
          onGrid={(v) => useUi.getState().setGrid(v)}
          onAction={runAction}
        />

        <AnimatePresence mode="wait">
          {ui.leftPanel && (
            <LeftPanelView
              key={ui.leftPanel}
              pid={pid}
              panel={ui.leftPanel}
              onFiles={(f) => void addFiles(f)}
              onFocusNode={(id) => {
                useUi.getState().select([id]);
                useUi.getState().openPanel("inspector");
                useUi.getState().requestCenter(id);
              }}
            />
          )}
        </AnimatePresence>

        <Canvas
          pid={pid}
          onOpenNode={(id) => {
            useUi.getState().select([id]);
            useUi.getState().openPanel("inspector");
          }}
          onNodeAction={onNodeAction}
          onAddFromSuggestion={(what) => {
            if (what === "claim") addCard("claim", { from: "P-01", edge: "investigates" });
            else if (what === "question") addCard("question", { from: "P-01", edge: "investigates" });
            else useUi.getState().openLeft("sources");
          }}
          onSourceClick={(sourceId, targetId) => {
            // 카드 위에 놓으면 그 카드에 붙인다. 어느 경우든 자료 패널(제목·미리보기·요약)만 연다.
            if (targetId) store().patchSource(pid, sourceId, { attachedTo: targetId });
            useUi.getState().select([sourceId]);
            useUi.getState().openPanel("source");
          }}
          onFilesDropped={(files, at, target) => void addFiles(files, at, target)}
          onPlaceBlock={(at) => {
            addCard("note", { at });
            useUi.getState().setTool("select");
          }}
          onDeleteSelected={deleteSelected}
          onFork={forkSelection}
        />

        {project.tutorial && <TutorialGuide pid={pid} />}

        <Toolbar
          tool={ui.tool}
          zoom={ui.zoom}
          phase={phase}
          canUndo={doc.undo.length > 0}
          canRedo={doc.redo.length > 0}
          onTool={(t) => useUi.getState().setTool(t)}
          onUndo={() => {
            if (!store().undoStep(pid)) toast("되돌릴 변경이 없어요");
          }}
          onRedo={() => {
            if (!store().redoStep(pid)) toast("다시 실행할 변경이 없어요");
          }}
          onTidy={() => useUi.getState().requestTidy()}
          showEdges={ui.showEdges}
          onToggleEdges={() => useUi.getState().setShowEdges(!ui.showEdges)}
          onZoom={(z) => useUi.getState().requestZoom(z)}
          hasSelection={ui.sel.length > 0}
          onFit={() => useUi.getState().requestFit()}
          onAction={(key) => {
            if (SPOTLIGHT_KEYS.includes(key)) spotlight(key);
            runAction(key);
          }}
          spotlightKey={ui.spotlight?.key ?? null}
          onAddKind={(kind) => addCard(kind)}
        />

        <AnimatePresence mode="wait">
          {ui.panel === "inspector" && <Inspector key="inspector" pid={pid} />}
          {ui.panel === "source" && <SourcePanel key="source" pid={pid} />}
          {ui.panel === "review" && <ReviewPanel key="review" pid={pid} />}
          {ui.panel === "decision" && <DecisionPanel key="decision" pid={pid} />}
          {ui.panel === "refine" && <RefinePanel key="refine" pid={pid} />}
        </AnimatePresence>

        {issuePanel && (
          <IssuePanel
            pid={pid}
            mode={issuePanel}
            issues={issues}
            conflicts={conflicts}
            onClose={() => setIssuePanel(null)}
          />
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".md,.markdown,.txt,.text,.csv,.json,.log,.pdf"
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) void addFiles(files);
        }}
      />

      <AnimatePresence>{ui.wide && <WideEditor key="wide" pid={pid} />}</AnimatePresence>

      <CommandMenu pid={pid} onAdd={(k) => addCard(k)} />
    </div>
  );
}
