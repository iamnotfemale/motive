/**
 * URL 본문 추출. 브라우저에서 바로 받으면 CORS 로 막히므로 서버를 거친다.
 *
 * 읽지 못하면 지어내지 않는다. 왜 못 읽었는지만 돌려준다 (스펙 §14.3).
 */

const MAX_BYTES = 2_000_000;

export async function POST(req: Request) {
  let url: string;
  try {
    const body = await req.json();
    url = String(body.url ?? "");
  } catch {
    return Response.json({ problem: "요청을 읽지 못했어요." }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return Response.json({ problem: "주소 형식이 아니에요." }, { status: 400 });
  }
  if (target.protocol !== "http:" && target.protocol !== "https:")
    return Response.json({ problem: "http 또는 https 주소만 읽을 수 있어요." }, { status: 400 });

  try {
    const res = await fetch(target, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; Motive/0.1; +research-context-tool)" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return Response.json({ problem: `주소가 ${res.status} 로 응답했어요.` });

    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml/.test(type))
      return Response.json({ problem: `이 형식(${type.split(";")[0] || "알 수 없음"})은 아직 읽지 못해요.` });

    const raw = (await res.text()).slice(0, MAX_BYTES);
    const text = htmlToText(raw);
    if (!text.trim()) return Response.json({ problem: "본문을 찾지 못했어요." });

    return Response.json({ text, title: titleOf(raw) });
  } catch (e) {
    const timeout = e instanceof Error && e.name === "TimeoutError";
    return Response.json({ problem: timeout ? "주소가 응답하지 않아요." : "주소를 열지 못했어요." });
  }
}

const titleOf = (html: string) => html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1].trim() ?? "";

/**
 * 인용은 줄 단위로 가리키므로 문단 구조를 남긴다.
 * 정교한 본문 추출기를 쓰지 않는다 — 필요해지면 그때 바꾼다.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<h([1-6])[^>]*>/gi, (_, n) => "\n" + "#".repeat(Number(n)) + " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter((l, i, all) => l !== "" || all[i - 1] !== "")
    .join("\n")
    .trim();
}
