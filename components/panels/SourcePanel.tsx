"use client";

/**
 * 자료를 고르면 뜨는 패널. 두 가지만 보여준다 — 미리보기와 AI 요약.
 *
 * 미리보기는 형식이 눈으로 볼 수 있는 것(그림·PDF·Markdown·텍스트)일 때만.
 * 요약은 올릴 때 미리 만들어 두고(lib/ai autoSummarize), 여기서는 보여주기만 한다.
 * 요약은 원문을 대신하지 않는다 — 근거는 여전히 원문 인용에서만 나온다 (스펙 §14.3, §5.5).
 */
import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Badge, Btn, Dot, FieldLabel, Indeterminate } from "@/components/kit";
import { PanelClose, SidePanel } from "./Panel";
import { autoSummarize } from "@/lib/ai";
import { linesOf } from "@/lib/extract";
import { nodeTitle, useDoc } from "@/lib/store";
import { flashSaved, useUi } from "@/lib/ui";
import type { SourceState } from "@/lib/types";

const STATE: Record<SourceState, { ko: string; tone: "ok" | "warn" | "muted" | "danger" }> = {
  reading: { ko: "읽는 중", tone: "muted" },
  read: { ko: "읽음", tone: "ok" },
  attached: { ko: "첨부만", tone: "muted" },
  "no-text": { ko: "텍스트 없음", tone: "warn" },
  failed: { ko: "읽기 실패", tone: "danger" },
};

/** 미리보기로 보여줄 형식. 웹 문서는 요약만. */
const PREVIEWABLE = new Set(["image", "pdf", "markdown", "text", "interview"]);
const PREVIEW_LINES = 14;

export function SourcePanel({ pid }: { pid: string }) {
  const doc = useDoc((s) => s.docs[pid]);
  const patchSource = useDoc((s) => s.patchSource);
  const id = useUi((s) => s.sel[0]);
  const source = doc?.sources.find((s) => s.id === id);

  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState("");
  const [showAll, setShowAll] = useState(false);

  if (!doc || !source) return null;

  const lines = linesOf(source.text);
  const usable = source.state === "read" && source.text.trim().length > 0;
  const state = STATE[source.state];
  const host = source.attachedTo ? doc.nodes.find((n) => n.id === source.attachedTo) : undefined;
  const evidence = doc.nodes.filter((n) => n.sourceId === source.id);
  const previewable = PREVIEWABLE.has(source.kind) && (source.preview || usable);

  async function resummarize() {
    setBusy(true);
    await autoSummarize(pid, source!);
    setBusy(false);
    if (!useDoc.getState().docs[pid]?.sources.find((s) => s.id === source!.id)?.summary)
      toast.warning("요약을 만들지 못했어요. AI 연결을 확인해 주세요.");
  }

  return (
    <SidePanel width={440} testId="source">
      <div className="flex items-center gap-2 border-b border-line px-5 py-4">
        <span className="min-w-0 flex-1 truncate font-mono text-[14px]" title={source.name}>
          {source.name}
        </span>
        {source.tag && <Badge>{source.tag}</Badge>}
        <PanelClose onClose={() => useUi.getState().closePanel()} />
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Dot tone={state.tone} />
            {state.ko}
          </span>
          {host && (
            <span className="inline-flex items-center gap-1.5">
              <span className="font-mono">{host.id}</span>
              <span className="max-w-[160px] truncate">{nodeTitle(host)}</span>
              <button
                type="button"
                onClick={() => {
                  patchSource(pid, source.id, { attachedTo: undefined });
                  flashSaved();
                }}
                className="text-brand hover:underline"
              >
                연결 끊기
              </button>
            </span>
          )}
          {source.uri && (
            <a href={source.uri} target="_blank" rel="noreferrer noopener" className="text-brand underline">
              원본 열기
            </a>
          )}
        </div>

        {/* 미리보기 — 그림은 그림으로, 글은 앞부분만 */}
        {previewable && (
          <div className="flex flex-col gap-2">
            <FieldLabel>미리보기</FieldLabel>
            {source.preview ? (
              <div className="overflow-hidden rounded-[8px] border border-line bg-wash-2">
                <Image src={source.preview} alt={source.name} width={800} height={600} unoptimized className="h-auto w-full object-contain" />
              </div>
            ) : (
              <div className="overflow-hidden rounded-[8px] border border-line font-mono text-[13px] leading-[22px]">
                {(showAll ? lines : lines.slice(0, PREVIEW_LINES)).map((text, i) => (
                  <div key={i} className="flex gap-3 px-3 py-0.5 hover:bg-wash">
                    <span className="w-6 shrink-0 text-right text-faint">{i + 1}</span>
                    <span className="kr whitespace-pre-wrap">{text}</span>
                  </div>
                ))}
                {lines.length > PREVIEW_LINES && (
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="w-full border-t border-line px-3 py-1.5 text-left text-[13px] text-muted hover:bg-wash"
                  >
                    {showAll ? "앞부분만" : `… ${lines.length - PREVIEW_LINES}줄 더`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* AI 요약 — 올릴 때 만들어 둔 것 */}
        {usable && (
          <div className="flex flex-col gap-2 rounded-[8px] border border-line p-4">
            <div className="flex items-center gap-2">
              <FieldLabel>AI 요약</FieldLabel>
              <Badge tone="warn">원문 아님</Badge>
              <span className="flex-1" />
              {!busy && (
                <Btn variant="ghost" size="sm" onClick={() => void resummarize()}>
                  {source.summary ? "다시 요약" : "요약하기"}
                </Btn>
              )}
            </div>
            {busy && <Indeterminate />}
            {source.summary ? (
              <p className="kr text-[14px] leading-6 whitespace-pre-wrap text-ink">{source.summary}</p>
            ) : (
              !busy && <p className="kr text-[13px] leading-5 text-muted">요약이 아직 없어요.</p>
            )}
          </div>
        )}

        {/* 읽지 못한 자료 — 직접 붙여넣게 한다 */}
        {!usable && source.kind !== "image" && (
          <div className="flex flex-col gap-2.5 rounded-[8px] border border-line p-4">
            <div className="font-semibold">읽을 텍스트를 찾지 못했어요</div>
            <textarea
              value={paste}
              rows={4}
              onChange={(e) => setPaste(e.target.value)}
              placeholder="원문을 붙여넣으세요"
              className="kr w-full resize-none rounded-[6px] border border-line bg-surface px-3 py-2.5 text-[14px] leading-6 focus:border-brand"
            />
            <div className="flex justify-end">
              <Btn
                variant="ink"
                size="sm"
                disabled={!paste.trim()}
                onClick={() => {
                  patchSource(pid, source.id, { text: paste, state: "read" });
                  void autoSummarize(pid, { id: source.id, name: source.name, text: paste });
                  setPaste("");
                  flashSaved();
                }}
              >
                원문으로 저장
              </Btn>
            </div>
          </div>
        )}

        {evidence.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <FieldLabel>이 자료에서 나온 근거 {evidence.length}</FieldLabel>
            {evidence.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  useUi.getState().select([n.id]);
                  useUi.getState().openPanel("inspector");
                }}
                className="flex items-center gap-2 rounded-[6px] border border-line px-3 py-2 text-left text-[14px] hover:bg-wash-2"
              >
                <span className="font-mono text-[12px] text-muted">{n.id}</span>
                <span className="min-w-0 flex-1 truncate">{nodeTitle(n)}</span>
                {n.sourceLocator?.line && <span className="shrink-0 text-[13px] text-muted">줄 {n.sourceLocator.line}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

    </SidePanel>
  );
}
