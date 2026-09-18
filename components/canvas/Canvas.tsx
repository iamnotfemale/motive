"use client";

/**
 * CMP-03 추론 캔버스. 무한 캔버스 — 끝이 없고 도구는 화면에 떠 있다.
 *
 * 캔버스 좌표는 표현 상태다. 카드를 옮겨도 관계는 그대로다 (스펙 §5.4, §12.1).
 * 전체 자동 배치를 넣지 않는다 (§12.2).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Btn } from "@/components/kit";
import { SelectionToolbar } from "./SelectionToolbar";
import { EdgeLayer, anchorOf, layoutEdges, type Rect } from "./Edges";
import { NODE_W, NodeView } from "./SemanticNode";
import { SOURCE_W, SourceChip } from "./SourceChip";
import { EDGE_CHOICES, KIND, choiceOf, kindOf } from "@/lib/labels";
import { tidyLayout } from "@/lib/tidy";
import { useDoc } from "@/lib/store";
import { useUi } from "@/lib/ui";
import type { EdgeType, ReasoningNode, Side } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  pid: string;
  onOpenNode: (id: string) => void;
  onNodeAction: (id: string, index: 0 | 1) => void;
  onAddFromSuggestion: (what: "claim" | "source" | "question" | "coldstart") => void;
  onSourceClick: (sourceId: string, targetId?: string) => void;
  onFilesDropped: (files: File[], at: { x: number; y: number }, targetId?: string) => void;
  onPlaceBlock: (at: { x: number; y: number }) => void;
  onDeleteSelected: () => void;
  onAskAi: (ids: string[]) => void;
  onFork: () => void;
}

type DragKind = "node" | "source" | "pan" | "marquee" | null;

/** 매 렌더마다 새 배열을 만들지 않기 위한 빈 값. */
const EMPTY_SOURCES: never[] = [];

/** 관계 선택지 앞의 점. 찬성은 초록, 반대는 빨강, 나머지는 회색. */
function EdgeDot({ tone }: { tone: "muted" | "ok" | "danger" }) {
  return (
    <span
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        tone === "danger" ? "bg-danger" : tone === "ok" ? "bg-[#147d4c]" : "bg-faint",
      )}
    />
  );
}

/** 포인터에서 가장 가까운 변. 놓는 순간 그 변에 꽂힌다. */
function nearestSide(r: Rect, x: number, y: number): Side {
  const d: [Side, number][] = [
    ["top", Math.abs(y - r.y)],
    ["bottom", Math.abs(y - (r.y + r.h))],
    ["left", Math.abs(x - r.x)],
    ["right", Math.abs(x - (r.x + r.w))],
  ];
  return d.sort((a, b) => a[1] - b[1])[0][0];
}

export function Canvas({
  pid,
  onOpenNode,
  onNodeAction,
  onAddFromSuggestion,
  onSourceClick,
  onFilesDropped,
  onPlaceBlock,
  onDeleteSelected,
  onAskAi,
  onFork,
}: Props) {
  const doc = useDoc((s) => s.docs[pid]);
  const moveNode = useDoc((s) => s.moveNode);
  const store = useDoc.getState;

  const ui = useUi();
  const vpRef = useRef<HTMLDivElement>(null);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [fileOver, setFileOver] = useState(false);
  const [pendingEdge, setPendingEdge] = useState<{
    from: string;
    to: string;
    fromSide: Side;
    toSide: Side;
    x: number;
    y: number;
  } | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const drag = useRef<{
    kind: DragKind;
    id?: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    /** 다중 선택을 함께 옮길 때의 시작 좌표. */
    group?: Record<string, { x: number; y: number }>;
    moved: boolean;
  } | null>(null);

  const onMeasure = useCallback((id: string, h: number) => {
    setHeights((prev) => (prev[id] === h ? prev : { ...prev, [id]: h }));
  }, []);

  const toCanvas = useCallback((clientX: number, clientY: number) => {
    const r = vpRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    const { pan, zoom } = useUi.getState();
    return { x: (clientX - r.left - pan.x) / zoom, y: (clientY - r.top - pan.y) / zoom };
  }, []);

  const rects = useMemo(() => {
    const out: Record<string, Rect> = {};
    if (!doc) return out;
    for (const n of doc.nodes) {
      const p = doc.placements[n.id];
      if (p) out[n.id] = { x: p.x, y: p.y, w: NODE_W, h: heights[n.id] ?? 120 };
    }
    for (const s of doc.sources) {
      const p = doc.placements[s.id];
      if (p) out[s.id] = { x: p.x, y: p.y, w: SOURCE_W, h: heights[s.id] ?? 76 };
    }
    return out;
  }, [doc, heights]);

  // 포인터 리스너가 매 프레임 다시 붙지 않도록 최신 값을 ref 로 들고 다닌다.
  const rectsRef = useRef(rects);
  rectsRef.current = rects;
  const docRef = useRef(doc);
  docRef.current = doc;

  const nodeMap = useMemo(() => new Map((doc?.nodes ?? []).map((n) => [n.id, n])), [doc]);

  /** 카드별로 그 카드에 떨어뜨린 자료 묶음. */
  const attachedBy = useMemo(() => {
    const m = new Map<string, typeof doc.sources>();
    for (const s of doc?.sources ?? []) {
      if (!s.attachedTo) continue;
      m.set(s.attachedTo, [...(m.get(s.attachedTo) ?? []), s]);
    }
    return m;
  }, [doc]);
  const geoms = useMemo(() => (doc ? layoutEdges(doc.edges, rects, nodeMap) : []), [doc, rects, nodeMap]);

  /**
   * 집중 보기 — 고른 카드에서 뻗어 나가는 줄기를 통째로 남기고 나머지는 흐리게.
   * 형제 가지(다른 가설과 그 아래)는 빠지고, 줄기에 붙은 근거·질문은 남는다.
   */
  const focus = useMemo(() => {
    if (!doc) return null;

    // 도구 막대에서 비추는 중이면 그 묶음만 남긴다
    if (ui.spotlight) {
      const keep = new Set(ui.spotlight.ids);
      const keepEdges = new Set<string>();
      for (const e of doc.edges) if (keep.has(e.from) && keep.has(e.to)) keepEdges.add(e.id);
      return { keep, keepEdges };
    }

    if (!ui.focusView) return null;
    const keep = new Set<string>([ui.focusView]);

    // 1) 방향을 따라 내려가며 모두 담는다
    const queue = [ui.focusView];
    while (queue.length) {
      const id = queue.shift()!;
      for (const e of doc.edges) {
        if (e.from === id && !keep.has(e.to)) {
          keep.add(e.to);
          queue.push(e.to);
        }
        // 무방향 연결은 양쪽 다 줄기로 본다
        if (e.undirected && e.to === id && !keep.has(e.from)) {
          keep.add(e.from);
          queue.push(e.from);
        }
      }
    }

    // 2) 줄기에 붙은 근거·질문은 한 홉까지 같이 남긴다
    const stem = new Set(keep);
    for (const e of doc.edges) if (stem.has(e.to)) keep.add(e.from);

    const keepEdges = new Set<string>();
    for (const e of doc.edges) if (keep.has(e.from) && keep.has(e.to)) keepEdges.add(e.id);
    return { keep, keepEdges };
  }, [ui.focusView, ui.spotlight, doc]);

  /* ── 화면 이동·확대는 전부 여기를 거친다. 한 번에 하나만 돈다 ── */
  const viewAnim = useRef<number | null>(null);
  const animateView = useCallback((target: { pan: { x: number; y: number }; zoom: number }) => {
    if (viewAnim.current) cancelAnimationFrame(viewAnim.current);
    const from = { pan: { ...useUi.getState().pan }, zoom: useUi.getState().zoom };
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      useUi.getState().setZoom(target.zoom);
      useUi.getState().setPan(target.pan);
      return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 380);
      const e = 1 - Math.pow(1 - t, 3);
      useUi.getState().setZoom(from.zoom + (target.zoom - from.zoom) * e);
      useUi.getState().setPan({
        x: from.pan.x + (target.pan.x - from.pan.x) * e,
        y: from.pan.y + (target.pan.y - from.pan.y) * e,
      });
      if (t < 1) viewAnim.current = requestAnimationFrame(step);
    };
    viewAnim.current = requestAnimationFrame(step);
  }, []);

  /**
   * 아래 세 effect 는 요청 번호가 바뀔 때만 돈다.
   * doc·rects 를 의존성에 넣으면 카드를 끄는 내내 다시 실행돼 화면이 튄다.
   */
  const handled = useRef({ center: 0, fit: 0, zoom: 0, tidy: 0 });

  /* 확대·축소 단추 — 화면 가운데를 기준으로 부드럽게 */
  useEffect(() => {
    const req = ui.zoomTo;
    const vp = vpRef.current;
    if (!req || !vp || handled.current.zoom === req.nonce) return;
    handled.current.zoom = req.nonce;
    const { pan, zoom } = useUi.getState();
    const z = Math.min(2, Math.max(0.3, req.z));
    const cx = vp.clientWidth / 2;
    const cy = vp.clientHeight / 2;
    animateView({
      zoom: z,
      pan: { x: cx - (cx - pan.x) * (z / zoom), y: cy - (cy - pan.y) * (z / zoom) },
    });
  }, [ui.zoomTo, animateView]);

  /* ── 카드를 새로 만들었을 때만 화면 가운데로. 클릭·드래그로는 움직이지 않는다 ── */
  useEffect(() => {
    const req = ui.center;
    const vp = vpRef.current;
    if (!req || !vp || handled.current.center === req.nonce) return;
    handled.current.center = req.nonce;

    const at = docRef.current?.placements[req.id];
    if (!at) return;
    const zoom = useUi.getState().zoom;
    const h = rectsRef.current[req.id]?.h ?? 140;
    animateView({
      zoom,
      pan: {
        x: vp.clientWidth / 2 - (at.x + NODE_W / 2) * zoom,
        y: vp.clientHeight / 2 - (at.y + h / 2) * zoom,
      },
    });
  }, [ui.center, animateView]);

  /* ── 화면 맞춤 — 고른 카드가 있으면 그 카드만 크게 ── */
  useEffect(() => {
    const vp = vpRef.current;
    if (!ui.fit || !vp || handled.current.fit === ui.fit) return;
    handled.current.fit = ui.fit;

    const all = rectsRef.current;
    const ids = useUi.getState().sel.filter((id) => all[id]);
    const targets = ids.length ? ids : Object.keys(all);
    if (!targets.length) return;

    const box = targets.reduce(
      (acc, id) => {
        const r = all[id];
        return {
          x0: Math.min(acc.x0, r.x),
          y0: Math.min(acc.y0, r.y),
          x1: Math.max(acc.x1, r.x + r.w),
          y1: Math.max(acc.y1, r.y + r.h),
        };
      },
      { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity },
    );

    const pad = ids.length ? 120 : 80;
    const zoom = Math.min(
      2,
      Math.max(0.3, Math.min((vp.clientWidth - pad * 2) / (box.x1 - box.x0), (vp.clientHeight - pad * 2) / (box.y1 - box.y0))),
    );
    animateView({
      zoom,
      pan: {
        x: vp.clientWidth / 2 - ((box.x0 + box.x1) / 2) * zoom,
        y: vp.clientHeight / 2 - ((box.y0 + box.y1) / 2) * zoom,
      },
    });
  }, [ui.fit, animateView]);

  /* ── 정리 — 관계 기준 격자로 다시 놓는다 (스펙 §12.2: 사용자가 눌렀을 때만) ── */
  useEffect(() => {
    const req = ui.tidy;
    if (!req || handled.current.tidy === req) return;
    handled.current.tidy = req;
    const d = docRef.current;
    if (!d) return;

    const spots = tidyLayout(d.nodes, d.edges, d.sources, rectsRef.current);
    const ids = Object.keys(spots);
    if (!ids.length) return;

    store().pushHistory(pid);
    for (const id of ids) store().moveNode(pid, id, { ...d.placements[id], ...spots[id] });
    useUi.getState().requestFit();
  }, [ui.tidy, pid, store]);

  /* ── 포인터 드래그 ── */
  function startDrag(kind: Exclude<DragKind, null>, e: React.PointerEvent, id?: string) {
    const origin =
      kind === "marquee" ? toCanvas(e.clientX, e.clientY) : id ? doc?.placements[id] : useUi.getState().pan;
    if (!origin) return;
    // 포인터 캡처는 있으면 좋고 없어도 된다. 실패해도 드래그는 계속되어야 한다.
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* 활성 포인터가 아니면 무시 */
    }

    let group: Record<string, { x: number; y: number }> | undefined;
    if (id && kind !== "marquee") {
      store().pushHistory(pid);
      const sel = useUi.getState().sel;
      if (sel.length > 1 && sel.includes(id)) {
        group = {};
        for (const sid of sel) {
          const at = doc?.placements[sid];
          if (at) group[sid] = { x: at.x, y: at.y };
        }
      }
    }

    drag.current = {
      kind,
      id,
      startX: e.clientX,
      startY: e.clientY,
      originX: origin.x,
      originY: origin.y,
      group,
      moved: false,
    };
    if (kind === "marquee") setMarquee({ x0: origin.x, y0: origin.y, x1: origin.x, y1: origin.y });
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const conn = useUi.getState().connecting;
      if (conn) {
        const at = toCanvas(e.clientX, e.clientY);
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const over = el?.closest("[data-node-id]")?.getAttribute("data-node-id") ?? null;
        const valid = over && over !== conn.from ? over : null;
        const r = valid ? rectsRef.current[valid] : null;
        useUi.getState().setConnecting({
          ...conn,
          x: at.x,
          y: at.y,
          over: valid,
          overSide: r ? nearestSide(r, at.x, at.y) : null,
        });
        return;
      }

      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.moved && Math.hypot(dx, dy) < 3) return;
      d.moved = true;

      if (d.kind === "marquee") {
        const at = toCanvas(e.clientX, e.clientY);
        setMarquee({ x0: d.originX, y0: d.originY, x1: at.x, y1: at.y });
        return;
      }
      if (d.kind === "pan") {
        useUi.getState().setPan({ x: d.originX + dx, y: d.originY + dy });
        return;
      }
      if (!d.id) return;

      const z = useUi.getState().zoom;
      if (d.group) {
        for (const [sid, at] of Object.entries(d.group))
          moveNode(pid, sid, { x: Math.round(at.x + dx / z), y: Math.round(at.y + dy / z) });
      } else {
        moveNode(pid, d.id, { x: Math.round(d.originX + dx / z), y: Math.round(d.originY + dy / z) });
      }

      if (d.kind === "source") {
        useUi.getState().setDragging(true);
        const el = document.elementFromPoint(e.clientX, e.clientY);
        useUi.getState().setDropTarget(el?.closest("[data-node-id]")?.getAttribute("data-node-id") ?? null);
      }
    }

    function onUp(e: PointerEvent) {
      const conn = useUi.getState().connecting;
      if (conn) {
        useUi.getState().setConnecting(null);
        if (conn.over && conn.over !== conn.from) {
          setPendingEdge({
            from: conn.from,
            to: conn.over,
            fromSide: conn.side,
            toSide: conn.overSide ?? "left",
            x: e.clientX,
            y: e.clientY,
          });
        }
        return;
      }

      const d = drag.current;
      drag.current = null;
      if (!d) return;

      if (d.kind === "marquee") {
        const m = marqueeRef.current;
        setMarquee(null);
        if (m && d.moved) {
          const x0 = Math.min(m.x0, m.x1);
          const x1 = Math.max(m.x0, m.x1);
          const y0 = Math.min(m.y0, m.y1);
          const y1 = Math.max(m.y0, m.y1);
          // 카드와 자료 아이콘 모두 잡는다.
          const hit = Object.entries(rectsRef.current)
            .filter(([, r]) => r.x < x1 && r.x + r.w > x0 && r.y < y1 && r.y + r.h > y0)
            .map(([id]) => id);
          useUi.getState().select(hit);
          // 양 끝이 다 들어온 관계선도 같이 고른다. select 뒤에 불러야 지워지지 않는다.
          const inside = new Set(hit);
          useUi.getState().setSelEdges(
            (docRef.current?.edges ?? [])
              .filter((e) => inside.has(e.from) && inside.has(e.to))
              .map((e) => e.id),
          );
        }
        return;
      }

      const { dropTarget } = useUi.getState();
      useUi.getState().setDragging(false);
      useUi.getState().setDropTarget(null);

      if (d.kind === "source" && d.id) {
        if (d.moved && dropTarget) onSourceClick(d.id, dropTarget);
        else if (!d.moved) onSourceClick(d.id);
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [pid, moveNode, onSourceClick, toCanvas, store]);

  // onUp 안에서 최신 마퀴 값을 읽기 위한 거울
  const marqueeRef = useRef(marquee);
  marqueeRef.current = marquee;

  /* ── 파일 드롭 ── */
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setFileOver(false);
    const files = [...e.dataTransfer.files];
    if (!files.length) return;
    const at = toCanvas(e.clientX, e.clientY);
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = el?.closest("[data-node-id]")?.getAttribute("data-node-id") ?? undefined;
    onFilesDropped(files, { x: Math.round(at.x - SOURCE_W / 2), y: Math.round(at.y - 38) }, target);
    useUi.getState().setDropTarget(null);
  }

  function onDragOver(e: React.DragEvent) {
    if (![...e.dataTransfer.types].includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!fileOver) setFileOver(true);
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = el?.closest("[data-node-id]")?.getAttribute("data-node-id") ?? null;
    if (useUi.getState().dropTarget !== target) useUi.getState().setDropTarget(target);
  }

  useEffect(() => {
    const el = vpRef.current;
    if (!el) return;
    function onWheel(ev: WheelEvent) {
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      const box = el!.getBoundingClientRect();
      const { pan, zoom } = useUi.getState();
      const next = Math.min(2, Math.max(0.3, zoom * (ev.deltaY > 0 ? 0.94 : 1.06)));
      // 포인터가 가리키던 지점이 제자리에 남도록 pan 을 같이 옮긴다.
      const cx = ev.clientX - box.left;
      const cy = ev.clientY - box.top;
      useUi.getState().setZoom(next);
      useUi.getState().setPan({
        x: cx - (cx - pan.x) * (next / zoom),
        y: cy - (cy - pan.y) * (next / zoom),
      });
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  if (!doc) return null;

  const showSuggest = doc.nodes.length <= 1 && !ui.panel;
  const anchor = doc.placements["P-01"];
  const hand = ui.tool === "hand";
  const addTool = ui.tool === "add";
  const connecting = ui.connecting;
  const selectedEdge = ui.selEdge ? doc.edges.find((e) => e.id === ui.selEdge) : null;
  const selectedNodes = ui.sel.filter((id) => nodeMap.has(id));
  // 자료 아이콘도 함께 고른다. 지우기·복제·접기는 묶음 전체에 걸린다.
  const selectedAll = ui.sel.filter((id) => rects[id]);

  // 선택 묶음의 화면 좌표 — 위에 붙는 도구 막대 자리
  const selBox = selectedAll.length
    ? selectedAll.reduce(
        (acc, id) => {
          const r = rects[id];
          if (!r) return acc;
          return {
            x0: Math.min(acc.x0, r.x),
            y0: Math.min(acc.y0, r.y),
            x1: Math.max(acc.x1, r.x + r.w),
          };
        },
        { x0: Infinity, y0: Infinity, x1: -Infinity },
      )
    : null;

  return (
    <div
      ref={vpRef}
      data-canvas
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) {
          setFileOver(false);
          useUi.getState().setDropTarget(null);
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        // 가운데·오른쪽 버튼은 어디서 눌러도 화면 이동
        if (e.button === 1 || e.button === 2) {
          e.preventDefault();
          startDrag("pan", e);
          return;
        }
        if (e.button !== 0) return;
        const onItem = (e.target as Element).closest("[data-node-id],[data-source-id],[data-ui]");
        if (onItem && !hand) return;

        if (addTool && !onItem) {
          const at = toCanvas(e.clientX, e.clientY);
          onPlaceBlock({ x: Math.round(at.x - NODE_W / 2), y: Math.round(at.y - 60) });
          return;
        }
        if (hand) {
          startDrag("pan", e);
          return;
        }
        // 빈 곳에서 끌면 범위 선택. 가운데 버튼이나 Space 없이도 손 도구로 이동할 수 있다.
        useUi.getState().select([]);
        useUi.getState().selectEdge(null);
        if (ui.panel === "refine") useUi.getState().closePanel();
        startDrag("marquee", e);
      }}
      className={cn(
        // 캔버스를 끌 때 글자가 파랗게 잡히지 않게 한다
        "relative min-w-0 flex-1 overflow-hidden select-none [-webkit-user-select:none]",
        ui.grid && "canvas-grid",
        hand ? (drag.current?.kind === "pan" ? "cursor-grabbing" : "cursor-grab") : "cursor-default",
        addTool && "cursor-crosshair",
      )}
    >
      <div
        style={{
          transform: `translate(${ui.pan.x}px, ${ui.pan.y}px) scale(${ui.zoom})`,
          transformOrigin: "0 0",
        }}
        className={cn("absolute top-0 left-0", hand && "pointer-events-none")}
      >
        <EdgeLayer
          geoms={geoms}
          selectedId={ui.selEdge}
          selectedIds={ui.selEdges}
          dimmed={focus ? focus.keepEdges : null}
          onSelect={(id) => {
            useUi.getState().selectEdge(id);
            // 화살표가 가리키는 쪽부터 아래로 집중한다
            const e = id ? doc.edges.find((x) => x.id === id) : null;
            useUi.getState().setFocusView(e ? e.to : null);
          }}
        />

        {connecting && rects[connecting.from] && (
          <svg className="pointer-events-none absolute top-0 left-0 overflow-visible" width={1} height={1}>
            <line
              x1={anchorOf(rects[connecting.from], connecting.side).x}
              y1={anchorOf(rects[connecting.from], connecting.side).y}
              x2={connecting.x}
              y2={connecting.y}
              stroke="#2563eb"
              strokeWidth={1.5}
              strokeDasharray="5 5"
            />
          </svg>
        )}

        {marquee && (
          <div
            style={{
              left: Math.min(marquee.x0, marquee.x1),
              top: Math.min(marquee.y0, marquee.y1),
              width: Math.abs(marquee.x1 - marquee.x0),
              height: Math.abs(marquee.y1 - marquee.y0),
            }}
            className="pointer-events-none absolute rounded-[2px] border border-brand bg-brand/10"
          />
        )}

        <AnimatePresence>
          {doc.nodes.map((n: ReasoningNode) => {
            const p = doc.placements[n.id];
            if (!p) return null;
            const selected = ui.sel.length === 1 && ui.sel[0] === n.id;
            return (
              <NodeView
                key={n.id}
                node={n}
                x={p.x}
                y={p.y}
                collapsed={Boolean(p.collapsed)}
                selected={selected}
                multi={ui.sel.length > 1 && ui.sel.includes(n.id)}
                hovered={ui.hover === n.id}
                focused={ui.focusId === n.id}
                dropTarget={ui.dropTarget === n.id}
                connectTarget={connecting?.over === n.id}
                connectSide={connecting?.over === n.id ? connecting.overSide : null}
                connecting={Boolean(connecting) && connecting!.from !== n.id}
                dimmed={Boolean(focus && !focus.keep.has(n.id))}
                source={doc.sources.find((s) => s.id === n.sourceId)}
                attached={attachedBy.get(n.id) ?? EMPTY_SOURCES}
                onOpenSource={(sid) => onSourceClick(sid, n.id)}
                showActions={(ui.hover === n.id || selected) && ui.sel.length <= 1 && !connecting}
                onMeasure={onMeasure}
                onPointerDown={(e) => {
                  if (hand || e.button !== 0) return;
                  e.stopPropagation();
                  // 기본 포커스를 막아 캔버스가 스스로 스크롤하지 않게 한다 (화면 흔들림의 원인)
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).focus({ preventScroll: true });
                  startDrag("node", e, n.id);
                }}
                onClick={(e) => {
                  if (hand) return;
                  e.stopPropagation();
                  if (drag.current?.moved) return;
                  // 고르기만 한다. 오른쪽 패널은 도구 막대에서 직접 연다.
                  if (e.shiftKey) useUi.getState().toggleSelect(n.id);
                  else useUi.getState().select([n.id]);
                }}
                onOpen={() => onOpenNode(n.id)}
                onHover={(v) => useUi.getState().setHover(v ? n.id : null)}
                onFocus={(v) => useUi.getState().setFocus(v ? n.id : null)}
                onAction={(i) => onNodeAction(n.id, i)}
                onToggleCollapse={() => store().setCollapsed(pid, n.id, !p.collapsed)}
                onStartConnect={(side, e) => {
                  const r = rects[n.id];
                  if (!r) return;
                  try {
                    (e.target as Element).setPointerCapture?.(e.pointerId);
                  } catch {
                    /* 무시 */
                  }
                  const a = anchorOf(r, side);
                  useUi.getState().setConnecting({
                    from: n.id,
                    side,
                    x: a.x,
                    y: a.y,
                    over: null,
                    overSide: null,
                  });
                }}
                onSourceClick={() => {
                  if (n.sourceId) onSourceClick(n.sourceId, n.id);
                }}
              />
            );
          })}

          {doc.sources.map((s) => {
            const p = doc.placements[s.id];
            if (!p) return null;
            return (
              <SourceChip
                key={s.id}
                source={s}
                x={p.x}
                y={p.y}
                selected={ui.sel.includes(s.id)}
                hovered={ui.hover === s.id}
                dragging={ui.dragging && drag.current?.id === s.id}
                dimmed={Boolean(focus)}
                evidenceCount={doc.nodes.filter((n) => n.sourceId === s.id).length}
                onMeasure={onMeasure}
                onPointerDown={(e) => {
                  if (hand || e.button !== 0) return;
                  e.stopPropagation();
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).focus({ preventScroll: true });
                  startDrag("source", e, s.id);
                }}
                onClick={(e) => {
                  if (hand) return;
                  e.stopPropagation();
                  if (drag.current?.moved) return;
                  useUi.getState().select([s.id]);
                }}
                onHover={(v) => useUi.getState().setHover(v ? s.id : null)}
              />
            );
          })}
        </AnimatePresence>

        {showSuggest && anchor && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, delay: 0.15 }}
            data-ui="suggest"
            style={{ left: anchor.x + NODE_W + 56, top: anchor.y }}
            className="absolute flex w-[240px] flex-col gap-1.5"
          >
            <span className="pl-0.5 text-[14px] leading-4 text-muted">다음으로 이어가기</span>
            {(
              [
                ["claim", "가설 추가"],
                ["source", "자료로 근거 찾기"],
                ["question", "검토 질문 추가"],
                ["coldstart", "불확실한 것부터 정리"],
              ] as const
            ).map(([what, label]) => (
              <Btn
                key={what}
                variant="dashed"
                className="justify-start gap-2 px-3"
                onClick={() => onAddFromSuggestion(what)}
              >
                <span className="text-muted">+</span>
                {label}
              </Btn>
            ))}
          </motion.div>
        )}
      </div>

      {/* 선택한 카드 위에 붙는 도구 막대 */}
      {selBox && !connecting && !drag.current?.moved && (
        <SelectionToolbar
          count={selectedAll.length}
          single={selectedAll.length === 1 && selectedNodes.length === 1}
          x={ui.pan.x + ((selBox.x0 + selBox.x1) / 2) * ui.zoom}
          y={ui.pan.y + selBox.y0 * ui.zoom}
          collapsed={selectedNodes.length > 0 && selectedNodes.every((id) => doc.placements[id]?.collapsed)}
          onOpen={() => onOpenNode(selectedNodes[0])}
          onFocus={() => useUi.getState().setFocusView(selectedNodes[0])}
          onCollapse={() => {
            const next = !selectedNodes.every((id) => doc.placements[id]?.collapsed);
            for (const id of selectedNodes) store().setCollapsed(pid, id, next);
          }}
          onDelete={onDeleteSelected}
          onAi={() => onAskAi(selectedNodes)}
          onFork={onFork}
        />
      )}

      {/* 관계 종류 고르기 */}
      {pendingEdge && (
        <>
          <div className="fixed inset-0 z-30" onPointerDown={() => setPendingEdge(null)} />
          <div
            style={{ left: pendingEdge.x, top: pendingEdge.y }}
            className="fixed z-40 w-56 -translate-x-1/2 overflow-hidden rounded-[8px] border border-line bg-surface shadow-[0_8px_24px_rgba(24,24,27,.14)] animate-pop-in"
          >
            <div className="flex items-center gap-1.5 border-b border-line px-3 py-2 font-mono text-[13px] text-muted">
              {pendingEdge.from} → {pendingEdge.to}
            </div>
            <div className="p-1">
              {EDGE_CHOICES.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => {
                    store().addEdge(pid, {
                      from: pendingEdge.from,
                      to: pendingEdge.to,
                      type: o.type as EdgeType,
                      undirected: o.undirected,
                      fromSide: pendingEdge.fromSide,
                      toSide: pendingEdge.toSide,
                    });
                    setPendingEdge(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[15px] hover:bg-wash"
                >
                  <EdgeDot tone={o.tone} />
                  {o.ko}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 선을 고르면 관계와 모양을 바꿀 수 있다 */}
      {selectedEdge && (
        <div
          data-ui="edgestyle"
          className="absolute bottom-28 left-1/2 z-20 flex w-max -translate-x-1/2 flex-col gap-1 rounded-[10px] border border-line bg-surface p-2 shadow-[0_6px_24px_rgba(24,24,27,.10)] animate-fade-up"
        >
          <div className="flex items-center gap-1">
            <span className="px-1.5 font-mono text-[13px] whitespace-nowrap text-muted">
              {selectedEdge.from} {selectedEdge.undirected ? "—" : "→"} {selectedEdge.to}
            </span>
            <span className="mx-0.5 h-5 w-px bg-line" />
            {EDGE_CHOICES.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() =>
                  store().patchEdge(pid, selectedEdge.id, {
                    type: o.type as EdgeType,
                    undirected: o.undirected ?? false,
                  })
                }
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-[6px] px-2.5 text-[13px] font-medium whitespace-nowrap hover:bg-wash",
                  choiceOf(selectedEdge) === o.key ? "bg-[#eff6ff] text-brand" : "text-muted",
                )}
              >
                <EdgeDot tone={o.tone} />
                {o.ko}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 border-t border-line pt-1">
            <span className="px-1.5 text-[13px] whitespace-nowrap text-faint">선 모양</span>
            {(
              [
                ["curve", "곡선"],
                ["straight", "직선"],
                ["elbow", "꺾은선"],
              ] as const
            ).map(([shape, ko]) => (
              <button
                key={shape}
                type="button"
                onClick={() => store().patchEdge(pid, selectedEdge.id, { shape })}
                className={cn(
                  "h-7 rounded-[6px] px-2.5 text-[13px] font-medium whitespace-nowrap hover:bg-wash",
                  (selectedEdge.shape ?? "curve") === shape ? "bg-[#eff6ff] text-brand" : "text-muted",
                )}
              >
                {ko}
              </button>
            ))}
            <button
              type="button"
              onClick={() => store().patchEdge(pid, selectedEdge.id, { dashed: !selectedEdge.dashed })}
              className={cn(
                "h-7 rounded-[6px] px-2.5 text-[13px] font-medium whitespace-nowrap hover:bg-wash",
                selectedEdge.dashed ? "bg-[#eff6ff] text-brand" : "text-muted",
              )}
            >
              점선
            </button>
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => {
                store().removeEdge(pid, selectedEdge.id);
                useUi.getState().selectEdge(null);
                useUi.getState().setFocusView(null);
              }}
              className="h-7 rounded-[6px] px-2.5 text-[13px] font-medium whitespace-nowrap text-danger hover:bg-wash"
            >
              관계 지우기
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {fileOver && !ui.dropTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-[10px] border-2 border-dashed border-brand bg-brand/[0.03]"
          >
            <span className="rounded-[6px] bg-brand px-3 py-1.5 text-[15px] text-white">
              놓으면 자료로 올라가요 · 카드 위에 놓으면 그 카드에 첨부돼요
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {ui.spotlight && (
        <div
          data-ui="spotlight"
          className="absolute top-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2.5 rounded-[8px] border border-line bg-surface py-2 pr-2 pl-3.5 text-[15px] shadow-[0_4px_12px_rgba(24,24,27,.08)] animate-fade-up"
        >
          <span className="font-medium">{ui.spotlight.ko}</span>
          <span className="text-muted">
            {ui.spotlight.ids.length}개만 보고 있어요. 나머지는 그대로 있어요.
          </span>
          <Btn size="sm" onClick={() => useUi.getState().setSpotlight(null)}>
            전체 보기
          </Btn>
        </div>
      )}

      {ui.focusView && !ui.spotlight && (
        <div
          data-ui="focus"
          className="absolute top-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2.5 rounded-[8px] border border-line bg-surface py-2 pr-2 pl-3.5 text-[15px] shadow-[0_4px_12px_rgba(24,24,27,.08)] animate-fade-up"
        >
          <span className="font-mono text-[14px] text-muted">{ui.focusView}</span>
          <span>
            {nodeMap.get(ui.focusView) ? KIND[kindOf(nodeMap.get(ui.focusView)!)].ko : "이 카드"} 주변만
            보고 있어요. 배치는 그대로예요.
          </span>
          <Btn size="sm" onClick={() => useUi.getState().setFocusView(null)}>
            전체 보기
          </Btn>
        </div>
      )}

      {addTool && (
        <div className="pointer-events-none absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded-[6px] bg-ink px-3 py-1.5 text-[14px] text-white">
          캔버스를 눌러 블록을 놓으세요 · Esc 로 취소
        </div>
      )}

      <span className="pointer-events-none absolute right-4 bottom-4 font-mono text-[13px] text-faint">
        {doc.nodes.length} 카드 · {doc.edges.length} 관계
      </span>
    </div>
  );
}
