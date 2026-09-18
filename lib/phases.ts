/**
 * 단계는 완료 순서가 아니라 관점이다 (스펙 §6.2). 언제든 옮겨 다닐 수 있다.
 * 단계에 따라 왼쪽 레일과 아래 도구 막대에 뜨는 핵심 기능만 바뀐다.
 */
import type { Phase } from "./types";

export type ActionKey =
  | "refine"
  | "add-claim"
  | "add-question"
  | "add-note"
  | "coldstart"
  | "attach"
  | "url"
  | "sources"
  | "find-evidence"
  | "conflicts"
  | "issues"
  | "check-quotes"
  | "add-solution"
  | "make-decision"
  | "add-requirement"
  | "handoff"
  | "export";

export interface ActionDef {
  key: ActionKey;
  ko: string;
  /** lucide 아이콘 이름. components/icon.tsx 에서 실제 컴포넌트로 바뀐다. */
  icon: string;
  hint?: string;
}

const A: Record<ActionKey, ActionDef> = {
  refine: { key: "refine", ko: "문제 다듬기", icon: "Sparkles" },
  "add-claim": { key: "add-claim", ko: "가설 추가", icon: "Lightbulb", hint: "H" },
  "add-question": { key: "add-question", ko: "검토 질문", icon: "CircleQuestionMark", hint: "C" },
  "add-note": { key: "add-note", ko: "생각 추가", icon: "StickyNote", hint: "N" },
  coldstart: { key: "coldstart", ko: "불확실한 것부터", icon: "ScanSearch" },
  attach: { key: "attach", ko: "자료 첨부", icon: "Paperclip" },
  url: { key: "url", ko: "주소 읽기", icon: "Link2" },
  sources: { key: "sources", ko: "자료함", icon: "FolderOpen" },
  "find-evidence": { key: "find-evidence", ko: "근거 찾기", icon: "Quote" },
  conflicts: { key: "conflicts", ko: "어긋남", icon: "TriangleAlert" },
  issues: { key: "issues", ko: "미확인 항목", icon: "ListChecks" },
  "check-quotes": { key: "check-quotes", ko: "인용 확인", icon: "BookOpenCheck" },
  "add-solution": { key: "add-solution", ko: "해결안 추가", icon: "Box", hint: "S" },
  "make-decision": { key: "make-decision", ko: "결정 만들기", icon: "Flag" },
  "add-requirement": { key: "add-requirement", ko: "요구사항", icon: "ListTodo" },
  handoff: { key: "handoff", ko: "개발 인계", icon: "PackageCheck" },
  export: { key: "export", ko: "내보내기", icon: "Download" },
};

/** 아래 도구 막대 가운데에 붙는 단계별 핵심 행동. 3개를 넘기지 않는다. */
export const DOCK_ACTIONS: Record<Phase, ActionDef[]> = {
  define: [A["add-claim"], A["add-note"]],
  explore: [A.attach, A["find-evidence"]],
  review: [A.conflicts, A.issues, A["check-quotes"]],
  decide: [A["add-solution"], A["make-decision"], A["add-requirement"]],
  handoff: [A.handoff, A.export],
};

/** 왼쪽 레일의 단계별 항목. 자료함·검색 아래에 붙는다. */
export const RAIL_ACTIONS: Record<Phase, ActionDef[]> = {
  define: [A.refine, A.coldstart],
  explore: [A.attach, A["find-evidence"]],
  review: [A.conflicts, A.issues],
  decide: [A["make-decision"], A["add-requirement"]],
  handoff: [A.handoff],
};

export const DEFAULT_PHASE: Phase = "define";
