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
import { EdgeLayer, layoutEdges, type Rect } from "./Edges";
import { NODE_W, NodeView, type Side } from "./SemanticNode";
import { SOURCE_W, SourceChip } from "./SourceChip";
import { EDGE_OPTIONS, KIND, kindOf } from "@/lib/labels";
import { useDoc } from "@/lib/store";
import { useUi } from "@/lib/ui";
import type { EdgeType, ReasoningNode } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  pid: string;
  onOpenNode: (id: string) => void;
  onNodeAction: (id: string, index: 0 | 1) => void;
  onAddFromSuggestion: (what: "claim" | "source" | "question" | "coldstart") => void;
  onSourceClick: (sourceId: string, targetId?: string) => void;
  onFilesDropped: (files: File[], at: { x: number; y: number }, targetId?: string) => void;
  /** 블록 추가 도구로 빈 곳을 눌렀을 때. */
  onPlaceBlock: (at: { x: number; y: number }) => void;
}

type DragKind = "node" | "source" | "pan" | null;

export function Canvas({
  pid,
  onOpenNode,
  onNodeAction,
  onAddFromSuggestion,
  onSourceClick,
  onFilesDropped,
  onPlaceBlock,
}: Props) {
  const doc = useDoc((s) => s.docs[pid]);
  const moveNode = useDoc((s) => s.moveNode);
  const store = useDoc.getState;

  const ui = useUi();
  const vpRef = useRef<HTMLDivElement>(null);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [fileOver, setFileOver] = useState(false);
  const [pendingEdge, setPendingEdge] = useState<{ from: string; to: string; x: number; y: number } | null>(
    null,
  );

  const drag = useRef<{
    kind: DragKind;
    id?: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  const onMeasure = useCallback((id: string, h: number) => {
    setHeights((prev) => (prev[id] === h ? prev : { ...prev, [id]: h }));
  }, []);

  const toCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const r = vpRef.current?.getBoundingClientRect();
      if (!r) return { x: 0, y: 0 };
      const { pan, zoom } = useUi.getState();
      return { x: (clientX - r.left - pan.x) / zoom, y: (clientY - r.top - pan.y) / zoom };
    },
    [],
  );

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

  const nodeMap = useMemo(() => new Map((doc?.nodes ?? []).map((n) => [n.id, n])), [doc]);
  const geoms = useMemo(() => (doc ? layoutEdges(doc.edges, rects, nodeMap) : []), [doc, rects, nodeMap]);

  /* ── Focus View — 고른 카드 주변만 남기고 나머지는 회색으로 (스펙 §12.3) ── */
  const focus = useMemo(() => {
    if (!ui.focusView || !doc) return null;
    const keep = new Set<string>([ui.focusView]);
    const keepEdges = new Set<string>();
    for (const e of doc.edges) {
      if (e.from === ui.focusView || e.to === ui.focusView) {
        keep.add(e.from);
        keep.add(e.to);
        keepEdges.add(e.id);
      }
    }
    for (const e of doc.edges) if (keep.has(e.from) && keep.has(e.to)) keepEdges.add(e.id);
    return { keep, keepEdges };
  }, [ui.focusView, doc]);

  /* ── 새 카드가 생기면 그 카드를 화면 가운데로 부드럽게 ── */
  const centerAnim = useRef<number | null>(null);
  useEffect(() => {
    const req = ui.center;
    if (!req || !doc) return;
    const at = doc.placements[req.id];
    const vp = vpRef.current;
    if (!at || !vp) return;

    const { zoom, pan } = useUi.getState();
    const h = heights[req.id] ?? 140;
    const target = {
      x: vp.clientWidth / 2 - (at.x + NODE_W / 2) * zoom,
      y: vp.clientHeight / 2 - (at.y + h / 2) * zoom,
    };
    const from = { ...pan };
    const t0 = performance.now();
    const dur = 420;

    if (centerAnim.current) cancelAnimationFrame(centerAnim.current);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      useUi.getState().setPan(target);
      return;
    }
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      useUi.getState().setPan({
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
      });
      if (t < 1) centerAnim.current = requestAnimationFrame(step);
    };
    centerAnim.current = requestAnimationFrame(step);
    return () => {
      if (centerAnim.current) cancelAnimationFrame(centerAnim.current);
    };
    // 좌표가 잡힌 뒤 한 번만 돈다
  }, [ui.center, doc, heights]);

  /* ── 포인터 드래그 ── */
  function startDrag(kind: Exclude<DragKind, null>, e: React.PointerEvent, id?: string) {
    const origin = id ? doc?.placements[id] : useUi.getState().pan;
    if (!origin) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (id) store().pushHistory(pid);
    drag.current = {
      kind,
      id,
      startX: e.clientX,
      startY: e.clientY,
      originX: origin.x,
      originY: origin.y,
      moved: false,
    };
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const conn = useUi.getState().connecting;
      if (conn) {
        const at = toCanvas(e.clientX, e.clientY);
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const over = el?.closest("[data-node-id]")?.getAttribute("data-node-id") ?? null;
        useUi.getState().setConnecting({ ...conn, x: at.x, y: at.y, over: over === conn.from ? null : over });
        return;
      }

      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.moved && Math.hypot(dx, dy) < 3) return;
      d.moved = true;

      if (d.kind === "pan") {
        useUi.getState().setPan({ x: d.originX + dx, y: d.originY + dy });
        return;
      }
      if (!d.id) return;

      const z = useUi.getState().zoom;
      moveNode(pid, d.id, { x: Math.round(d.originX + dx / z), y: Math.round(d.originY + dy / z) });

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
          setPendingEdge({ from: conn.from, to: conn.over, x: e.clientX, y: e.clientY });
        }
        return;
      }

      const d = drag.current;
      drag.current = null;
      if (!d) return;
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

  /* ── 줌 ── */
  useEffect(() => {
    const el = vpRef.current;
    if (!el) return;
    function onWheel(ev: WheelEvent) {
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      useUi.getState().setZoom(useUi.getState().zoom * (ev.deltaY > 0 ? 0.94 : 1.06));
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
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const onItem = (e.target as Element).closest("[data-node-id],[data-source-id],[data-ui]");
        if (onItem && !hand) return;

        if (addTool && !onItem) {
          const at = toCanvas(e.clientX, e.clientY);
          onPlaceBlock({ x: Math.round(at.x - NODE_W / 2), y: Math.round(at.y - 60) });
          return;
        }
        if (!hand) {
          useUi.getState().select([]);
          useUi.getState().selectEdge(null);
          if (ui.panel === "inspector" || ui.panel === "refine") useUi.getState().closePanel();
        }
        startDrag("pan", e);
      }}
      className={cn(
        "relative min-w-0 flex-1 overflow-hidden",
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
        className="absolute top-0 left-0"
      >
        <EdgeLayer
          geoms={geoms}
          selectedId={ui.selEdge}
          dimmed={focus ? focus.keepEdges : null}
          onSelect={(id) => {
            useUi.getState().selectEdge(id);
            // 관계 라벨을 누르면 그 가지만 남기고 나머지는 회색으로 (집중하기)
            const e = id ? doc.edges.find((x) => x.id === id) : null;
            useUi.getState().setFocusView(e ? e.from : null);
          }}
        />

        {/* 끌고 있는 관계선 */}
        {connecting && rects[connecting.from] && (
          <svg className="pointer-events-none absolute top-0 left-0 overflow-visible" width={1} height={1}>
            <line
              x1={handleX(rects[connecting.from], connecting.side)}
              y1={handleY(rects[connecting.from], connecting.side)}
              x2={connecting.x}
              y2={connecting.y}
              stroke="#2563eb"
              strokeWidth={1.5}
              strokeDasharray="5 5"
            />
          </svg>
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
                dimmed={Boolean(focus && !focus.keep.has(n.id))}
                source={doc.sources.find((s) => s.id === n.sourceId)}
                showActions={(ui.hover === n.id || selected) && !ui.panel && ui.sel.length <= 1}
                onMeasure={onMeasure}
                onPointerDown={(e) => {
                  if (hand) return;
                  e.stopPropagation();
                  startDrag("node", e, n.id);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (drag.current?.moved) return;
                  if (e.shiftKey) {
                    useUi.getState().toggleSelect(n.id);
                    return;
                  }
                  // 한 번 눌러도 바로 오른쪽에 뜬다
                  useUi.getState().select([n.id]);
                  onOpenNode(n.id);
                }}
                onOpen={() => onOpenNode(n.id)}
                onHover={(v) => useUi.getState().setHover(v ? n.id : null)}
                onFocus={(v) => useUi.getState().setFocus(v ? n.id : null)}
                onAction={(i) => onNodeAction(n.id, i)}
                onToggleCollapse={() => store().setCollapsed(pid, n.id, !p.collapsed)}
                onStartConnect={(side, e) => {
                  const r = rects[n.id];
                  if (!r) return;
                  (e.target as Element).setPointerCapture?.(e.pointerId);
                  useUi.getState().setConnecting({
                    from: n.id,
                    side,
                    x: handleX(r, side),
                    y: handleY(r, side),
                    over: null,
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
                selected={ui.sel.length === 1 && ui.sel[0] === s.id}
                hovered={ui.hover === s.id}
                dragging={ui.dragging && drag.current?.id === s.id}
                dimmed={Boolean(focus)}
                evidenceCount={doc.nodes.filter((n) => n.sourceId === s.id).length}
                onMeasure={onMeasure}
                onPointerDown={(e) => {
                  if (hand) return;
                  e.stopPropagation();
                  startDrag("source", e, s.id);
                }}
                onClick={(e) => {
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
            className="absolute flex w-[228px] flex-col gap-1.5"
          >
            <span className="pl-0.5 text-[12px] leading-4 text-muted">다음으로 이어가기</span>
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

      {/* 관계 종류 고르기 */}
      {pendingEdge && (
        <>
          <div className="fixed inset-0 z-30" onPointerDown={() => setPendingEdge(null)} />
          <div
            style={{ left: pendingEdge.x, top: pendingEdge.y }}
            className="fixed z-40 w-52 -translate-x-1/2 overflow-hidden rounded-[8px] border border-line bg-surface shadow-[0_8px_24px_rgba(24,24,27,.14)] animate-pop-in"
          >
            <div className="flex items-center gap-1.5 border-b border-line px-3 py-2 font-mono text-[11px] text-muted">
              {pendingEdge.from} → {pendingEdge.to}
            </div>
            <div className="p-1">
              {EDGE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    store().addEdge(pid, {
                      from: pendingEdge.from,
                      to: pendingEdge.to,
                      type: o.value as EdgeType,
                    });
                    setPendingEdge(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[13px] hover:bg-wash"
                >
                  {o.value === "contradicts" && <span className="size-1.5 rounded-full bg-danger" />}
                  {o.ko}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {fileOver && !ui.dropTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-[10px] border-2 border-dashed border-brand bg-brand/[0.03]"
          >
            <span className="rounded-[6px] bg-brand px-3 py-1.5 text-[13px] text-white">
              놓으면 자료로 올라가요 · 카드 위에 놓으면 그 카드에 첨부돼요
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {ui.focusView && (
        <div
          data-ui="focus"
          className="absolute top-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2.5 rounded-[8px] border border-line bg-surface py-2 pr-2 pl-3.5 text-[13px] shadow-[0_4px_12px_rgba(24,24,27,.08)] animate-fade-up"
        >
          <span className="font-mono text-[12px] text-muted">{ui.focusView}</span>
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
        <div className="pointer-events-none absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded-[6px] bg-ink px-3 py-1.5 text-[12px] text-white">
          캔버스를 눌러 블록을 놓으세요 · Esc 로 취소
        </div>
      )}

      <span className="pointer-events-none absolute right-4 bottom-4 font-mono text-[11px] text-faint">
        {doc.nodes.length} 카드 · {doc.edges.length} 관계
      </span>
    </div>
  );
}

const handleX = (r: Rect, side: Side) =>
  side === "left" ? r.x : side === "right" ? r.x + r.w : r.x + r.w / 2;
const handleY = (r: Rect, side: Side) =>
  side === "top" ? r.y : side === "bottom" ? r.y + r.h : r.y + r.h / 2;
