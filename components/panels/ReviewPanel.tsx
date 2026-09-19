"use client";

/**
 * CMP-09 자료 검토. 폭 440. 이 제품의 대표 인터랙션이다.
 *
 * 드롭 ≠ 근거. 드롭은 원문 저장까지다. 후보는 동의 후에 생기고,
 * 사람이 `근거로 추가` 를 눌러야만 실선 Evidence 카드와 관계가 만들어진다 (핸드오프 §7).
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge, Btn, Dot, FieldLabel, Indeterminate, Mono, Notice } from "@/components/kit";
import { PanelClose, SidePanel } from "./Panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { proposeEvidence } from "@/lib/ai";
import { linesOf } from "@/lib/extract";
import { EDGE_OPTIONS, KIND, kindOf } from "@/lib/labels";
import { findNode, nodeTitle, useDoc } from "@/lib/store";
import { REVIEW_STEPS, flashSaved, useUi, type ReviewStep } from "@/lib/ui";
import type { EdgeType } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 패널 상단 스텝 인디케이터에서 지금 어디인지 표시할 단계 번호. */
const STEP_INDEX: Record<ReviewStep, number> = {
  reading: 2,
  "pick-target": 2,
  analyzing: 4,
  candidates: 5,
  source: 5,
  attached: 2,
};

export function ReviewPanel({ pid }: { pid: string }) {
  const doc = useDoc((s) => s.docs[pid]);
  const store = useDoc.getState;
  const ui = useUi();
  const review = ui.review;
  const [busy, setBusy] = useState(false);
  // 직접 고른 인용의 관계. 기본을 `지지` 로 두되 추가 전에 반드시 보이게 한다.
  const [pickedRel, setPickedRel] = useState<EdgeType>("supports");

  const source = doc?.sources.find((s) => s.id === review?.sourceId);
  const candidates = (doc?.candidates ?? []).filter((c) => c.sourceId === review?.sourceId);
  const target = review?.targetId && doc ? findNode(doc, review.targetId) : undefined;


  const analyze = useCallback(async (targetId: string | null = review?.targetId ?? null) => {
    if (!doc || !review || !source) return;
    setBusy(true);
    useUi.getState().patchReview({ step: "analyzing", targetId });
    const res = await proposeEvidence(source.id, source.text, doc.nodes);
    setBusy(false);

    if (!res.ok) {
      if (res.aiOff) useUi.getState().setAiOff(true);
      useUi.getState().patchReview({
        step: "attached",
        notice: {
          text: res.aiOff
            ? "AI가 연결되지 않았어요. 원문에서 직접 근거를 선택할 수 있어요."
            : res.message,
        },
      });
      return;
    }

    // 대상이 지정돼 있으면 그 카드에 붙는 후보만 남긴다.
    const list = targetId ? res.data.filter((c) => c.targetId === targetId) : res.data;
    store().setCandidates(pid, [
      ...(doc.candidates ?? []).filter((c) => c.sourceId !== source.id),
      ...list,
    ]);
    useUi.getState().patchReview({ step: "candidates" });
  }, [doc, review, source, pid, store]);

  // 자료를 아직 읽는 중이면 읽기가 끝나는 순간 다음 단계로 넘어간다.
  useEffect(() => {
    if (!review || !source) return;
    if (review.step !== "reading") return;
    if (source.state === "read") {
      if (review.targetId) void analyze(review.targetId);
      else useUi.getState().patchReview({ step: "pick-target" });
    }
    if (source.state === "no-text" || source.state === "failed")
      useUi.getState().patchReview({
        step: "attached",
        notice: { text: "이 자료에서 읽을 텍스트를 찾지 못했어요." },
      });
  }, [review, source, analyze]);

  if (!doc || !review || !source) return null;

  const stepNow = STEP_INDEX[review.step];
  const lines = linesOf(source.text);

  return (
    <SidePanel width={440} testId="review">
      <div className="flex flex-col gap-3 border-b border-line px-5 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold">자료 검토</span>
          <span
            className="max-w-[180px] truncate font-mono text-[13px] text-muted"
            title={source.name}
          >
            {source.name}
          </span>
          {source.tag && <Badge>{source.tag}</Badge>}
          <span className="flex-1" />
          <PanelClose onClose={() => useUi.getState().closePanel()} />
        </div>
        <ol className="flex flex-wrap gap-x-1.5 gap-y-1">
          {REVIEW_STEPS.map((label, i) => {
            const n = i + 1;
            const done = n < stepNow;
            const on = n === stepNow;
            return (
              <li
                key={label}
                className={cn(
                  "inline-flex items-center gap-1 text-[12px] leading-4",
                  on ? "font-semibold text-ink" : done ? "text-muted" : "text-faint",
                )}
              >
                <span className="font-mono">{String(n).padStart(2, "0")}</span>
                {label}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-auto px-5 py-4">
        {review.notice && (
          <Notice
            tone="warn"
            actions={
              <Btn
                size="sm"
                onClick={() =>
                  useUi.getState().patchReview({ step: "source", backTo: "attached", notice: undefined })
                }
              >
                원문 열기
              </Btn>
            }
          >
            {review.notice.text}
          </Notice>
        )}

        {review.step === "reading" && (
          <div className="flex flex-col gap-2.5 rounded-[8px] border border-line p-4">
            <div className="flex items-center gap-2 text-[14px]">
              <span className="font-medium">자료 읽는 중</span>
              <span className="flex-1" />
              <span className="text-[13px] text-ok">파일 저장됨</span>
            </div>
            <Indeterminate />
            <p className="text-[13px] text-muted">진행률을 알 수 없어 표시하지 않아요.</p>
          </div>
        )}

        {review.step === "pick-target" && (
          <div className="flex flex-col gap-2.5 rounded-[8px] border border-line p-4">
            <div className="font-semibold">자료함에 추가했어요</div>
            <p className="text-[14px] leading-5 text-muted">
              연결 대상을 고르세요. 나중에 골라도 자료는 그대로 남아요.
            </p>
            <div className="flex flex-col gap-1">
              {doc.nodes
                .filter((n) => n.type !== "note" && n.type !== "evidence")
                .map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    aria-label={`${KIND[kindOf(n)].ko} ${n.id} ${nodeTitle(n)}`}
                    onClick={() => void analyze(n.id)}
                    className={cn(
                      "flex h-10 items-center gap-2 rounded-[6px] border border-line bg-surface px-3 text-left text-[14px] hover:border-brand hover:bg-wash",
                      ui.hint === n.id && "hint-pulse",
                    )}
                  >
                    <Mono>{n.id}</Mono>
                    <span className="min-w-0 flex-1 truncate">{nodeTitle(n)}</span>
                    <span className="shrink-0 text-[13px] text-muted">{KIND[kindOf(n)].ko}</span>
                  </button>
                ))}
            </div>
            <Btn
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => useUi.getState().patchReview({ step: "source", backTo: "pick-target" })}
            >
              원문부터 보기
            </Btn>
          </div>
        )}

        {review.step === "analyzing" && (
          <div className="flex flex-col gap-2.5 rounded-[8px] border border-line p-4">
            <div className="text-[14px] font-medium">근거 후보를 찾는 중</div>
            <Indeterminate />
            <p className="text-[13px] text-muted">
              찾은 인용은 원문과 한 번 더 대조해요. 대조에 실패하면 승인할 수 없게 표시돼요.
            </p>
          </div>
        )}

        {review.step === "attached" && (
          <div className="flex flex-col gap-2.5 rounded-[8px] border border-line p-4">
            <p className="text-[14px] leading-5">첨부만 유지했어요. 원문에서 직접 근거를 고를 수 있어요.</p>
            <div className="flex gap-2">
              <Btn onClick={() => useUi.getState().patchReview({ step: "source", backTo: "attached" })}>
                원문 열기
              </Btn>
              <Btn variant="ghost" onClick={() => void analyze()} disabled={ui.aiOff || busy}>
                나중에 후보 찾기
              </Btn>
            </div>
          </div>
        )}

        {review.step === "candidates" && (
          <>
            {candidates.length === 0 && (
              <div className="flex flex-col items-start gap-2.5 rounded-[8px] border border-dashed border-line p-4">
                <p className="text-[14px] leading-5">
                  관련 근거를 찾지 못했어요. 원문에서 직접 선택할 수 있어요.
                </p>
                <Btn onClick={() => useUi.getState().patchReview({ step: "source", backTo: "candidates" })}>
                  원문에서 직접 선택
                </Btn>
              </div>
            )}

            {candidates.map((c) => {
              const t = findNode(doc, c.targetId);
              const done = c.state !== "pending";
              return (
                <div
                  key={c.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-[8px] border p-4 animate-fade-up",
                    c.state === "approved"
                      ? "border-line bg-wash-2"
                      : c.state === "excluded"
                        ? "border-line opacity-60"
                        : c.mismatch
                          ? "border-[#fecdca]"
                          : "border-line",
                  )}
                >
                  <div className="flex items-center gap-2 text-[13px] leading-4">
                    <span className="font-semibold">근거 후보</span>
                    <Badge tone={c.state === "approved" ? "ok" : c.mismatch ? "danger" : "warn"}>
                      {c.state === "approved" ? "승인됨" : c.state === "excluded" ? "제외됨" : "미확정"}
                    </Badge>
                    <span className="flex-1" />
                    <span className="font-mono text-muted">
                      {source.name} · 줄 {c.line}
                    </span>
                  </div>

                  <div className="flex gap-2 rounded-[6px] bg-wash px-3 py-2.5">
                    <span className="shrink-0 font-serif text-[19px] leading-[23px] text-faint">“</span>
                    <p className="kr text-[14px] leading-[23px] text-ink">
                      {c.quote}
                      <span className="ml-1.5 text-[12px] text-muted">원문 인용</span>
                    </p>
                  </div>

                  {c.mismatch && (
                    <div className="flex items-center gap-2.5 text-[13px] leading-4 text-danger">
                      <Dot tone="danger" />
                      <span className="flex-1">제안된 인용을 원문에서 확인하지 못했어요.</span>
                      <Btn
                        size="xs"
                        onClick={() =>
                          useUi.getState().patchReview({ step: "source", backTo: "candidates" })
                        }
                      >
                        원문 확인
                      </Btn>
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <FieldLabel>
                      해석 <span className="font-normal text-faint">AI 작성</span>
                    </FieldLabel>
                    <p className="kr text-[14px] leading-5 text-ink">{c.claim}</p>
                    <p className="kr text-[14px] leading-5 text-muted">{c.limit}</p>
                  </div>

                  <div className="grid grid-cols-[64px_1fr] items-center gap-x-2.5 gap-y-1.5 text-[14px] leading-5">
                    <span className="text-muted">연결 대상</span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Mono>{c.targetId}</Mono>
                      <span className="truncate">{t ? nodeTitle(t) : c.targetId}</span>
                    </span>
                    <span className="text-muted">관계</span>
                    <Select
                      value={c.edgeType}
                      disabled={done}
                      onValueChange={(v) =>
                        store().patchCandidate(pid, c.id, { edgeType: v as EdgeType })
                      }
                    >
                      <SelectTrigger size="sm" className="w-auto justify-self-start">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EDGE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.ko}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {c.state === "pending" && (
                    <div className="flex items-center gap-1.5">
                      <Btn
                        variant="ghost"
                        size="sm"
                        className="text-ink hover:text-ink"
                        onClick={() =>
                          useUi.getState().patchReview({ step: "source", backTo: "candidates" })
                        }
                      >
                        원문 보기
                      </Btn>
                      <span className="flex-1" />
                      <Btn
                        size="sm"
                        onClick={() => store().patchCandidate(pid, c.id, { state: "excluded" })}
                      >
                        제외
                      </Btn>
                      <Btn
                        variant="ink"
                        size="sm"
                        disabled={c.mismatch}
                        className={cn(ui.hint === c.targetId && c.edgeType === "contradicts" && "hint-pulse")}
                        onClick={() => {
                          const newId = store().approveCandidate(pid, c.id);
                          if (!newId) return;
                          flashSaved();
                          useUi.getState().requestCenter(newId);
                          const rel = EDGE_OPTIONS.find((o) => o.value === c.edgeType)?.ko ?? "관계";
                          toast(`${newId} 근거로 추가했어요`, { description: `${rel} 관계를 만들었어요` });
                        }}
                      >
                        근거로 추가
                      </Btn>
                    </div>
                  )}

                  {c.state === "approved" && (
                    <div className="flex items-center gap-2 text-[14px] text-ok">
                      <Dot tone="ok" />
                      근거 {c.approvedAs}로 추가됨 · 실선 관계 생성
                    </div>
                  )}

                  {c.state === "excluded" && (
                    <div className="flex items-center gap-2 text-[14px] text-muted">
                      제외됨
                      <button
                        type="button"
                        onClick={() => store().patchCandidate(pid, c.id, { state: "pending" })}
                        className="h-6 px-1.5 text-[13px] text-brand"
                      >
                        되돌리기
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {review.step === "source" && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <Btn
                variant="ghost"
                size="sm"
                onClick={() => useUi.getState().patchReview({ step: review.backTo, pickedLine: null })}
              >
                ← 돌아가기
              </Btn>
              <span className="flex-1" />
              <span className="text-[13px] text-muted">줄을 눌러 직접 근거 선택</span>
            </div>

            <div className="overflow-hidden rounded-[8px] border border-line font-mono text-[14px] leading-[23px]">
              {lines.map((text, i) => {
                const n = i + 1;
                const on = review.pickedLine === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => useUi.getState().patchReview({ pickedLine: text.trim() ? n : null })}
                    className={cn(
                      "flex w-full gap-3 px-3 py-0.5 text-left transition-colors duration-[120ms]",
                      on ? "bg-[#eff6ff]" : "hover:bg-wash",
                      !text.trim() && "cursor-default",
                    )}
                  >
                    <span className="w-5 shrink-0 text-right text-faint">{n}</span>
                    <span className="kr whitespace-pre-wrap">{text}</span>
                  </button>
                );
              })}
            </div>

            {review.pickedLine && (
              <div className="flex flex-col gap-2 rounded-[6px] border border-line bg-wash-2 p-3">
                <p className="text-[14px] leading-5">
                  줄 {review.pickedLine}을 근거 인용으로 골랐어요.
                  {target ? (
                    <>
                      {" "}
                      연결 대상: <span className="font-mono text-[13px]">{target.id}</span>
                    </>
                  ) : (
                    " 연결 대상을 먼저 골라주세요."
                  )}
                </p>
                <div className="grid grid-cols-[48px_1fr] items-center gap-x-2.5 text-[14px]">
                  <span className="text-muted">관계</span>
                  <Select value={pickedRel} onValueChange={(v) => setPickedRel(v as EdgeType)}>
                    <SelectTrigger size="sm" className="w-auto justify-self-start">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EDGE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.ko}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-1.5">
                  <Btn size="sm" onClick={() => useUi.getState().patchReview({ pickedLine: null })}>
                    취소
                  </Btn>
                  <Btn
                    variant="ink"
                    size="sm"
                    disabled={!target}
                    onClick={() => {
                      if (!target || !review.pickedLine) return;
                      const quote = lines[review.pickedLine - 1].trim();
                      const candId = `manual-${source.id}-${review.pickedLine}`;
                      store().setCandidates(pid, [
                        ...doc.candidates.filter((c) => c.id !== candId),
                        {
                          id: candId,
                          sourceId: source.id,
                          line: review.pickedLine,
                          quote,
                          claim: "(직접 고른 인용 — 해석은 카드에서 적어주세요)",
                          limit: "",
                          targetId: target.id,
                          edgeType: pickedRel,
                          state: "pending",
                        },
                      ]);
                      const newId = store().approveCandidate(pid, candId);
                      flashSaved();
                      if (newId) {
                        toast(`${newId} 근거로 추가했어요`, {
                          description: "해석과 한계는 카드에서 직접 적어주세요",
                        });
                        useUi.getState().patchReview({ pickedLine: null, step: review.backTo });
                      }
                    }}
                  >
                    근거로 추가
                  </Btn>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="border-t border-line px-5 py-2.5 text-[13px] leading-4 text-muted">
        점선은 후보, 실선은 승인한 관계예요. 점선을 눌러도 승인되지 않아요.
      </p>
    </SidePanel>
  );
}
