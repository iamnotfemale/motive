"use client";

/**
 * 문제 다듬기. 원문과 제안을 나란히 두고 사람이 고른다.
 * AI 제안이 원문을 조용히 덮어쓰지 않는다 (스펙 §5.3).
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge, Btn, FieldLabel, Indeterminate, Mono, Notice } from "@/components/kit";
import { PanelClose, SidePanel } from "./Panel";
import { refineProblem } from "@/lib/ai";
import { parseMd, setTitle } from "@/lib/md";
import { useDoc } from "@/lib/store";
import { flashSaved, useUi } from "@/lib/ui";

export function RefinePanel({ pid }: { pid: string }) {
  const doc = useDoc((s) => s.docs[pid]);
  const patchNode = useDoc((s) => s.patchNode);

  const problem = doc?.nodes.find((n) => n.type === "problem");
  const original = problem ? parseMd(problem.md).title : "";

  const [suggestion, setSuggestion] = useState<{ statement: string; note: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!original) return;
    setBusy(true);
    setError(null);
    const res = await refineProblem(original);
    setBusy(false);
    if (!res.ok) {
      if (res.aiOff) useUi.getState().setAiOff(true);
      setError(
        res.aiOff
          ? "AI가 연결되지 않았어요. 원문을 직접 고치거나 나중에 다시 시도할 수 있어요."
          : res.message,
      );
      return;
    }
    setSuggestion(res.data);
  }, [original]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!doc || !problem) return null;

  return (
    <SidePanel testId="refine">
      <div className="flex items-center gap-2 border-b border-line px-5 py-4">
        <span className="font-semibold">문제 다듬기</span>
        <Mono>{problem.id}</Mono>
        <span className="flex-1" />
        <PanelClose onClose={() => useUi.getState().closePanel()} />
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-5">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>원문</FieldLabel>
          <p className="kr rounded-[6px] border border-line p-3 text-[14px] leading-[23px]">{original}</p>
        </div>

        {busy && <Indeterminate />}

        {error && (
          <Notice
            tone="warn"
            actions={
              <Btn size="sm" onClick={() => void load()}>
                다시 시도
              </Btn>
            }
          >
            {error}
          </Notice>
        )}

        {suggestion && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <FieldLabel>AI 제안</FieldLabel>
              <Badge tone="warn">미확정</Badge>
            </div>
            <p className="kr rounded-[6px] border border-line bg-wash-2 p-3 text-[14px] leading-[23px]">
              {suggestion.statement}
            </p>
            <p className="kr text-[13px] leading-[19px] text-muted">{suggestion.note}</p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
        <Btn onClick={() => useUi.getState().closePanel()}>원문 유지</Btn>
        <Btn
          variant="ink"
          disabled={!suggestion}
          onClick={() => {
            if (!suggestion) return;
            patchNode(pid, problem.id, { md: setTitle(problem.md, suggestion.statement) });
            flashSaved();
            useUi.getState().closePanel();
            toast("문제 진술을 바꿨어요", { description: "되돌리려면 카드에서 직접 수정하세요" });
          }}
        >
          제안 적용
        </Btn>
      </div>
    </SidePanel>
  );
}
