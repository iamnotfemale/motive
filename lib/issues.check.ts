/**
 * issues.ts 자체 점검. 실행:  node --experimental-strip-types lib/issues.check.ts
 * 어긋남 감지는 P0 라서, 조용히 0건이 되면 여기서 터지게 해둔다.
 */
import assert from "node:assert/strict";
import { detectConflicts, detectIssues, openConflicts } from "./issues.ts";
import { DEMO_SOURCE, demoEdges, demoNodes } from "./demo.ts";
import type { Doc } from "./store.ts";

function makeDoc(): Doc {
  return {
    nodes: demoNodes(),
    edges: demoEdges(),
    sources: [DEMO_SOURCE],
    placements: {},
    candidates: [],
    acknowledged: [],
    checks: {},
    changedAt: 0,
    genAt: 0,
  };
}

const base = makeDoc();

// 시드 상태에는 어긋남이 없다. 근거가 들어와야 생긴다.
assert.equal(detectConflicts(base).length, 0, "시드에 없던 어긋남이 잡혔다");

// D-01(09-17)이 채택한 S-01 을 반대하는 근거가 09-19 에 들어온다
const withLate: Doc = {
  ...base,
  nodes: [
    ...base.nodes,
    {
      id: "E-03",
      type: "evidence",
      md: "# 제출 직전에는 단톡에서 바로 확인해서, 따로 페이지를 열진 않았어요.\n",
      createdAt: "2026-09-19T00:00:00.000Z",
      updatedAt: "2026-09-19T00:00:00.000Z",
    },
  ],
  edges: [...base.edges, { id: "E-03>S-01:contradicts", from: "E-03", to: "S-01", type: "contradicts" }],
};

const conflicts = detectConflicts(withLate);
assert.equal(conflicts.length, 1, "채택한 해결안에 대한 반대 근거를 놓쳤다");
assert.equal(conflicts[0].kind, "adopted-vs-evidence");
assert.ok(conflicts[0].text.includes("D-01") && conflicts[0].text.includes("E-03"));
assert.deepEqual(conflicts[0].nodeIds.sort(), ["D-01", "E-03", "S-01"]);
// 판정어를 쓰지 않는다
assert.ok(!/틀렸|잘못|오류/.test(conflicts[0].text), "어긋남 문구가 판정하고 있다");

// 결정보다 먼저 있던 근거는 어긋남이 아니다 (이미 알고 내린 결정)
const early: Doc = {
  ...withLate,
  nodes: withLate.nodes.map((n) =>
    n.id === "E-03" ? { ...n, createdAt: "2026-09-16T00:00:00.000Z" } : n,
  ),
};
assert.equal(detectConflicts(early).length, 0, "결정 이전 근거를 어긋남으로 셌다");

// 알고도 수용하면 열린 어긋남에서 빠진다. 감지 자체는 계속된다.
const ack: Doc = { ...withLate, acknowledged: [conflicts[0].key] };
assert.equal(openConflicts(ack).length, 0);
assert.equal(detectConflicts(ack).length, 1);
assert.equal(detectConflicts(ack)[0].acknowledged, true);

// 결정이 근거로 삼은 주장이 뒤늦게 반박된 경우
const basis: Doc = {
  ...base,
  nodes: [
    ...base.nodes,
    {
      id: "E-04",
      type: "evidence",
      md: "# 반대 근거\n",
      createdAt: "2026-09-20T00:00:00.000Z",
      updatedAt: "2026-09-20T00:00:00.000Z",
    },
  ],
  edges: [
    ...base.edges,
    { id: "D-01>H-01:based_on", from: "D-01", to: "H-01", type: "based_on" },
    { id: "E-04>H-01:contradicts", from: "E-04", to: "H-01", type: "contradicts" },
  ],
};
assert.ok(detectConflicts(basis).some((c) => c.kind === "basis-contradicted"));

// 지지 근거와 반대 근거가 같은 가설에 동시에 붙은 경우
const both: Doc = {
  ...base,
  edges: [...base.edges, { id: "E-01>H-01:supports", from: "E-01", to: "H-01", type: "supports" }],
};
assert.ok(detectConflicts(both).some((c) => c.kind === "claim-both-ways"));

/* 나머지 검출기 */
const issues = detectIssues(base);
const kinds = new Set(issues.map((i) => i.kind));
// H-01 은 반대 근거만 있고 지지 근거가 없다
assert.ok(kinds.has("unsupported-claim"));
// C-01 은 열린 질문이다
assert.ok(kinds.has("open-question"));
// D-01 은 based_on 엣지가 없다 (시드는 관계로 연결하지 않았다)
assert.ok(kinds.has("decision-no-basis"));
// D-01 에는 기각 대안(S-02)과 재검토 조건 섹션이 둘 다 있다
assert.ok(!kinds.has("decision-no-alternative"), "기각 대안이 있는데 없다고 셌다");
assert.ok(!kinds.has("decision-no-revisit"), "재검토 조건이 있는데 없다고 셌다");
// 요구사항 R-01/R-02 는 D-01 에서 produces 로 내려온다
assert.ok(!kinds.has("output-no-provenance"));

// 점수·퍼센트를 만들지 않는다
assert.ok(!("score" in (issues[0] ?? {})));

console.log("issues.ts ok — conflicts:", conflicts.length, "issues:", issues.length);
