"use client";

/**
 * CMP-05 관계선. 방향 화살표는 항상 보인다 (브리프 §3.3).
 * 후보 관계는 점선, 승인한 관계는 실선. 점선을 눌러도 승인되지 않는다.
 */
import { memo } from "react";
import { edgeLabel } from "@/lib/labels";
import type { ReasoningNode, SemanticEdge } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 중심을 잇는 선을 카드 테두리에서 자른다. 카드가 겹쳐도 화살표가 안으로 숨지 않는다. */
function clipToRect(rect: Rect, toward: { x: number; y: number }, pad = 6) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const sx = dx !== 0 ? rect.w / 2 / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const sy = dy !== 0 ? rect.h / 2 / Math.abs(dy) : Number.POSITIVE_INFINITY;
  const s = Math.min(sx, sy);
  const len = Math.hypot(dx, dy);
  const padS = len > 0 ? pad / len : 0;
  return { x: cx + dx * (s + padS), y: cy + dy * (s + padS) };
}

export interface EdgeGeom {
  edge: SemanticEdge;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lx: number;
  ly: number;
  arrow: string;
  label: string;
  counter: boolean;
}

export function layoutEdges(
  edges: SemanticEdge[],
  rects: Record<string, Rect>,
  nodes: Map<string, ReasoningNode>,
): EdgeGeom[] {
  const out: EdgeGeom[] = [];
  for (const edge of edges) {
    const a = rects[edge.from];
    const b = rects[edge.to];
    if (!a || !b) continue;

    const ca = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
    const cb = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    const p1 = clipToRect(a, cb);
    const p2 = clipToRect(b, ca);

    const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const len = 9;
    const half = 4.5;
    const arrow = [
      [p2.x, p2.y],
      [p2.x - len * Math.cos(ang) + half * Math.sin(ang), p2.y - len * Math.sin(ang) - half * Math.cos(ang)],
      [p2.x - len * Math.cos(ang) - half * Math.sin(ang), p2.y - len * Math.sin(ang) + half * Math.cos(ang)],
    ]
      .map(([x, y]) => `${x},${y}`)
      .join(" ");

    out.push({
      edge,
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y,
      lx: (p1.x + p2.x) / 2,
      ly: (p1.y + p2.y) / 2,
      arrow,
      label: edgeLabel(edge, nodes.get(edge.to)),
      counter: edge.type === "contradicts",
    });
  }
  return out;
}

interface EdgeLayerProps {
  geoms: EdgeGeom[];
  selectedId: string | null;
  dimmed: Set<string> | null;
  onSelect: (id: string | null) => void;
}

export const EdgeLayer = memo(function EdgeLayer({ geoms, selectedId, dimmed, onSelect }: EdgeLayerProps) {
  return (
    <>
      <svg
        className="pointer-events-none absolute top-0 left-0 overflow-visible"
        width={2400}
        height={1600}
        aria-hidden
      >
        {geoms.map((g) => {
          const on = selectedId === g.edge.id;
          const faded = dimmed?.has(g.edge.id) === false;
          const color = on ? "#2563eb" : g.edge.proposed ? "#a1a1aa" : "#a1a1aa";
          return (
            <g key={g.edge.id} opacity={faded ? 0.18 : 1}>
              <line
                x1={g.x1}
                y1={g.y1}
                x2={g.x2}
                y2={g.y2}
                stroke={color}
                strokeWidth={on ? 2 : 1.5}
                strokeDasharray={g.edge.proposed ? "5 5" : undefined}
                className="transition-[stroke] duration-[160ms]"
              />
              <polygon points={g.arrow} fill={color} />
              <line
                x1={g.x1}
                y1={g.y1}
                x2={g.x2}
                y2={g.y2}
                stroke="transparent"
                strokeWidth={14}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(g.edge.id);
                }}
              />
            </g>
          );
        })}
      </svg>

      {geoms.map((g) => {
        const on = selectedId === g.edge.id;
        const faded = dimmed?.has(g.edge.id) === false;
        return (
          <button
            key={g.edge.id}
            type="button"
            style={{ left: g.lx, top: g.ly, opacity: faded ? 0.2 : 1 }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(on ? null : g.edge.id);
            }}
            className={cn(
              "absolute z-10 flex h-5 -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-[5px] border px-1.5 text-[12px] leading-4 whitespace-nowrap transition-[border-color,color] duration-[120ms]",
              on
                ? "border-brand bg-[#eff6ff] text-brand"
                : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink",
            )}
          >
            {g.counter && <span className="size-1.5 rounded-full bg-danger" />}
            {g.label}
          </button>
        );
      })}
    </>
  );
});
