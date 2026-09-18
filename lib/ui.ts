"use client";

/**
 * 화면 상태. 저장하지 않는다 — 새로고침하면 선택·패널·줌은 초기화되고 그래프만 남는다.
 * 보조 패널은 한 번에 하나만 연다 (핸드오프 §6).
 */
import { create } from "zustand";
import type { Phase, SaveState } from "./types";

export type Panel = "inspector" | "review" | "decision" | "refine" | "coldstart" | "shelf" | null;
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
  hover: string | null;
  focusId: string | null;
  panel: Panel;
  inspTab: InspectorTab;
  editMode: EditMode;
  focusView: string | null;
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

  select: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  setHover: (id: string | null) => void;
  setFocus: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  openPanel: (p: Panel) => void;
  closePanel: () => void;
  setInspTab: (t: InspectorTab) => void;
  setEditMode: (m: EditMode) => void;
  setFocusView: (id: string | null) => void;
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
  /** Esc — 메뉴 → 관계 → 패널 → 선택 순서로 하나씩 푼다. */
  escape: () => void;
  reset: () => void;
}

const initial = {
  sel: [] as string[],
  selEdge: null,
  hover: null,
  focusId: null,
  panel: null as Panel,
  inspTab: "content" as InspectorTab,
  editMode: "write" as EditMode,
  focusView: null,
  pan: { x: 0, y: 0 },
  zoom: 1,
  phase: null,
  save: "saved" as SaveState,
  cmdk: false,
  review: null,
  dropTarget: null,
  dragging: false,
  aiOff: false,
};

export const useUi = create<UiState>()((set, get) => ({
  ...initial,

  select: (sel) => set({ sel, selEdge: null }),
  toggleSelect: (id) =>
    set((s) => ({
      sel: s.sel.includes(id) ? s.sel.filter((x) => x !== id) : [...s.sel, id],
      selEdge: null,
    })),
  setHover: (hover) => set({ hover }),
  setFocus: (focusId) => set({ focusId }),
  selectEdge: (selEdge) => set({ selEdge, sel: selEdge ? [] : get().sel }),
  openPanel: (panel) => set({ panel }),
  closePanel: () => set({ panel: null }),
  setInspTab: (inspTab) => set({ inspTab }),
  setEditMode: (editMode) => set({ editMode }),
  setFocusView: (focusView) => set({ focusView }),
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

  escape: () => {
    const s = get();
    if (s.cmdk) return set({ cmdk: false });
    if (s.focusView) return set({ focusView: null });
    if (s.selEdge) return set({ selEdge: null });
    if (s.panel) return set({ panel: null });
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
