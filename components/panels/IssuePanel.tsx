"use client";

/**
 * 남은 일 목록. 퍼센트로 바꾸지 않는다 (스펙 §6, §17).
 * 어긋남은 별도 모드로 본다 — 사실만 진술하고, 해소는 사용자의 행동으로만 이뤄진다 (스펙 §17.1).
 */
import { motion } from "motion/react";
import { toast } from "sonner";
import { Btn, Dot } from "@/components/kit";
import { PanelClose } from "./Panel";
import { groupIssues, type Conflict, type Issue } from "@/lib/issues";
import { findNode, nodeTitle, useDoc } from "@/lib/store";
import { useUi } from "@/lib/ui";

interface Props {
  pid: string;
  mode: "issues" | "conflicts";
  issues: Issue[];
  conflicts: Conflict[];
  onClose: () => void;
}

export function IssuePanel({ pid, mode, issues, conflicts, onClose }: Props) {
  const doc = useDoc((s) => s.docs[pid]);
  const acknowledgeConflict = useDoc((s) => s.acknowledgeConflict);
  const removeEdge = useDoc((s) => s.removeEdge);

  function focus(ids: string[]) {
    useUi.getState().select(ids.slice(0, 1));
    useUi.getState().setFocusView(ids[0]);
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      data-ui="issues"
      className="absolute top-4 right-6 z-20 flex max-h-[70vh] w-[420px] flex-col rounded-[8px] border border-line bg-surface shadow-[0_16px_48px_rgba(24,24,27,.16)]"
    >
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="font-semibold">{mode === "conflicts" ? "어긋남" : "인계 전 확인"}</span>
        <span className="text-[12px] text-muted">
          {mode === "conflicts" ? conflicts.length : issues.length}건
        </span>
        <span className="flex-1" />
        <PanelClose onClose={onClose} label="닫기" />
      </div>

      <div className="flex flex-col gap-2 overflow-auto p-4">
        {mode === "conflicts" ? (
          conflicts.length === 0 ? (
            <Empty>지금 어긋나는 항목은 없어요.</Empty>
          ) : (
            conflicts.map((c) => (
              <div key={c.key} className="flex flex-col gap-2.5 rounded-[6px] border border-line p-3">
                <div className="flex items-start gap-2.5">
                  <Dot tone="danger" className="mt-1.5" />
                  <p className="kr flex-1 text-[13px] leading-5">{c.text}</p>
                </div>
                <p className="text-[12px] leading-[18px] text-muted">
                  어느 쪽이 맞는지는 판단하지 않아요. 결정을 고치거나, 근거를 제외하거나, 알고도
                  진행한다고 표시할 수 있어요.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Btn size="sm" onClick={() => focus(c.nodeIds)}>
                    주변 보기
                  </Btn>
                  <Btn
                    size="sm"
                    onClick={() => {
                      const decisionId = c.nodeIds[0];
                      useUi.getState().select([decisionId]);
                      useUi.getState().openPanel("inspector");
                      onClose();
                    }}
                  >
                    결정 고치기
                  </Btn>
                  {doc && (
                    <Btn
                      size="sm"
                      onClick={() => {
                        const evidenceId = c.nodeIds[c.nodeIds.length - 1];
                        const edge = doc.edges.find(
                          (e) => e.from === evidenceId && e.type === "contradicts",
                        );
                        if (!edge) return;
                        removeEdge(pid, edge.id);
                        toast("반대 근거 관계를 지웠어요", {
                          description: `${evidenceId} 카드는 그대로 남아 있어요`,
                        });
                      }}
                    >
                      근거 연결 제외
                    </Btn>
                  )}
                  <span className="flex-1" />
                  <Btn
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      acknowledgeConflict(pid, c.key);
                      toast("알고도 진행한다고 표시했어요", {
                        description: "인계 문서에는 그대로 남아요",
                      });
                    }}
                  >
                    알고도 진행
                  </Btn>
                </div>
              </div>
            ))
          )
        ) : issues.length === 0 ? (
          <Empty>남은 확인 항목이 없어요.</Empty>
        ) : (
          groupIssues(issues).map((g) => (
            <div key={g.group} className="flex flex-col gap-1">
              <div className="px-1 py-1.5 text-[11px] leading-4 font-semibold tracking-[.02em] text-faint">
                {g.group} {g.issues.length}
              </div>
              {g.issues.map((i) => {
                const node = doc ? findNode(doc, i.nodeIds[0]) : undefined;
                return (
                  <button
                    key={i.key}
                    type="button"
                    onClick={() => focus(i.nodeIds)}
                    className="flex flex-col gap-0.5 rounded-[6px] px-2 py-2 text-left hover:bg-wash-2"
                  >
                    <span className="kr text-[13px] leading-[18px]">{i.text}</span>
                    {node && (
                      <span className="truncate text-[12px] text-muted">{nodeTitle(node)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      <p className="border-t border-line px-4 py-2.5 text-[12px] leading-4 text-muted">
        확인하지 않아도 인계 문서는 만들 수 있어요. 미확인 상태는 문서에 그대로 남아요.
      </p>
    </motion.div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-[6px] border border-dashed border-line p-5 text-center text-[13px] text-muted">
    {children}
  </div>
);
