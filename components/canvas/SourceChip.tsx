"use client";

/**
 * 캔버스에 놓인 자료. 파일을 캔버스로 끌어다 놓으면 이 아이콘이 생긴다.
 *
 * 자료는 그 자체로 근거가 아니다 (스펙 §8.2). 아이콘이 생겼다는 것은 원문을 저장했다는 뜻이고,
 * 근거가 되려면 검토 패널에서 사람이 승인해야 한다.
 */
import { memo, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { FileText, FileType2, ImageIcon, Link2, MessageSquareQuote } from "lucide-react";
import { Dot } from "@/components/kit";
import type { Source, SourceState } from "@/lib/types";
import { cn } from "@/lib/utils";

export const SOURCE_W = 208;

const ICON: Record<string, typeof FileText> = {
  markdown: FileText,
  text: FileText,
  pdf: FileType2,
  url: Link2,
  interview: MessageSquareQuote,
  image: ImageIcon,
};

const STATE: Record<SourceState, { ko: string; tone: "ok" | "warn" | "muted" | "danger" }> = {
  reading: { ko: "읽는 중", tone: "muted" },
  read: { ko: "읽음", tone: "ok" },
  attached: { ko: "첨부만", tone: "muted" },
  "no-text": { ko: "텍스트 없음", tone: "warn" },
  failed: { ko: "읽기 실패", tone: "danger" },
};

interface Props {
  source: Source;
  x: number;
  y: number;
  selected: boolean;
  hovered: boolean;
  dragging: boolean;
  dimmed: boolean;
  evidenceCount: number;
  onMeasure: (id: string, h: number) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  onHover: (v: boolean) => void;
}

export const SourceChip = memo(function SourceChip(p: Props) {
  const { source } = p;
  const Icon = ICON[source.kind] ?? FileText;
  const state = STATE[source.state];
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    p.onMeasure(source.id, el.offsetHeight);
  }, [source.id, source.state, p]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: p.dimmed ? 0.35 : 1, scale: p.dragging ? 1.02 : 1 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      style={{ left: p.x, top: p.y, width: SOURCE_W }}
      className="absolute"
    >
      <div
        ref={ref}
        data-source-id={source.id}
        tabIndex={0}
        role="button"
        aria-label={`자료 ${source.name}`}
        onPointerDown={p.onPointerDown}
        onClick={p.onClick}
        onMouseEnter={() => p.onHover(true)}
        onMouseLeave={() => p.onHover(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            p.onClick(e as unknown as React.MouseEvent);
          }
        }}
        className={cn(
          "flex cursor-grab flex-col gap-2 rounded-[8px] border bg-surface p-3 select-none transition-[border-color,box-shadow] duration-[120ms]",
          "focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2",
          p.dragging && "cursor-grabbing shadow-[0_8px_20px_rgba(24,24,27,.14)]",
          p.selected
            ? "border-brand shadow-[0_0_0_3px_#eff6ff]"
            : p.hovered
              ? "border-line-strong shadow-[0_4px_12px_rgba(24,24,27,.08)]"
              : "border-line",
        )}
      >
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-[6px] bg-wash text-muted">
            <Icon className="size-4" />
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-[13px] leading-4 text-ink" title={source.name}>
            {source.name}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[12px] leading-4 text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Dot tone={state.tone} />
            {state.ko}
          </span>
          {source.tag && <span className="rounded-[4px] bg-wash px-1.5">{source.tag}</span>}
          <span className="flex-1" />
          {p.evidenceCount > 0 && <span>근거 {p.evidenceCount}</span>}
        </div>
      </div>
    </motion.div>
  );
});
