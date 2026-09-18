"use client";

/**
 * AI 호출 래퍼. 돌아온 것은 전부 "제안"이다 — 승인 전에는 그래프에 넣지 않는다 (스펙 §27).
 *
 * 인용은 반드시 원문과 대조한다. 대조에 실패한 후보는 승인할 수 없게 표시한다 (스펙 §14.3).
 */
import { verifyQuote } from "./extract";
import { kindOf, KIND } from "./labels";
import { nodeTitle } from "./store";
import type { EdgeType, EvidenceCandidate, ReasoningNode } from "./types";

export type AiResult<T> = { ok: true; data: T } | { ok: false; aiOff: boolean; message: string };

async function call<T>(body: Record<string, unknown>): Promise<AiResult<T>> {
  try {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data?.aiOff) return { ok: false, aiOff: true, message: "AI가 연결되지 않았어요." };
    if (!res.ok) return { ok: false, aiOff: false, message: data?.error ?? "AI 응답을 받지 못했어요." };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, aiOff: false, message: "AI 응답을 받지 못했어요." };
  }
}

export interface ColdStart {
  claims: { text: string; reason: string }[];
  questions: { text: string; whyItMatters: string }[];
  mindChangeConditions: { text: string }[];
}

export const coldStart = (problem: string) => call<ColdStart>({ kind: "cold-start", problem });

export interface SourceSummary {
  summary: string;
  points: string[];
  caveat: string;
}

/** 바로 읽기 어려운 자료를 훑어본다. 원문을 대신하지 않는다 — 근거는 여전히 인용에서 나온다. */
export const summarizeSource = (name: string, text: string) =>
  call<SourceSummary>({ kind: "summarize", name, text });

export const refineProblem = (problem: string) =>
  call<{ statement: string; note: string }>({ kind: "refine", problem });

interface RawCandidate {
  quote: string;
  line: number;
  claim: string;
  limit: string;
  targetId: string;
  polarity: EdgeType;
}

export async function proposeEvidence(
  sourceId: string,
  text: string,
  nodes: ReasoningNode[],
): Promise<AiResult<EvidenceCandidate[]>> {
  const targets = nodes
    .filter((n) => n.type !== "note")
    .map((n) => ({ id: n.id, kind: KIND[kindOf(n)].ko, title: nodeTitle(n) }));

  const res = await call<{ candidates: RawCandidate[] }>({ kind: "evidence", text, targets });
  if (!res.ok) return res;

  const known = new Set(nodes.map((n) => n.id));
  const candidates: EvidenceCandidate[] = res.data.candidates
    .filter((c) => known.has(c.targetId))
    .map((c, i) => {
      // 모델이 준 줄 번호를 믿지 않고 원문에서 직접 찾는다.
      const found = verifyQuote(text, c.quote);
      return {
        id: `cand-${sourceId}-${i}`,
        sourceId,
        line: found.line ?? c.line,
        quote: c.quote,
        claim: c.claim,
        limit: c.limit,
        targetId: c.targetId,
        edgeType: c.polarity,
        state: "pending" as const,
        mismatch: !found.ok,
      };
    });

  return { ok: true, data: candidates };
}
