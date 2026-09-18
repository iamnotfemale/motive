"use client";

/**
 * S06 결정과 범위. 이 제품의 핵심 값이 여기 담긴다 (스펙 §16).
 *
 * 결정은 사람이 명시적으로 확정할 때만 생긴다. AI 제안이 결정으로 바뀌지 않는다 (스펙 §5.3).
 * 기각 대안 / 기각 이유 / 재검토 조건은 빼지 않는다 — 코딩 에이전트가 이미 버린 길을 다시 제안하지 않게 한다.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge, Btn, Dot, FieldLabel, Mono, TypeIcon } from "@/components/kit";
import { PanelClose, SidePanel } from "./Panel";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KIND, SCOPE_KO, kindOf } from "@/lib/labels";
import { parseMd, serializeMd } from "@/lib/md";
import { findNode, nextFreeSpot, nodeTitle, useDoc } from "@/lib/store";
import { flashSaved, useUi } from "@/lib/ui";
import type { ReqScope } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DecisionPanel({ pid }: { pid: string }) {
  const doc = useDoc((s) => s.docs[pid]);
  const store = useDoc.getState;
  const ui = useUi();
  const selId = ui.sel[0];
  const selected = doc && selId ? findNode(doc, selId) : undefined;

  // 결정 카드를 직접 열었으면 그 결정, 해결안을 열었으면 그 해결안에 딸린 결정.
  const decision = useMemo(() => {
    if (!doc || !selected) return undefined;
    if (selected.type === "decision") return selected;
    const edge = doc.edges.find(
      (e) => e.to === selected.id && e.type === "produces" && !e.rejected && !e.hold,
    );
    return edge ? findNode(doc, edge.from) : undefined;
  }, [doc, selected]);

  const adopted = useMemo(() => {
    if (!doc) return undefined;
    if (decision) {
      const e = doc.edges.find(
        (x) => x.from === decision.id && x.type === "produces" && !x.rejected && !x.hold,
      );
      const n = e ? findNode(doc, e.to) : undefined;
      if (n && kindOf(n) === "solution") return n;
    }
    return selected && kindOf(selected) === "solution" ? selected : undefined;
  }, [doc, decision, selected]);

  const confirmed = Boolean(decision);

  const alternatives = useMemo(
    () =>
      (doc?.nodes ?? []).filter(
        (n) => kindOf(n) === "solution" && n.id !== adopted?.id,
      ),
    [doc, adopted],
  );

  const questions = useMemo(() => (doc?.nodes ?? []).filter((n) => n.type === "question"), [doc]);

  const [reason, setReason] = useState("");
  const [revisit, setRevisit] = useState("");
  const [altState, setAltState] = useState<Record<string, "reject" | "hold">>({});
  const [risks, setRisks] = useState<Record<string, boolean>>({});
  const [newQ, setNewQ] = useState("");
  const [reqAction, setReqAction] = useState("");
  const [reqAc, setReqAc] = useState("");

  if (!doc || !adopted) return null;

  const requirements = decision
    ? doc.edges
        .filter((e) => e.from === decision.id && e.type === "produces")
        .map((e) => findNode(doc, e.to))
        .filter((n) => n && kindOf(n) === "requirement")
    : [];

  function confirm() {
    if (!adopted) return;
    if (!reason.trim()) {
      toast.warning("결정 이유를 적어주세요.", { description: "나중에 왜 그렇게 정했는지 남는 부분이에요." });
      return;
    }
    if (!revisit.trim()) {
      toast.warning("재검토 조건을 적어주세요.", {
        description: "언제 이 결정을 다시 볼지가 인계 문서에 그대로 들어가요.",
      });
      return;
    }

    const rejected = alternatives.filter((a) => altState[a.id]);
    const acked = questions.filter((q) => risks[q.id]);

    const md = [
      "# " + (adopted ? nodeTitle(adopted) : ""),
      "",
      "## 선택한 해결안",
      `${adopted.id} ${nodeTitle(adopted)}`,
      "",
      "## 이유",
      reason.trim(),
      "",
      "## 기각 대안",
      rejected.length
        ? rejected
            .map((a) => `- ${a.id} ${nodeTitle(a)} — ${altState[a.id] === "hold" ? "보류" : "기각"}`)
            .join("\n")
        : "(아직 없음)",
      "",
      "## 재검토 조건",
      revisit
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => `- ${l}`)
        .join("\n"),
      "",
      "## 열린 질문·위험",
      [
        ...acked.map((q) => `- ${q.id} ${nodeTitle(q)} — 미검증이지만 이번 범위에서 시도`),
        ...(newQ.trim() ? [`- ${newQ.trim()}`] : []),
      ].join("\n") || "(아직 없음)",
      "",
    ].join("\n");

    const at = nextFreeSpot(doc!, doc!.placements[adopted.id] ?? { x: 72, y: 48 });
    const did = store().addNode(pid, { kind: "decision", md, at, node: { status: "confirmed" } });

    store().addEdge(pid, { from: did, to: adopted.id, type: "produces" });
    store().patchNode(pid, adopted.id, { status: "adopted" });

    for (const a of rejected) {
      const hold = altState[a.id] === "hold";
      store().addEdge(pid, { from: did, to: a.id, type: "produces", ...(hold ? { hold: true } : { rejected: true }) });
      store().patchNode(pid, a.id, { status: hold ? "held" : "rejected" });
    }

    // 결정이 무엇을 근거로 삼았는지 남긴다. 근거 없는 결정은 인계에서 걸린다.
    for (const e of doc!.edges) {
      if (e.to === adopted.id && (e.type === "based_on" || e.type === "supports"))
        store().addEdge(pid, { from: did, to: e.from, type: "based_on" });
    }
    for (const q of acked) store().addEdge(pid, { from: did, to: q.id, type: "based_on" });

    if (newQ.trim()) {
      const qid = store().addNode(pid, {
        kind: "question",
        md: `# ${newQ.trim()}\n\n## 상태\n열림\n`,
        at: nextFreeSpot(doc!, at),
        node: { status: "open" },
      });
      store().addEdge(pid, { from: did, to: qid, type: "based_on" });
    }

    flashSaved();
    useUi.getState().select([did]);
    toast(`${did} 결정을 확정했어요`, { description: "기각 대안과 재검토 조건이 함께 남았어요" });
  }

  function addRequirement() {
    if (!decision) return;
    if (!reqAction.trim()) {
      toast.warning("사용자가 무엇을 할 수 있어야 하는지 적어주세요.");
      return;
    }
    const criteria = reqAc
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const md = [
      "# " + reqAction.trim(),
      "",
      "## 사용자 행동",
      reqAction.trim(),
      "",
      "## 수용 기준",
      criteria.length ? criteria.map((c) => `- [ ] ${c}`).join("\n") : "(아직 없음)",
      "",
      "## 범위",
      SCOPE_KO.mvp,
      "",
      "## 연결된 결정",
      decision.id,
      "",
    ].join("\n");

    const at = nextFreeSpot(doc!, doc!.placements[decision.id] ?? { x: 72, y: 48 });
    const rid = store().addNode(pid, { kind: "requirement", md, at, node: { scope: "mvp" } });
    store().addEdge(pid, { from: decision.id, to: rid, type: "produces" });
    setReqAction("");
    setReqAc("");
    flashSaved();
    toast(`${rid} 요구사항을 추가했어요`);
  }

  return (
    <SidePanel testId="decision">
      <div className="flex items-center gap-2 border-b border-line px-5 py-4">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted">
          <TypeIcon d={KIND.decision.icon} />
          결정
        </span>
        {decision && <Mono>{decision.id}</Mono>}
        <Badge tone={confirmed ? "ok" : "warn"}>{confirmed ? "확정" : "초안"}</Badge>
        <span className="flex-1" />
        <PanelClose onClose={() => useUi.getState().closePanel()} />
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto px-5 py-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>선택한 해결안</FieldLabel>
          <div className="flex items-start gap-2.5 rounded-[6px] border border-line p-3">
            <Mono className="mt-0.5">{adopted.id}</Mono>
            <span className="kr flex-1 text-[14px] leading-5">{nodeTitle(adopted)}</span>
            {confirmed && <span className="shrink-0 text-[13px] text-ok">채택</span>}
          </div>
        </div>

        {confirmed ? (
          <ConfirmedBody decision={decision!} />
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>결정 이유</FieldLabel>
              <textarea
                value={reason}
                rows={3}
                onChange={(e) => setReason(e.target.value)}
                placeholder="왜 이 해결안을 골랐나요?"
                className="kr w-full resize-none rounded-[6px] border border-line bg-surface px-3 py-2.5 text-[14px] leading-[23px] transition-[border-color,box-shadow] duration-[120ms] focus:border-brand focus:shadow-[0_0_0_3px_#f4f4f5]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel>기각 대안</FieldLabel>
              {alternatives.length === 0 && (
                <p className="rounded-[6px] border border-dashed border-line p-3 text-center text-[14px] text-muted">
                  검토한 다른 해결안이 없어요. 대안 없이 정한 결정으로 남아요.
                </p>
              )}
              {alternatives.map((a) => (
                <div key={a.id} className="flex items-center gap-2.5 rounded-[6px] border border-line p-3">
                  <Mono>{a.id}</Mono>
                  <span className="kr min-w-0 flex-1 text-[14px] leading-5">{nodeTitle(a)}</span>
                  <Select
                    value={altState[a.id] ?? "none"}
                    onValueChange={(v) =>
                      setAltState((s) =>
                        v === "none"
                          ? Object.fromEntries(Object.entries(s).filter(([k]) => k !== a.id))
                          : { ...s, [a.id]: v as "reject" | "hold" },
                      )
                    }
                  >
                    <SelectTrigger size="sm" className="w-[88px] shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">그대로</SelectItem>
                      <SelectItem value="reject">기각</SelectItem>
                      <SelectItem value="hold">보류</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel>재검토 조건</FieldLabel>
              <textarea
                value={revisit}
                rows={2}
                onChange={(e) => setRevisit(e.target.value)}
                placeholder="무엇이 나오면 이 결정을 다시 보나요?"
                className="kr w-full resize-none rounded-[6px] border border-line bg-surface px-3 py-2.5 text-[14px] leading-[23px] focus:border-brand focus:shadow-[0_0_0_3px_#f4f4f5]"
              />
              <span className="text-[13px] text-muted">줄마다 하나의 조건</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel>열린 질문 · 위험 인지</FieldLabel>
              {questions.map((q) => (
                <label
                  key={q.id}
                  className="flex cursor-pointer items-start gap-2.5 rounded-[6px] border border-line p-3"
                >
                  <Checkbox
                    checked={Boolean(risks[q.id])}
                    onCheckedChange={(v) => setRisks((s) => ({ ...s, [q.id]: Boolean(v) }))}
                    className="mt-0.5"
                  />
                  <span className="flex flex-col gap-0.5 text-[14px] leading-[19px]">
                    <span className="kr">
                      <Mono className="mr-1.5">{q.id}</Mono>
                      {nodeTitle(q)}
                    </span>
                    <span className="text-warn">
                      미검증이지만 이번 범위에서 시도 — 검증됐다는 뜻은 아니에요.
                    </span>
                  </span>
                </label>
              ))}
              <div className="flex h-10 items-center gap-2 rounded-[6px] border border-dashed border-line px-3">
                <span className="text-faint">+</span>
                <input
                  value={newQ}
                  onChange={(e) => setNewQ(e.target.value)}
                  placeholder="새 열린 질문 남기기"
                  className="flex-1 border-0 bg-transparent text-[14px] text-ink"
                />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-line px-5 py-3">
        {confirmed ? (
          <>
            <span className="inline-flex flex-1 items-center gap-1.5 text-[13px] text-ok">
              <Dot tone="ok" />
              결정을 확정했어요
            </span>
            <Btn variant="ink" onClick={() => toast("헤더의 `개발 인계`에서 내보낼 수 있어요")}>
              인계에 포함
            </Btn>
          </>
        ) : (
          <>
            <span className="flex-1 text-[13px] text-muted">초안은 저장되지 않아요</span>
            <Btn onClick={() => useUi.getState().closePanel()}>나중에</Btn>
            <Btn variant="ink" onClick={confirm}>
              결정 확정
            </Btn>
          </>
        )}
      </div>

      {confirmed && decision && (
        <RequirementForm
          pid={pid}
          decisionId={decision.id}
          requirements={requirements.filter(Boolean) as NonNullable<(typeof requirements)[number]>[]}
          action={reqAction}
          criteria={reqAc}
          onAction={setReqAction}
          onCriteria={setReqAc}
          onAdd={addRequirement}
        />
      )}
    </SidePanel>
  );
}

function ConfirmedBody({ decision }: { decision: NonNullable<ReturnType<typeof findNode>> }) {
  const parsed = parseMd(decision.md);
  return (
    <div className="flex flex-col gap-4">
      {parsed.sections
        .filter((s) => s.h !== "선택한 해결안")
        .map((s) => (
          <div key={s.h} className="flex flex-col gap-1.5">
            <FieldLabel>{s.h}</FieldLabel>
            <p className="kr rounded-[6px] border border-line bg-wash-2 px-3 py-2.5 text-[14px] leading-[23px] whitespace-pre-wrap">
              {s.body || "(아직 없음)"}
            </p>
          </div>
        ))}
      <p className="text-[13px] leading-[19px] text-muted">
        확정한 결정은 카드에서 편집해요. 여기서는 읽기만 해요.
      </p>
      <span className="hidden">{serializeMd(parsed).length}</span>
    </div>
  );
}

function RequirementForm({
  pid,
  decisionId,
  requirements,
  action,
  criteria,
  onAction,
  onCriteria,
  onAdd,
}: {
  pid: string;
  decisionId: string;
  requirements: NonNullable<ReturnType<typeof findNode>>[];
  action: string;
  criteria: string;
  onAction: (v: string) => void;
  onCriteria: (v: string) => void;
  onAdd: () => void;
}) {
  const patchNode = useDoc((s) => s.patchNode);
  return (
    <div className="flex max-h-[46%] flex-col gap-3 overflow-auto border-t border-line px-5 py-4 animate-fade-up">
      <div className="font-semibold">요구사항</div>

      {requirements.map((r) => {
        const ac = parseMd(r.md).sections.find((s) => s.h === "수용 기준");
        const count = ac ? ac.body.split("\n").filter((l) => l.trim().startsWith("- ")).length : 0;
        return (
          <div key={r.id} className="flex flex-col gap-2 rounded-[6px] border border-line p-3">
            <div className="flex items-start gap-2">
              <Mono className="mt-0.5">{r.id}</Mono>
              <span className="kr flex-1 text-[14px] leading-5">{nodeTitle(r)}</span>
            </div>
            <div className="flex items-center gap-2 text-[13px] text-muted">
              <span>수용 기준 {count}</span>
              <span className="flex-1" />
              <Select
                value={r.scope ?? "mvp"}
                onValueChange={(v) => patchNode(pid, r.id, { scope: v as ReqScope })}
              >
                <SelectTrigger size="sm" className="w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SCOPE_KO) as ReqScope[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {SCOPE_KO[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      })}

      <div className="flex flex-col gap-2.5 rounded-[6px] border border-line bg-wash-2 p-3">
        <label className="flex flex-col gap-1">
          <span className="text-[14px] font-medium">사용자가 무엇을 할 수 있어야 하나요?</span>
          <input
            value={action}
            onChange={(e) => onAction(e.target.value)}
            className="h-8 rounded-[6px] border border-line bg-surface px-2.5 text-[14px] focus:border-brand"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[14px] font-medium">완료됐다고 판단할 기준은 무엇인가요?</span>
          <textarea
            value={criteria}
            rows={2}
            onChange={(e) => onCriteria(e.target.value)}
            className="kr resize-none rounded-[6px] border border-line bg-surface px-2.5 py-2 text-[14px] leading-5 focus:border-brand"
          />
          <span className="text-[13px] text-muted">줄마다 하나의 기준</span>
        </label>
        <div className="flex justify-end">
          <Btn variant="ink" onClick={onAdd}>
            요구사항 추가
          </Btn>
        </div>
      </div>

      <p className={cn("text-[13px] leading-[19px] text-muted")}>
        요구사항이 생겨도 시장 검증이나 개발 완료를 뜻하지 않아요. 미검증 상태는 인계 문서에 그대로 남아요.
      </p>
      <span className="hidden">{decisionId}</span>
    </div>
  );
}
