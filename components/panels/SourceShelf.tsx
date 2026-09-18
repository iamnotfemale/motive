"use client";

/**
 * CMP-08 자료함. 상시 문서 트리가 아니다 — 필요할 때만 열리는 하단 서랍이다 (스펙 §19 C).
 * 자료는 Source 지 Evidence 가 아니다. 여기서 바로 근거가 만들어지지 않는다.
 */
import { useRef, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Badge, Btn, Dot, Spinner } from "@/components/kit";
import { PanelClose } from "./Panel";
import { extractUrl } from "@/lib/extract";
import { nextFreeSpot, useDoc } from "@/lib/store";
import { flashSaved, useUi } from "@/lib/ui";
import type { SourceState } from "@/lib/types";

const STATE: Record<SourceState, { ko: string; tone: "ok" | "warn" | "muted" | "danger" }> = {
  reading: { ko: "읽는 중", tone: "muted" },
  read: { ko: "읽음", tone: "ok" },
  attached: { ko: "첨부만", tone: "muted" },
  "no-text": { ko: "텍스트 없음", tone: "warn" },
  failed: { ko: "읽기 실패", tone: "danger" },
};

export function SourceShelf({ pid, onAttachFile }: { pid: string; onAttachFile: (f: File[]) => void }) {
  const doc = useDoc((s) => s.docs[pid]);
  const store = useDoc.getState;
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function addUrl() {
    const value = url.trim();
    if (!value || !doc) return;
    setLoading(true);
    const out = await extractUrl(value);
    setLoading(false);

    const sid = "src-" + Math.random().toString(36).slice(2, 9);
    store().addSource(pid, {
      id: sid,
      kind: "url",
      name: value.replace(/^https?:\/\//, "").slice(0, 60),
      text: out.text,
      uri: value,
      state: out.problem ? "no-text" : "read",
      createdAt: new Date().toISOString(),
    });
    store().moveNode(pid, sid, nextFreeSpot(useDoc.getState().docs[pid]!, { x: 72, y: 48 }));
    setUrl("");
    flashSaved();

    if (out.problem) {
      toast.warning(out.problem, { description: "자료함에는 남겨뒀어요." });
      return;
    }
    useUi.getState().setReview({
      sourceId: sid,
      step: "pick-target",
      targetId: null,
      pickedLine: null,
      backTo: "candidates",
    });
    useUi.getState().openPanel("review");
  }

  if (!doc) return null;

  const broken = doc.sources.filter((s) => s.state === "no-text" || s.state === "failed");

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      data-ui="shelf"
      className="absolute inset-x-0 bottom-0 z-8 flex h-[260px] flex-col border-t border-line bg-surface shadow-[0_-4px_16px_rgba(24,24,27,.05)]"
    >
      <div className="flex h-10 items-center gap-2.5 border-b border-wash px-5">
        <span className="font-semibold">자료함</span>
        <span className="text-[12px] text-muted">{doc.sources.length}</span>
        <span className="flex-1" />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void addUrl();
          }}
          placeholder="주소 붙여넣기"
          aria-label="자료 주소"
          className="h-7 w-52 rounded-[6px] border border-line bg-surface px-2.5 text-[13px] focus:border-brand"
        />
        <Btn size="sm" onClick={() => void addUrl()} disabled={!url.trim() || loading}>
          {loading && <Spinner className="border-ink/30 border-t-ink" />}
          주소 읽기
        </Btn>
        <Btn size="sm" onClick={() => fileRef.current?.click()}>
          + 파일
        </Btn>
        <PanelClose onClose={() => useUi.getState().closePanel()} label="닫기" />
      </div>

      {broken.length > 0 && (
        <div className="mx-5 mt-3 flex items-center gap-2.5 rounded-[6px] border border-line bg-wash-2 px-3 py-2.5 text-[13px] leading-[18px]">
          <Dot tone="warn" />
          <span className="flex-1">
            {broken.length}개 자료에서 읽을 텍스트를 찾지 못했어요. 텍스트를 직접 붙여넣을 수 있어요.
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-1.5 overflow-auto px-5 pt-3 pb-4">
        {doc.sources.length === 0 && (
          <div className="rounded-[6px] border border-dashed border-line p-6 text-center text-[13px] text-muted">
            아직 자료가 없어요. 파일을 캔버스로 끌어다 놓으면 아이콘으로 올라가요.
          </div>
        )}

        {doc.sources.map((s) => {
          const state = STATE[s.state];
          const used = doc.nodes.filter((n) => n.sourceId === s.id).length;
          return (
            <div
              key={s.id}
              className="flex h-10 items-center gap-3 rounded-[6px] border border-line bg-surface px-3 hover:bg-wash-2"
            >
              <span className="min-w-0 truncate font-mono text-[13px]" title={s.name}>
                {s.name}
              </span>
              {s.tag && <Badge>{s.tag}</Badge>}
              <span className="flex-1" />
              <span className="inline-flex items-center gap-1.5 text-[12px] whitespace-nowrap text-muted">
                <Dot tone={state.tone} />
                {state.ko}
              </span>
              <span className="text-[12px] whitespace-nowrap text-muted">
                {used > 0 ? `근거 ${used}` : `${s.text.split("\n").length}줄`}
              </span>
              <Btn
                size="sm"
                onClick={() => {
                  if (s.state !== "read") {
                    toast.warning("이 자료에서 읽을 텍스트를 찾지 못했어요.");
                    return;
                  }
                  useUi.getState().setReview({
                    sourceId: s.id,
                    step: "pick-target",
                    targetId: null,
                    pickedLine: null,
                    backTo: "candidates",
                  });
                  useUi.getState().openPanel("review");
                }}
              >
                {s.state === "read" ? "검토" : "확인"}
              </Btn>
            </div>
          );
        })}
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
          if (files.length) onAttachFile(files);
        }}
      />
    </motion.div>
  );
}
