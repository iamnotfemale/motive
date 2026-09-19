/**
 * 3분 체험. 스터디 지속성 프로젝트를 씨앗으로 깔고, 다음 할 일을 문서 상태에서 계산한다.
 * 단계는 잠그지 않는다 — 어떤 순서로 해도 되고, 안내는 "다음으로 좋은 한 걸음"만 가리킨다.
 * 체험 자료의 AI 결과(근거 후보)는 미리 정해 둔다 — 무료 모델 지연·한도와 무관하게 늘 같아야 한다.
 */
import { setSectionBody } from "./md";
import { blankMd } from "./templates";
import type { Doc } from "./store";
import { useDoc } from "./store";
import type { EdgeType, EvidenceCandidate, Source, SourceKind } from "./types";
import { verifyQuote } from "./extract";

export const TUTORIAL_TAG = "체험 자료";
export const TUTORIAL_NAME = "대학생 스터디가 왜 오래 유지되지 않을까?";
export const TUTORIAL_PROBLEM = "대학생들은 자신에게 맞는 스터디를 찾기 어렵다.";

const SRC_INTERVIEW = `Study Project — User Interviews (Week 1)
※ 제품 시연용 합성 자료입니다.

## 참여자 A — 대학교 2학년 / 스터디 경험 4회
Q. 스터디를 구하는 건 어렵나요?
아니요. 에브리타임이나 학교 커뮤니티에 올리면 사람은 생각보다 금방 모여요.
저도 이번 학기에 두 개 들어갔는데 문제는 둘 다 한 달을 못 갔어요.
처음에는 다들 열심히 하겠다고 하는데 시험기간 한 번 겹치거나 한 명이 빠지기 시작하면 그냥 흐지부지돼요.
Q. 가장 불편했던 순간은요?
누가 이번 주에 뭘 해야 하는지 애매한 거요.
카톡방에서는 대화가 계속 올라오니까 저번에 정했던 내용을 다시 찾아야 하고,
결국 "이번 주 뭐 하기로 했지?" 이런 질문을 계속 하게 됩니다.

## 참여자 B — 대학교 3학년 / 개발 스터디 운영 경험
Q. 스터디원을 구하기 어려웠나요?
사람 구하는 건 사실 별로 안 어려웠어요.
오히려 지원자가 너무 많아서 누구를 받을지 고민한 적도 있어요.
Q. 운영할 때 가장 어려웠던 점은?
처음 세운 목표가 계속 흐려져요.
원래는 매주 프로젝트 하나씩 하기로 했는데 한두 번 미뤄지기 시작하면서 나중에는 그냥 만나서 각자 공부하는 모임이 됐어요.
목표가 언제 바뀌었는지, 왜 바뀌었는지도 따로 기록되지 않았고요.

## 참여자 C — 대학교 1학년 / 스터디 경험 2회
Q. 새로운 스터디를 찾을 수 있다면 참여할 생각이 있나요?
새로운 걸 더 찾고 싶지는 않아요.
이미 오픈채팅방도 많고 모집 글도 많아요.
오히려 들어간 스터디가 진짜 계속 굴러갈지 모르겠는 게 더 문제예요.
Q. 어떤 기능이 있다면 좋을까요?
매주 해야 할 일이랑 누가 약속을 지켰는지만 보여줘도 좋을 것 같아요.
사람을 추천해주는 것보다 지금 있는 사람들이 안 나가게 해주는 게 더 필요해요.`;

const SRC_COMPETITOR = `# Competitor Research (Week 1)
※ 제품 시연용 합성 자료입니다.

## Everytime
- 대학별 커뮤니티, 스터디 모집 게시글, 빠른 참여자 모집
- 관찰: 스터디 모집 글은 지속적으로 올라오고 있으며, 모집 자체를 위한 접근성은 이미 높다.
- 빠진 것: 스터디가 시작된 이후의 목표 관리와 지속성은 지원하지 않는다.

## Kakao Open Chat
- 빠른 그룹 생성, 자유로운 커뮤니케이션
- 관찰: 대부분의 학생 스터디가 실제 운영 단계에서 사용한다.
- 빠진 것: 과거 결정, 목표, 역할, 약속이 일반 메시지와 함께 쌓인다.

## Notion
- 문서 작성, 일정과 자료 정리
- 관찰: 잘 관리하면 스터디 운영에 사용할 수 있다.
- 빠진 것: 팀원들이 지속적으로 직접 구조를 관리해야 한다.`;

const SRC_SURVEY = `question,option,count
※ 제품 시연용 합성 자료입니다 (응답 40명).
Have you ever joined a study group?,Yes,34
Have you ever joined a study group?,No,6
Have you experienced a group becoming inactive within 4 weeks?,Yes,22
Have you experienced a group becoming inactive within 4 weeks?,No,12
Main reason for inactivity,Schedule conflicts,9
Main reason for inactivity,Members stopped participating,6
Main reason for inactivity,Goals became unclear,5
Main reason for inactivity,Could not find suitable members,2
Would better matching help maintain a study?,Yes,8
Would better matching help maintain a study?,Not sure,14
Would better matching help maintain a study?,No,12
Would visible weekly commitments help?,Yes,25
Would visible weekly commitments help?,Not sure,7
Would visible weekly commitments help?,No,2`;

const SRC_EXPERIMENT = `# Week 2 — Prototype Experiment
※ 제품 시연용 합성 자료입니다.

## 가설
이번 주 목표, 각자의 약속, 약속 이행 여부가 한눈에 보이면 스터디를 유지하기 쉬워질 것이다.

## 프로토타입
가벼운 주간 보드. 각 멤버가 주간 목표 · 개인 약속 · 기한 · 완료 여부를 적는다.

## 참여자
현재 스터디 중인 대학생 5명.

## 피드백
참여자 1: "카톡을 스크롤하지 않아도 뭘 정했는지 알 수 있는 게 좋아요."
참여자 2: "모임 전에 이걸 먼저 볼 것 같아요."
참여자 3: "누가 못 했는지 확인하는 게 중요한 게 아니라, 다들 뭘 하기로 했는지 아는 게 중요해요."
참여자 4: "목표가 왜 바뀌었는지도 보이면 좋겠어요."
참여자 5: "이게 또 하나의 할 일 관리 앱이 되면 안 쓸 것 같아요."

## 관찰
공유된 약속과 결정 맥락에 초점을 맞출 때 반응이 좋았다.
일반적인 할 일 관리 도구처럼 보일 때는 반응이 나빴다.`;

const SRC_MEETING = `# Week 3 Team Meeting
※ 제품 시연용 합성 자료입니다.

## 지금까지의 이해
처음 방향: 스터디 매칭 플랫폼
지금 이해: 사람을 찾는 것은 핵심 병목이 아니다.
더 일관되게 나타나는 문제: 흐려지는 주간 약속, 사라지는 결정, 바뀌는 목표, 줄어드는 참여.

## 논의
민: 그냥 스터디용 할 일 관리 앱을 만들면 되지 않을까?
지윤: 그건 스터디용 Trello가 될까 걱정돼.
민: 목표가 왜 바뀌었는지 기억하고 싶다는 인터뷰가 더 흥미로웠어.
지윤: 그러면 단위가 "할 일"이면 안 돼. "약속"과 "결정"이어야 해.
민: 동의. 할 일을 많이 관리하는 게 아니라 공유 맥락을 유지하는 쪽으로 최적화하자.

## 결정 후보
약속 · 결정 · 목표 변경 · 주간 체크인을 중심으로 한 가벼운 스터디 워크스페이스.`;

interface DemoSource {
  id: string;
  kind: SourceKind;
  name: string;
  text: string;
  meta: string;
  /** 미리 정한 근거 후보. quote 는 원문의 한 줄에 그대로 있어야 한다. */
  candidates: { quote: string; claim: string; limit: string; targetId: string; polarity: EdgeType }[];
}

export const TUTORIAL_SOURCES: DemoSource[] = [
  {
    id: "tut-interview",
    kind: "interview",
    name: "01_user_interviews.md",
    text: SRC_INTERVIEW,
    meta: "인터뷰 3건 · 1주차",
    candidates: [
      {
        quote: "사람 구하는 건 사실 별로 안 어려웠어요.",
        claim: "스터디원을 모으는 것 자체는 어렵지 않다는 진술이 반복된다.",
        limit: "참여자 2명의 경험이라 모든 대학생에게 일반화할 수는 없다.",
        targetId: "H-01",
        polarity: "contradicts",
      },
      {
        quote: "처음 세운 목표가 계속 흐려져요.",
        claim: "목표와 주간 약속이 대화 속에 묻히면서 운영 방향이 흐려진다.",
        limit: "운영자 1명의 회고라 빈도는 알 수 없다.",
        targetId: "P-01",
        polarity: "related",
      },
      {
        quote: "사람을 추천해주는 것보다 지금 있는 사람들이 안 나가게 해주는 게 더 필요해요.",
        claim: "새 스터디 추천보다 기존 스터디의 지속을 돕는 기능을 더 원한다.",
        limit: "한 사람의 의견이며 실제 사용 행동으로 확인된 것은 아니다.",
        targetId: "S-01",
        polarity: "contradicts",
      },
    ],
  },
  {
    id: "tut-competitor",
    kind: "markdown",
    name: "02_competitor_research.md",
    text: SRC_COMPETITOR,
    meta: "경쟁 서비스 3곳 · 1주차",
    candidates: [
      {
        quote: "모집 자체를 위한 접근성은 이미 높다.",
        claim: "기존 도구들이 모집과 소통 문제를 이미 상당 부분 해결하고 있다.",
        limit: "접근성이 높다는 것이 모집 품질까지 보장하는 것은 아니다.",
        targetId: "H-01",
        polarity: "contradicts",
      },
      {
        quote: "스터디가 시작된 이후의 목표 관리와 지속성은 지원하지 않는다.",
        claim: "시작 이후의 목표 관리·지속성은 비어 있는 영역이다.",
        limit: "경쟁 조사 3곳에 한정된 관찰이다.",
        targetId: "P-01",
        polarity: "related",
      },
    ],
  },
  {
    id: "tut-survey",
    kind: "text",
    name: "03_survey_results.csv",
    text: SRC_SURVEY,
    meta: "응답 40명 · 2주차",
    candidates: [
      {
        quote: "Main reason for inactivity,Could not find suitable members,2",
        claim: "중도 이탈 원인으로 '적합한 멤버를 못 찾음'은 22명 중 2명만 꼽았다. 일정 충돌·참여 감소·목표 불명확이 훨씬 많다.",
        limit: "합성 설문이며 표본이 40명이다.",
        targetId: "H-01",
        polarity: "contradicts",
      },
      {
        quote: "Would visible weekly commitments help?,Yes,25",
        claim: "주간 약속이 보이면 도움이 될 것이라는 응답이 25/34로 가장 많다.",
        limit: "의향 응답이라 실제 행동과 다를 수 있다.",
        targetId: "P-01",
        polarity: "related",
      },
    ],
  },
  {
    id: "tut-experiment",
    kind: "markdown",
    name: "04_experiment_log.md",
    text: SRC_EXPERIMENT,
    meta: "참여자 5명 · 2주차",
    candidates: [
      {
        quote: "이게 또 하나의 할 일 관리 앱이 되면 안 쓸 것 같아요.",
        claim: "단순 할 일 관리 도구처럼 느껴지면 사용 의향이 떨어진다.",
        limit: "참여자 5명의 짧은 실험이다.",
        targetId: "P-01",
        polarity: "related",
      },
      {
        quote: "공유된 약속과 결정 맥락에 초점을 맞출 때 반응이 좋았다.",
        claim: "사용자는 할 일 추적보다 공유된 약속과 결정 맥락을 더 가치 있게 느꼈다.",
        limit: "프로토타입 반응이며 지속 사용은 확인되지 않았다.",
        targetId: "P-01",
        polarity: "supports",
      },
    ],
  },
  {
    id: "tut-meeting",
    kind: "markdown",
    name: "05_team_meeting.md",
    text: SRC_MEETING,
    meta: "최종 논의 · 3주차",
    candidates: [
      {
        quote: '그러면 단위가 "할 일"이면 안 돼. "약속"과 "결정"이어야 해.',
        claim: "팀은 할 일이 아니라 약속과 결정을 중심 단위로 삼기로 논의했다.",
        limit: "팀 내부 논의라 사용자 검증은 아니다.",
        targetId: "P-01",
        polarity: "related",
      },
    ],
  },
];

export const REVISED_PROBLEM =
  "대학생 스터디는 사람을 찾는 것보다, 시작 이후 목표와 약속을 유지하고 팀의 진행 맥락을 공유하는 데 어려움을 겪는다.";

export const SUGGESTED_SOLUTION = "스터디의 약속·결정·목표 변경을 보존하는 가벼운 워크스페이스.";
export const SUGGESTED_DECISION = "매칭 플랫폼도, 일반 할 일 관리 앱도 만들지 않는다. 약속·결정·목표 변경을 남기는 가벼운 스터디 워크스페이스를 만든다.";

/** 체험 자료면 AI 대신 미리 정한 후보를 돌려준다. 줄 번호는 원문에서 다시 찾는다. */
export function tutorialCandidates(sourceId: string, doc: Doc): EvidenceCandidate[] | null {
  const spec = TUTORIAL_SOURCES.find((s) => s.id === sourceId);
  const source = doc.sources.find((s) => s.id === sourceId);
  if (!spec || !source) return null;
  const known = new Set(doc.nodes.map((n) => n.id));
  return spec.candidates
    .filter((c) => known.has(c.targetId))
    .map((c, i) => {
      const found = verifyQuote(source.text, c.quote);
      return {
        id: `cand-${sourceId}-${i}`,
        sourceId,
        line: found.line ?? 1,
        quote: c.quote,
        claim: c.claim,
        limit: c.limit,
        targetId: c.targetId,
        edgeType: c.polarity,
        state: "pending" as const,
        mismatch: !found.ok,
      };
    });
}

/** 씨앗 프로젝트를 만들고 id 를 돌려준다. 문제 · 가설 · 해결안 + 자료 5개(캔버스 오른쪽 줄). */
export function createTutorialProject(): string {
  const S = useDoc.getState();
  const pid = S.createProject(TUTORIAL_PROBLEM, TUTORIAL_NAME);
  useDoc.setState((s) => ({ projects: s.projects.map((p) => (p.id === pid ? { ...p, tutorial: true } : p)) }));

  const hid = S.addNode(pid, {
    kind: "claim",
    md: setSectionBody(blankMd("claim", "스터디 참여율이 낮은 가장 큰 이유는 적합한 사람을 찾기 어렵기 때문이다."), "검토 상태", "미검증"),
    at: { x: 72, y: 460 },
    node: { status: "unverified" },
  });
  const sid = S.addNode(pid, {
    kind: "solution",
    md: setSectionBody(blankMd("solution", "관심사·목표·시간대를 기반으로 스터디원을 자동 매칭한다."), "상태", "검토 중"),
    at: { x: 72, y: 880 },
    node: { status: "reviewing" },
  });
  S.addEdge(pid, { from: "P-01", to: hid, type: "investigates" });
  S.addEdge(pid, { from: hid, to: sid, type: "related" });

  const at = new Date().toISOString();
  TUTORIAL_SOURCES.forEach((d, i) => {
    const src: Source = { id: d.id, kind: d.kind, name: d.name, text: d.text, state: "read", tag: TUTORIAL_TAG, createdAt: at };
    S.addSource(pid, src);
    S.moveNode(pid, d.id, { x: 620, y: 48 + i * 96 });
  });
  return pid;
}

export type TutorialStep = "evidence" | "more" | "revisit" | "decide" | "handoff" | "done";

/** 문서 상태에서 다음 걸음을 고른다. 어떤 순서로 했든 여기서 다시 계산된다. */
export function tutorialStep(doc: Doc): { step: TutorialStep; counter: number } {
  const evidence = doc.nodes.filter((n) => n.type === "evidence");
  const counter = doc.edges.filter((e) => e.type === "contradicts" && e.to === "H-01").length;
  const revised = doc.nodes.some((n) => n.type === "problem" && n.id !== "P-01");
  const decided = doc.nodes.some((n) => n.type === "decision");
  if (evidence.length === 0) return { step: "evidence", counter };
  if (counter < 2) return { step: "more", counter };
  if (!revised) return { step: "revisit", counter };
  if (!decided) return { step: "decide", counter };
  if (doc.genAt === 0) return { step: "handoff", counter };
  return { step: "done", counter };
}

/** 문제를 다시 정의한다 — P-01 은 남기고 P-02 를 만들어 반대 근거들과 잇는다. */
export function reviseProblem(pid: string, statement: string): string {
  const S = useDoc.getState();
  const doc = S.docs[pid];
  S.pushHistory(pid);
  const p1 = doc.placements["P-01"] ?? { x: 72, y: 48 };
  const id = S.addNode(pid, {
    kind: "problem",
    md: setSectionBody(setSectionBody(blankMd("problem", statement), "대상·상황", "스터디를 시작한 뒤의 대학생 팀"), "불편", "목표·약속이 대화에 묻히고, 결정이 사라지고, 참여가 줄어든다."),
    at: { x: p1.x + 960, y: p1.y },
  });
  for (const e of doc.edges) if (e.type === "contradicts" && e.to === "H-01") S.addEdge(pid, { from: e.from, to: id, type: "based_on" });
  const old = doc.nodes.find((n) => n.id === "P-01");
  if (old) S.patchNode(pid, "P-01", { md: setSectionBody(old.md, "검토 상태", `재정의됨 → ${id}`) });
  S.addEdge(pid, { from: "P-01", to: id, type: "related" });
  useDoc.setState((s) => ({ projects: s.projects.map((p) => (p.id === pid ? { ...p, problemStatement: statement } : p)) }));
  return id;
}

/** 결정을 남긴다 — 새 해결안(채택) + 결정, 기존 매칭 해결안은 기각. */
export function createTutorialDecision(pid: string, decisionText: string): string {
  const S = useDoc.getState();
  const doc = S.docs[pid];
  S.pushHistory(pid);
  const p2 = doc.nodes.find((n) => n.type === "problem" && n.id !== "P-01");
  const base = (p2 && doc.placements[p2.id]) ?? { x: 1032, y: 48 };
  const sol = S.addNode(pid, {
    kind: "solution",
    md: setSectionBody(setSectionBody(blankMd("solution", SUGGESTED_SOLUTION), "어떻게 해결하나", "주간 약속 · 결정 · 목표 변경을 한 곳에 남기고, 모임 전에 확인한다."), "상태", "채택"),
    at: { x: base.x, y: base.y + 460 },
    node: { status: "adopted" },
  });
  let md = blankMd("decision", decisionText);
  md = setSectionBody(md, "선택한 해결안", `${sol} ${SUGGESTED_SOLUTION}`);
  md = setSectionBody(md, "이유", "인터뷰·설문·경쟁 조사 모두 '사람 찾기'가 핵심 병목이라는 근거가 부족했고, 실험에서는 할 일 관리처럼 보일 때 반응이 나빴다.");
  md = setSectionBody(md, "기각 대안", "S-01 스터디 매칭 — 모집은 이미 쉽다는 근거가 반복됨\n일반 할 일 관리 앱 — 실험 참여자가 사용 의향 저하를 표현");
  md = setSectionBody(md, "재검토 조건", "사람 찾기가 병목이라는 새 근거가 2건 이상 나오면");
  const dec = S.addNode(pid, { kind: "decision", md, at: { x: base.x, y: base.y + 920 }, node: { status: "confirmed" } });
  S.addEdge(pid, { from: dec, to: sol, type: "produces" });
  if (doc.nodes.some((n) => n.id === "S-01")) {
    S.addEdge(pid, { from: dec, to: "S-01", type: "produces", rejected: true });
    S.patchNode(pid, "S-01", { status: "rejected" });
  }
  if (p2) S.addEdge(pid, { from: p2.id, to: sol, type: "investigates" });
  return dec;
}
