/**
 * 노션식 블록 편집기의 데이터 계층.
 *
 * 저장은 여전히 md 문자열 하나다 (핸드오프 §7). 블록은 그 문자열을 줄 단위로 읽은 표현이고,
 * 편집하면 다시 같은 md 로 직렬화된다. 별도 문서 구조를 만들지 않는다.
 *
 * 첫 `# ` 줄은 카드 제목이라 블록에 포함하지 않는다.
 */

export type BlockType =
  | "text"
  | "h1"
  | "h2"
  | "h3"
  | "list"
  | "check"
  | "quote"
  | "code"
  | "divider";

/** 코드 블록에서 고를 수 있는 언어. 지금은 둘만 쓴다. */
export const CODE_LANGS = ["python", "c"] as const;
export type CodeLang = (typeof CODE_LANGS)[number];

export interface Block {
  id: string;
  type: BlockType;
  text: string;
  /** check 전용 */
  checked?: boolean;
  /** code 전용 */
  lang?: CodeLang;
}

export interface BlockMeta {
  type: BlockType;
  ko: string;
  hint: string;
  /** 줄 앞에 붙는 Markdown 표식. 없으면 빈 문자열. */
  prefix: string;
}

/** `/` 메뉴에 뜨는 순서. 첨부한 화면의 목록과 같다. */
export const BLOCK_MENU: BlockMeta[] = [
  { type: "text", ko: "텍스트", hint: "", prefix: "" },
  { type: "h1", ko: "제목 1", hint: "#", prefix: "# " },
  { type: "h2", ko: "제목 2", hint: "##", prefix: "## " },
  { type: "h3", ko: "제목 3", hint: "###", prefix: "### " },
  { type: "list", ko: "목록", hint: "-", prefix: "- " },
  { type: "check", ko: "체크리스트", hint: "- [ ]", prefix: "- [ ] " },
  { type: "quote", ko: "인용", hint: ">", prefix: "> " },
  { type: "code", ko: "코드", hint: "```", prefix: "" },
  { type: "divider", ko: "구분선", hint: "---", prefix: "" },
];

export const blockMeta = (t: BlockType) => BLOCK_MENU.find((b) => b.type === t)!;

let seq = 0;
export const newBlockId = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`;

export const emptyBlock = (type: BlockType = "text"): Block => ({
  id: newBlockId(),
  type,
  text: "",
  ...(type === "check" ? { checked: false } : {}),
  ...(type === "code" ? { lang: "python" as CodeLang } : {}),
});

/** md 본문 → 블록. 첫 `# 제목` 줄은 건너뛴다. */
export function mdToBlocks(md: string): Block[] {
  const lines = md.split("\n");
  const blocks: Block[] = [];
  let titleSkipped = false;
  let inCode = false;
  let codeLang: CodeLang = "python";
  let codeBuf: string[] = [];

  for (const raw of lines) {
    if (inCode) {
      if (raw.trim().startsWith("```")) {
        blocks.push({ id: newBlockId(), type: "code", text: codeBuf.join("\n"), lang: codeLang });
        codeBuf = [];
        inCode = false;
      } else codeBuf.push(raw);
      continue;
    }

    if (!titleSkipped && raw.startsWith("# ")) {
      titleSkipped = true;
      continue;
    }
    if (raw.trim().startsWith("```")) {
      const tag = raw.trim().slice(3).trim().toLowerCase();
      codeLang = (CODE_LANGS as readonly string[]).includes(tag) ? (tag as CodeLang) : "python";
      inCode = true;
      continue;
    }
    if (/^---+$/.test(raw.trim())) {
      blocks.push({ id: newBlockId(), type: "divider", text: "" });
      continue;
    }

    const check = raw.match(/^- \[([ xX])\] ?(.*)$/);
    if (check) {
      blocks.push({
        id: newBlockId(),
        type: "check",
        text: check[2],
        checked: check[1].toLowerCase() === "x",
      });
      continue;
    }
    if (raw.startsWith("### ")) {
      blocks.push({ id: newBlockId(), type: "h3", text: raw.slice(4) });
      continue;
    }
    if (raw.startsWith("## ")) {
      blocks.push({ id: newBlockId(), type: "h2", text: raw.slice(3) });
      continue;
    }
    if (raw.startsWith("# ")) {
      blocks.push({ id: newBlockId(), type: "h1", text: raw.slice(2) });
      continue;
    }
    if (raw.startsWith("- ")) {
      blocks.push({ id: newBlockId(), type: "list", text: raw.slice(2) });
      continue;
    }
    if (raw.startsWith("> ")) {
      blocks.push({ id: newBlockId(), type: "quote", text: raw.slice(2) });
      continue;
    }
    // 빈 줄은 블록이 아니라 서식이다. 직렬화할 때 다시 넣는다.
    if (raw.trim() === "") continue;
    blocks.push({ id: newBlockId(), type: "text", text: raw });
  }

  if (inCode && codeBuf.length)
    blocks.push({ id: newBlockId(), type: "code", text: codeBuf.join("\n"), lang: codeLang });

  return blocks;
}

export function blocksToMd(title: string, blocks: Block[]): string {
  const line = (b: Block) => {
    switch (b.type) {
      case "h1":
        return "# " + b.text;
      case "h2":
        return "## " + b.text;
      case "h3":
        return "### " + b.text;
      case "list":
        return "- " + b.text;
      case "check":
        return `- [${b.checked ? "x" : " "}] ` + b.text;
      case "quote":
        return "> " + b.text;
      case "code":
        return "```" + (b.lang ?? "python") + "\n" + b.text + "\n```";
      case "divider":
        return "---";
      default:
        return b.text;
    }
  };

  // 빈 줄은 읽기 좋으라고 넣는다. 다시 읽을 때 무시되므로 왕복에 영향이 없다.
  const body: string[] = [];
  blocks.forEach((b, i) => {
    const prev = blocks[i - 1];
    const heading = b.type === "h1" || b.type === "h2" || b.type === "h3";
    if (prev && (heading || prev.type !== b.type || b.type === "text")) body.push("");
    body.push(line(b));
  });

  return ["# " + title, "", ...body].join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/**
 * 줄 맨 앞에 Markdown 표식을 치면 그 블록 유형으로 바뀐다. 노션과 같은 동작.
 * 바뀌면 남은 텍스트를 돌려주고, 아니면 null.
 */
export function autoType(text: string): { type: BlockType; rest: string } | null {
  const table: [RegExp, BlockType][] = [
    [/^# /, "h1"],
    [/^## /, "h2"],
    [/^### /, "h3"],
    [/^- \[[ xX]\] /, "check"],
    [/^- /, "list"],
    [/^> /, "quote"],
    [/^```/, "code"],
    [/^---/, "divider"],
  ];
  for (const [re, type] of table) {
    const m = text.match(re);
    if (m) return { type, rest: text.slice(m[0].length) };
  }
  return null;
}

/** 카드 앞면에 보여줄 줄. 접지 않은 카드는 본문을 그대로 보여준다. */
export function previewLines(md: string, max = 6): Block[] {
  return mdToBlocks(md)
    .filter((b) => b.type === "divider" || b.text.trim() !== "")
    .slice(0, max);
}
