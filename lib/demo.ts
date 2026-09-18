/**
 * 브리프 §7 공통 예시 시나리오 `제출 체크룸`. 전부 합성 자료다.
 * 실제 인터뷰·연구 결과·사용자 수를 꾸며내지 않는다. 화면 어디서든 `데모 자료` 로 표시한다.
 */
import type { EdgeType, ReasoningNode, SemanticEdge, Source } from "./types";
import { kindFromId, typeOf } from "./labels";

export const INTERVIEW_LINES = [
  "# 합성 인터뷰 — 데모 전용",
  "",
  "이 문서는 제품 화면과 테스트를 위한 가상 자료입니다.",
  "",
  "## 참여자 A",
  "마지막에 배포 주소가 어느 메시지에 있었는지 다시 찾았어요.",
  "",
  "## 참여자 B",
  "앱을 하나 더 가입해야 하면 그냥 카톡에 정리할 것 같아요.",
  "",
  "## 참여자 C",
  "제출 직전에는 단톡에서 바로 확인해서, 따로 페이지를 열진 않았어요.",
];

export const INTERVIEW_TEXT = INTERVIEW_LINES.join("\n");

const MD: Record<string, string> = {
  "P-01": `# 해커톤 팀은 제출 직전에 배포 주소·시연 계정·필수 첨부물을 여러 대화에서 다시 찾아야 한다.

## 대상·상황
해커톤 마감 1–2시간 전, 3–5명 팀.

## 불편
제출에 필요한 정보가 채팅 여러 곳에 흩어져 있어 마지막에 다시 찾는다.
`,
  "H-01": `# 제출 준비를 별도 협업 앱으로 옮기면 누락이 줄어들 것이다.

## 본문
제출 항목을 한 곳에서 관리하면 마감 직전 누락이 줄어든다고 예상한다.

## 검증 계획
- 참여자 인터뷰에서 도구 전환 의향 확인
- 해커톤 1회에서 체크리스트 사용 후 누락 항목 비교

## 결과 기록
아직 없음.

## 검토 상태
미검증
`,
  "E-01": `# “마지막에 배포 주소가 어느 메시지에 있었는지 다시 찾았어요.”

## 원문 인용
> 마지막에 배포 주소가 어느 메시지에 있었는지 다시 찾았어요.

## 출처
interview-demo.md · 참여자 A · 줄 6 (합성 자료)

## 해석
제출 정보가 대화에 흩어져 있어 마감 직전 재탐색이 발생한다.

## 한계
참여자 1명의 발언. 팀 전체로 일반화할 수 없다.
`,
  "E-02": `# “앱을 하나 더 가입해야 하면 그냥 카톡에 정리할 것 같아요.”

## 원문 인용
> 앱을 하나 더 가입해야 하면 그냥 카톡에 정리할 것 같아요.

## 출처
interview-demo.md · 참여자 B · 줄 9 (합성 자료)

## 해석
새 계정 가입이 도입 장벽일 가능성이 있다.

## 한계
이 발언 하나를 전체 대학생에게 일반화할 수는 없다.
`,
  "C-01": `# 팀원 전원이 새 도구에 가입해야 한다면 사용을 시작할까?

## 상태
열림

## 연결 대상
H-01 — 검토 필요

## 메모
E-02의 발언과 관련. 결정 D-01에서 위험으로 인지.
`,
  "S-01": `# 계정 없이 링크로 여는 제출 준비 체크리스트.

## 어떻게 해결하나
팀 대표가 링크를 만들고 팀원은 가입 없이 항목을 확인·수정한다.

## 상태
채택 (D-01)
`,
  "S-02": `# 팀원 전원이 가입하는 별도 협업 앱.

## 어떻게 해결하나
팀 전용 워크스페이스에 제출 항목·채팅·파일을 모은다.

## 상태
보류·기각 (D-01) — 가입 장벽(E-02, C-01)
`,
  "D-01": `# 별도 채팅을 만들지 않고 제출 정보 확인에만 집중한다.

## 선택한 해결안
S-01 계정 없이 링크로 여는 제출 준비 체크리스트

## 이유
가입 장벽이 도입을 막을 가능성(E-02). 채팅은 이미 쓰는 메신저가 대신한다.

## 기각 대안
S-02 별도 협업 앱 — 기각

## 재검토 조건
- 팀원 전원 가입을 전제로 해도 도입에 문제가 없다는 근거가 나오면
- 링크 공유만으로 팀 전체가 항목을 확인하지 않는다는 결과가 나오면

## 열린 질문·위험
- C-01 팀원 전원 가입 시 사용 시작 여부 — 미검증이지만 이번 MVP에서 시도
- 체크리스트도 직접 만들 만큼 필요할까?
`,
  "R-01": `# 제출 항목과 담당자를 입력·수정할 수 있다.

## 사용자 행동
팀 대표가 항목을 추가하고 담당자를 수정한다.

## 수용 기준
- 새 항목을 추가하면 목록에 나타난다.
- 담당자를 수정하고 다시 열어도 값이 유지된다.

## 범위
이번 MVP에 포함

## 연결된 결정
D-01
`,
  "R-02": `# 필요한 항목이 비어 있으면 제출 전에 표시한다.

## 사용자 행동
팀원이 제출 전 화면에서 비어 있는 필수 항목을 확인한다.

## 수용 기준
- 필수 항목이 비어 있으면 제출 화면 상단에 표시된다.
- 모든 필수 항목이 채워지면 표시가 사라진다.

## 범위
이번 MVP에 포함

## 연결된 결정
D-01
`,
};

/** 근거 승인으로 뒤늦게 들어오는 노드. 시드에는 없다 — 승인하면 D-01 과 어긋남이 생긴다. */
export const LATE_EVIDENCE_MD = `# “제출 직전에는 단톡에서 바로 확인해서, 따로 페이지를 열진 않았어요.”

## 원문 인용
> 제출 직전에는 단톡에서 바로 확인해서, 따로 페이지를 열진 않았어요.

## 출처
interview-demo.md · 참여자 C · 줄 12 (합성 자료)

## 해석
마감 직전에는 이미 쓰는 채팅에서 확인하는 습관이 있어, 별도 페이지를 여는 행동 자체가 일어나지 않을 가능성이 있다.

## 한계
참여자 1명의 발언. 링크 체크리스트를 실제로 써 본 상황은 아니다.
`;

export const DEMO_POS: Record<string, { x: number; y: number }> = {
  // 카드는 기본이 펼침이라 간격을 넉넉히 둔다. 가로 440(카드 288 + 여백 152), 세로 520.
  "P-01": { x: 56, y: 40 },
  "H-01": { x: 496, y: 40 },
  "C-01": { x: 936, y: 40 },
  "E-01": { x: 56, y: 560 },
  "E-02": { x: 496, y: 560 },
  "S-01": { x: 936, y: 560 },
  "E-03": { x: 1376, y: 560 },
  "S-02": { x: 56, y: 1080 },
  "D-01": { x: 496, y: 1080 },
  "R-01": { x: 936, y: 1080 },
  "R-02": { x: 1376, y: 1080 },
};

const STATUS: Record<string, ReasoningNode["status"]> = {
  "H-01": "unverified",
  "C-01": "open",
  "S-01": "adopted",
  "S-02": "rejected",
  "D-01": "confirmed",
};

const DATES: Record<string, string> = {
  "E-01": "2026-09-15",
  "E-02": "2026-09-15",
  "S-01": "2026-09-16",
  "S-02": "2026-09-16",
  "D-01": "2026-09-17",
};

type RawEdge = [string, string, EdgeType, { rejected?: boolean; hold?: boolean }?];

const DEMO_EDGES: RawEdge[] = [
  ["P-01", "H-01", "investigates"],
  ["E-01", "P-01", "supports"],
  ["E-02", "H-01", "contradicts"],
  ["C-01", "H-01", "investigates"],
  ["E-02", "S-01", "based_on"],
  ["D-01", "S-01", "produces"],
  ["D-01", "S-02", "produces", { rejected: true }],
  ["D-01", "R-01", "produces"],
  ["D-01", "R-02", "produces"],
];

export const DEMO_SOURCE: Source = {
  id: "src-interview",
  kind: "interview",
  name: "interview-demo.md",
  text: INTERVIEW_TEXT,
  state: "read",
  tag: "합성 자료",
  createdAt: "2026-09-15T00:00:00.000Z",
};

export function demoNodes(): ReasoningNode[] {
  return Object.entries(MD).map(([id, md]) => {
    const at = (DATES[id] ?? "2026-09-15") + "T00:00:00.000Z";
    const node: ReasoningNode = {
      id,
      ...typeOf(kindFromId(id)),
      md,
      status: STATUS[id],
      createdAt: at,
      updatedAt: at,
    };
    if (id === "E-01") {
      node.sourceId = DEMO_SOURCE.id;
      node.sourceLocator = { line: 6, excerpt: INTERVIEW_LINES[5], verified: true };
    }
    if (id === "E-02") {
      node.sourceId = DEMO_SOURCE.id;
      node.sourceLocator = { line: 9, excerpt: INTERVIEW_LINES[8], verified: true };
    }
    if (id === "R-01" || id === "R-02") node.scope = "mvp";
    return node;
  });
}

export function demoEdges(): SemanticEdge[] {
  return DEMO_EDGES.map(([from, to, type, flags]) => ({
    id: `${from}>${to}`,
    from,
    to,
    type,
    ...flags,
  }));
}

/** 인터뷰 원문에서 뽑히는 근거 후보 3개. 줄 번호는 실제 원문 줄과 일치한다. */
export const DEMO_CANDIDATES = [
  {
    line: 6,
    quote: INTERVIEW_LINES[5],
    claim: "제출 정보가 대화에 흩어져 있어 마감 직전 재탐색이 발생할 가능성이 있어요.",
    limit: "참여자 1명의 발언이라 팀 전체로 일반화할 수는 없어요.",
    targetId: "P-01",
    edgeType: "supports" as EdgeType,
  },
  {
    line: 9,
    quote: INTERVIEW_LINES[8],
    claim: "새 계정 가입이 도입 장벽일 가능성이 있어요.",
    limit: "이 발언 하나를 전체 대학생에게 일반화할 수는 없어요.",
    targetId: "H-01",
    edgeType: "contradicts" as EdgeType,
  },
  {
    line: 12,
    quote: INTERVIEW_LINES[11],
    claim: "마감 직전에는 별도 페이지를 여는 행동이 일어나지 않을 가능성이 있어요.",
    limit: "참여자 1명의 발언. 링크 체크리스트를 써 본 상황은 아니에요.",
    targetId: "S-01",
    edgeType: "contradicts" as EdgeType,
  },
];

export const DEMO_PROBLEM =
  "해커톤 팀은 제출 직전에 배포 주소·시연 계정·필수 첨부물을 여러 대화에서 다시 찾아야 한다.";

export const DEMO_PROJECT_NAME = "제출 체크룸";

/** S01 예시 넣기 버튼. */
export const S01_EXAMPLE = DEMO_PROBLEM;
