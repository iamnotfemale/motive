"use client";

/**
 * S02·S03 추론 워크스페이스.
 *
 * 보조 패널은 한 번에 하나만 연다. 상시 AI 채팅 칼럼을 만들지 않는다 (스펙 §30.5).
 */
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Canvas } from "@/components/canvas/Canvas";
import { SOURCE_W } from "@/components/canvas/SourceChip";
import { ActionDock, ToolRail } from "@/components/ActionDock";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { Inspector } from "@/components/panels/Inspector";
import { ReviewPanel } from "@/components/panels/ReviewPanel";
import { DecisionPanel } from "@/components/panels/DecisionPanel";
import { ColdStartPanel } from "@/components/panels/ColdStartPanel";
import { RefinePanel } from "@/components/panels/RefinePanel";
import { IssuePanel } from "@/components/panels/IssuePanel";
import { SourceShelf } from "@/components/panels/SourceShelf";
import { CommandMenu } from "@/components/CommandMenu";
import { extractFile } from "@/lib/extract";
import { summarize } from "@/lib/issues";
import { type Kind, kindOf } from "@/lib/labels";
import { nextFreeSpot, useDoc } from "@/lib/store";
import { blankMd } from "@/lib/templates";
import { flashSaved, useUi } from "@/lib/ui";
import type { Phase, Source } from "@/lib/types";

export default function Workspace({ params }: { params: Promise<{ id: string }> }) {
  const { id: pid } = use(params);
  const router = useRouter();

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // persist 가 localStorage 를 읽기 전에는 프로젝트가 없는 것처럼 보인다.
    const unsub = useDoc.persist.onFinishHydration(() => setHydrated(true));
    if (useDoc.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  const project = useDoc((s) => s.projects.find((p) => p.id === pid));
  const doc = useDoc((s) => s.docs[pid]);
  const store = useDoc.getState;
  const ui = useUi();

  const [issuePanel, setIssuePanel] = useState<"issues" | "conflicts" | null>(null);

  const { issues, conflicts } = useMemo(
    () => (doc ? summarize(doc) : { issues: [], conflicts: [] }),
    [doc],
  );

  useEffect(() => () => useUi.getState().reset(), [pid]);

  /* ── 키보드 ── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = /^(INPUT|TEXTAREA)$/.test((e.target as HTMLElement)?.tagName ?? "");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useUi.getState().setCmdk(!useUi.getState().cmdk);
        return;
      }
      if (e.key === "Escape" && !typing) {
        useUi.getState().escape();
        setIssuePanel(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ── 카드 만들기 ── */
  const addCard = useCallback(
    (kind: Kind, opts?: { from?: string; edge?: "investigates" | "based_on" | "produces" }) => {
      if (!doc) return;
      const near = opts?.from ? doc.placements[opts.from] : undefined;
      const at = nextFreeSpot(doc, near ?? { x: 72, y: 48 });
      const id = store().addNode(pid, { kind, md: blankMd(kind), at });
      if (opts?.from && opts.edge) store().addEdge(pid, { from: opts.from, to: id, type: opts.edge });
      useUi.getState().select([id]);
      useUi.getState().openPanel("inspector");
      useUi.getState().setInspTab("content");
      flashSaved();
      return id;
    },
    [doc, pid, store],
  );

  /* ── 자료 올리기: 파일 → 캔버스 아이콘 ── */
  const addFiles = useCallback(
    async (files: File[], at?: { x: number; y: number }, targetId?: string) => {
      if (!doc) return;
      let spot = at ?? nextFreeSpot(doc, { x: 72, y: 48 });
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
        useUi.getState().openPanel("shelf");
        return;
      }
      if (failed > 0)
        toast.warning(`${files.length}개 중 ${failed}개를 읽지 못했어요.`, {
          description: "읽은 자료는 그대로 쓸 수 있어요.",
        });

      // 읽은 자료가 하나면 바로 검토로 이어준다. 드롭한 카드가 있으면 그 카드가 대상이다.
      const readId = firstId;
      if (readId && files.length === 1 && !failed) {
        useUi.getState().setReview({
          sourceId: readId,
          step: targetId ? "consent" : "pick-target",
          targetId: targetId ?? null,
          pickedLine: null,
          backTo: "candidates",
        });
        useUi.getState().openPanel("review");
      }
    },
    [doc, pid, store],
  );

  /* ── 카드 액션 ── */
  const onNodeAction = useCallback(
    (id: string, index: 0 | 1) => {
      if (!doc) return;
      const node = doc.nodes.find((n) => n.id === id);
      if (!node) return;
      const kind = kindOf(node);

      if (kind === "problem") {
        if (index === 0) useUi.getState().openPanel("refine");
        else addCard("claim", { from: id, edge: "investigates" });
        return;
      }
      if (kind === "claim") {
        if (index === 0) useUi.getState().openPanel("shelf");
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
      if (kind === "solution") {
        if (index === 0) {
          useUi.getState().select([id]);
          useUi.getState().openPanel("decision");
        } else useUi.getState().openPanel("shelf");
        return;
      }
      if (kind === "decision") {
        if (index === 0) {
          useUi.getState().select([id]);
          useUi.getState().openPanel("decision");
        } else router.push(`/p/${pid}/handoff`);
        return;
      }
      useUi.getState().select([id]);
      useUi.getState().openPanel("inspector");
      useUi.getState().setInspTab(index === 1 ? "links" : "content");
    },
    [doc, addCard, pid, router],
  );

  if (!hydrated) return <div className="p-10 text-[13px] text-muted">불러오는 중…</div>;
  if (!project || !doc)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-[13px] text-muted">이 프로젝트를 찾을 수 없어요.</p>
        <button onClick={() => router.push("/")} className="text-[13px] text-brand underline">
          처음으로
        </button>
      </div>
    );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas">
      <WorkspaceHeader
        project={project}
        phase={ui.phase}
        save={ui.save}
        aiOff={ui.aiOff}
        issues={issues}
        conflicts={conflicts}
        view="canvas"
        onPhase={(p: Phase) => useUi.getState().setPhase(p)}
        onIssues={() => setIssuePanel(issuePanel === "issues" ? null : "issues")}
        onConflicts={() => setIssuePanel(issuePanel === "conflicts" ? null : "conflicts")}
        onHandoff={() => router.push(`/p/${pid}/handoff`)}
        onBack={() => router.push(`/p/${pid}`)}
      />

      <div className="relative flex min-h-0 flex-1">
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
            else if (what === "source") useUi.getState().openPanel("shelf");
            else useUi.getState().openPanel("coldstart");
          }}
          onSourceClick={(sourceId, targetId) => {
            const s = doc.sources.find((x) => x.id === sourceId);
            useUi.getState().setReview({
              sourceId,
              step: s?.state === "read" ? (targetId ? "consent" : "pick-target") : "reading",
              targetId: targetId ?? null,
              pickedLine: null,
              backTo: "candidates",
            });
            useUi.getState().openPanel("review");
          }}
          onFilesDropped={(files, at, target) => void addFiles(files, at, target)}
        />

        <ToolRail
          shelfOpen={ui.panel === "shelf"}
          onShelf={() => useUi.getState().openPanel(ui.panel === "shelf" ? null : "shelf")}
          onSearch={() => useUi.getState().setCmdk(true)}
          onAdd={() => addCard("note")}
        />

        <ActionDock
          zoom={ui.zoom}
          shelfOpen={ui.panel === "shelf"}
          onAdd={(kind) => addCard(kind)}
          onAttachFile={(files) => void addFiles(files)}
          onTidy={() => toast("정리는 다음 단계예요. 지금은 배치를 건드리지 않아요.")}
          onZoom={(z) => useUi.getState().setZoom(z)}
          onFit={() => {
            useUi.getState().setZoom(1);
            useUi.getState().setPan({ x: 0, y: 0 });
          }}
        />

        <AnimatePresence mode="wait">
          {ui.panel === "inspector" && <Inspector key="inspector" pid={pid} />}
          {ui.panel === "review" && <ReviewPanel key="review" pid={pid} />}
          {ui.panel === "decision" && <DecisionPanel key="decision" pid={pid} />}
          {ui.panel === "coldstart" && <ColdStartPanel key="coldstart" pid={pid} />}
          {ui.panel === "refine" && <RefinePanel key="refine" pid={pid} />}
        </AnimatePresence>

        {ui.panel === "shelf" && <SourceShelf pid={pid} onAttachFile={(f) => void addFiles(f)} />}

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

      <CommandMenu pid={pid} onAdd={(k) => addCard(k)} />
    </div>
  );
}
