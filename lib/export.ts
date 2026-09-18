/**
 * 그래프 → 인계 문서. 템플릿 렌더러다 (스펙 §20.5).
 *
 * 새 대상(창업 지원사업 서류·연구 계획 등)을 추가할 때 데이터 모델을 넓히지 않는다.
 * 어떤 대상도 그 대상만 쓰는 필드를 요구하면 안 된다 — 그건 대상을 다시 생각하라는 신호다.
 *
 * 미확인·미검증·반대 근거를 빼지 않는다. 점검 완료 여부와 관계없이 내용은 같다 (핸드오프 §8).
 */
import { detectConflicts, detectIssues } from "./issues";
import { KIND, SCOPE_KO, kindOf } from "./labels";
import { parseMd, titleOf } from "./md";
import type { Doc } from "./store";
import type { Project, ReasoningNode } from "./types";

export interface ExportFile {
  name: string;
  content: string;
}

const NONE = "(아직 없음)";

const title = (n: ReasoningNode) => titleOf(n.md) || "(제목 없음)";
const section = (n: ReasoningNode, h: string) =>
  parseMd(n.md).sections.find((s) => s.h === h)?.body.trim() ?? "";
const bullets = (lines: string[]) => (lines.length ? lines.map((l) => `- ${l}`).join("\n") : NONE);
const block = (body: string) => (body.trim() ? body.trim() : NONE);

/** 그래프에서 한 번만 읽어두고 모든 템플릿이 공유한다. */
function read(doc: Doc, project: Project) {
  const by = (fn: (n: ReasoningNode) => boolean) => doc.nodes.filter(fn);
  const find = (id: string) => doc.nodes.find((n) => n.id === id);

  const problem = doc.nodes.find((n) => n.type === "problem");
  const claims = by((n) => kindOf(n) === "claim");
  const questions = by((n) => n.type === "question");
  const evidence = by((n) => n.type === "evidence");
  const decisions = by((n) => n.type === "decision");
  const solutions = by((n) => kindOf(n) === "solution");
  const requirements = by((n) => kindOf(n) === "requirement");

  const polarityOf = (e: ReasoningNode) => {
    const edge = doc.edges.find((x) => x.from === e.id && (x.type === "supports" || x.type === "contradicts"));
    return edge?.type ?? null;
  };
  const relatedTo = (e: ReasoningNode) => {
    const edge = doc.edges.find((x) => x.from === e.id);
    return edge ? find(edge.to) : undefined;
  };

  const adoptedOf = (d: ReasoningNode) =>
    doc.edges
      .filter((e) => e.from === d.id && e.type === "produces" && !e.rejected && !e.hold)
      .map((e) => find(e.to))
      .filter((n): n is ReasoningNode => Boolean(n) && kindOf(n!) === "solution");

  const rejectedOf = (d: ReasoningNode) =>
    doc.edges
      .filter((e) => e.from === d.id && e.type === "produces" && (e.rejected || e.hold))
      .map((e) => ({ node: find(e.to), hold: Boolean(e.hold) }))
      .filter((x): x is { node: ReasoningNode; hold: boolean } => Boolean(x.node));

  const basisOf = (d: ReasoningNode) =>
    doc.edges
      .filter((e) => e.from === d.id && e.type === "based_on")
      .map((e) => find(e.to))
      .filter((n): n is ReasoningNode => Boolean(n));

  const producesOf = (d: ReasoningNode) =>
    doc.edges
      .filter((e) => e.from === d.id && e.type === "produces" && !e.rejected && !e.hold)
      .map((e) => find(e.to))
      .filter((n): n is ReasoningNode => Boolean(n) && kindOf(n!) === "requirement");

  return {
    project,
    problem,
    claims,
    questions,
    evidence,
    decisions,
    solutions,
    requirements,
    counters: evidence.filter((e) => polarityOf(e) === "contradicts"),
    unsupportedClaims: claims.filter(
      (c) => !doc.edges.some((e) => e.to === c.id && e.type === "supports"),
    ),
    outOfScope: requirements.filter((r) => r.scope === "out" || r.scope === "hold"),
    inScope: requirements.filter((r) => (r.scope ?? "mvp") === "mvp"),
    conflicts: detectConflicts(doc),
    issues: detectIssues(doc),
    sources: doc.sources,
    polarityOf,
    relatedTo,
    adoptedOf,
    rejectedOf,
    basisOf,
    producesOf,
    find,
  };
}

type Ctx = ReturnType<typeof read>;

/* ── 1. 미리보기용 단일 문서 ── */

function projectHandoff(c: Ctx): string {
  const reqLine = (r: ReasoningNode) => {
    const ac = section(r, "수용 기준")
      .split("\n")
      .map((l) => l.replace(/^- (\[[ x]\] )?/, "").trim())
      .filter(Boolean);
    return [
      `### ${r.id} ${title(r)}`,
      `범위: ${SCOPE_KO[r.scope ?? "mvp"]}`,
      "",
      "수용 기준:",
      bullets(ac),
    ].join("\n");
  };

  return [
    `# ${c.project.name} — 개발 인계`,
    "",
    c.project.demo ? "> 데모 자료로 만든 문서입니다. 실제 리서치 결과가 아닙니다.\n" : "",
    "## 1. 문제",
    block(c.problem ? title(c.problem) : ""),
    c.problem && section(c.problem, "대상·상황") ? `\n대상·상황: ${section(c.problem, "대상·상황")}` : "",
    "",
    "## 2. 선택한 해결안",
    c.decisions.length
      ? c.decisions
          .flatMap((d) => c.adoptedOf(d).map((s) => `- ${s.id} ${title(s)} — ${d.id}에서 채택`))
          .join("\n") || NONE
      : NONE,
    "",
    "## 3. 요구사항",
    c.inScope.length ? c.inScope.map(reqLine).join("\n\n") : NONE,
    "",
    "## 4. 결정 이유",
    c.decisions.length
      ? c.decisions
          .map((d) => [`### ${d.id} ${title(d)}`, block(section(d, "이유"))].join("\n"))
          .join("\n\n")
      : NONE,
    "",
    "## 5. 반대 근거",
    "이 항목을 지우지 마세요. 아래 근거는 위 결정과 반대 방향을 가리킵니다.",
    "",
    c.counters.length
      ? c.counters
          .map((e) => {
            const t = c.relatedTo(e);
            return [
              `### ${e.id} → ${t?.id ?? "?"} ${t ? title(t) : ""}`,
              `인용: ${section(e, "원문 인용").replace(/^> ?/gm, "") || title(e)}`,
              section(e, "해석") ? `해석: ${section(e, "해석")}` : "",
              section(e, "한계") ? `한계: ${section(e, "한계")}` : "",
            ]
              .filter(Boolean)
              .join("\n");
          })
          .join("\n\n")
      : NONE,
    "",
    "## 6. 미검증 가설과 열린 질문",
    "아래는 아직 확인되지 않았습니다. 확인된 것처럼 쓰지 마세요.",
    "",
    bullets([
      ...c.claims
        .filter((n) => n.status !== "verified")
        .map((n) => `${n.id} ${title(n)} — ${c.unsupportedClaims.includes(n) ? "지지 근거 없음" : "미검증"}`),
      ...c.questions.map((q) => `${q.id} ${title(q)} — 열린 질문`),
    ]),
    "",
    "## 7. 제외 범위",
    bullets([
      ...c.outOfScope.map((r) => `${r.id} ${title(r)} — ${SCOPE_KO[r.scope ?? "hold"]}`),
      ...c.decisions.flatMap((d) =>
        c.rejectedOf(d).map((x) => `${x.node.id} ${title(x.node)} — ${x.hold ? "보류" : "기각"} (${d.id})`),
      ),
    ]),
    "",
    "## 8. 출처",
    c.sources.length
      ? c.sources
          .map((s) => {
            const used = c.evidence.filter((e) => e.sourceId === s.id);
            const missing = used.filter((e) => !e.sourceLocator?.verified);
            return `- ${s.name}${s.tag ? ` (${s.tag})` : ""} — 근거 ${used.length}건${
              missing.length ? ` · 인용 미확인 ${missing.length}건` : ""
            }`;
          })
          .join("\n")
      : NONE,
    "",
    c.conflicts.length
      ? [
          "## 9. 서로 어긋나는 항목",
          "제품이 감지한 사실입니다. 어느 쪽이 맞는지는 판단하지 않았습니다.",
          "",
          c.conflicts
            .map((x) => `- ${x.text}${x.acknowledged ? " (알고도 진행하기로 표시함)" : ""}`)
            .join("\n"),
          "",
        ].join("\n")
      : "",
    "---",
    "",
    `미확인 항목 ${c.issues.length}건은 그대로 남겼습니다. 확인된 것으로 바꾸지 마세요.`,
    "",
  ]
    .filter((l) => l !== "")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim() + "\n";
}

/* ── 2. 코딩 에이전트 대상 4파일 (스펙 §20) ── */

function projectContext(c: Ctx): string {
  return [
    "# Project Context",
    "",
    "## Problem",
    block(c.problem ? title(c.problem) : ""),
    "",
    "## Target User",
    block(c.problem ? section(c.problem, "대상·상황") : ""),
    "",
    "## Current Framing",
    block(c.problem ? section(c.problem, "불편") : ""),
    "",
    "## Key Claims",
    bullets(c.claims.map((n) => `${n.id} ${title(n)} — ${n.status === "verified" ? "검증됨" : "미검증"}`)),
    "",
    "## Open Questions",
    bullets(c.questions.map((n) => `${n.id} ${title(n)}`)),
    "",
    "## Current Decisions",
    bullets(c.decisions.map((d) => `${d.id} ${title(d)}`)),
    "",
    "## Outputs / MVP Scope",
    bullets(c.inScope.map((r) => `${r.id} ${title(r)}`)),
    "",
    "## Constraints",
    bullets(
      c.decisions
        .flatMap((d) => section(d, "재검토 조건").split("\n"))
        .map((l) => l.replace(/^- /, "").trim())
        .filter(Boolean),
    ),
    "",
    "## Explicit Non-Goals",
    bullets([
      ...c.outOfScope.map((r) => `${r.id} ${title(r)}`),
      ...c.decisions.flatMap((d) =>
        c.rejectedOf(d).map((x) => `${x.node.id} ${title(x.node)} — ${x.hold ? "보류" : "기각"}`),
      ),
    ]),
    "",
    "## Known Contradictions",
    bullets(c.conflicts.map((x) => x.text)),
    "",
    "## What to verify before changing direction",
    bullets([
      ...c.unsupportedClaims.map((n) => `${n.id} 은 지지 근거가 없습니다.`),
      ...c.questions.map((q) => `${q.id} 은 아직 답이 없습니다.`),
    ]),
    "",
  ].join("\n");
}

function decisionsMd(c: Ctx): string {
  if (!c.decisions.length) return "# Decisions\n\n(아직 없음)\n";
  return [
    "# Decisions",
    "",
    ...c.decisions.map((d) =>
      [
        `## Decision: ${title(d)}`,
        "",
        "### Decision",
        block(section(d, "선택한 해결안") || title(d)),
        "",
        "### Why",
        block(section(d, "이유")),
        "",
        "### Based on",
        bullets(c.basisOf(d).map((n) => `${n.id} (${KIND[kindOf(n)].ko}) ${title(n)}`)),
        "",
        "### Alternatives considered",
        bullets(c.rejectedOf(d).map((x) => `${x.node.id} ${title(x.node)}`)),
        "",
        "### Rejected alternatives",
        c.rejectedOf(d).length
          ? c.rejectedOf(d)
              .map((x) =>
                [
                  `#### ${x.node.id} ${title(x.node)}`,
                  `상태: ${x.hold ? "보류" : "기각"}`,
                  "Reason:",
                  block(section(x.node, "상태") || section(d, "기각 대안")),
                ].join("\n"),
              )
              .join("\n\n")
          : NONE,
        "",
        "### Revisit if",
        block(section(d, "재검토 조건")),
        "",
        "### Produces",
        bullets(c.producesOf(d).map((r) => `${r.id} ${title(r)} — ${SCOPE_KO[r.scope ?? "mvp"]}`)),
        "",
        "### Open risks acknowledged at decision time",
        block(section(d, "열린 질문·위험")),
        "",
      ].join("\n"),
    ),
  ].join("\n");
}

function evidenceMd(c: Ctx): string {
  if (!c.evidence.length) return "# Evidence\n\n(아직 없음)\n";
  return [
    "# Evidence",
    "",
    ...c.evidence.map((e) => {
      const source = c.sources.find((s) => s.id === e.sourceId);
      const target = c.relatedTo(e);
      const pol = c.polarityOf(e);
      return [
        `## Evidence: ${e.id}`,
        "",
        "Statement:",
        block(section(e, "해석") || title(e)),
        "",
        "Quote:",
        block(section(e, "원문 인용").replace(/^> ?/gm, "")),
        "",
        "Polarity:",
        pol === "contradicts" ? "contradicts" : pol === "supports" ? "supports" : "(연결 없음)",
        "",
        "Related:",
        target ? `${target.id} ${title(target)}` : NONE,
        "",
        "Source:",
        source ? `${source.name}${source.tag ? ` (${source.tag})` : ""}` : "원본을 찾을 수 없음",
        "",
        "Source location:",
        e.sourceLocator?.line ? `줄 ${e.sourceLocator.line}` : NONE,
        "",
        "Quote verified against source:",
        e.sourceLocator?.verified ? "yes" : "no — 확인되지 않았습니다",
        "",
        "Notes / limitations:",
        block(section(e, "한계")),
        "",
      ].join("\n");
    }),
  ].join("\n");
}

function agentsMd(c: Ctx): string {
  return [
    "# Agent Instructions",
    "",
    "이 문서는 사람이 내린 결정과 그 근거를 옮겨 적은 것입니다. 여기 적힌 결정을 임의로 뒤집지 마세요.",
    "",
    "## Product intent",
    block(c.problem ? title(c.problem) : ""),
    "",
    "## Current scope",
    bullets(c.inScope.map((r) => `${r.id} ${title(r)}`)),
    "",
    "## Decisions you must respect",
    bullets(c.decisions.map((d) => `${d.id} ${title(d)} — 이유: ${section(d, "이유").split("\n")[0]}`)),
    "",
    "## Rejected approaches you should not re-propose unless revisit conditions are met",
    c.decisions.length
      ? c.decisions
          .flatMap((d) =>
            c.rejectedOf(d).map((x) =>
              [
                `- ${x.node.id} ${title(x.node)} — ${x.hold ? "보류" : "기각"} (${d.id})`,
                `  재검토 조건: ${section(d, "재검토 조건").replace(/\n/g, " / ").replace(/- /g, "") || "명시되지 않음"}`,
              ].join("\n"),
            ),
          )
          .join("\n") || NONE
      : NONE,
    "",
    "## Open questions you may investigate",
    bullets(c.questions.map((q) => `${q.id} ${title(q)}`)),
    "",
    "## Known contradictions — do not silently resolve these",
    bullets(c.conflicts.map((x) => x.text)),
    "",
    "## Constraints",
    bullets([
      ...(c.project.demo ? ["이 문서의 내용은 데모용 합성 자료입니다."] : []),
      ...c.unsupportedClaims.map((n) => `${n.id} 은 지지 근거가 없습니다. 사실로 쓰지 마세요.`),
    ]),
    "",
    "## Implementation priorities",
    bullets(c.inScope.map((r, i) => `${i + 1}. ${r.id} ${title(r)}`)),
    "",
    "## Definition of done",
    bullets(
      c.inScope.flatMap((r) =>
        section(r, "수용 기준")
          .split("\n")
          .map((l) => l.replace(/^- (\[[ x]\] )?/, "").trim())
          .filter(Boolean)
          .map((l) => `${r.id}: ${l}`),
      ),
    ),
    "",
    "## Context files",
    "- PROJECT_CONTEXT.md",
    "- DECISIONS.md",
    "- EVIDENCE.md",
    "",
  ].join("\n");
}

/* ── 공개 API ── */

export function buildHandoffPreview(doc: Doc, project: Project): string {
  return projectHandoff(read(doc, project));
}

export function buildAgentFiles(doc: Doc, project: Project): ExportFile[] {
  const c = read(doc, project);
  return [
    { name: "PROJECT_HANDOFF.md", content: projectHandoff(c) },
    { name: "PROJECT_CONTEXT.md", content: projectContext(c) },
    { name: "DECISIONS.md", content: decisionsMd(c) },
    { name: "EVIDENCE.md", content: evidenceMd(c) },
    { name: "AGENTS.md", content: agentsMd(c) },
  ];
}

/* ── 인계 전 점검 ── */

export interface Check {
  key: string;
  title: string;
  sub: string;
  ok: boolean;
}

/** 제품이 스스로 확인할 수 있는 것. 사람이 판단할 항목과 섞지 않는다. */
export function systemChecks(doc: Doc, project: Project): Check[] {
  const c = read(doc, project);
  const brokenSources = c.evidence.filter((e) => e.sourceId && !c.sources.some((s) => s.id === e.sourceId));
  const unverified = c.evidence.filter((e) => e.sourceLocator && !e.sourceLocator.verified);

  return [
    {
      key: "problem",
      title: "문제·대상",
      sub: c.problem ? title(c.problem).slice(0, 40) : "문제 카드가 없어요",
      ok: Boolean(c.problem && title(c.problem)),
    },
    {
      key: "solution",
      title: "선택한 해결안",
      sub: c.decisions.length
        ? c.decisions.flatMap((d) => c.adoptedOf(d)).map((s) => s.id).join(", ") || "채택한 해결안이 없어요"
        : "확정한 결정이 없어요",
      ok: c.decisions.some((d) => c.adoptedOf(d).length > 0),
    },
    {
      key: "sources",
      title: "출처 유효성",
      sub: brokenSources.length
        ? `${brokenSources.length}건의 근거에서 원본을 찾을 수 없어요`
        : unverified.length
          ? `${unverified.length}건의 인용이 확인되지 않았어요`
          : `근거 ${c.evidence.length}건 모두 원문과 대조됨`,
      ok: brokenSources.length === 0 && unverified.length === 0,
    },
  ];
}

export const USER_CHECKS: { key: string; title: string; sub: string }[] = [
  { key: "criteria", title: "수용 기준", sub: "요구사항마다 완료 판단 기준을 적었나요?" },
  { key: "risks", title: "열린 질문 인지", sub: "미검증 상태로 진행한다는 것을 알고 있나요?" },
  { key: "changes", title: "변경 검토", sub: "결정 이후 바뀐 근거를 확인했나요?" },
  { key: "outscope", title: "제외 범위", sub: "이번에 하지 않을 것을 적었나요?" },
];
