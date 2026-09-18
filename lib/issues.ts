/**
 * 완료율 대신 남은 일을 개수로 센다. (스펙 §6, §17)
 * 점수·퍼센트·신뢰도로 바꾸지 않는다.
 *
 * 어긋남(모순) 감지는 P0 이고 나머지 검출기와 분리해서 보여준다. (스펙 §17.1, BUILD_PLAN §1.6)
 * 이 파일은 사실만 진술한다. 어느 쪽이 맞는지 판정하지 않는다.
 */
import type { Doc } from "./store";
import { kindOf } from "./labels";
import { parseMd, titleOf } from "./md";
import type { ReasoningNode } from "./types";

export type IssueKind =
  | "open-question"
  | "unsupported-claim"
  | "decision-no-basis"
  | "decision-no-alternative"
  | "decision-no-revisit"
  | "output-no-provenance"
  | "evidence-source-missing";

export interface Issue {
  key: string;
  kind: IssueKind;
  /** 그룹 칩에 쓰는 이름. `3 Open Questions` 같은 묶음 라벨. */
  group: string;
  text: string;
  nodeIds: string[];
}

export type ConflictKind = "adopted-vs-evidence" | "basis-contradicted" | "claim-both-ways";

export interface Conflict {
  key: string;
  kind: ConflictKind;
  /** 화면에 그대로 내보내는 문장. 판정어를 쓰지 않는다. */
  text: string;
  nodeIds: string[];
  acknowledged: boolean;
}

const short = (n: ReasoningNode, len = 34) => {
  const t = titleOf(n.md) || "(제목 없음)";
  return t.length > len ? t.slice(0, len) + "…" : t;
};

const byId = (doc: Doc) => new Map(doc.nodes.map((n) => [n.id, n]));

/** 결정 노드에서 `## 재검토 조건` 섹션이 실제로 채워져 있는지. */
function hasRevisit(n: ReasoningNode) {
  return parseMd(n.md).sections.some((s) => /재검토|revisit/i.test(s.h) && s.body.trim().length > 0);
}

function hasAlternative(doc: Doc, n: ReasoningNode) {
  return doc.edges.some((e) => e.from === n.id && e.type === "produces" && (e.rejected || e.hold));
}

/* ── 어긋남 ── */

export function detectConflicts(doc: Doc): Conflict[] {
  const nodes = byId(doc);
  const out: Conflict[] = [];
  const push = (c: Omit<Conflict, "acknowledged">) => {
    if (out.some((x) => x.key === c.key)) return;
    out.push({ ...c, acknowledged: doc.acknowledged.includes(c.key) });
  };

  const counters = doc.edges.filter((e) => e.type === "contradicts" && !e.proposed);

  for (const edge of doc.edges) {
    const decision = nodes.get(edge.from);
    if (!decision || decision.type !== "decision") continue;

    // (1) 채택한 해결안을 반대하는 근거가 결정 이후에 들어왔다
    if (edge.type === "produces" && !edge.rejected && !edge.hold) {
      const target = nodes.get(edge.to);
      if (!target) continue;
      for (const c of counters.filter((x) => x.to === edge.to)) {
        const evidence = nodes.get(c.from);
        if (!evidence || evidence.createdAt <= decision.createdAt) continue;
        push({
          key: ["adopted", decision.id, target.id, evidence.id].join("|"),
          kind: "adopted-vs-evidence",
          text: `${decision.id} “${short(decision)}” 과 나중에 추가한 ${evidence.id} 이 어긋납니다.`,
          nodeIds: [decision.id, target.id, evidence.id],
        });
      }
    }

    // (2) 결정이 근거로 삼은 주장이 그 뒤에 반박됐다
    if (edge.type === "based_on") {
      for (const c of counters.filter((x) => x.to === edge.to)) {
        const evidence = nodes.get(c.from);
        const basis = nodes.get(edge.to);
        if (!evidence || !basis || evidence.createdAt <= decision.createdAt) continue;
        push({
          key: ["basis", decision.id, basis.id, evidence.id].join("|"),
          kind: "basis-contradicted",
          text: `${decision.id} 이 근거로 삼은 ${basis.id} 을 ${evidence.id} 이 반대합니다.`,
          nodeIds: [decision.id, basis.id, evidence.id],
        });
      }
    }
  }

  // (3) 같은 주장에 지지 근거와 반대 근거가 동시에 붙어 있다
  for (const node of doc.nodes) {
    if (kindOf(node) !== "claim") continue;
    const sup = doc.edges.filter((e) => e.to === node.id && e.type === "supports" && !e.proposed);
    const con = counters.filter((e) => e.to === node.id);
    if (!sup.length || !con.length) continue;
    push({
      key: ["both", node.id].join("|"),
      kind: "claim-both-ways",
      text: `${node.id} 에 지지 근거 ${sup.length}건과 반대 근거 ${con.length}건이 같이 붙어 있습니다.`,
      nodeIds: [node.id, ...sup.map((e) => e.from), ...con.map((e) => e.from)],
    });
  }

  return out;
}

/** 해소되지 않은 것만. 해소는 결정 수정·근거 제외·알고도 수용 중 하나로만 이뤄진다. */
export const openConflicts = (doc: Doc) => detectConflicts(doc).filter((c) => !c.acknowledged);

/* ── 나머지 미확인 항목 ── */

export function detectIssues(doc: Doc): Issue[] {
  const out: Issue[] = [];
  const has = (to: string, type: string) => doc.edges.some((e) => e.to === to && e.type === type && !e.proposed);

  for (const n of doc.nodes) {
    const kind = kindOf(n);

    if (kind === "question" && n.status !== "answered") {
      const answered = doc.edges.some((e) => e.to === n.id && e.type === "supports");
      if (!answered)
        out.push({
          key: "q:" + n.id,
          kind: "open-question",
          group: "열린 질문",
          text: `${n.id} “${short(n)}” 에 답할 근거가 아직 없어요.`,
          nodeIds: [n.id],
        });
    }

    if (kind === "claim" && !has(n.id, "supports")) {
      out.push({
        key: "c:" + n.id,
        kind: "unsupported-claim",
        group: "지지 근거 없는 가설",
        text: `${n.id} “${short(n)}” 을 지지하는 근거가 없어요.`,
        nodeIds: [n.id],
      });
    }

    if (kind === "decision") {
      if (!doc.edges.some((e) => e.from === n.id && e.type === "based_on"))
        out.push({
          key: "db:" + n.id,
          kind: "decision-no-basis",
          group: "근거가 연결되지 않은 결정",
          text: `${n.id} 에 어떤 근거로 정했는지가 연결돼 있지 않아요.`,
          nodeIds: [n.id],
        });
      if (!hasAlternative(doc, n))
        out.push({
          key: "da:" + n.id,
          kind: "decision-no-alternative",
          group: "기각 대안이 없는 결정",
          text: `${n.id} 에 검토했다가 기각·보류한 대안이 남아 있지 않아요.`,
          nodeIds: [n.id],
        });
      if (!hasRevisit(n))
        out.push({
          key: "dr:" + n.id,
          kind: "decision-no-revisit",
          group: "재검토 조건이 없는 결정",
          text: `${n.id} 에 언제 다시 볼지가 적혀 있지 않아요.`,
          nodeIds: [n.id],
        });
    }

    if (n.type === "output") {
      const fromDecision = doc.edges.some((e) => e.to === n.id && e.type === "produces");
      const fromClaim = doc.edges.some((e) => e.to === n.id && e.type === "based_on");
      if (!fromDecision && !fromClaim)
        out.push({
          key: "o:" + n.id,
          kind: "output-no-provenance",
          group: "출처가 없는 산출물",
          text: `${n.id} 이 어떤 결정·가설에서 나왔는지 연결돼 있지 않아요.`,
          nodeIds: [n.id],
        });
    }

    if (kind === "evidence" && n.sourceId && !doc.sources.some((s) => s.id === n.sourceId)) {
      out.push({
        key: "e:" + n.id,
        kind: "evidence-source-missing",
        group: "원본을 찾을 수 없는 근거",
        text: `${n.id} 의 원본 자료를 찾을 수 없어요.`,
        nodeIds: [n.id],
      });
    }
  }

  return out;
}

export interface IssueGroup {
  group: string;
  issues: Issue[];
}

export function groupIssues(issues: Issue[]): IssueGroup[] {
  const map = new Map<string, Issue[]>();
  for (const i of issues) map.set(i.group, [...(map.get(i.group) ?? []), i]);
  return [...map].map(([group, list]) => ({ group, issues: list }));
}

/** 헤더에 쓰는 요약. 어긋남은 따로 센다. */
export function summarize(doc: Doc) {
  const issues = detectIssues(doc);
  const conflicts = openConflicts(doc);
  return { issues, conflicts, issueCount: issues.length, conflictCount: conflicts.length };
}
