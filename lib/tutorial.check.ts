/** 체험 씨앗·후보·단계 전이. `npm run check` 에 포함. */
import assert from "node:assert/strict";
import { useDoc } from "./store.ts";
import { TUTORIAL_SOURCES, createTutorialDecision, createTutorialProject, reviseProblem, tutorialCandidates, tutorialStep } from "./tutorial.ts";

const pid = createTutorialProject();
const D = () => useDoc.getState().docs[pid];
assert.equal(D().nodes.length, 3);
assert.equal(D().sources.length, 5);
assert.equal(tutorialStep(D()).step, "evidence");

// 모든 미리 정한 인용이 원문 줄에 실제로 있다
for (const s of TUTORIAL_SOURCES) {
  const c = tutorialCandidates(s.id, D())!;
  assert.ok(c.length > 0, s.name);
  for (const x of c) assert.equal(x.mismatch, false, `${s.name}: "${x.quote}"`);
}

// 반대 근거 2건 승인 → 문제 재정의 단계
const S = useDoc.getState();
for (const sid of ["tut-interview", "tut-competitor"]) {
  const c = tutorialCandidates(sid, D())!.find((x) => x.targetId === "H-01")!;
  S.setCandidates(pid, [...D().candidates, c]);
  assert.ok(S.approveCandidate(pid, c.id));
}
assert.equal(tutorialStep(D()).step, "revisit");

const p2 = reviseProblem(pid, "새 문제");
assert.equal(p2, "P-02");
assert.equal(tutorialStep(D()).step, "decide");
const dec = createTutorialDecision(pid, "결정");
assert.ok(D().edges.some((e) => e.from === dec && e.to === "S-01" && e.rejected));
assert.equal(D().nodes.find((n) => n.id === "S-01")?.status, "rejected");
assert.equal(tutorialStep(D()).step, "handoff");
S.markGenerated(pid);
assert.equal(tutorialStep(D()).step, "done");
console.log("tutorial.check ok");
