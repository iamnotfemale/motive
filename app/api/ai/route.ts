import { generateObject } from "ai";
import { z } from "zod";

/**
 * AI 출력은 구조화된 형태로만 받는다 (스펙 §27).
 * 여기서 만든 것은 전부 "제안"이고, 사람이 승인하기 전에는 그래프에 들어가지 않는다.
 *
 * 키가 없으면 실패가 아니라 `aiOff` 로 답한다 — 직접 작성과 내보내기는 계속 돼야 한다.
 */

const MODEL = process.env.MOTIVE_MODEL ?? "anthropic/claude-sonnet-5";

const coldStart = z.object({
  claims: z
    .array(
      z.object({
        text: z.string().describe("문제 진술에 이미 들어 있는 암묵적 주장 한 문장"),
        reason: z.string().describe("왜 이것이 문제 진술에 함축돼 있는지"),
      }),
    )
    .max(4),
  questions: z
    .array(
      z.object({
        text: z.string().describe("답에 따라 방향이 달라지는 질문"),
        whyItMatters: z.string(),
      }),
    )
    .max(4),
  mindChangeConditions: z.array(z.object({ text: z.string() })).max(4),
});

const evidenceOut = z.object({
  candidates: z
    .array(
      z.object({
        quote: z.string().describe("원문에 그대로 있는 문장. 고치거나 다듬지 말 것"),
        line: z.number().int().describe("그 문장이 있는 줄 번호 (1부터)"),
        claim: z.string().describe("이 인용이 시사하는 바 한 문장"),
        limit: z.string().describe("이 근거로 말할 수 없는 것 한 문장"),
        targetId: z.string().describe("연결할 카드 ID"),
        polarity: z.enum(["supports", "contradicts", "based_on", "related"]),
      }),
    )
    .max(5),
});

const summary = z.object({
  summary: z.string().describe("자료가 무엇을 담고 있는지 3~5문장"),
  points: z.array(z.string()).max(5).describe("이 프로젝트와 맞닿을 수 있는 대목"),
  caveat: z.string().describe("이 요약만 보고 판단하면 안 되는 이유 한 줄"),
});

const refine = z.object({
  statement: z.string().describe("대상·상황·불편이 한 문장에 드러나게 정리한 문제 진술"),
  note: z.string().describe("무엇을 바꿨는지 한 줄"),
});

function hasKey() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY);
}

const GUARD = `너는 리서치 맥락을 구조화하는 도구의 일부다.
- 일반적인 창업 조언을 쓰지 마라. "사용자는 편리함을 중요하게 여긴다" 같은 문장은 금지다.
- 수치·통계·사용자 수·성장률을 만들어내지 마라.
- 확인하지 못한 것은 확인하지 못했다고 써라.
- 모든 출력은 사람이 검토하고 승인할 제안이다. 결론처럼 쓰지 마라.
- 한국어로 답하라.`;

export async function POST(req: Request) {
  if (!hasKey()) return Response.json({ aiOff: true });

  let body: { kind?: string; [k: string]: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "요청을 읽지 못했어요." }, { status: 400 });
  }

  try {
    if (body.kind === "cold-start") {
      const problem = String(body.problem ?? "").slice(0, 4000);
      if (!problem.trim()) return Response.json({ error: "문제 진술이 비어 있어요." }, { status: 400 });

      const { object } = await generateObject({
        model: MODEL,
        schema: coldStart,
        system: GUARD,
        prompt: `다음 문제 진술을 읽고 세 가지를 뽑아라.

1. 지금 우리가 안다고 생각하는 것 — 진술에 이미 함축된 주장. 사실이 아니라 "추론된 가정"으로 표시된다.
2. 모르는 것 — 답에 따라 제품 방향이 달라질 질문.
3. 생각을 바꿀 조건 — 이것이 나오면 현재 틀을 버려야 하는 근거.

근거(Evidence)는 만들지 마라. 자료가 없으므로 근거를 지어낼 수 없다.

문제 진술:
${problem}`,
      });
      return Response.json(object);
    }

    if (body.kind === "evidence") {
      const text = String(body.text ?? "").slice(0, 24000);
      const targets = (body.targets ?? []) as { id: string; kind: string; title: string }[];
      if (!text.trim()) return Response.json({ candidates: [] });

      const numbered = text
        .split("\n")
        .map((l, i) => `${i + 1}\t${l}`)
        .join("\n");

      const { object } = await generateObject({
        model: MODEL,
        schema: evidenceOut,
        system: GUARD,
        prompt: `아래는 줄 번호가 붙은 자료 원문이다. 현재 캔버스의 카드와 관련된 근거 후보를 찾아라.

규칙:
- quote 는 원문에 있는 문장을 **그대로** 옮겨라. 요약·수정 금지.
- line 은 그 문장이 실제로 있는 줄 번호다.
- 관련된 카드가 없으면 후보를 만들지 마라. 억지로 채우지 마라.
- polarity: 카드를 뒷받침하면 supports, 반대하면 contradicts, 제안의 근거면 based_on.

카드 목록:
${targets.map((t) => `${t.id} (${t.kind}) ${t.title}`).join("\n") || "(없음)"}

원문:
${numbered}`,
      });
      return Response.json(object);
    }

    if (body.kind === "summarize") {
      const text = String(body.text ?? "").slice(0, 24000);
      const name = String(body.name ?? "자료");
      if (!text.trim()) return Response.json({ error: "요약할 원문이 없어요." }, { status: 400 });

      const { object } = await generateObject({
        model: MODEL,
        schema: summary,
        system: GUARD,
        prompt: `아래 자료를 읽고 무엇이 들어 있는지 알려줘라.

규칙:
- 자료에 없는 내용을 채우지 마라.
- 이 요약은 원문을 대신하지 않는다. 근거로 쓰려면 원문에서 인용해야 한다는 점을 caveat 에 써라.
- points 는 자료에 실제로 있는 대목만.

자료 이름: ${name}

원문:
${text}`,
      });
      return Response.json(object);
    }

    if (body.kind === "refine") {
      const problem = String(body.problem ?? "").slice(0, 4000);
      const { object } = await generateObject({
        model: MODEL,
        schema: refine,
        system: GUARD,
        prompt: `다음 문제 진술을 한 문장으로 정리하라. 대상·상황·불편이 드러나야 한다.
없는 수치를 넣지 마라. 범위를 넓히지 마라.

${problem}`,
      });
      return Response.json(object);
    }

    return Response.json({ error: "알 수 없는 요청이에요." }, { status: 400 });
  } catch (e) {
    console.error("[ai]", e);
    return Response.json({ error: "AI 응답을 받지 못했어요." }, { status: 502 });
  }
}
