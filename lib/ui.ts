"use client";

/**
 * 화면 상태. 저장하지 않는다 — 새로고침하면 선택·패널·줌은 초기화되고 그래프만 남는다.
 * 보조 패널은 한 번에 하나만 연다 (핸드오프 §6).
 */
import { create } from "zustand";
import type { Phase, SaveState, Side } from "./types";

export type Panel = "inspector" | "review" | "decision" | "refine" | "coldstart" | null;

/** 왼쪽에서 밀려나오는 패널. 아래에서 올라오는 서랍을 대신한다. */
export type LeftPanel = "sources" | "search" | null;

/** 캔버스 도구. 피그마와 같은 뜻으로 쓴다. */
export type Tool = "select" | "hand" | "frame" | "add";

/** 카드 테두리에서 끌어 만드는 관계. 놓을 때까지 그래프에 들어가지 않는다. */
export interface Connecting {
  from: string;
  side: Side;
  x: number;
  y: number;
  over: string | null;
  /** 놓으면 꽂힐 변. 포인터에서 가장 가까운 변을 고른다. */
  overSide: Side | null;
}
export type InspectorTab = "content" | "links" | "sources";
export type EditMode = "write" | "md";

/** 자료 검토 8단계. 화면 상단 스텝 인디케이터와 1:1. */
export const REVIEW_STEPS = [
  "끌어오기",
  "드롭 영역",
  "파일 저장·읽기",
  "AI 전송 동의",
  "후보 표시",
  "원문·해석 검토",
  "선택 승인",
  "실선 관계",
] as const;

export type ReviewStep =
  | "reading"
  | "consent"
  | "analyzing"
  | "candidates"
  | "source"
  | "attached"
  | "pick-target";

export interface ReviewState {
  sourceId: string;
  step: ReviewStep;
  /** 근거를 붙일 대상 노드. 빈 캔버스에 떨어뜨리면 나중에 고른다. */
  targetId: string | null;
  /** 원문 보기에서 사용자가 직접 고른 줄. */
  pickedLine: number | null;
  /** 원문 보기로 들어오기 전 단계. 뒤로 가기용. */
  backTo: ReviewStep;
  notice?: { text: string; a1?: string; a2?: string };
}

interface UiState {
  sel: string[];
  selEdge: string | null;
  /** 범위 선택으로 함께 잡힌 관계선들. */
  selEdges: string[];
  hover: string | null;
  focusId: string | null;
  panel: Panel;
  inspTab: InspectorTab;
  editMode: EditMode;
  focusView: string | null;
  /** 도구 막대 단추가 비추는 블록 묶음. 집중 보기와 같은 방식으로 나머지를 흐린다. */
  spotlight: { key: string; ko: string; ids: string[] } | null;
  pan: { x: number; y: number };
  zoom: number;
  phase: Phase | null;
  save: SaveState;
  cmdk: boolean;
  review: ReviewState | null;
  /** 파일을 끌고 있을 때 하이라이트할 노드. */
  dropTarget: string | null;
  dragging: boolean;
  /** AI 키 없음. 직접 작성과 내보내기는 계속 된다. */
  aiOff: boolean;
  tool: Tool;
  leftPanel: LeftPanel;
  search: string;
  connecting: Connecting | null;
  grid: boolean;
  /** 전체 화면 편집기. 노션처럼 본문만 크게 본다. */
  wide: boolean;
  /** 새 카드를 화면 가운데로 부드럽게 옮겨달라는 요청. */
  center: { id: string; nonce: number } | null;
  /** 화면 맞춤 요청. 고른 카드가 있으면 그것만, 없으면 전체. */
  fit: number | null;
  /** 확대·축소 요청. 부드럽게 옮기기 위해 Canvas 가 받아서 처리한다. */
  zoomTo: { z: number; nonce: number } | null;
  /** 관계 기준 격자 재배치 요청. */
  tidy: number | null;

  select: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  setHover: (id: string | null) => void;
  setFocus: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  setSelEdges: (ids: string[]) => void;
  openPanel: (p: Panel) => void;
  closePanel: () => void;
  setInspTab: (t: InspectorTab) => void;
  setEditMode: (m: EditMode) => void;
  setFocusView: (id: string | null) => void;
  setSpotlight: (s: { key: string; ko: string; ids: string[] } | null) => void;
  setPan: (p: { x: number; y: number }) => void;
  setZoom: (z: number) => void;
  setPhase: (p: Phase | null) => void;
  setSave: (s: SaveState) => void;
  setCmdk: (v: boolean) => void;
  setReview: (r: ReviewState | null) => void;
  patchReview: (p: Partial<ReviewState>) => void;
  setDropTarget: (id: string | null) => void;
  setDragging: (v: boolean) => void;
  setAiOff: (v: boolean) => void;
  setTool: (t: Tool) => void;
  openLeft: (p: LeftPanel) => void;
  setSearch: (q: string) => void;
  setConnecting: (c: Connecting | null) => void;
  setGrid: (v: boolean) => void;
  setWide: (v: boolean) => void;
  requestCenter: (id: string) => void;
  requestFit: () => void;
  requestZoom: (z: number) => void;
  requestTidy: () => void;
  /** Esc — 메뉴 → 관계 → 패널 → 선택 순서로 하나씩 푼다. */
  escape: () => void;
  reset: () => void;
}

const initial = {
  sel: [] as string[],
  selEdge: null,
  selEdges: [] as string[],
  hover: null,
  focusId: null,
  panel: null as Panel,
  inspTab: "content" as InspectorTab,
  editMode: "write" as EditMode,
  focusView: null,
  spotlight: null as { key: string; ko: string; ids: string[] } | null,
  pan: { x: 0, y: 0 },
  zoom: 1,
  phase: null,
  save: "saved" as SaveState,
  cmdk: false,
  review: null,
  dropTarget: null,
  dragging: false,
  aiOff: false,
  tool: "select" as Tool,
  leftPanel: null as LeftPanel,
  search: "",
  connecting: null as Connecting | null,
  grid: true,
  wide: false,
  center: null as { id: string; nonce: number } | null,
  fit: null as number | null,
  zoomTo: null as { z: number; nonce: number } | null,
  tidy: null as number | null,
};

export const useUi = create<UiState>()((set, get) => ({
  ...initial,

  select: (sel) => set({ sel, selEdge: null, selEdges: [] }),
  toggleSelect: (id) =>
    set((s) => ({
      sel: s.sel.includes(id) ? s.sel.filter((x) => x !== id) : [...s.sel, id],
      selEdge: null,
    })),
  setHover: (hover) => set({ hover }),
  setFocus: (focusId) => set({ focusId }),
  selectEdge: (selEdge) => set({ selEdge, selEdges: [], sel: selEdge ? [] : get().sel }),
  setSelEdges: (selEdges) => set({ selEdges }),
  openPanel: (panel) => set({ panel }),
  closePanel: () => set({ panel: null }),
  setInspTab: (inspTab) => set({ inspTab }),
  setEditMode: (editMode) => set({ editMode }),
  setFocusView: (focusView) => set({ focusView, spotlight: null }),
  setSpotlight: (spotlight) => set({ spotlight, focusView: null }),
  setPan: (pan) => set({ pan }),
  setZoom: (zoom) => set({ zoom: Math.min(2, Math.max(0.5, zoom)) }),
  setPhase: (phase) => set({ phase }),
  setSave: (save) => set({ save }),
  setCmdk: (cmdk) => set({ cmdk }),
  setReview: (review) => set({ review }),
  patchReview: (p) => set((s) => (s.review ? { review: { ...s.review, ...p } } : s)),
  setDropTarget: (dropTarget) => set({ dropTarget }),
  setDragging: (dragging) => set({ dragging }),
  setAiOff: (aiOff) => set({ aiOff }),
  setTool: (tool) => set({ tool, connecting: null }),
  openLeft: (leftPanel) => set({ leftPanel }),
  setSearch: (search) => set({ search }),
  setConnecting: (connecting) => set({ connecting }),
  setGrid: (grid) => set({ grid }),
  setWide: (wide) => set({ wide }),
  requestCenter: (id) => set({ center: { id, nonce: Date.now() } }),
  requestFit: () => set({ fit: Date.now() }),
  requestZoom: (z) => set({ zoomTo: { z, nonce: Date.now() } }),
  requestTidy: () => set({ tidy: Date.now() }),

  escape: () => {
    const s = get();
    if (s.wide) return set({ wide: false });
    if (s.connecting) return set({ connecting: null });
    if (s.cmdk) return set({ cmdk: false });
    if (s.tool !== "select") return set({ tool: "select" });
    if (s.spotlight) return set({ spotlight: null });
    if (s.focusView) return set({ focusView: null });
    if (s.selEdge) return set({ selEdge: null });
    if (s.panel) return set({ panel: null });
    if (s.leftPanel) return set({ leftPanel: null });
    if (s.sel.length) return set({ sel: [] });
  },

  reset: () => set(initial),
}));

/** 자동 저장 표시. 실제 저장은 zustand persist 가 동기로 끝나므로, 표시만 짧게 준다. */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
export function flashSaved() {
  const { setSave } = useUi.getState();
  setSave("saving");
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => setSave("saved"), 400);
}
