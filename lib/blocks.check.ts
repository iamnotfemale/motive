/** blocks.ts 자체 점검. md ↔ 블록 왕복에서 내용이 깨지면 여기서 터진다. */
import assert from "node:assert/strict";
import { autoType, blocksToMd, mdToBlocks, previewLines } from "./blocks.ts";
import { titleOf } from "./md.ts";

const MD = `# 제출 준비를 별도 협업 앱으로 옮기면 누락이 줄어들 것이다.

## 본문
제출 항목을 한 곳에서 관리하면 누락이 줄어든다고 예상한다.

## 검증 계획
- 참여자 인터뷰에서 도구 전환 의향 확인
- [ ] 해커톤 1회에서 체크리스트 사용
- [x] 이미 끝난 항목

## 원문 인용
> 앱을 하나 더 가입해야 하면 그냥 카톡에 정리할 것 같아요.

---

### 메모
\`\`\`
const a = 1;
\`\`\`
`;

const blocks = mdToBlocks(MD);
const types = blocks.map((b) => b.type);

// 첫 `# ` 줄은 제목이라 블록에 없다
assert.ok(!blocks.some((b) => b.type === "h1"), "제목 줄이 블록으로 들어왔다");
assert.ok(types.includes("h2") && types.includes("h3"));
assert.ok(types.includes("list") && types.includes("check"));
assert.ok(types.includes("quote") && types.includes("divider") && types.includes("code"));

const checks = blocks.filter((b) => b.type === "check");
assert.deepEqual(checks.map((c) => c.checked), [false, true]);
assert.equal(checks[1].text, "이미 끝난 항목");
assert.equal(blocks.find((b) => b.type === "code")!.text, "const a = 1;");
assert.equal(blocks.find((b) => b.type === "quote")!.text, "앱을 하나 더 가입해야 하면 그냥 카톡에 정리할 것 같아요.");

// 왕복: 다시 md 로 쓰고 읽어도 같은 블록이 나온다
const title = titleOf(MD);
const round = blocksToMd(title, blocks);
assert.equal(titleOf(round), title, "왕복에서 제목이 바뀌었다");
assert.deepEqual(
  mdToBlocks(round).map((b) => ({ t: b.type, x: b.text, c: b.checked })),
  blocks.map((b) => ({ t: b.type, x: b.text, c: b.checked })),
  "왕복에서 블록이 달라졌다",
);

// 인용·체크·코드 내용이 살아 있다
assert.ok(round.includes("> 앱을 하나 더"));
assert.ok(round.includes("- [x] 이미 끝난 항목"));
assert.ok(round.includes("const a = 1;"));

// 표식을 치면 유형이 바뀐다
assert.deepEqual(autoType("## 섹션"), { type: "h2", rest: "섹션" });
assert.deepEqual(autoType("- [ ] 할 일"), { type: "check", rest: "할 일" });
assert.deepEqual(autoType("> 인용"), { type: "quote", rest: "인용" });
assert.equal(autoType("그냥 문장"), null);

// 빈 문서도 깨지지 않는다
assert.deepEqual(mdToBlocks("# 제목만\n"), []);
assert.equal(titleOf(blocksToMd("제목만", [])), "제목만");

// 카드 앞면 미리보기는 빈 줄을 버린다
assert.ok(previewLines(MD, 3).every((b) => b.text.trim() !== "" || b.type === "divider"));
assert.equal(previewLines(MD, 3).length, 3);

console.log("blocks.ts ok —", blocks.length, "blocks");
