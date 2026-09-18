"use client";

/**
 * CMP-05 관계선. 방향 화살표는 항상 보인다 (브리프 §3.3).
 *
 * 선은 카드의 네 변 중 한 곳에 꽂힌다. 같은 두 카드를 여러 번 잇더라도
 * 서로 겹치지 않게 벌린다. 모양(곡선·직선·꺾은선)과 점선 여부는 보기 설정이고
 * 의미를 바꾸지 않는다 — `근거 후보`의 점선만은 승인 전 상태를 뜻한다.
 */
import { memo } from "react";
import { edgeLabel } from "@/lib/labels";
import type { ReasoningNode, SemanticEdge, Side } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const SIDES: Side[] = ["top", "right", "bottom", "left"];

export const anchorOf = (r: Rect, side: Side) => {
  switch (side) {
    case "top":
      return { x: r.x + r.w / 2, y: r.y };
    case "bottom":
      return { x: r.x + r.w / 2, y: r.y + r.h };
    case "left":
      return { x: r.x, y: r.y + r.h / 2 };
    case "right":
      return { x: r.x + r.w, y: r.y + r.h / 2 };
  }
};

/** 변에서 바깥을 향하는 방향. 곡선의 제어점을 여기로 민다. */
const normalOf = (side: Side) =>
  side === "top"
    ? { x: 0, y: -1 }
    : side === "bottom"
      ? { x: 0, y: 1 }
      : side === "left"
        ? { x: -1, y: 0 }
        : { x: 1, y: 0 };

/**
 * 변을 지정하지 않은 선은 두 카드의 상대 위치로 고른다.
 * 서로 마주보는 변을 쓰므로 선이 카드를 가로지르거나 꼬이지 않는다.
 */
function bestSides(a: Rect, b: Rect): [Side, Side] {
  const dx = b.x + b.w / 2 - (a.x + a.w / 2);
  const dy = b.y + b.h / 2 - (a.y + a.h / 2);
  // 가로로 겹치는 정도를 감안해, 세로로 확실히 떨어져 있으면 위아래를 쓴다.
  const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const preferVertical = Math.abs(dy) > Math.abs(dx) || overlapX > Math.min(a.w, b.w) * 0.5;
  if (preferVertical) return dy > 0 ? ["bottom", "top"] : ["top", "bottom"];
  return dx > 0 ? ["right", "left"] : ["left", "right"];
}

export interface EdgeGeom {
  edge: SemanticEdge;
  path: string;
  lx: number;
  ly: number;
  arrow: string;
  label: string;
  /** 라벨 앞에 붙는 점. 찬성은 초록, 반대는 빨강. */
  dot: "ok" | "danger" | null;
}

const cubicAt = (
  t: number,
  p0: { x: number; y: number },
  c1: { x: number; y: number },
  c2: { x: number; y: number },
  p1: { x: number; y: number },
) => {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
    y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y,
  };
};

export function layoutEdges(
  edges: SemanticEdge[],
  rects: Record<string, Rect>,
  nodes: Map<string, ReasoningNode>,
): EdgeGeom[] {
  // 같은 두 카드 사이의 선끼리는 서로 벌린다. 방향과 무관하게 한 묶음으로 센다.
  const groups = new Map<string, SemanticEdge[]>();
  for (const e of edges) {
    const key = [e.from, e.to].sort().join("~");
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  const out: EdgeGeom[] = [];

  for (const edge of edges) {
    const a = rects[edge.from];
    const b = rects[edge.to];
    if (!a || !b) continue;

    const key = [edge.from, edge.to].sort().join("~");
    const siblings = groups.get(key)!;
    const idx = siblings.indexOf(edge);
    const spread = siblings.length > 1 ? (idx - (siblings.length - 1) / 2) * 34 : 0;

    const [autoA, autoB] = bestSides(a, b);
    const sideA = edge.fromSide ?? autoA;
    const sideB = edge.toSide ?? autoB;

    const na = normalOf(sideA);
    const nb = normalOf(sideB);
    let p0 = anchorOf(a, sideA);
    let p1 = anchorOf(b, sideB);

    // 같은 변에서 여러 선이 나가면 변을 따라 조금씩 어긋나게 둔다.
    if (spread !== 0) {
      const ta = { x: -na.y, y: na.x };
      const tb = { x: -nb.y, y: nb.x };
      p0 = { x: p0.x + ta.x * spread, y: p0.y + ta.y * spread };
      p1 = { x: p1.x + tb.x * spread, y: p1.y + tb.y * spread };
    }

    const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const pull = Math.min(160, Math.max(56, dist / 2.2));
    const c1 = { x: p0.x + na.x * pull, y: p0.y + na.y * pull };
    const c2 = { x: p1.x + nb.x * pull, y: p1.y + nb.y * pull };

    const shape = edge.shape ?? "curve";
    let path: string;
    let mid: { x: number; y: number };
    let tangent: { x: number; y: number };

    if (shape === "straight") {
      path = `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y}`;
      mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
      tangent = { x: p1.x - p0.x, y: p1.y - p0.y };
    } else if (shape === "elbow") {
      const horizontal = sideA === "left" || sideA === "right";
      const bend = horizontal ? { x: p1.x, y: p0.y } : { x: p0.x, y: p1.y };
      path = `M ${p0.x} ${p0.y} L ${bend.x} ${bend.y} L ${p1.x} ${p1.y}`;
      mid = bend;
      tangent = { x: p1.x - bend.x, y: p1.y - bend.y };
    } else {
      path = `M ${p0.x} ${p0.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p1.x} ${p1.y}`;
      mid = cubicAt(0.5, p0, c1, c2, p1);
      const near = cubicAt(0.94, p0, c1, c2, p1);
      tangent = { x: p1.x - near.x, y: p1.y - near.y };
    }

    const ang = Math.atan2(tangent.y, tangent.x);
    const len = 10;
    const half = 5;
    const arrow = [
      [p1.x, p1.y],
      [p1.x - len * Math.cos(ang) + half * Math.sin(ang), p1.y - len * Math.sin(ang) - half * Math.cos(ang)],
      [p1.x - len * Math.cos(ang) - half * Math.sin(ang), p1.y - len * Math.sin(ang) + half * Math.cos(ang)],
    ]
      .map(([x, y]) => `${x},${y}`)
      .join(" ");

    out.push({
      edge,
      path,
      lx: mid.x,
      ly: mid.y,
      arrow,
      label: edgeLabel(edge, nodes.get(edge.to)),
      dot: edge.type === "contradicts" ? "danger" : edge.type === "supports" ? "ok" : null,
    });
  }

  return out;
}

interface EdgeLayerProps {
  geoms: EdgeGeom[];
  selectedId: string | null;
  /** 범위 선택으로 함께 잡힌 선들. */
  selectedIds?: string[];
  dimmed: Set<string> | null;
  onSelect: (id: string | null) => void;
}

export const EdgeLayer = memo(function EdgeLayer({
  geoms,
  selectedId,
  selectedIds,
  dimmed,
  onSelect,
}: EdgeLayerProps) {
  const multi = new Set(selectedIds ?? []);
  return (
    <>
      <svg
        className="pointer-events-none absolute top-0 left-0 overflow-visible"
        width={1}
        height={1}
        aria-hidden
      >
        {geoms.map((g) => {
          const on = selectedId === g.edge.id || multi.has(g.edge.id);
          const faded = dimmed?.has(g.edge.id) === false;
          const color = on ? "#2563eb" : "#a1a1aa";
          // 후보(승인 전)는 언제나 점선이다. 보기 설정보다 이쪽이 우선한다.
          const dash = g.edge.proposed ? "5 5" : g.edge.dashed ? "6 4" : undefined;
          return (
            <g key={g.edge.id} opacity={faded ? 0.18 : 1}>
              <path
                d={g.path}
                fill="none"
                stroke={color}
                strokeWidth={on ? 2 : 1.5}
                strokeDasharray={dash}
                className="transition-[stroke] duration-[160ms]"
              />
              {!g.edge.undirected && <polygon points={g.arrow} fill={color} />}
              <path
                d={g.path}
                fill="none"
                stroke="transparent"
                strokeWidth={16}
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
        const on = selectedId === g.edge.id || multi.has(g.edge.id);
        const faded = dimmed?.has(g.edge.id) === false;
        return (
          <button
            key={g.edge.id}
            type="button"
            data-edge-label={g.edge.id}
            style={{ left: g.lx, top: g.ly, opacity: faded ? 0.2 : 1 }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(on ? null : g.edge.id);
            }}
            className={cn(
              "absolute z-10 flex h-[22px] -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-[5px] border px-2 text-[14px] leading-4 whitespace-nowrap transition-[border-color,color] duration-[120ms]",
              on
                ? "border-brand bg-[#eff6ff] text-brand"
                : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink",
            )}
          >
            {g.dot && (
              <span
                className={cn("size-1.5 rounded-full", g.dot === "danger" ? "bg-danger" : "bg-[#147d4c]")}
              />
            )}
            {g.label}
          </button>
        );
      })}
    </>
  );
});
