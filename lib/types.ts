/**
 * 내부 데이터 계약. docs/01_REASONING_LAYER_PRODUCT_SPEC.md §7.2 / §26 기준.
 *
 * 화면에 보이는 한국어 이름(가설·검토 질문·해결안·요구사항)은 lib/labels.ts 에서만 만든다.
 * `hypothesis` / `challenge` / `solution` 은 타입으로 존재하지 않는다 (스펙 §30.14).
 */

/** 6개 추론 타입 + 프로젝트당 1개인 문제 앵커. */
export type NodeType =
  | "problem" // 앵커. Project.problemStatement 와 짝. 프로젝트당 1개
  | "claim" // UI: 가설
  | "question" // UI: 검토 질문
  | "evidence" // UI: 근거
  | "decision" // UI: 결정
  | "output" // UI: 해결안 | 요구사항 (subtype 으로 구분)
  | "note"; // UI: 메모

export type OutputSubtype = "solution" | "requirement";

/** 노드 상태. 타입마다 쓰는 값이 다르다. */
export type NodeStatus =
  | "unverified" // 가설 — 미검증
  | "verified"
  | "open" // 검토 질문 — 열림
  | "answered"
  | "reviewing" // 해결안 — 검토 중
  | "adopted" // 해결안 — 채택
  | "rejected" // 해결안 — 기각
  | "held" // 해결안 — 보류
  | "draft" // 결정 — 초안
  | "confirmed"; // 결정 — 확정

export type ReqScope = "mvp" | "hold" | "out";

export interface ReasoningNode {
  id: string; // 표시용 ID. P-01 / H-01 / E-01 / C-01 / S-01 / D-01 / R-01 / N-01
  type: NodeType;
  subtype?: OutputSubtype;
  /** 본문 전체. `# 제목` 1개 + `## 섹션` n개. 카드 제목은 여기서 파생된다(단일 소스). */
  md: string;
  status?: NodeStatus;
  scope?: ReqScope; // 요구사항 전용
  /** AI가 제안했고 아직 사람이 확정하지 않은 상태. 점선으로 그린다 (스펙 §5.3). */
  proposed?: boolean;
  sourceId?: string; // evidence 전용. derived_from 을 엣지 대신 필드로 정규화 (스펙 §26)
  sourceLocator?: SourceLocator;
  createdAt: string;
  updatedAt: string;
}

export interface SourceLocator {
  line?: number;
  page?: number;
  url?: string;
  section?: string;
  excerpt?: string;
  /** 인용을 원문에서 실제로 찾았는지. false 면 승인 불가 (핸드오프 §7). */
  verified?: boolean;
}

export type EdgeType =
  | "supports" // UI: 지지
  | "contradicts" // UI: 반대 근거
  | "investigates" // UI: 이 문제에서 출발 | 검토 필요
  | "based_on" // UI: 제안의 근거
  | "produces" // UI: 채택 | 구현 범위 | 보류 | 기각
  | "related"; // UI: 관련

/** 카드의 어느 변에 꽂혔는지. 연결선이 그 변에서 시작하고 끝난다. */
export type Side = "top" | "right" | "bottom" | "left";

export interface SemanticEdge {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  fromSide?: Side;
  toSide?: Side;
  /** 선 모양. 의미가 아니라 보기 설정이다. */
  shape?: "curve" | "straight" | "elbow";
  dashed?: boolean;
  /** 방향 없는 단순 연결. 화살촉을 그리지 않는다. */
  undirected?: boolean;
  /** produces 전용. 기각/보류를 내부에서 분리 (BUILD_PLAN §1.5). */
  rejected?: boolean;
  hold?: boolean;
  proposed?: boolean;
}

export type SourceKind = "markdown" | "text" | "pdf" | "url" | "interview" | "image";
export type SourceState = "reading" | "read" | "attached" | "no-text" | "failed";

export interface Source {
  id: string;
  kind: SourceKind;
  name: string;
  /** 원문. 줄 단위 인용을 위해 그대로 보관한다. */
  text: string;
  uri?: string;
  state: SourceState;
  /** 합성 자료임을 화면에 표시하기 위한 태그 (브리프 §7). */
  tag?: string;
  /** 어느 카드에 떨어뜨린 자료인지. 그 카드 아래에 목록으로 붙는다. */
  attachedTo?: string;
  /** 그림 미리보기 (data URL). 용량이 크면 담지 않는다. */
  preview?: string;
  /** 바로 읽기 어려운 자료에 대해 AI 가 쓴 요약. 원문을 대체하지 않는다. */
  summary?: string;
  createdAt: string;
}

export interface Placement {
  x: number;
  y: number;
  /** 접으면 제목만 보인다. 기본은 펼침 — 카드가 내용을 다 보여준다. */
  collapsed?: boolean;
}

export type EvidenceCandidateState = "pending" | "approved" | "excluded";

export interface EvidenceCandidate {
  id: string;
  sourceId: string;
  line: number;
  quote: string;
  /** AI 해석 2줄: 주장 / 한계 (핸드오프 §7). */
  claim: string;
  limit: string;
  targetId: string;
  edgeType: EdgeType;
  state: EvidenceCandidateState;
  /** 인용을 원문에서 찾지 못함. 승인 불가. */
  mismatch?: boolean;
  approvedAs?: string;
}

export interface Project {
  id: string;
  name: string;
  problemStatement: string;
  demo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SaveState = "saved" | "saving" | "failed";
export type Phase = "define" | "explore" | "review" | "decide" | "handoff";
