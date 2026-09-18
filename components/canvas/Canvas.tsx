"use client";

/**
 * CMP-03 추론 캔버스.
 *
 * 캔버스 좌표는 표현 상태다. 카드를 옮겨도 관계는 그대로다 (스펙 §5.4, §12.1).
 * 전체 자동 배치를 넣지 않는다 — 사용자가 만든 배치를 논리로 덮어쓰지 않는다 (스펙 §12.2).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Btn } from "@/components/kit";
import { EdgeLayer, layoutEdges, type Rect } from "./Edges";
import { NODE_W, NodeView } from "./SemanticNode";
import { SOURCE_W, SourceChip } from "./SourceChip";
import { kindOf } from "@/lib/labels";
import { useDoc } from "@/lib/store";
import { useUi } from "@/lib/ui";
import type { ReasoningNode } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  pid: string;
  onOpenNode: (id: string) => void;
  onNodeAction: (id: string, index: 0 | 1) => void;
  onAddFromSuggestion: (what: "claim" | "source" | "question" | "coldstart") => void;
  onSourceClick: (sourceId: string, targetId?: string) => void;
  onFilesDropped: (files: File[], at: { x: number; y: number }, targetId?: string) => void;
}

type DragKind = "node" | "source" | "pan" | null;

export function Canvas({
  pid,
  onOpenNode,
  onNodeAction,
  onAddFromSuggestion,
  onSourceClick,
  onFilesDropped,
}: Props) {
  const doc = useDoc((s) => s.docs[pid]);
  const moveNode = useDoc((s) => s.moveNode);

  const ui = useUi();
  const vpRef = useRef<HTMLDivElement>(null);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [fileOver, setFileOver] = useState(false);

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

  /* ── 좌표 변환 ── */
  const toCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const r = vpRef.current?.getBoundingClientRect();
      if (!r) return { x: 0, y: 0 };
      return {
        x: (clientX - r.left - ui.pan.x) / ui.zoom,
        y: (clientY - r.top - ui.pan.y) / ui.zoom,
      };
    },
    [ui.pan.x, ui.pan.y, ui.zoom],
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

  const geoms = useMemo(
    () => (doc ? layoutEdges(doc.edges, rects, nodeMap) : []),
    [doc, rects, nodeMap],
  );

  /* ── Focus View — 선택한 카드 주변의 추론 사슬만 남긴다. 좌표는 건드리지 않는다 (스펙 §12.3) ── */
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
    // 한 홉 더: 붙어 있는 결정/근거가 무엇에 연결됐는지까지 보여준다
    for (const e of doc.edges) {
      if (keep.has(e.from) && keep.has(e.to)) keepEdges.add(e.id);
    }
    return { keep, keepEdges };
  }, [ui.focusView, doc]);

  /* ── 포인터 드래그 ── */
  function startDrag(kind: Exclude<DragKind, null>, e: React.PointerEvent, id?: string) {
    const origin = id ? doc?.placements[id] : ui.pan;
    if (!origin) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
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

      // 자료를 카드 위로 끌면 첨부 대상으로 표시한다
      if (d.kind === "source") {
        useUi.getState().setDragging(true);
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const target = el?.closest("[data-node-id]")?.getAttribute("data-node-id") ?? null;
        useUi.getState().setDropTarget(target);
      }
    }

    function onUp(e: PointerEvent) {
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      const { dropTarget } = useUi.getState();
      useUi.getState().setDragging(false);
      useUi.getState().setDropTarget(null);

      if (d.kind === "source" && d.moved && dropTarget && d.id) {
        onSourceClick(d.id, dropTarget);
        return;
      }
      if (d.kind === "source" && !d.moved && d.id) {
        onSourceClick(d.id);
        return;
      }
      void e;
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [pid, moveNode, onSourceClick]);

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
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      useUi.getState().setZoom(useUi.getState().zoom * (e.deltaY > 0 ? 0.94 : 1.06));
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  if (!doc) return null;

  const showSuggest = doc.nodes.length <= 1 && !ui.panel;
  const anchor = doc.placements["P-01"];
  const anchorH = heights["P-01"] ?? 120;

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
        if ((e.target as Element).closest("[data-node-id],[data-source-id],[data-ui]")) return;
        useUi.getState().select([]);
        useUi.getState().selectEdge(null);
        if (ui.panel === "inspector" || ui.panel === "refine") useUi.getState().closePanel();
        startDrag("pan", e);
      }}
      className={cn(
        "canvas-grid relative min-w-0 flex-1 overflow-hidden",
        drag.current?.kind === "pan" ? "cursor-grabbing" : "cursor-default",
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
          onSelect={(id) => useUi.getState().selectEdge(id)}
        />

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
                selected={selected}
                multi={ui.sel.length > 1 && ui.sel.includes(n.id)}
                hovered={ui.hover === n.id}
                focused={ui.focusId === n.id}
                dropTarget={ui.dropTarget === n.id}
                dimmed={Boolean(focus && !focus.keep.has(n.id))}
                source={doc.sources.find((s) => s.id === n.sourceId)}
                showActions={(ui.hover === n.id || selected) && !ui.panel && ui.sel.length <= 1}
                onMeasure={onMeasure}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  startDrag("node", e, n.id);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (drag.current?.moved) return;
                  if (e.shiftKey) useUi.getState().toggleSelect(n.id);
                  else useUi.getState().select([n.id]);
                }}
                onOpen={() => onOpenNode(n.id)}
                onHover={(v) => useUi.getState().setHover(v ? n.id : null)}
                onFocus={(v) => useUi.getState().setFocus(v ? n.id : null)}
                onAction={(i) => onNodeAction(n.id, i)}
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

        {/* 첫 캔버스의 가벼운 제안 3+1개. 카드가 늘거나 패널이 열리면 사라진다 */}
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

      {/* 파일을 끌고 들어왔을 때. 어디에 놓으면 무엇이 되는지 먼저 말한다 */}
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
          <span>주변 추론만 보고 있어요. 배치는 그대로예요.</span>
          <Btn size="sm" onClick={() => useUi.getState().setFocusView(null)}>
            전체 보기
          </Btn>
        </div>
      )}

      <span className="pointer-events-none absolute right-4 bottom-4 font-mono text-[11px] text-faint">
        {doc.nodes.length} 카드 · {doc.edges.length} 관계
      </span>
    </div>
  );
}

export { kindOf };
