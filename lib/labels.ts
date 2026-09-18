/**
 * 내부 타입 ↔ 한국어 라벨 매핑의 유일한 지점. (BUILD_PLAN §1.1)
 *
 * 사용자에게 `claim` / `question` / `output` 을 절대 노출하지 않는다.
 * 라벨을 바꾸려면 여기만 고친다. 다른 파일에서 한국어 유형명을 하드코딩하지 않는다.
 */
import type { EdgeType, NodeStatus, NodeType, OutputSubtype, ReasoningNode, SemanticEdge } from "./types";

/** 카드 좌상단에 붙는 유형 키. 내부 타입 + subtype 의 조합을 하나로 눌러놓은 값. */
export type Kind =
  | "problem"
  | "claim"
  | "evidence"
  | "question"
  | "solution"
  | "decision"
  | "requirement"
  | "note";

export interface KindMeta {
  ko: string;
  prefix: string;
  /** 16x16 viewBox, stroke 기반 path. 프로토타입 실측값. */
  icon: string;
  /** 카드 hover / 단일 선택 시 뜨는 액션 2개 (핸드오프 S03). */
  acts: [string, string];
}

export const KIND: Record<Kind, KindMeta> = {
  problem: {
    ko: "문제",
    prefix: "P",
    icon: "M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12ZM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
    acts: ["다듬기", "가설"],
  },
  claim: {
    ko: "가설",
    prefix: "H",
    icon: "M8 2v1M3 7h1M12 7h1M5.5 7.5a2.5 2.5 0 1 1 5 0c0 1.4-1 2-1 3.5h-3c0-1.5-1-2.1-1-3.5ZM6.5 13h3",
    acts: ["근거 연결", "검토 질문"],
  },
  evidence: {
    ko: "근거",
    prefix: "E",
    icon: "M4 10.5c0-3 1.5-5 4-6M10 10.5c0-3 1.5-5 4-6M3.5 9.5h2.5v2.5H3.5zM9.5 9.5H12v2.5H9.5z",
    acts: ["원문", "다른 곳에 연결"],
  },
  question: {
    ko: "검토 질문",
    prefix: "C",
    icon: "M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12ZM6.3 6.5a1.8 1.8 0 1 1 2.6 1.6c-.6.3-.9.7-.9 1.4M8 11.4v.2",
    acts: ["근거 연결", "연결"],
  },
  solution: {
    ko: "해결안",
    prefix: "S",
    icon: "M8 2l5 2.8v6.4L8 14l-5-2.8V4.8ZM3 4.8l5 2.8 5-2.8M8 7.6V14",
    acts: ["결정 채택", "근거 연결"],
  },
  decision: {
    ko: "결정",
    prefix: "D",
    icon: "M4 14V3h8l-1.5 3L12 9H4",
    acts: ["요구사항", "인계"],
  },
  requirement: {
    ko: "요구사항",
    prefix: "R",
    icon: "M3 4h2v2H3zM7 5h6M3 10h2v2H3zM7 11h6",
    acts: ["수용 기준", "범위"],
  },
  note: {
    ko: "메모",
    prefix: "N",
    icon: "M4 2h6l3 3v9H4zM10 2v3h3",
    acts: ["편집", "연결"],
  },
};

/** 내부 타입 + subtype → 화면 유형 키. */
export function kindOf(node: Pick<ReasoningNode, "type" | "subtype">): Kind {
  if (node.type === "output") return node.subtype === "requirement" ? "requirement" : "solution";
  return node.type as Kind;
}

/** 화면 유형 키 → 저장할 내부 타입. 역방향. */
export function typeOf(kind: Kind): { type: NodeType; subtype?: OutputSubtype } {
  if (kind === "solution") return { type: "output", subtype: "solution" };
  if (kind === "requirement") return { type: "output", subtype: "requirement" };
  return { type: kind as NodeType };
}

export const kindMeta = (node: Pick<ReasoningNode, "type" | "subtype">) => KIND[kindOf(node)];

/** ID prefix 로 유형을 되찾는다. 데모 시드와 표시용. */
export function kindFromId(id: string): Kind {
  const map: Record<string, Kind> = {
    P: "problem",
    H: "claim",
    E: "evidence",
    C: "question",
    S: "solution",
    D: "decision",
    R: "requirement",
    N: "note",
  };
  return map[id[0]] ?? "note";
}

/** 상태 점 + 텍스트. 색은 의미가 아니라 색+텍스트 둘 다로 구분한다. */
export const STATUS: Record<NodeStatus, { ko: string; tone: "ok" | "warn" | "muted" | "danger" }> = {
  unverified: { ko: "미검증", tone: "warn" },
  verified: { ko: "검증됨", tone: "ok" },
  open: { ko: "열림", tone: "warn" },
  answered: { ko: "해소됨", tone: "ok" },
  reviewing: { ko: "검토 중", tone: "muted" },
  adopted: { ko: "채택", tone: "ok" },
  rejected: { ko: "기각", tone: "muted" },
  held: { ko: "보류", tone: "muted" },
  draft: { ko: "초안", tone: "warn" },
  confirmed: { ko: "확정", tone: "ok" },
};

export const SCOPE_KO = { mvp: "이번 MVP에 포함", hold: "보류", out: "제외" } as const;

/**
 * 엣지 → 한국어 관계 라벨.
 * `produces` 하나가 채택/구현 범위/보류/기각 네 가지로 갈린다. 대상 타입과 플래그로 구분한다.
 */
export function edgeLabel(edge: SemanticEdge, target?: Pick<ReasoningNode, "type" | "subtype">): string {
  switch (edge.type) {
    case "supports":
      return "지지";
    case "contradicts":
      return "반대 근거";
    case "based_on":
      return "제안의 근거";
    case "related":
      return edge.undirected ? "연결" : "관련";
    case "investigates":
      return target && kindOf(target) === "claim" && edge.from.startsWith("P") ? "이 문제에서 출발" : "검토 필요";
    case "produces":
      if (edge.rejected) return "기각";
      if (edge.hold) return "보류";
      if (target && kindOf(target) === "requirement") return "구현 범위";
      return "채택";
  }
}

/** 반대 근거만 빨간 점을 붙인다. 카드 전체를 빨갛게 칠하지 않는다 (토큰 role). */
export const isCounter = (edge: SemanticEdge) => edge.type === "contradicts";

export const PHASES = [
  { key: "define", ko: "정의" },
  { key: "explore", ko: "탐색" },
  { key: "review", ko: "검토" },
  { key: "decide", ko: "결정" },
  { key: "handoff", ko: "인계" },
] as const;

/** 근거를 붙일 때 고르는 관계. 대상이 정해진 상태라 극성이 핵심이다. */
export const EDGE_OPTIONS: { value: EdgeType; ko: string }[] = [
  { value: "supports", ko: "근거 (찬성)" },
  { value: "contradicts", ko: "근거 (반대)" },
  { value: "based_on", ko: "제안의 근거" },
  { value: "related", ko: "관련" },
];

/**
 * 캔버스에서 선을 그을 때 고르는 선택지. 두 카드의 유형에 따라 달라진다 —
 * 결정→해결안이면 채택·보류·기각, 결정→요구사항이면 구현 범위, 문제→가설이면 이 문제에서 출발.
 * `연결` 은 방향이 없는 단순 연결이라 화살촉을 그리지 않는다.
 */
export interface EdgeChoice {
  key: string;
  ko: string;
  type: EdgeType;
  undirected?: boolean;
  /** produces 의 갈래. 채택은 둘 다 없음. */
  rejected?: boolean;
  hold?: boolean;
  /** 이 관계를 고르면 대상 카드의 상태를 이렇게 바꾼다 (해결안 채택·보류·기각). */
  targetStatus?: NodeStatus;
  tone: "muted" | "ok" | "danger";
}

export const EDGE_CHOICES: EdgeChoice[] = [
  { key: "related", ko: "관련", type: "related", tone: "muted" },
  { key: "supports", ko: "근거 (찬성)", type: "supports", tone: "ok" },
  { key: "contradicts", ko: "근거 (반대)", type: "contradicts", tone: "danger" },
  { key: "link", ko: "연결", type: "related", undirected: true, tone: "muted" },
];

/** 모든 관계 이름. 사용자가 선을 이을 때 어느 것이든 고를 수 있다. */
export const ALL_EDGE_CHOICES: EdgeChoice[] = [
  { key: "origin", ko: "이 문제에서 출발", type: "investigates", tone: "muted" },
  { key: "challenge", ko: "검토 필요", type: "investigates", tone: "muted" },
  { key: "supports", ko: "지지", type: "supports", tone: "ok" },
  { key: "contradicts", ko: "반대 근거", type: "contradicts", tone: "danger" },
  { key: "basis", ko: "제안의 근거", type: "based_on", tone: "ok" },
  { key: "adopt", ko: "채택", type: "produces", targetStatus: "adopted", tone: "ok" },
  { key: "hold", ko: "보류", type: "produces", hold: true, targetStatus: "held", tone: "muted" },
  { key: "reject", ko: "기각", type: "produces", rejected: true, targetStatus: "rejected", tone: "danger" },
  { key: "scope", ko: "구현 범위", type: "produces", tone: "ok" },
  { key: "related", ko: "관련", type: "related", tone: "muted" },
  { key: "link", ko: "연결", type: "related", undirected: true, tone: "muted" },
];

/**
 * 두 카드 유형에 맞는 관계를 앞에 두고, 나머지도 전부 뒤에 붙인다.
 * 제안 순서만 다르고 선택지는 항상 같다 — 사용자가 어떤 이름이든 쓸 수 있어야 한다.
 */
export function edgeChoicesFor(
  from: Pick<ReasoningNode, "type" | "subtype">,
  to: Pick<ReasoningNode, "type" | "subtype">,
): EdgeChoice[] {
  const a = kindOf(from);
  const b = kindOf(to);
  const first: string[] =
    a === "decision" && b === "solution"
      ? ["adopt", "hold", "reject"]
      : a === "decision" && b === "requirement"
        ? ["scope"]
        : a === "problem" && b === "claim"
          ? ["origin"]
          : a === "question"
            ? ["challenge"]
            : a === "evidence" && (b === "solution" || b === "decision")
              ? ["basis", "supports", "contradicts"]
              : a === "evidence"
                ? ["supports", "contradicts"]
                : ["related", "link"];
  return [
    ...first.map((k) => ALL_EDGE_CHOICES.find((c) => c.key === k)!),
    ...ALL_EDGE_CHOICES.filter((c) => !first.includes(c.key)),
  ];
}

/** 지금 선이 어느 선택지인지. 선 도구 막대에서 현재 값을 표시할 때 쓴다. */
export function choiceOf(e: Pick<SemanticEdge, "type" | "undirected" | "rejected" | "hold">, choices: EdgeChoice[] = ALL_EDGE_CHOICES) {
  if (e.type === "related" && e.undirected) return "link";
  return (
    choices.find(
      (c) => c.type === e.type && !c.undirected && Boolean(c.rejected) === Boolean(e.rejected) && Boolean(c.hold) === Boolean(e.hold),
    )?.key ?? choices.find((c) => c.type === e.type && !c.undirected)?.key ?? "related"
  );
}
