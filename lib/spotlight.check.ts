/** spotlight.ts 자체 점검. 단추가 엉뚱한 블록을 비추면 여기서 터진다. */
import assert from "node:assert/strict";
import { spotlightFor } from "./spotlight.ts";
import { DEMO_SOURCE, demoEdges, demoNodes } from "./demo.ts";
import type { Doc } from "./store.ts";

const doc: Doc = {
  nodes: [
    ...demoNodes(),
    {
      id: "E-03",
      type: "evidence",
      md: "# 반대 근거\n",
      sourceId: DEMO_SOURCE.id,
      createdAt: "2026-09-19T00:00:00.000Z",
      updatedAt: "2026-09-19T00:00:00.000Z",
    },
  ],
  edges: [...demoEdges(), { id: "E-03>S-01:contradicts", from: "E-03", to: "S-01", type: "contradicts" }],
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

const ids = (k: Parameters<typeof spotlightFor>[0]) => spotlightFor(k, doc)!.ids;

// 가설 단추는 가설만
assert.deepEqual(ids("add-claim"), ["H-01"]);

// 해결안 단추는 해결안만
assert.deepEqual(ids("add-solution").sort(), ["S-01", "S-02"]);

// 반박은 반대 근거와 그 대상, 어긋남으로 묶인 결정까지
const conflict = ids("conflicts");
assert.ok(conflict.includes("E-02") && conflict.includes("E-03"), "반대 근거가 빠졌다");
assert.ok(conflict.includes("H-01") && conflict.includes("S-01"), "반박 대상이 빠졌다");
assert.ok(conflict.includes("D-01"), "어긋난 결정이 빠졌다");
assert.ok(!conflict.includes("R-01"), "관계 없는 요구사항까지 비췄다");

// 미확인은 검출된 항목만
const issues = ids("issues");
assert.ok(issues.includes("C-01"), "열린 질문이 빠졌다");
assert.ok(issues.length > 0 && issues.length < doc.nodes.length, "전부를 비추면 의미가 없다");

// 자료는 자료와 거기서 나온 근거
const src = ids("attach");
assert.ok(src.includes(DEMO_SOURCE.id), "자료가 빠졌다");
assert.ok(src.includes("E-01") && src.includes("E-02"), "자료에서 나온 근거가 빠졌다");

// 결정은 결정과 그 결정이 채택·기각한 것
const dec = ids("make-decision");
assert.ok(dec.includes("D-01") && dec.includes("S-01") && dec.includes("S-02"));

// 비출 게 없으면 안내를 준다
const empty: Doc = { ...doc, nodes: doc.nodes.filter((n) => n.type !== "note"), sources: [] };
assert.ok(spotlightFor("add-note", empty)!.empty, "빈 경우 안내가 없다");
assert.equal(spotlightFor("add-note", empty)!.ids.length, 0);

// 화면을 옮기는 단추는 비추지 않는다
assert.equal(spotlightFor("handoff", doc), null);
assert.equal(spotlightFor("export", doc), null);

console.log("spotlight.ts ok — conflicts:", conflict.length, "issues:", issues.length);
