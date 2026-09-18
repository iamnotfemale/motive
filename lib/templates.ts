/**
 * 새 카드의 빈 골격. 섹션 이름이 곧 작성 모드의 항목 이름이 된다 (핸드오프 S05).
 * 내용을 미리 채우지 않는다 — 빈 칸이 무엇을 적는 자리인지만 알려준다.
 */
import type { Kind } from "./labels";

const T: Record<Kind, string[]> = {
  problem: ["대상·상황", "불편"],
  claim: ["본문", "검증 계획", "결과 기록", "검토 상태"],
  evidence: ["원문 인용", "출처", "해석", "한계"],
  question: ["상태", "연결 대상", "메모"],
  solution: ["어떻게 해결하나", "상태"],
  decision: ["선택한 해결안", "이유", "기각 대안", "재검토 조건", "열린 질문·위험"],
  requirement: ["사용자 행동", "수용 기준", "범위", "연결된 결정"],
  note: ["내용"],
};

export function blankMd(kind: Kind, title = ""): string {
  return ["# " + title, "", ...T[kind].flatMap((h) => ["## " + h, "", ""])].join("\n").trimEnd() + "\n";
}

export const sectionsFor = (kind: Kind) => T[kind];

/** 상태 섹션에 적는 기본값. 카드 배지와 같은 말을 쓴다. */
export const DEFAULT_STATUS: Partial<Record<Kind, string>> = {
  claim: "미검증",
  question: "열림",
  solution: "검토 중",
};
