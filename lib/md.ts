/**
 * 노드 본문은 md 문자열 하나가 유일한 소스다. (핸드오프 §7)
 * 카드 제목 = 첫 `# ` 줄, 작성 모드의 항목 = `## ` 섹션.
 * 작성 모드에서 편집한 결과를 다시 같은 md 로 직렬화한다. 별도 문서를 만들지 않는다.
 */

export type SectionKind = "text" | "list" | "quote";

export interface Section {
  h: string;
  body: string;
  kind: SectionKind;
}

export interface ParsedMd {
  title: string;
  sections: Section[];
  /** 작성 모드가 렌더할 수 없는 문법(표·HTML). 원문은 보존하고 안내만 띄운다. */
  unsupported: boolean;
}

const isTable = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isHtml = (l: string) => /<\/?[a-z][\s\S]*>/i.test(l);

export function parseMd(md: string): ParsedMd {
  const lines = md.split("\n");
  let title = "";
  const sections: { h: string; lines: string[] }[] = [];
  let cur: { h: string; lines: string[] } | null = null;

  for (const l of lines) {
    if (!title && l.startsWith("# ")) {
      title = l.slice(2);
      continue;
    }
    if (l.startsWith("## ")) {
      cur = { h: l.slice(3), lines: [] };
      sections.push(cur);
      continue;
    }
    if (cur) cur.lines.push(l);
  }

  const out: Section[] = sections.map((s) => {
    const body = trimBlank(s.lines);
    const filled = body.filter((x) => x.trim() !== "");
    const kind: SectionKind =
      filled.length && filled.every((x) => x.startsWith("- "))
        ? "list"
        : filled.length && filled.every((x) => x.startsWith("> "))
          ? "quote"
          : "text";
    return { h: s.h, body: body.join("\n"), kind };
  });

  return {
    title,
    sections: out,
    unsupported: lines.some((l) => isTable(l) || isHtml(l)),
  };
}

function trimBlank(lines: string[]) {
  const out = [...lines];
  while (out.length && out[0] === "") out.shift();
  while (out.length && out[out.length - 1] === "") out.pop();
  return out;
}

export function serializeMd(parsed: Pick<ParsedMd, "title" | "sections">): string {
  return (
    ["# " + parsed.title, "", ...parsed.sections.flatMap((s) => ["## " + s.h, s.body, ""])]
      .join("\n")
      .trim() + "\n"
  );
}

/** 카드가 보여줄 제목. 비어 있으면 빈 문자열을 돌려주고, 표시는 호출부가 정한다. */
export function titleOf(md: string): string {
  const m = md.match(/^# (.*)$/m);
  return m ? m[1].trim() : "";
}

export function setTitle(md: string, title: string): string {
  if (/^# .*$/m.test(md)) return md.replace(/^# .*$/m, "# " + title);
  return "# " + title + "\n\n" + md.replace(/^#\s*$/m, "").trimStart();
}

export function sectionBody(md: string, heading: string): string {
  return parseMd(md).sections.find((s) => s.h === heading)?.body ?? "";
}

export function setSectionBody(md: string, heading: string, body: string): string {
  const parsed = parseMd(md);
  const i = parsed.sections.findIndex((s) => s.h === heading);
  if (i === -1) return serializeMd({ ...parsed, sections: [...parsed.sections, { h: heading, body, kind: "text" }] });
  const sections = parsed.sections.map((s, n) => (n === i ? { ...s, body } : s));
  return serializeMd({ ...parsed, sections });
}

export function addSection(md: string, heading: string): string {
  const parsed = parseMd(md);
  return serializeMd({ ...parsed, sections: [...parsed.sections, { h: heading, body: "", kind: "text" }] });
}

/* ── 목록 섹션 ── */

export interface ListItem {
  text: string;
  checked: boolean | null; // null 이면 불릿, boolean 이면 체크박스
}

export function parseList(body: string): ListItem[] {
  return body
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => {
      const m = l.match(/^- \[([ xX])\] (.*)$/);
      if (m) return { text: m[2], checked: m[1].toLowerCase() === "x" };
      return { text: l.replace(/^- /, ""), checked: null };
    });
}

export function serializeList(items: ListItem[]): string {
  return items
    .map((it) => (it.checked === null ? `- ${it.text}` : `- [${it.checked ? "x" : " "}] ${it.text}`))
    .join("\n");
}

/** 인용 섹션은 `> ` 접두사를 벗겨서 편집하고, 저장할 때 다시 붙인다. */
export const stripQuote = (body: string) =>
  body
    .split("\n")
    .map((l) => l.replace(/^> ?/, ""))
    .join("\n");

export const applyQuote = (body: string) =>
  body
    .split("\n")
    .map((l) => (l.trim() === "" ? ">" : "> " + l))
    .join("\n");
