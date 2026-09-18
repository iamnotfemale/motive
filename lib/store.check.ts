/** 휴지통과 백업 왕복. `npm run check` 에 포함. */
import assert from "node:assert/strict";
import { useDoc } from "./store.ts";
import { sectionBody, setSectionBody } from "./md.ts";
import { blankMd } from "./templates.ts";

const S = () => useDoc.getState();
const pid = S().createProject("검사용 문제");
S().addNode(pid, { kind: "claim", md: "# 가설 하나", at: { x: 10, y: 10 } });

S().trashProject(pid);
assert.ok(S().projects.find((p) => p.id === pid)?.deletedAt, "휴지통에 deletedAt 이 안 찍혔다");
S().restoreProject(pid);
assert.equal(S().projects.find((p) => p.id === pid)?.deletedAt, undefined, "복원이 안 됐다");

// 31일 전에 지운 것은 비워진다
S().trashProject(pid);
useDoc.setState((s) => ({
  projects: s.projects.map((p) => (p.id === pid ? { ...p, deletedAt: new Date(Date.now() - 31 * 86400000).toISOString() } : p)),
}));
const backup = S().exportAll();
S().purgeTrash();
assert.equal(S().projects.find((p) => p.id === pid), undefined, "30일 지난 항목이 남아 있다");
assert.equal(S().docs[pid], undefined, "문서가 같이 안 지워졌다");

// 백업 파일로 되살린다
assert.equal(S().importAll("{not json"), false);
assert.equal(S().importAll(JSON.stringify({ app: "other" })), false);
assert.equal(S().importAll(backup), true);
assert.equal(S().docs[pid]?.nodes.length, 2, "가져온 문서에 카드가 없다"); // P-01 + 가설
assert.deepEqual(S().docs[pid]?.undo, [], "되돌리기 이력은 백업에 들어가면 안 된다");

console.log("store.check ok");

// 가설 상태 전환: 미검증 → 검증됨 이 status 와 "검토 상태" 절에 함께 반영된다
{
  const p2 = S().createProject("상태 검사");
  const hid = S().addNode(p2, { kind: "claim", md: blankMd("claim", "가설"), at: { x: 0, y: 0 }, node: { status: "unverified" } });
  const n = S().docs[p2].nodes.find((x) => x.id === hid)!;
  S().patchNode(p2, hid, { status: "verified", md: setSectionBody(n.md, "검토 상태", "검증됨") });
  const after = S().docs[p2].nodes.find((x) => x.id === hid)!;
  assert.equal(after.status, "verified");
  assert.equal(sectionBody(after.md, "검토 상태").trim(), "검증됨");
  console.log("status toggle ok");
}
