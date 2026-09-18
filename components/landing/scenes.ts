/**
 * 소개 페이지 장면 데이터. 제출 체크룸 데모(lib/demo.ts)와 같은 카드를 쓴다. 전부 합성 자료.
 */
import { col, sceneH, type Block, type SceneEdge, type SceneNode, type SceneSpec } from "./Scene";
import type { Kind } from "@/lib/labels";

const q = (text: string, l?: number): Block => ({ t: "quote", text, l });
const h = (text: string): Block => ({ t: "h2", text });
const p = (text: string, l?: number): Block => ({ t: "text", text, l });
const li = (text: string, l?: number): Block => ({ t: "list", text, l });

type Demo = { type: Kind | "source"; title: string; lines?: number; full?: Block[]; state?: string };

const DEMO: Record<string, Demo> = {
  "P-01": {
    type: "problem",
    title: "해커톤 팀은 제출 직전에 배포 주소·시연 계정·필수 첨부물을 여러 대화에서 다시 찾아야 한다.",
    lines: 3,
    full: [h("대상·상황"), p("해커톤 마감 1–2시간 전, 3–5명 팀."), h("불편"), p("제출에 필요한 정보가 채팅 여러 곳에 흩어져 있어 마지막에 다시 찾는다.", 2)],
  },
  "H-01": {
    type: "claim",
    title: "제출 준비를 별도 협업 앱으로 옮기면 누락이 줄어들 것이다.",
    lines: 2,
    full: [
      h("본문"),
      p("제출 항목을 한 곳에서 관리하면 마감 직전 누락이 줄어든다고 예상한다.", 2),
      h("검증 계획"),
      li("참여자 인터뷰에서 도구 전환 의향 확인", 2),
      li("해커톤 1회에서 체크리스트 사용 후 누락 항목 비교", 2),
      h("검토 상태"),
      p("미검증"),
    ],
  },
  "C-01": {
    type: "question",
    title: "팀원 전원이 새 도구에 가입해야 한다면 사용을 시작할까?",
    lines: 2,
    full: [h("상태"), p("열림"), h("연결 대상"), p("H-01 — 검토 필요"), h("메모"), p("E-02의 발언과 관련. 결정 D-01에서 위험으로 인지.", 2)],
  },
  "E-01": {
    type: "evidence",
    title: "“마지막에 배포 주소가 어느 메시지에 있었는지 다시 찾았어요.”",
    lines: 2,
    full: [q("마지막에 배포 주소가 어느 메시지에 있었는지 다시 찾았어요.", 2), h("출처"), p("interview-demo.md · 참여자 A · 줄 6"), h("해석"), p("제출 정보가 대화에 흩어져 있어 마감 직전 재탐색이 발생한다.", 2)],
  },
  "E-02": {
    type: "evidence",
    title: "“앱을 하나 더 가입해야 하면 그냥 카톡에 정리할 것 같아요.”",
    lines: 2,
    full: [
      q("앱을 하나 더 가입해야 하면 그냥 카톡에 정리할 것 같아요.", 2),
      h("출처"),
      p("interview-demo.md · 참여자 B · 줄 9"),
      h("해석"),
      p("새 계정 가입이 도입 장벽일 가능성이 있다."),
      h("한계"),
      p("이 발언 하나를 전체 대학생에게 일반화할 수는 없다.", 2),
    ],
  },
  "E-03": {
    type: "evidence",
    title: "“제출 직전에는 단톡에서 바로 확인해서, 따로 페이지를 열진 않았어요.”",
    lines: 3,
    full: [h("출처"), p("interview-demo.md · 참여자 C · 줄 12"), h("해석"), p("마감 직전에는 이미 쓰는 채팅에서 확인하는 습관이 있어, 별도 페이지를 여는 행동이 일어나지 않을 수 있다.", 3)],
  },
  "S-01": {
    type: "solution",
    title: "계정 없이 링크로 여는 제출 준비 체크리스트.",
    lines: 2,
    full: [h("어떻게 해결하나"), p("팀 대표가 링크를 만들고 팀원은 가입 없이 항목을 확인·수정한다.", 2), h("상태"), p("채택 (D-01)")],
  },
  "S-02": {
    type: "solution",
    title: "팀원 전원이 가입하는 별도 협업 앱.",
    lines: 2,
    full: [h("어떻게 해결하나"), p("팀 전용 워크스페이스에 제출 항목·채팅·파일을 모은다.", 2), h("상태"), p("보류·기각 (D-01) — 가입 장벽(E-02, C-01)", 2)],
  },
  "D-01": {
    type: "decision",
    title: "별도 채팅을 만들지 않고 제출 정보 확인에만 집중한다.",
    lines: 2,
    full: [
      h("선택한 해결안"),
      p("S-01 계정 없이 링크로 여는 제출 준비 체크리스트", 2),
      h("이유"),
      p("가입 장벽이 도입을 막을 가능성(E-02). 채팅은 이미 쓰는 메신저가 대신한다.", 2),
      h("기각 대안"),
      p("S-02 별도 협업 앱 — 기각"),
    ],
  },
  "SRC-1": { type: "source", title: "interview-demo.md", state: "읽음" },
};

type Opt = { body?: "full" | "heads"; selected?: boolean; acts?: [string, string] };
/** 데모 카드 → 장면 노드. 좌표는 col() 이 나중에 찍는다. */
function N(id: string, o: Opt = {}): SceneNode {
  const d = DEMO[id];
  return {
    id,
    type: d.type,
    title: d.title,
    lines: d.lines,
    state: d.state,
    body: o.body === "full" ? d.full : o.body === "heads" ? "heads" : undefined,
    selected: o.selected,
    acts: o.acts,
    x: 0,
    y: 0,
  };
}
/** 데모에 없는 카드(스타트업·리서치 예시). */
const sp = (id: string, type: Kind, title: string, lines: number, body?: "heads" | Block[]): SceneNode => ({ id, type, title, lines, body, x: 0, y: 0 });

const X = [104, 504, 904];
const Y = [16, 416, 816];

function mk(cols: [number, SceneNode[], number?][], edges: SceneEdge[], extra?: Partial<SceneSpec>): SceneSpec & { h: number } {
  const nodes: SceneNode[] = [];
  for (const [x, list, top] of cols) nodes.push(...col(x, list, top ?? 40));
  return { nodes, edges, h: sceneH(nodes), ...extra };
}

export const hero = mk(
  [
    [X[0], [N("P-01", { body: "full" }), N("H-01", { selected: true, acts: ["근거 연결", "검토 질문"] })]],
    [X[1], [N("E-01"), N("C-01"), N("E-02", { body: "heads" })]],
    [X[2], [N("SRC-1"), N("S-01"), N("D-01", { body: "heads" })]],
  ],
  [["P-01", "H-01", "origin"], ["E-01", "P-01", "support"], ["C-01", "H-01", "challenge"], ["E-02", "H-01", "counter"], ["E-02", "S-01", "basis"], ["D-01", "S-01", "adopt"]],
);
hero.h = Math.max(hero.h + 80, 660);
// 히어로 프레임은 위에 52px 워크스페이스 헤더를 얹는다. 카드를 그만큼 내린다.
for (const n of hero.nodes) n.y += 52;
hero.h += 52;

export const how = mk(
  [
    [Y[0], [N("P-01", { body: "heads" }), N("H-01")]],
    [Y[1], [N("C-01"), N("E-02", { body: "heads" })]],
    [Y[2], [N("SRC-1"), N("S-01", { body: "heads" })]],
  ],
  [["P-01", "H-01", "origin"], ["C-01", "H-01", "challenge"], ["E-02", "H-01", "counter"], ["E-02", "S-01", "basis"]],
);

export const chal = mk(
  [
    [Y[0], [N("D-01", { body: "heads" }), N("H-01")]],
    [Y[1], [N("S-01", { body: "full" }), N("E-02")]],
    [Y[2], [N("SRC-1"), N("E-03", { body: "full" })]],
  ],
  [["D-01", "S-01", "adopt"], ["E-03", "S-01", "counter"], ["E-02", "H-01", "counter"]],
);
chal.h += 56;

export const ctx = mk(
  [
    [16, [N("P-01", { body: "heads" }), N("H-01"), N("S-02")]],
    [392, [N("C-01"), N("E-02", { body: "heads" }), N("D-01")]],
  ],
  [["P-01", "H-01", "origin"], ["C-01", "H-01", "challenge"], ["E-02", "H-01", "counter"], ["D-01", "S-02", "reject"]],
  { conv: { dx: 72 } },
);
ctx.h = Math.max(ctx.h, 620);

export const useCases = {
  hackathon: {
    label: "Hackathon",
    title: "하루 안에 문제를 찾고 검증해야 할 때.",
    desc: "인터뷰 한 번으로 가설이 바뀌어도 됩니다. 마감 직전에 \"왜 이걸 만들었는지\"가 이미 문서에 있습니다.",
    scene: mk(
      [
        [Y[0], [N("P-01"), N("H-01", { body: "heads" })]],
        [Y[1], [N("SRC-1"), N("E-02")]],
        [Y[2], [N("D-01"), N("S-01")]],
      ],
      [["P-01", "H-01", "origin"], ["E-02", "H-01", "counter"], ["D-01", "S-01", "adopt"]],
    ),
  },
  startup: {
    label: "Startup",
    title: "고객 인터뷰가 제품 결정으로 이어지게.",
    desc: "통화 노트에서 뽑은 인용이 근거가 되고, 근거가 결정을 바꿉니다. 기각한 대안은 다음 회의에 다시 올라오지 않습니다.",
    scene: mk(
      [
        [Y[0], [sp("P-01", "problem", "온보딩 첫 주에 팀 초대가 거의 일어나지 않는다.", 2), sp("H-01", "claim", "초대 보상을 주면 초대가 늘 것이다.", 2, "heads")]],
        [Y[1], [sp("C-01", "question", "혼자 쓰는 첫 주가 문제인가, 초대할 이유가 없는 게 문제인가?", 3), sp("E-01", "evidence", "“초대할 사람이 정해지기 전엔 혼자 써봐요.”", 2, [h("출처"), p("call-notes.md · 참여자 2 · 줄 14")])]],
        [Y[2], [sp("D-01", "decision", "초대 보상 대신 첫 주 혼자 쓰는 흐름부터 고친다.", 2), sp("S-01", "solution", "첫 주를 혼자서도 끝낼 수 있게 온보딩 정리.", 2, [h("상태"), p("채택 (D-01)")])]],
      ],
      [["P-01", "H-01", "origin"], ["C-01", "H-01", "challenge"], ["E-01", "H-01", "counter"], ["D-01", "S-01", "adopt"]],
    ),
  },
  research: {
    label: "Research",
    title: "자료를 모으는 데서 끝나지 않도록.",
    desc: "출처는 줄 번호까지 남고, 열린 질문은 열린 채로 표시됩니다. 정리된 맥락은 그대로 에이전트에 넘어갑니다.",
    scene: mk(
      [
        [Y[0], [sp("P-01", "problem", "선행 연구가 같은 용어에 서로 다른 정의를 쓴다.", 2), sp("H-01", "claim", "정의 B를 기준으로 삼아도 결과 비교가 가능하다.", 2), sp("C-01", "question", "정의 A 기반 결과는 어떻게 재해석하나?", 2, [h("상태"), p("열림")])]],
        [Y[1], [sp("E-01", "evidence", "“정의 A는 결과 지표만, 정의 B는 과정도 포함한다.”", 2, [h("출처"), p("review-notes.md · 줄 3")]), sp("E-02", "evidence", "“2021년 이후 논문은 대부분 정의 B를 쓴다.”", 2, [h("출처"), p("review-notes.md · 줄 21")])]],
        [Y[2], [{ id: "SRC-3", type: "source", title: "review-notes.md", state: "읽음", x: 0, y: 0 }, sp("N-01", "note", "정의 매핑표 초안 — 지표별 대응 관계", 2, [li("결과 지표 ↔ 정의 A"), li("과정 지표 ↔ 정의 B 추가분")])]],
      ],
      [["P-01", "H-01", "origin"], ["E-01", "H-01", "support"], ["E-02", "H-01", "support"], ["C-01", "H-01", "challenge"], ["N-01", "E-02", "related"]],
    ),
  },
} as const;

export type UseCaseKey = keyof typeof useCases;
