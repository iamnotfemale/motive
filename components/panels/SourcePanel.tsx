"use client";

/**
 * 자료를 고르면 뜨는 패널.
 *
 * 형식에 따라 다르게 보여준다. 그림은 그림으로, 글은 줄 번호가 붙은 원문으로.
 * 바로 읽기 어려운 자료는 AI 요약을 붙일 수 있다 — 다만 요약은 원문을 대신하지 않는다.
 * 근거는 여전히 원문 인용에서만 나온다 (스펙 §14.3, §5.5).
 */
import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Badge, Btn, Dot, FieldLabel, Indeterminate, Notice } from "@/components/kit";
import { PanelClose, SidePanel } from "./Panel";
import { summarizeSource } from "@/lib/ai";
import { linesOf } from "@/lib/extract";
import { useDoc } from "@/lib/store";
import { flashSaved, useUi } from "@/lib/ui";
import type { Source, SourceState } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATE: Record<SourceState, { ko: string; tone: "ok" | "warn" | "muted" | "danger" }> = {
  reading: { ko: "읽는 중", tone: "muted" },
  read: { ko: "읽음", tone: "ok" },
  attached: { ko: "첨부만", tone: "muted" },
  "no-text": { ko: "텍스트 없음", tone: "warn" },
  failed: { ko: "읽기 실패", tone: "danger" },
};

const KIND_KO: Record<string, string> = {
  markdown: "Markdown",
  text: "텍스트",
  pdf: "PDF",
  url: "웹 문서",
  interview: "인터뷰",
  image: "그림",
};

/** 줄 수가 이만큼 넘으면 바로 읽기 어렵다고 보고 요약을 권한다. */
const LONG = 60;

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
  const long = lines.length > LONG;
  const evidence = doc.nodes.filter((n) => n.sourceId === source.id);
  const state = STATE[source.state];

  async function summarize(s: Source) {
    setBusy(true);
    const res = await summarizeSource(s.name, s.text);
    setBusy(false);
    if (!res.ok) {
      if (res.aiOff) useUi.getState().setAiOff(true);
      return toast.warning(
        res.aiOff ? "AI가 연결되지 않았어요. 원문은 아래에서 그대로 볼 수 있어요." : res.message,
      );
    }
    const md = [
      res.data.summary,
      "",
      ...res.data.points.map((p) => `- ${p}`),
      "",
      `※ ${res.data.caveat}`,
    ].join("\n");
    patchSource(pid, s.id, { summary: md });
    flashSaved();
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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted">
          <span>{KIND_KO[source.kind] ?? source.kind}</span>
          <span className="inline-flex items-center gap-1.5">
            <Dot tone={state.tone} />
            {state.ko}
          </span>
          {usable && <span>{lines.length}줄</span>}
          {evidence.length > 0 && <span>근거 {evidence.length}건</span>}
          {source.uri && (
            <a
              href={source.uri}
              target="_blank"
              rel="noreferrer noopener"
              className="text-brand underline"
            >
              원본 열기
            </a>
          )}
        </div>

        {/* 그림은 그림으로 */}
        {source.preview && (
          <div className="overflow-hidden rounded-[8px] border border-line bg-wash-2">
            <Image
              src={source.preview}
              alt={source.name}
              width={800}
              height={600}
              unoptimized
              className="h-auto w-full object-contain"
            />
          </div>
        )}

        {source.kind === "image" && (
          <Notice tone="warn">
            그림에서는 인용할 줄이 나오지 않아요. 근거로 쓰려면 카드에 직접 적어주세요.
          </Notice>
        )}

        {/* 읽지 못한 자료 — 직접 붙여넣게 한다 */}
        {!usable && source.kind !== "image" && (
          <div className="flex flex-col gap-2.5 rounded-[8px] border border-line p-4">
            <div className="font-semibold">읽을 텍스트를 찾지 못했어요</div>
            <p className="kr text-[14px] leading-5 text-muted">
              스캔 이미지이거나 지원하지 않는 형식일 수 있어요. 원문을 직접 붙여넣으면 그대로 쓸 수
              있어요.
            </p>
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
                  setPaste("");
                  flashSaved();
                  toast("원문을 저장했어요");
                }}
              >
                원문으로 저장
              </Btn>
            </div>
          </div>
        )}

        {/* 바로 읽기 어려운 자료 — AI 요약 */}
        {usable && (long || source.kind === "pdf") && (
          <div className="flex flex-col gap-2.5 rounded-[8px] border border-line p-4">
            <div className="flex items-center gap-2">
              <FieldLabel>AI 요약</FieldLabel>
              <Badge tone="warn">원문 아님</Badge>
              <span className="flex-1" />
              {!busy && (
                <Btn size="sm" onClick={() => void summarize(source)}>
                  {source.summary ? "다시 요약" : "요약하기"}
                </Btn>
              )}
            </div>
            {busy && <Indeterminate />}
            {source.summary ? (
              <p className="kr text-[14px] leading-6 whitespace-pre-wrap text-ink">{source.summary}</p>
            ) : (
              !busy && (
                <p className="kr text-[13px] leading-5 text-muted">
                  {lines.length}줄이라 한눈에 보기 어려워요. 무엇이 들어 있는지만 훑어볼 수 있어요.
                  근거는 여전히 아래 원문에서 인용해야 해요.
                </p>
              )
            )}
          </div>
        )}

        {/* 원문 */}
        {usable && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FieldLabel>원문</FieldLabel>
              <span className="flex-1" />
              {long && (
                <Btn variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "앞부분만" : `전체 ${lines.length}줄`}
                </Btn>
              )}
            </div>
            <div className="overflow-hidden rounded-[8px] border border-line font-mono text-[13px] leading-[22px]">
              {(showAll ? lines : lines.slice(0, LONG)).map((text, i) => (
                <div key={i} className="flex gap-3 px-3 py-0.5 hover:bg-wash">
                  <span className="w-6 shrink-0 text-right text-faint">{i + 1}</span>
                  <span className="kr whitespace-pre-wrap">{text}</span>
                </div>
              ))}
              {!showAll && long && (
                <div className="border-t border-line px-3 py-1.5 text-[13px] text-muted">
                  … {lines.length - LONG}줄 더
                </div>
              )}
            </div>
          </div>
        )}

        {evidence.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <FieldLabel>이 자료에서 나온 근거</FieldLabel>
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
                <span className="min-w-0 flex-1 truncate">{n.md.split("\n")[0].replace(/^# /, "")}</span>
                {n.sourceLocator?.line && (
                  <span className="shrink-0 text-[13px] text-muted">줄 {n.sourceLocator.line}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-line px-5 py-3">
        <span className={cn("flex-1 text-[13px]", usable ? "text-muted" : "text-warn")}>
          {usable ? "자료는 아직 근거가 아니에요" : "원문이 있어야 근거를 만들 수 있어요"}
        </span>
        <Btn
          variant="ink"
          disabled={!usable}
          onClick={() => {
            useUi.getState().setReview({
              sourceId: source.id,
              step: "pick-target",
              targetId: null,
              pickedLine: null,
              backTo: "candidates",
            });
            useUi.getState().openPanel("review");
          }}
        >
          근거 만들기
        </Btn>
      </div>
    </SidePanel>
  );
}
