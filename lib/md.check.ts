/**
 * md.ts 자체 점검. 실행:  node --experimental-strip-types lib/md.check.ts
 * 작성 모드 ↔ Markdown 왕복에서 내용이 깨지면 여기서 먼저 터진다.
 */
import assert from "node:assert/strict";
import { applyQuote, parseList, parseMd, serializeList, serializeMd, setSectionBody, setTitle, stripQuote, titleOf } from "./md.ts";

const SAMPLE = `# 제출 준비를 별도 협업 앱으로 옮기면 누락이 줄어들 것이다.

## 본문
제출 항목을 한 곳에서 관리하면 마감 직전 누락이 줄어든다고 예상한다.

## 검증 계획
- 참여자 인터뷰에서 도구 전환 의향 확인
- 해커톤 1회에서 체크리스트 사용 후 누락 항목 비교

## 원문 인용
> 앱을 하나 더 가입해야 하면 그냥 카톡에 정리할 것 같아요.
`;

const p = parseMd(SAMPLE);
assert.equal(p.title, "제출 준비를 별도 협업 앱으로 옮기면 누락이 줄어들 것이다.");
assert.equal(p.sections.length, 3);
assert.equal(p.sections[0].kind, "text");
assert.equal(p.sections[1].kind, "list");
assert.equal(p.sections[2].kind, "quote");
assert.equal(p.unsupported, false);

// 왕복해도 내용이 같아야 한다
assert.equal(serializeMd(p), SAMPLE.trim() + "\n");
assert.equal(titleOf(serializeMd(p)), p.title);

// 제목 교체가 본문을 건드리지 않는다
const renamed = setTitle(SAMPLE, "바뀐 제목");
assert.equal(titleOf(renamed), "바뀐 제목");
assert.equal(parseMd(renamed).sections.length, 3);

// 섹션 본문 교체
const edited = setSectionBody(SAMPLE, "본문", "다시 쓴 본문");
assert.equal(parseMd(edited).sections[0].body, "다시 쓴 본문");
assert.equal(parseMd(edited).sections[1].kind, "list");

// 목록 왕복 (불릿 / 체크박스 섞임)
const items = parseList("- 그냥 항목\n- [ ] 안 한 것\n- [x] 한 것");
assert.deepEqual(items.map((i) => i.checked), [null, false, true]);
assert.equal(serializeList(items), "- 그냥 항목\n- [ ] 안 한 것\n- [x] 한 것");

// 인용 왕복
assert.equal(stripQuote("> 한 줄\n> 두 줄"), "한 줄\n두 줄");
assert.equal(applyQuote("한 줄\n두 줄"), "> 한 줄\n> 두 줄");

// 미지원 문법은 감지하되 원문을 버리지 않는다
const withTable = SAMPLE + "\n## 표\n| a | b |\n| - | - |\n";
const t = parseMd(withTable);
assert.equal(t.unsupported, true);
assert.ok(serializeMd(t).includes("| a | b |"));

console.log("md.ts ok");
