import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";

/**
 * AI 출력은 구조화된 형태로만 받는다 (스펙 §27).
 * 여기서 만든 것은 전부 "제안"이고, 사람이 승인하기 전에는 그래프에 들어가지 않는다.
 *
 * 키가 없으면 실패가 아니라 `aiOff` 로 답한다 — 직접 작성과 내보내기는 계속 돼야 한다.
 */

const MODEL_ID = process.env.MOTIVE_MODEL ?? "deepseek/deepseek-v4-flash-0731:free";

/** OpenRouter 키가 있으면 OpenRouter, 없으면 Vercel AI Gateway(문자열 모델 ID) 로 간다. */
function model() {
  const key = process.env.OPENROUTER_API_KEY;
  return key ? createOpenRouter({ apiKey: key })(MODEL_ID) : MODEL_ID;
}

/**
 * 모든 generateObject 호출에 공통. 출력은 작지만 추론 모델은 "생각" 토큰을 여기서 같이 쓴다 —
 * 추론을 끄지 않으면 2048 토큰을 전부 생각에 쓰고 빈 답을 돌려준다(DeepSeek V4 Flash 에서 확인).
 */
const GEN = {
  maxOutputTokens: 8192,
  temperature: 0.2,
  providerOptions: { openrouter: { reasoning: { enabled: false } } },
};

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
  summary: z.string().describe("자료가 무엇을 담고 있는지 1~2문장"),
  points: z.array(z.string()).max(3).describe("이 프로젝트와 맞닿을 수 있는 대목, 각각 한 줄"),
  caveat: z.string().describe("이 요약만 보고 판단하면 안 되는 이유 한 줄"),
});

const refine = z.object({
  statement: z.string().describe("대상·상황·불편이 한 문장에 드러나게 정리한 문제 진술"),
  note: z.string().describe("무엇을 바꿨는지 한 줄"),
});

function hasKey() {
  return Boolean(process.env.OPENROUTER_API_KEY || process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY);
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
    if (body.kind === "evidence") {
      const text = String(body.text ?? "").slice(0, 24000);
      const targets = (body.targets ?? []) as { id: string; kind: string; title: string }[];
      if (!text.trim()) return Response.json({ candidates: [] });

      const numbered = text
        .split("\n")
        .map((l, i) => `${i + 1}\t${l}`)
        .join("\n");

      const { object } = await generateObject({
        model: model(),
        ...GEN,
        schema: evidenceOut,
        system: GUARD,
        prompt: `아래는 줄 번호가 붙은 자료 원문이다. 현재 캔버스의 카드와 관련된 근거 후보를 찾아라.

규칙:
- 참여자 발언·사실 문장 하나하나를 카드 목록과 대조해, 관련이 있으면 전부 후보로 만들어라. 한 인용이 여러 카드와 관련되면 카드마다 따로 만든다.
- quote 는 원문에 있는 문장을 **그대로** 옮겨라. 요약·수정 금지. 제목(#)이나 안내문은 인용하지 마라.
- line 은 그 문장이 실제로 있는 줄 번호다.
- claim 은 "이 인용이 무엇을 시사하는가"를 한국어 완결 문장으로 쓴다. limit 은 "이 인용만으로는 말할 수 없는 것"을 한국어 완결 문장으로 쓴다. 두 칸에 카드 ID 나 단어 하나만 쓰면 안 된다.
- 관련된 카드가 없으면 후보를 만들지 마라. 억지로 채우지 마라.
- polarity: 카드를 뒷받침하면 supports, 반대하면 contradicts, 제안의 근거면 based_on.

예시 (형식만 참고, 내용은 아래 원문에서):
{"quote":"회의 끝나고 링크를 다시 물어봤어요.","line":4,"claim":"공유된 정보가 대화에 묻혀 다시 묻는 일이 생긴다.","limit":"한 사람의 경험이라 빈도는 알 수 없다.","targetId":"P-01","polarity":"supports"}

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
        model: model(),
        ...GEN,
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
        model: model(),
        ...GEN,
        schema: refine,
        system: GUARD,
        prompt: `아래 <진술> 안의 문장을 다듬는 일이다. **새 주제를 만들지 마라** — <진술>에 적힌 그 문제만 다룬다.
<진술>에 있는 대상(누가)·상황(언제·어디서)·불편(무엇이 힘든가)이 한 문장에 드러나게 정리하라.
<진술>에 없는 대상·수치·맥락을 지어내지 마라. 빠진 요소는 채우지 말고 그대로 비워 두어라.

<진술>
${problem}
</진술>`,
      });
      return Response.json(object);
    }

    return Response.json({ error: "알 수 없는 요청이에요." }, { status: 400 });
  } catch (e) {
    console.error("[ai]", e);
    return Response.json({ error: "AI 응답을 받지 못했어요." }, { status: 502 });
  }
}
