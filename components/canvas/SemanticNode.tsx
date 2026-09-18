"use client";

/**
 * CMP-04 의미 카드. 폭 288, padding 16, radius 8.
 * 상태: 기본 / hover / 선택 / 키보드 focus / 다중 선택 / 후보(점선) / 드롭 대상.
 */
import { memo, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Badge, Dot, Mono, TypeIcon } from "@/components/kit";
import { KIND, STATUS, kindOf } from "@/lib/labels";
import { nodeTitle } from "@/lib/store";
import { titleOf } from "@/lib/md";
import type { ReasoningNode, Source } from "@/lib/types";
import { cn } from "@/lib/utils";

export const NODE_W = 288;

export interface NodeViewProps {
  node: ReasoningNode;
  x: number;
  y: number;
  selected: boolean;
  multi: boolean;
  hovered: boolean;
  focused: boolean;
  dropTarget: boolean;
  dimmed: boolean;
  source?: Source;
  showActions: boolean;
  onMeasure: (id: string, h: number) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  onOpen: () => void;
  onHover: (v: boolean) => void;
  onFocus: (v: boolean) => void;
  onAction: (index: 0 | 1) => void;
  onSourceClick: () => void;
}

function NodeViewImpl(p: NodeViewProps) {
  const { node } = p;
  const kind = kindOf(node);
  const meta = KIND[kind];
  const ref = useRef<HTMLDivElement>(null);
  const status = node.status ? STATUS[node.status] : null;

  // 카드 높이는 내용에 따라 달라진다. 관계선을 카드 경계에 맞추려면 실측이 필요하다.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => p.onMeasure(node.id, el.offsetHeight));
    ro.observe(el);
    p.onMeasure(node.id, el.offsetHeight);
    return () => ro.disconnect();
  }, [node.id, p.onMeasure, p]);

  const title = nodeTitle(node);
  const sourceLabel = p.source
    ? `${p.source.name}${node.sourceLocator?.line ? ` · 줄 ${node.sourceLocator.line}` : ""}`
    : node.sourceId
      ? "원본 없음"
      : null;
  const sourceMissing = Boolean(node.sourceId && !p.source);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: p.dimmed ? 0.35 : 1, scale: 1 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      style={{ left: p.x, top: p.y, width: NODE_W }}
      className="absolute"
    >
      <div
        ref={ref}
        data-node-id={node.id}
        tabIndex={0}
        role="button"
        aria-label={`${meta.ko} ${node.id} ${title}`}
        onPointerDown={p.onPointerDown}
        onClick={p.onClick}
        onDoubleClick={p.onOpen}
        onMouseEnter={() => p.onHover(true)}
        onMouseLeave={() => p.onHover(false)}
        onFocus={() => p.onFocus(true)}
        onBlur={() => p.onFocus(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            p.onOpen();
          }
        }}
        className={cn(
          "rounded-[8px] bg-surface p-4 select-none transition-[border-color,box-shadow,background] duration-[120ms]",
          "focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2",
          node.proposed ? "border border-dashed border-line-strong bg-wash-2" : "border border-line",
          p.hovered && !p.selected && "border-line-strong shadow-[0_4px_12px_rgba(24,24,27,.08)]",
          p.selected && "border-brand shadow-[0_0_0_3px_#eff6ff]",
          p.multi && "border-brand",
        )}
      >
        <div className="mb-2.5 flex h-5 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[12px] leading-4 font-medium text-muted">
            <TypeIcon d={meta.icon} />
            {meta.ko}
          </span>
          <Mono>{node.id}</Mono>
          <span className="flex-1" />
          {node.proposed && (
            <Badge tone="warn" className="font-medium">
              AI 제안 · 미확정
            </Badge>
          )}
          <button
            type="button"
            title="상세 열기"
            onClick={(e) => {
              e.stopPropagation();
              p.onOpen();
            }}
            className={cn(
              "size-6 shrink-0 rounded-[6px] text-[13px] text-muted transition-opacity duration-[120ms] hover:bg-wash hover:text-ink",
              p.hovered || p.selected || p.focused ? "opacity-100" : "opacity-0",
            )}
          >
            ⋯
          </button>
        </div>

        <div className="kr max-h-[63px] overflow-hidden text-[13px] leading-[21px] font-medium text-ink">
          {title}
        </div>

        {(status || sourceLabel) && (
          <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[12px] leading-4 text-muted">
            {status && (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 font-medium",
                  status.tone === "warn" && "text-warn",
                  status.tone === "ok" && "text-ok",
                  status.tone === "danger" && "text-danger",
                  status.tone === "muted" && "text-muted",
                )}
              >
                <Dot tone={status.tone} />
                {status.ko}
              </span>
            )}
            {sourceLabel && (
              <button
                type="button"
                title={sourceLabel}
                onClick={(e) => {
                  e.stopPropagation();
                  p.onSourceClick();
                }}
                className={cn(
                  "h-5 max-w-[220px] truncate rounded-[5px] border bg-surface px-1.5 font-mono text-[11px] hover:bg-wash",
                  sourceMissing ? "border-[#fecdca] text-danger" : "border-line text-muted",
                )}
              >
                {sourceLabel}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 카드 액션 — hover 또는 단일 선택, 패널이 닫혀 있을 때만 */}
      {p.showActions && (
        <div
          className="absolute top-full left-0 mt-1.5 flex gap-1 rounded-[6px] border border-line bg-surface p-1 whitespace-nowrap shadow-[0_4px_12px_rgba(24,24,27,.08)] animate-pop-in"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {meta.acts.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                p.onAction(i as 0 | 1);
              }}
              className="h-7 rounded-[6px] px-2.5 text-[13px] font-medium text-ink hover:bg-wash"
            >
              {label}
            </button>
          ))}
          <span className="my-1 mx-0.5 w-px bg-line" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              p.onOpen();
            }}
            className="h-7 rounded-[6px] px-2.5 text-[13px] text-muted hover:bg-wash hover:text-ink"
          >
            열기
          </button>
        </div>
      )}

      {/* 드롭 대상 표시 — 어떤 관계가 생기는지 미리 말해준다 */}
      {p.dropTarget && (
        <div className="pointer-events-none absolute -inset-1 rounded-[10px] border-2 border-brand bg-brand/5">
          <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-[6px] bg-brand px-2 py-1 text-[12px] leading-4 whitespace-nowrap text-white">
            이 {meta.ko}에 자료 첨부
          </span>
        </div>
      )}
    </motion.div>
  );
}

export const NodeView = memo(NodeViewImpl, (a, b) => {
  return (
    a.node === b.node &&
    a.x === b.x &&
    a.y === b.y &&
    a.selected === b.selected &&
    a.multi === b.multi &&
    a.hovered === b.hovered &&
    a.focused === b.focused &&
    a.dropTarget === b.dropTarget &&
    a.dimmed === b.dimmed &&
    a.source === b.source &&
    a.showActions === b.showActions
  );
});

export { titleOf };
