"use client";

/**
 * CMP-04 의미 카드. 폭 288.
 *
 * 기본은 펼침 — 본문이 다 보인다. 접으면 제목만 남는다.
 * 네 변의 점을 끌면 관계가 생긴다. 놓을 때까지 그래프에는 들어가지 않는다.
 */
import { memo, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge, Dot, Mono, TypeIcon } from "@/components/kit";
import { previewLines } from "@/lib/blocks";
import { KIND, STATUS, kindOf } from "@/lib/labels";
import { nodeTitle } from "@/lib/store";
import type { ReasoningNode, Source } from "@/lib/types";
import { cn } from "@/lib/utils";

export const NODE_W = 288;

export type Side = "top" | "right" | "bottom" | "left";
const SIDES: { side: Side; className: string }[] = [
  { side: "top", className: "left-1/2 -top-1.5 -translate-x-1/2" },
  { side: "right", className: "top-1/2 -right-1.5 -translate-y-1/2" },
  { side: "bottom", className: "left-1/2 -bottom-1.5 -translate-x-1/2" },
  { side: "left", className: "top-1/2 -left-1.5 -translate-y-1/2" },
];

export interface NodeViewProps {
  node: ReasoningNode;
  x: number;
  y: number;
  collapsed: boolean;
  selected: boolean;
  multi: boolean;
  hovered: boolean;
  focused: boolean;
  dropTarget: boolean;
  connectTarget: boolean;
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
  onToggleCollapse: () => void;
  onStartConnect: (side: Side, e: React.PointerEvent) => void;
}

function NodeViewImpl(p: NodeViewProps) {
  const { node } = p;
  const kind = kindOf(node);
  const meta = KIND[kind];
  const ref = useRef<HTMLDivElement>(null);
  const status = node.status ? STATUS[node.status] : null;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => p.onMeasure(node.id, el.offsetHeight));
    ro.observe(el);
    p.onMeasure(node.id, el.offsetHeight);
    return () => ro.disconnect();
  }, [node.id, p.onMeasure, p]);

  const title = nodeTitle(node);
  const body = p.collapsed ? [] : previewLines(node.md, 8);
  const sourceLabel = p.source
    ? `${p.source.name}${node.sourceLocator?.line ? ` · 줄 ${node.sourceLocator.line}` : ""}`
    : node.sourceId
      ? "원본 없음"
      : null;
  const sourceMissing = Boolean(node.sourceId && !p.source);
  const showHandles = (p.hovered || p.selected) && !p.dimmed;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: p.dimmed ? 0.25 : 1, scale: 1 }}
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
        aria-expanded={!p.collapsed}
        onPointerDown={p.onPointerDown}
        onClick={p.onClick}
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
          "relative rounded-[8px] bg-surface p-4 select-none transition-[border-color,box-shadow,background] duration-[120ms]",
          "focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2",
          node.proposed ? "border border-dashed border-line-strong bg-wash-2" : "border border-line",
          p.hovered && !p.selected && "border-line-strong shadow-[0_4px_12px_rgba(24,24,27,.08)]",
          p.selected && "border-brand shadow-[0_0_0_3px_#eff6ff]",
          p.multi && "border-brand",
          p.connectTarget && "border-brand shadow-[0_0_0_3px_#eff6ff]",
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
            title={p.collapsed ? "펼치기" : "접기"}
            aria-label={p.collapsed ? "펼치기" : "접기"}
            onClick={(e) => {
              e.stopPropagation();
              p.onToggleCollapse();
            }}
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-[6px] text-muted transition-opacity duration-[120ms] hover:bg-wash hover:text-ink",
              p.hovered || p.selected || p.focused || p.collapsed ? "opacity-100" : "opacity-0",
            )}
          >
            {p.collapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
          <button
            type="button"
            title="상세 열기"
            aria-label="상세 열기"
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

        <div className="kr text-[13px] leading-[21px] font-medium text-ink">{title}</div>

        {body.length > 0 && (
          <div className="mt-2.5 flex flex-col gap-1 border-t border-wash pt-2.5">
            {body.map((b) => {
              if (b.type === "divider") return <hr key={b.id} className="my-1 border-line" />;
              return (
                <div
                  key={b.id}
                  className={cn(
                    "kr flex gap-1.5 text-[12px] leading-[19px] text-muted",
                    (b.type === "h2" || b.type === "h3" || b.type === "h1") &&
                      "mt-1 text-[11px] font-semibold tracking-[.01em] text-faint uppercase",
                    b.type === "quote" && "border-l-2 border-line pl-2 text-ink",
                    b.checked && "line-through",
                  )}
                >
                  {b.type === "list" && <span className="text-faint">•</span>}
                  {b.type === "check" && (
                    <span className={cn("shrink-0", b.checked ? "text-ok" : "text-faint")}>
                      {b.checked ? "☑" : "☐"}
                    </span>
                  )}
                  <span className="line-clamp-2">{b.text}</span>
                </div>
              );
            })}
          </div>
        )}

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

        {/* 관계 손잡이 — 끌어서 다른 카드에 놓으면 관계가 생긴다 */}
        {SIDES.map(({ side, className }) => (
          <button
            key={side}
            type="button"
            aria-label={`${side} 에서 관계 연결`}
            onPointerDown={(e) => {
              e.stopPropagation();
              p.onStartConnect(side, e);
            }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "absolute z-10 size-3 rounded-full border-2 border-brand bg-surface transition-opacity duration-[120ms] hover:scale-125",
              className,
              showHandles ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          />
        ))}
      </div>

      {p.showActions && (
        <div
          className="absolute top-full left-0 z-20 mt-1.5 flex gap-1 rounded-[6px] border border-line bg-surface p-1 whitespace-nowrap shadow-[0_4px_12px_rgba(24,24,27,.08)] animate-pop-in"
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
        </div>
      )}

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
    a.collapsed === b.collapsed &&
    a.selected === b.selected &&
    a.multi === b.multi &&
    a.hovered === b.hovered &&
    a.focused === b.focused &&
    a.dropTarget === b.dropTarget &&
    a.connectTarget === b.connectTarget &&
    a.dimmed === b.dimmed &&
    a.source === b.source &&
    a.showActions === b.showActions
  );
});
