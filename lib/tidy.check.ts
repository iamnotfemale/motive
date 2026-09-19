/** tidy.ts 자체 점검. 배치만 바꾸고 관계는 건드리지 않는다는 것이 핵심이다. */
import assert from "node:assert/strict";
import { levelsOf, tidyLayout, type Size } from "./tidy.ts";
import { DEMO_SOURCE, demoEdges, demoNodes } from "./demo.ts";
import { kindOf } from "./labels.ts";

const nodes = demoNodes();
const edges = demoEdges();
const kindById = new Map(nodes.map((n) => [n.id, kindOf(n) as string]));
const kindOfId = (id: string) => kindById.get(id) ?? "note";

const level = levelsOf(nodes, edges, kindOfId);

// 문제가 맨 위, 가설은 그 아래
assert.equal(level.get("P-01"), 0, "문제가 맨 위가 아니다");
assert.ok(level.get("H-01")! > level.get("P-01")!, "가설이 문제보다 위에 있다");

// 근거와 검토 질문은 자기가 가리키는 카드 아래에 달린다
assert.ok(level.get("E-02")! > level.get("H-01")!, "근거가 가설 위에 있다");
assert.ok(level.get("C-01")! > level.get("H-01")!, "검토 질문이 가설 위에 있다");
assert.ok(level.get("E-01")! > level.get("P-01")!, "근거가 문제 위에 있다");

// 결정이 만든 것은 결정 아래
assert.ok(level.get("R-01")! > level.get("D-01")!, "요구사항이 결정 위에 있다");
assert.ok(level.get("S-02")! > level.get("D-01")!, "기각 대안이 결정 위에 있다");

const sizes: Record<string, Size> = Object.fromEntries(
  [...nodes.map((n) => n.id), DEMO_SOURCE.id].map((id) => [id, { w: 288, h: 200 }]),
);
const spots = tidyLayout(nodes, edges, [{ ...DEMO_SOURCE, attachedTo: "E-01" }], sizes);

// 모든 카드가 자리를 받는다
for (const n of nodes) assert.ok(spots[n.id], `${n.id} 자리가 없다`);
// 자료도 함께
assert.ok(spots[DEMO_SOURCE.id], "자료 자리가 없다");
// 붙어 있는 자료는 그 카드 오른쪽, 같은 줄
assert.equal(spots[DEMO_SOURCE.id].y, spots["E-01"].y, "붙은 자료가 다른 줄에 놓였다");
assert.ok(spots[DEMO_SOURCE.id].x > spots["E-01"].x + 288, "붙은 자료가 카드와 겹친다");
// 같은 줄의 카드(자료 자리 포함)는 서로 겹치지 않는다
{
  const ids = [...nodes.map((n) => n.id), DEMO_SOURCE.id];
  for (const a of ids) for (const b of ids) {
    if (a >= b) continue;
    const A = spots[a], B = spots[b];
    const overlap = Math.abs(A.x - B.x) < 288 && Math.abs(A.y - B.y) < 200;
    assert.ok(!overlap, `${a} 와 ${b} 가 겹친다`);
  }
}

// 같은 층은 같은 y, 다른 x
const byLevel = new Map<number, string[]>();
for (const n of nodes) {
  const l = level.get(n.id)!;
  byLevel.set(l, [...(byLevel.get(l) ?? []), n.id]);
}
for (const [, ids] of byLevel) {
  const ys = new Set(ids.map((id) => spots[id].y));
  assert.equal(ys.size, 1, "같은 층인데 y 가 다르다");
  const xs = new Set(ids.map((id) => spots[id].x));
  assert.equal(xs.size, ids.length, "같은 층에서 x 가 겹친다");
}

// 겹치지 않는다
const ids = nodes.map((n) => n.id);
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    const a = spots[ids[i]];
    const b = spots[ids[j]];
    const overlap = Math.abs(a.x - b.x) < 288 && Math.abs(a.y - b.y) < 200;
    assert.ok(!overlap, `${ids[i]} 와 ${ids[j]} 가 겹친다`);
  }
}

// 음수 좌표를 만들지 않는다
for (const id of Object.keys(spots)) {
  assert.ok(spots[id].x >= 0 && spots[id].y >= 0, `${id} 가 화면 밖으로 나갔다`);
}

// 순환이 있어도 멈춘다
const cyclic = levelsOf(
  nodes.slice(0, 2),
  [
    { id: "a", from: nodes[0].id, to: nodes[1].id, type: "produces" },
    { id: "b", from: nodes[1].id, to: nodes[0].id, type: "produces" },
  ],
  kindOfId,
);
assert.ok(Number.isFinite(cyclic.get(nodes[0].id)!), "순환에서 멈추지 못했다");

// 두 층 이상 건너뛰는 선은 중간 층 카드를 뚫지 않는다 (세로 직선 근사)
{
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const e of edges) {
    const a = spots[e.from], b = spots[e.to];
    if (!a || !b) continue;
    const la = level.get(e.from)!, lb = level.get(e.to)!;
    if (Math.abs(la - lb) < 2) continue;
    const top = la < lb ? a : b, bottom = la < lb ? b : a;
    const cx = top.x + 144;
    for (const n of nodes) {
      const l = level.get(n.id)!;
      if (l <= Math.min(la, lb) || l >= Math.max(la, lb)) continue;
      const s2 = spots[n.id];
      const hit = cx > s2.x - 8 && cx < s2.x + 288 + 8 && s2.y > top.y && s2.y < bottom.y;
      assert.ok(!hit, `${e.from}→${e.to} 선이 ${n.id} 를 지난다`);
    }
  }
  void byId;
}

console.log("tidy.ts ok — levels:", Math.max(...level.values()) + 1);

// 합성: 문제 → 가설 → 근거, 그리고 문제 → 결정(based_on 근거) 처럼 층을 건너뛰는 선이 있는 그래프
{
  const at = new Date().toISOString();
  const mk = (id: string, type: "problem" | "claim" | "evidence" | "decision" | "output", subtype?: "solution") =>
    ({ id, type, subtype, md: `# ${id}\n`, createdAt: at, updatedAt: at }) as (typeof nodes)[number];
  const N = [mk("P-01", "problem"), mk("H-01", "claim"), mk("H-02", "claim"), mk("E-01", "evidence"), mk("E-02", "evidence"), mk("D-01", "decision"), mk("S-01", "output", "solution")];
  const E = [
    { id: "e1", from: "P-01", to: "H-01", type: "investigates" },
    { id: "e2", from: "P-01", to: "H-02", type: "investigates" },
    { id: "e3", from: "E-01", to: "H-01", type: "supports" },
    { id: "e4", from: "E-02", to: "H-02", type: "contradicts" },
    { id: "e5", from: "E-01", to: "D-01", type: "based_on" }, // D-01 은 근거 아래(3층)
    { id: "e6", from: "P-01", to: "D-01", type: "investigates" }, // 문제 → 결정: 두 층 건너뜀
    { id: "e7", from: "D-01", to: "S-01", type: "produces" },
  ] as typeof edges;
  const sz = Object.fromEntries(N.map((n) => [n.id, { w: 288, h: 200 }]));
  const lv = levelsOf(N, E, (id) => kindOf(N.find((n) => n.id === id)!));
  const sp = tidyLayout(N, E, [], sz);
  const cx = sp["P-01"].x + 144;
  for (const n of N) {
    const l = lv.get(n.id)!;
    if (l === 0 || l >= lv.get("D-01")!) continue;
    assert.ok(!(cx > sp[n.id].x - 8 && cx < sp[n.id].x + 296), `P-01→D-01 선이 ${n.id} 를 지난다`);
  }
  console.log("tidy corridor ok");
}
