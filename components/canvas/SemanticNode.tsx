"use client";

/**
 * CMP-04 의미 카드. 폭 288.
 *
 * 기본은 펼침 — 본문을 노션 문서처럼 그대로 보여준다. 접으면 제목만 남는다.
 * 네 변의 점을 끌면 관계가 생기고, 놓는 쪽도 네 변 중 하나에 꽂힌다.
 */
import { memo, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { ChevronDown, ChevronRight, Paperclip } from "lucide-react";
import { Badge, Dot, Mono, TypeIcon } from "@/components/kit";
import { previewLines } from "@/lib/blocks";
import { KIND, STATUS, kindOf } from "@/lib/labels";
import { nodeTitle } from "@/lib/store";
import type { ReasoningNode, Side, Source } from "@/lib/types";
import { cn } from "@/lib/utils";

export const NODE_W = 288;

const SIDES: { side: Side; className: string }[] = [
  { side: "top", className: "left-1/2 -top-[7px] -translate-x-1/2" },
  { side: "right", className: "top-1/2 -right-[7px] -translate-y-1/2" },
  { side: "bottom", className: "left-1/2 -bottom-[7px] -translate-x-1/2" },
  { side: "left", className: "top-1/2 -left-[7px] -translate-y-1/2" },
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
  /** 연결선을 놓으면 꽂힐 변. 끌고 있는 동안만 값이 있다. */
  connectSide: Side | null;
  /** 다른 카드에서 연결선을 끌고 있는 중. 손잡이를 미리 보여준다. */
  connecting: boolean;
  dimmed: boolean;
  source?: Source;
  /** 이 카드에 떨어뜨린 자료들. 카드 아래에 목록으로 붙는다. */
  attached: Source[];
  onOpenSource: (id: string) => void;
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
  const body = p.collapsed ? [] : previewLines(node.md, 14);
  const sourceLabel = p.source
    ? `${p.source.name}${node.sourceLocator?.line ? ` · 줄 ${node.sourceLocator.line}` : ""}`
    : node.sourceId
      ? "원본 없음"
      : null;
  const sourceMissing = Boolean(node.sourceId && !p.source);
  const showHandles = (p.hovered || p.selected || p.connecting) && !p.dimmed;

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
          "relative rounded-[10px] bg-surface p-4 select-none transition-[border-color,box-shadow,background] duration-[120ms]",
          "focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2",
          node.proposed ? "border border-dashed border-line-strong bg-wash-2" : "border border-line",
          p.hovered && !p.selected && "border-line-strong shadow-[0_4px_12px_rgba(24,24,27,.08)]",
          p.selected && "border-brand shadow-[0_0_0_3px_#eff6ff]",
          p.multi && "border-brand",
          p.connectTarget && "border-brand shadow-[0_0_0_3px_#eff6ff]",
        )}
      >
        <div className="mb-2.5 flex h-5 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[14px] leading-4 font-medium text-muted">
            <TypeIcon d={meta.icon} size={15} />
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
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              p.onToggleCollapse();
            }}
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-[6px] text-muted transition-opacity duration-[120ms] hover:bg-wash hover:text-ink",
              p.hovered || p.selected || p.focused || p.collapsed ? "opacity-100" : "opacity-0",
            )}
          >
            {p.collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        </div>

        <div className="kr text-[16px] leading-[24px] font-semibold text-ink">{title}</div>

        {body.length > 0 && (
          <div className="mt-2.5 flex flex-col gap-1 border-t border-wash pt-2.5">
            {body.map((b) => {
              if (b.type === "divider") return <hr key={b.id} className="my-1.5 border-line" />;
              if (b.type === "code")
                return (
                  <pre
                    key={b.id}
                    className="overflow-hidden rounded-[6px] bg-wash-2 px-2.5 py-1.5 font-mono text-[13px] leading-[19px] text-ink"
                  >
                    {b.text.split("\n").slice(0, 4).join("\n")}
                  </pre>
                );
              if (b.type === "quote")
                return (
                  <p
                    key={b.id}
                    className="kr border-l-2 border-line pl-2.5 text-[14px] leading-[22px] text-ink"
                  >
                    {b.text}
                  </p>
                );
              if (b.type === "h1" || b.type === "h2" || b.type === "h3")
                return (
                  <p
                    key={b.id}
                    className={cn(
                      "kr mt-1.5 font-semibold text-ink",
                      b.type === "h1" && "text-[16px] leading-[23px]",
                      b.type === "h2" && "text-[15px] leading-[22px]",
                      b.type === "h3" && "text-[14px] leading-[21px]",
                    )}
                  >
                    {b.text}
                  </p>
                );
              if (b.type === "list" || b.type === "check")
                return (
                  <div key={b.id} className="flex items-start gap-2">
                    {b.type === "list" ? (
                      <span className="mt-[7px] size-1 shrink-0 rounded-full bg-faint" />
                    ) : (
                      <span
                        className={cn(
                          "mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border text-[10px]",
                          b.checked ? "border-brand bg-brand text-white" : "border-line-strong",
                        )}
                      >
                        {b.checked ? "✓" : ""}
                      </span>
                    )}
                    <span
                      className={cn(
                        "kr text-[14px] leading-[22px] text-ink",
                        b.checked && "text-muted line-through",
                      )}
                    >
                      {b.text}
                    </span>
                  </div>
                );
              return (
                <p key={b.id} className="kr text-[14px] leading-[22px] text-ink">
                  {b.text}
                </p>
              );
            })}
          </div>
        )}

        {p.attached.length > 0 && !p.collapsed && (
          <div className="mt-3 flex flex-col gap-1 border-t border-wash pt-2.5">
            <span className="text-[12px] leading-4 text-faint">첨부한 자료 {p.attached.length}</span>
            {p.attached.map((s) => (
              <button
                key={s.id}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  p.onOpenSource(s.id);
                }}
                className="flex items-center gap-2 rounded-[6px] border border-line bg-wash-2 px-2 py-1.5 text-left hover:bg-wash"
              >
                <Paperclip className="size-3.5 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate font-mono text-[12px]" title={s.name}>
                  {s.name}
                </span>
                <span className="shrink-0 text-[12px] text-muted">
                  {s.state === "read" ? "열기" : "확인"}
                </span>
              </button>
            ))}
          </div>
        )}

        {(status || sourceLabel) && (
          <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[14px] leading-4 text-muted">
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
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  p.onSourceClick();
                }}
                className={cn(
                  "h-5 max-w-[220px] truncate rounded-[5px] border bg-surface px-1.5 font-mono text-[13px] hover:bg-wash",
                  sourceMissing ? "border-[#fecdca] text-danger" : "border-line text-muted",
                )}
              >
                {sourceLabel}
              </button>
            )}
          </div>
        )}

        {/* 관계 손잡이 — 끌어서 다른 카드의 변에 놓으면 그 변에 꽂힌다 */}
        {SIDES.map(({ side, className }) => {
          const armed = p.connectSide === side;
          return (
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
                "absolute z-10 size-3.5 rounded-full border-2 border-brand bg-surface transition-[opacity,transform] duration-[120ms] hover:scale-125",
                className,
                armed && "scale-150 bg-brand",
                showHandles ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            />
          );
        })}
      </div>

      {p.showActions && (
        <div
          className="absolute top-full left-0 z-20 mt-1.5 flex gap-1 rounded-[8px] border border-line bg-surface p-1 whitespace-nowrap shadow-[0_4px_12px_rgba(24,24,27,.08)] animate-pop-in"
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
              className="h-7 rounded-[6px] px-2.5 text-[14px] font-medium text-ink hover:bg-wash"
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {p.dropTarget && (
        <div className="pointer-events-none absolute -inset-1 rounded-[12px] border-2 border-brand bg-brand/5">
          <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-[6px] bg-brand px-2 py-1 text-[14px] leading-4 whitespace-nowrap text-white">
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
    a.connectSide === b.connectSide &&
    a.connecting === b.connecting &&
    a.dimmed === b.dimmed &&
    a.source === b.source &&
    a.attached === b.attached &&
    a.showActions === b.showActions
  );
});
