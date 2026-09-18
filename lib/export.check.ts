/**
 * export.ts 자체 점검. 실행:  tsx lib/export.check.ts
 *
 * 인계 문서에서 빠지면 안 되는 것: 기각 대안, 기각 이유, 재검토 조건, 반대 근거, 미검증 표시, 어긋남.
 * 들어가면 안 되는 것: 퍼센트·점수·검증 완료 류 문구.
 */
import assert from "node:assert/strict";
import { buildAgentFiles, buildHandoffPreview, systemChecks } from "./export.ts";
import { DEMO_PROJECT_NAME, DEMO_PROBLEM, DEMO_SOURCE, demoEdges, demoNodes } from "./demo.ts";
import type { Doc } from "./store.ts";
import type { Project } from "./types.ts";

const project: Project = {
  id: "p1",
  name: DEMO_PROJECT_NAME,
  problemStatement: DEMO_PROBLEM,
  demo: true,
  createdAt: "2026-09-15T00:00:00.000Z",
  updatedAt: "2026-09-19T00:00:00.000Z",
};

const doc: Doc = {
  nodes: [
    ...demoNodes(),
    {
      id: "E-03",
      type: "evidence",
      md: `# “제출 직전에는 단톡에서 바로 확인해서, 따로 페이지를 열진 않았어요.”

## 원문 인용
> 제출 직전에는 단톡에서 바로 확인해서, 따로 페이지를 열진 않았어요.

## 해석
마감 직전에는 별도 페이지를 여는 행동이 일어나지 않을 가능성이 있다.

## 한계
참여자 1명의 발언.
`,
      sourceId: DEMO_SOURCE.id,
      sourceLocator: { line: 12, verified: true },
      createdAt: "2026-09-19T00:00:00.000Z",
      updatedAt: "2026-09-19T00:00:00.000Z",
    },
  ],
  edges: [
    ...demoEdges(),
    { id: "E-03>S-01:contradicts", from: "E-03", to: "S-01", type: "contradicts" },
    { id: "D-01>H-01:based_on", from: "D-01", to: "H-01", type: "based_on" },
  ],
  sources: [DEMO_SOURCE],
  placements: {},
  candidates: [],
  undo: [],
  redo: [],
  acknowledged: [],
  checks: {},
  changedAt: 0,
  genAt: 0,
};

const files = buildAgentFiles(doc, project);
const name = (n: string) => files.find((f) => f.name === n)!.content;

assert.deepEqual(
  files.map((f) => f.name),
  ["PROJECT_HANDOFF.md", "PROJECT_CONTEXT.md", "DECISIONS.md", "EVIDENCE.md", "AGENTS.md"],
);

/* ── 결정 이력이 살아 있어야 한다 (스펙 §16, §20.2) ── */
const decisions = name("DECISIONS.md");
assert.ok(decisions.includes("### Rejected alternatives"), "기각 대안 절이 없다");
assert.ok(decisions.includes("S-02"), "기각한 대안 S-02 가 빠졌다");
assert.ok(decisions.includes("### Revisit if"), "재검토 조건 절이 없다");
assert.ok(/팀원 전원 가입|링크 공유만으로/.test(decisions), "재검토 조건 내용이 비었다");
assert.ok(decisions.includes("### Based on"), "근거 연결이 빠졌다");

/* ── 에이전트가 이미 버린 길을 다시 제안하지 않게 (스펙 §16) ── */
const agents = name("AGENTS.md");
assert.ok(
  agents.includes("Rejected approaches you should not re-propose"),
  "재제안 금지 절이 없다",
);
assert.ok(agents.includes("S-02"), "AGENTS.md 에 기각 대안이 없다");
assert.ok(agents.includes("재검토 조건:"), "기각 항목에 재검토 조건이 붙지 않았다");
assert.ok(agents.includes("Known contradictions"), "어긋남 절이 없다");

/* ── 반대 근거와 provenance (스펙 §5.5, §20.3) ── */
const evidence = name("EVIDENCE.md");
assert.ok(evidence.includes("E-02"), "반대 근거 E-02 가 빠졌다");
assert.ok(evidence.includes("contradicts"), "polarity 가 없다");
assert.ok(evidence.includes("Source location:"), "출처 위치가 없다");
assert.ok(evidence.includes("Quote verified against source:"), "인용 대조 결과가 없다");
assert.ok(evidence.includes("줄 9"), "줄 번호가 빠졌다");

/* ── 미리보기 문서 ── */
const preview = buildHandoffPreview(doc, project);
assert.ok(preview.includes("## 5. 반대 근거"), "반대 근거 절이 없다");
assert.ok(preview.includes("E-03"), "나중에 들어온 반대 근거가 빠졌다");
assert.ok(preview.includes("## 6. 미검증 가설과 열린 질문"));
assert.ok(preview.includes("## 7. 제외 범위"));
assert.ok(/미확인 항목 \d+건은 그대로 남겼습니다/.test(preview), "미확인 항목 문구가 없다");
assert.ok(preview.includes("서로 어긋나는 항목"), "어긋남 절이 빠졌다");
assert.ok(preview.includes("데모 자료로 만든 문서입니다"), "데모 표시가 빠졌다");

/* ── 들어가면 안 되는 것 (스펙 §6, §30.2) ── */
for (const f of files) {
  assert.ok(!/\d+\s*%/.test(f.content), `${f.name} 에 퍼센트가 들어갔다`);
  assert.ok(!/검증 완료|사업성|readiness|준비도/i.test(f.content), `${f.name} 에 검증 완료 류 문구가 있다`);
  assert.ok(!/\bclaim\b|\bquestion\b|"output"/.test(f.content), `${f.name} 에 내부 타입명이 노출됐다`);
}

/* ── 점검은 문서 내용을 바꾸지 않는다 (핸드오프 §8) ── */
const checked = buildAgentFiles({ ...doc, checks: { criteria: true, risks: true } }, project);
assert.equal(checked[0].content, files[0].content, "점검 여부가 문서 내용을 바꿨다");

/* ── 시스템 확인 ── */
const sys = systemChecks(doc, project);
assert.equal(sys.length, 3);
assert.ok(sys.find((c) => c.key === "solution")!.ok, "채택한 해결안을 못 찾았다");
const broken = systemChecks({ ...doc, sources: [] }, project);
assert.equal(broken.find((c) => c.key === "sources")!.ok, false, "원본 없음을 못 잡았다");

console.log("export.ts ok —", files.map((f) => `${f.name}(${f.content.length})`).join(" "));
