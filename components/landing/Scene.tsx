"use client";

/**
 * 소개 페이지·대시보드 썸네일용 정적 캔버스 그림.
 * 와이어프레임 support.js 를 그대로 옮겼다. 치수는 실제 캔버스와 같다
 * (SemanticNode 288px, 곡선 pull 56–160, 화살촉 10/5, SourceChip 176px).
 * 상호작용은 없다 — 실제 캔버스는 components/canvas 를 쓴다.
 */
import { useEffect, useRef, useState } from "react";
import { KIND, type Kind } from "@/lib/labels";

const NW = 288;
const SW = 176;

/** 카드 본문의 절 제목. `body:'heads'` 일 때 이 순서로 그린다. */
const HEADS: Record<Kind, string[]> = {
  problem: ["대상·상황", "불편"],
  claim: ["본문", "검증 계획", "결과 기록", "검토 상태"],
  evidence: ["원문 인용", "출처", "해석", "한계"],
  question: ["상태", "연결 대상", "메모"],
  solution: ["어떻게 해결하나", "상태"],
  decision: ["선택한 해결안", "이유", "기각 대안", "재검토 조건", "열린 질문·위험"],
  requirement: ["사용자 행동", "수용 기준", "범위", "연결된 결정"],
  note: ["내용"],
};

export type Rel =
  | "origin"
  | "support"
  | "counter"
  | "challenge"
  | "basis"
  | "adopt"
  | "reject"
  | "scope"
  | "related"
  | "link";

export const REL: Record<Rel, string> = {
  origin: "이 문제에서 출발",
  support: "지지",
  counter: "반대 근거",
  challenge: "검토 필요",
  basis: "제안의 근거",
  adopt: "채택",
  reject: "기각",
  scope: "구현 범위",
  related: "관련",
  link: "연결",
};

export type Block = { t: "h2" | "text" | "list" | "quote"; text: string; l?: number };

export interface SceneNode {
  id: string;
  type: Kind | "source";
  title: string;
  /** 제목 줄 수. 높이 계산에만 쓴다. */
  lines?: number;
  x: number;
  y: number;
  body?: "heads" | Block[];
  selected?: boolean;
  acts?: [string, string];
  proposed?: boolean;
  /** source 전용 */
  state?: string;
}

export type SceneEdge = [from: string, to: string, rel: Rel];

export interface SceneSpec {
  nodes: SceneNode[];
  edges: SceneEdge[];
  /** 컨텍스트 장면: 보이면 카드가 dx 만큼 오른쪽으로 밀리며 흐려진다. */
  conv?: { dx: number };
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const bh = (b: Block) => (b.t === "h2" ? 26 : 22 * (b.l || 1));
const bodyOf = (n: SceneNode): Block[] =>
  n.body === "heads"
    ? HEADS[n.type as Kind].map((h) => ({ t: "h2", text: h }))
    : Array.isArray(n.body)
      ? n.body
      : [];

export function nodeH(n: SceneNode) {
  if (n.type === "source") return 62;
  const b = bodyOf(n);
  return (
    46 +
    24 * (n.lines || 2) +
    (b.length ? 21 + b.reduce((a, x) => a + bh(x), 0) + 4 * (b.length - 1) : 0) +
    16
  );
}
export const nodeW = (n: SceneNode) => (n.type === "source" ? SW : NW);

/** 세로로 쌓는다. 40px 간격, y 는 top 부터. */
export function col(x: number, nodes: SceneNode[], top = 40, gap = 40) {
  let y = top;
  for (const n of nodes) {
    n.x = x;
    n.y = y;
    y += nodeH(n) + gap;
  }
  return nodes;
}
export const sceneH = (nodes: SceneNode[], pad = 40) =>
  nodes.length ? Math.max(...nodes.map((n) => n.y + nodeH(n))) + pad : 200;

type Rect = { x: number; y: number; w: number; h: number };
type Side = "top" | "bottom" | "left" | "right";
type Pt = { x: number; y: number };

const anchor = (r: Rect, s: Side): Pt =>
  s === "top"
    ? { x: r.x + r.w / 2, y: r.y }
    : s === "bottom"
      ? { x: r.x + r.w / 2, y: r.y + r.h }
      : s === "left"
        ? { x: r.x, y: r.y + r.h / 2 }
        : { x: r.x + r.w, y: r.y + r.h / 2 };
const normal = (s: Side): Pt =>
  s === "top" ? { x: 0, y: -1 } : s === "bottom" ? { x: 0, y: 1 } : s === "left" ? { x: -1, y: 0 } : { x: 1, y: 0 };
function bestSides(a: Rect, b: Rect): [Side, Side] {
  const dx = b.x + b.w / 2 - (a.x + a.w / 2);
  const dy = b.y + b.h / 2 - (a.y + a.h / 2);
  const ov = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const v = Math.abs(dy) > Math.abs(dx) || ov > Math.min(a.w, b.w) * 0.5;
  if (v) return dy > 0 ? ["bottom", "top"] : ["top", "bottom"];
  return dx > 0 ? ["right", "left"] : ["left", "right"];
}
const cubicAt = (t: number, p0: Pt, c1: Pt, c2: Pt, p1: Pt): Pt => {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
    y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y,
  };
};

function geo(a: Rect, b: Rect) {
  const [sa, sb] = bestSides(a, b);
  const p0 = anchor(a, sa);
  const p1 = anchor(b, sb);
  const na = normal(sa);
  const nb = normal(sb);
  const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const pull = Math.min(160, Math.max(56, dist / 2.2));
  const c1 = { x: p0.x + na.x * pull, y: p0.y + na.y * pull };
  const c2 = { x: p1.x + nb.x * pull, y: p1.y + nb.y * pull };
  let L = 0;
  let prev = p0;
  for (let i = 1; i <= 24; i++) {
    const q = cubicAt(i / 24, p0, c1, c2, p1);
    L += Math.hypot(q.x - prev.x, q.y - prev.y);
    prev = q;
  }
  const m = cubicAt(0.5, p0, c1, c2, p1);
  const near = cubicAt(0.94, p0, c1, c2, p1);
  const ang = Math.atan2(p1.y - near.y, p1.x - near.x);
  const len = 10;
  const half = 5;
  const arrow = [
    [p1.x, p1.y],
    [p1.x - len * Math.cos(ang) + half * Math.sin(ang), p1.y - len * Math.sin(ang) - half * Math.cos(ang)],
    [p1.x - len * Math.cos(ang) - half * Math.sin(ang), p1.y - len * Math.sin(ang) + half * Math.cos(ang)],
  ]
    .map(([x, y]) => `${r1(x)},${r1(y)}`)
    .join(" ");
  return {
    path: `M ${r1(p0.x)} ${r1(p0.y)} C ${r1(c1.x)} ${r1(c1.y)}, ${r1(c2.x)} ${r1(c2.y)}, ${r1(p1.x)} ${r1(p1.y)}`,
    L: Math.ceil(L) + 2,
    lx: r1(m.x),
    ly: r1(m.y),
    arrow,
  };
}

const EASE = "cubic-bezier(.22,1,.36,1)";

/** 화면에 30% 이상 들어오면 한 번 true 가 되고 유지된다. */
function useSeen<T extends HTMLElement>(always?: boolean) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(!!always);
  useEffect(() => {
    if (always || !ref.current) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [always]);
  return [ref, seen] as const;
}

export function Scene({
  spec,
  w,
  h,
  dark,
  immediate,
  children,
}: {
  spec: SceneSpec;
  w: number;
  h: number;
  dark?: boolean;
  /** 스크롤 등장 없이 바로 그린다 (썸네일). */
  immediate?: boolean;
  children?: React.ReactNode;
}) {
  const [ref, seen] = useSeen<HTMLDivElement>(immediate);
  const conv = spec.conv;
  const shift = (n: SceneNode) => (conv && seen ? n.x + conv.dx : n.x);
  const rects: Record<string, Rect> = {};
  for (const n of spec.nodes) rects[n.id] = { x: shift(n), y: n.y, w: nodeW(n), h: nodeH(n) };

  return (
    <div
      ref={ref}
      className="absolute top-0 left-0 font-sans text-ink"
      style={{ width: w, height: h }}
    >
      <svg className="pointer-events-none absolute top-0 left-0 overflow-visible" style={{ width: w, height: h }}>
        {spec.edges.map(([s, t, rel], i) => {
          if (!rects[s] || !rects[t]) return null;
          const g = geo(rects[s], rects[t]);
          const op = conv ? (seen ? 0.45 : 1) : seen ? 1 : 0;
          const color = dark ? "#71717a" : "#a1a1aa";
          return (
            <g key={i}>
              <path
                d={g.path}
                style={{
                  fill: "none",
                  stroke: color,
                  strokeWidth: 1.5,
                  strokeDasharray: g.L,
                  strokeDashoffset: conv ? 0 : seen ? 0 : g.L,
                  opacity: op,
                  transition: conv
                    ? "none"
                    : `stroke-dashoffset 900ms ${EASE} ${300 + i * 140}ms, opacity 400ms ${300 + i * 140}ms`,
                }}
              />
              <polygon
                points={g.arrow}
                style={{ fill: color, opacity: op, transition: conv ? "none" : `opacity 300ms ${950 + i * 140}ms` }}
              />
            </g>
          );
        })}
      </svg>
      {spec.edges.map(([s, t, rel], i) => {
        if (!rects[s] || !rects[t]) return null;
        const g = geo(rects[s], rects[t]);
        const op = conv ? (seen ? 0.45 : 1) : seen ? 1 : 0;
        const dot = rel === "counter" ? "#b42318" : rel === "support" ? "#147d4c" : "";
        return (
          <div
            key={`l${i}`}
            className="absolute flex h-[22px] -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-[5px] border px-2 text-[14px] leading-5 whitespace-nowrap"
            style={{
              left: g.lx,
              top: g.ly,
              opacity: op,
              transition: conv ? "none" : `opacity 400ms ${950 + i * 140}ms`,
              background: dark ? "#27272a" : "#fff",
              borderColor: dark ? "#3f3f46" : "#e4e4e7",
              color: dark ? "#d4d4d8" : "#71717a",
            }}
          >
            {dot && <span className="size-1.5 rounded-full" style={{ background: dot }} />}
            {REL[rel]}
          </div>
        );
      })}
      {spec.nodes.map((n, i) => {
        let x = n.x;
        let op = 1;
        let tr = "none";
        if (conv) {
          if (seen) {
            x = shift(n);
            op = 0.45;
          }
        } else if (!seen) {
          op = 0;
          tr = "translateY(12px)";
        }
        const delay = conv ? (seen ? 200 + i * 90 : 0) : i * 90;
        const sel = !!n.selected;
        const body = bodyOf(n);
        return (
          <div
            key={n.id}
            className="absolute"
            style={{
              left: x,
              top: n.y,
              width: nodeW(n),
              opacity: op,
              transform: tr,
              transition: `left 900ms ${EASE} ${delay}ms, opacity 600ms ${EASE} ${delay}ms, transform 700ms ${EASE} ${delay}ms`,
            }}
          >
            {n.type === "source" ? (
              <div className="flex flex-col gap-1.5 rounded-[8px] border border-line bg-surface px-3 py-2.5 shadow-[0_1px_2px_rgba(24,24,27,.04)]">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0 fill-none stroke-muted stroke-[1.8]" strokeLinejoin="round">
                    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6" />
                  </svg>
                  <span className="truncate font-mono text-[13px]">{n.title}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[12px] text-muted">
                  <span className="size-1.5 rounded-full bg-ok" />
                  {n.state ?? "읽음"}
                </div>
              </div>
            ) : (
              <div
                className="relative rounded-[10px] p-4"
                style={{
                  background: n.proposed ? "#fafafa" : "#fff",
                  border: `1px ${n.proposed ? "dashed" : "solid"} ${sel ? "#2563eb" : n.proposed ? "#a1a1aa" : "#e4e4e7"}`,
                  boxShadow: sel
                    ? "0 0 0 3px #eff6ff"
                    : dark
                      ? "0 8px 24px rgba(0,0,0,.35)"
                      : "0 1px 2px rgba(24,24,27,.04)",
                }}
              >
                <div className="mb-2.5 flex h-5 items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[14px] leading-4 font-medium text-muted">
                    <svg width="15" height="15" viewBox="0 0 16 16" className="fill-none stroke-current stroke-[1.4]" strokeLinecap="round" strokeLinejoin="round">
                      <path d={KIND[n.type].icon} />
                    </svg>
                    {KIND[n.type].ko}
                  </span>
                  <span className="font-mono text-[12px] text-faint">{n.id}</span>
                  <span className="flex-1" />
                  {n.proposed && (
                    <span className="rounded-[4px] bg-wash px-1.5 text-[12px] leading-4 font-medium text-warn">AI 제안 · 미확정</span>
                  )}
                  <span className="flex size-6 items-center justify-center text-muted" style={{ opacity: sel ? 1 : 0 }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" className="fill-none stroke-current stroke-[1.5]" strokeLinecap="round" strokeLinejoin="round">
                      <path d={body.length ? "M4 6l4 4 4-4" : "M6 4l4 4-4 4"} />
                    </svg>
                  </span>
                </div>
                <div className="kr text-[16px] leading-6 font-semibold text-ink">{n.title}</div>
                {body.length > 0 && (
                  <div className="mt-2.5 flex flex-col gap-1 border-t border-wash pt-2.5">
                    {body.map((b, j) =>
                      b.t === "h2" ? (
                        <div key={j} className="kr mt-1 text-[13px] leading-[22px] font-semibold text-ink">{b.text}</div>
                      ) : b.t === "list" ? (
                        <div key={j} className="flex items-start gap-2">
                          <span className="mt-[9px] size-1 shrink-0 rounded-full bg-faint" />
                          <span className="kr text-[14px] leading-[22px]">{b.text}</span>
                        </div>
                      ) : b.t === "quote" ? (
                        <div key={j} className="kr border-l-2 border-line pl-2.5 text-[14px] leading-[22px]">{b.text}</div>
                      ) : (
                        <div key={j} className="kr text-[14px] leading-[22px]">{b.text}</div>
                      ),
                    )}
                  </div>
                )}
                {sel &&
                  (["-top-[7px] left-1/2 -translate-x-1/2", "-bottom-[7px] left-1/2 -translate-x-1/2", "top-1/2 -left-[7px] -translate-y-1/2", "top-1/2 -right-[7px] -translate-y-1/2"] as const).map((c) => (
                    <span key={c} className={`absolute size-3.5 rounded-full border-2 border-brand bg-surface ${c}`} />
                  ))}
              </div>
            )}
            {n.acts && (
              <div className="absolute top-full left-0 mt-1.5 flex gap-1 rounded-[8px] border border-line bg-surface p-1 whitespace-nowrap shadow-[0_4px_12px_rgba(24,24,27,.08)]">
                <span className="h-7 rounded-[6px] px-2.5 text-[14px] leading-7 font-medium">{n.acts[0]}</span>
                <span className="h-7 rounded-[6px] bg-wash px-2.5 text-[14px] leading-7 font-medium">{n.acts[1]}</span>
              </div>
            )}
          </div>
        );
      })}
      {children}
    </div>
  );
}

/** 컨테이너 폭에 맞춰 고정 폭(w) 장면을 축소해 넣는다. aspect-ratio 로 높이를 잡는다. */
export function SceneFrame({
  spec,
  w = 1120,
  h,
  dark,
  immediate,
  className,
  style,
  children,
  overlay,
}: {
  spec: SceneSpec;
  w?: number;
  h?: number;
  dark?: boolean;
  immediate?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** 장면 좌표계 안에 같이 축소되어 얹히는 것 */
  children?: React.ReactNode;
  /** 축소되지 않고 프레임 위에 얹히는 것 */
  overlay?: React.ReactNode;
}) {
  const H = h ?? sceneH(spec.nodes);
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / w));
    ro.observe(el);
    setScale(el.clientWidth / w);
    return () => ro.disconnect();
  }, [w]);
  return (
    <div ref={ref} className={className} style={{ position: "relative", width: "100%", aspectRatio: `${w}/${H}`, overflow: "hidden", ...style }}>
      <div className="absolute top-0 left-0 origin-top-left" style={{ width: w, height: H, transform: `scale(${scale})`, visibility: scale ? "visible" : "hidden" }}>
        <Scene spec={spec} w={w} h={H} dark={dark} immediate={immediate}>
          {children}
        </Scene>
      </div>
      {overlay}
    </div>
  );
}
