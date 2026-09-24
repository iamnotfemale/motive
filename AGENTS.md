# AGENTS.md

이 저장소에서 작업하는 코딩 에이전트를 위한 안내.

> 헷갈리기 쉬운 점: 이 제품은 인계 문서로 `AGENTS.md` 를 **생성**한다 (`lib/export.ts`).
> 그건 사용자가 내려받는 산출물이고, 지금 읽고 있는 이 파일은 저장소 자체의 규칙이다. 서로 다른 것이다.

---

## 무엇을 만들고 있나

리서치와 의사결정의 맥락을 구조화해, 코딩 에이전트가 사람의 생각을 그대로 이어받게 만드는 워크스페이스.
결과물은 예쁜 캔버스가 아니라 **추적 가능한 기계 판독 맥락**이다.

`문제 → 가설 → 근거 → 검토 질문 → 결정 → 인계`

원본 명세는 `docs/` 에 있다. 충돌하면 그쪽이 이긴다:

| 문서 | 무엇의 기준인가 |
| --- | --- |
| `docs/01_REASONING_LAYER_PRODUCT_SPEC.md` | 데이터·제품 계약 (내부 타입, 엣지, export, P0) |
| `docs/WIREFRAME_DESIGN_BRIEF.md` | UI 한국어 라벨, 금지 목록 |
| `docs/DESIGN_HANDOFF.md` | 화면 S01–S08, 컴포넌트 CMP-01–12 |
| `docs/design-tokens.json` | 색·타이포 (단, 프로토타입 실측값이 우선 — `BUILD_PLAN.md` §9 참고) |
| `BUILD_PLAN.md` | 위 문서들이 어긋날 때의 **해소 결과**와 구현 이력 |

---

## 명령

```bash
npm run dev      # localhost:3000
npm run check    # 순수 로직 자체 점검 8종 — 커밋 전 반드시
npm run build    # 프로덕션 빌드 (타입 오류 포함)
npx tsc --noEmit # 타입만 빠르게
```

`npm run check` 가 이 저장소의 안전망이다. 테스트 프레임워크는 쓰지 않는다 —
`lib/*.check.ts` 가 `node:assert` 로 도는 실행 가능한 점검이고, `tsx` 로 직접 실행된다.
**로직을 고치면 해당 check 도 같이 고친다.** 조용히 통과시키지 말 것.

---

## 절대 하지 말 것

명세 §30 과 브리프 §9 에서 온 것들. 판단이 갈리면 여기로 돌아온다.

1. **완료율·퍼센트·신뢰도 점수를 만들지 않는다.** `72% Ready` 같은 것. 남은 일은 개수로만 센다.
2. **`challenge` / `hypothesis` / `solution` 을 노드 타입으로 만들지 않는다.**
   내부 타입은 `problem · claim · question · evidence · decision · output · note` 뿐이고,
   한국어 라벨 매핑은 **`lib/labels.ts` 한 곳에만** 있다. 사용자에게 `claim` 을 절대 노출하지 않는다.
3. **캔버스 좌표를 의미 그래프로 쓰지 않는다.** 카드를 옮겨도 관계는 변하지 않는다.
4. **AI 제안을 사용자 확정 없이 저장하지 않는다.** 제안은 점선 `미확정` 으로 남는다.
5. **근거 provenance 를 잃지 않는다.** 인용은 원문과 대조하고, 못 찾으면 지어내지 말고 미확인으로 표시.
6. **상시 AI 채팅 칼럼을 만들지 않는다.** AI 는 선택 대상의 액션과 패널로만 등장한다.
7. **좌 문서 트리 / 중앙 캔버스 / 우 AI 채팅** 구조로 되돌리지 않는다.
8. **없는 기능 버튼을 만들지 않는다** (`Codex 열기`, `배포하기`, 존재하지 않는 ZIP 목록 등).
9. **`사업성 검증 완료` 류 문구 금지.** 점검 완료 문구는 `인계에 필요한 정보를 확인했어요`.
10. **전체 자동 배치를 기본 동작으로 만들지 않는다.** `정리` 는 사용자가 누를 때만 돌고 ⌘Z 로 취소된다.

---

## 구조

```
app/
  page.tsx                 소개 페이지 (랜딩)
  dashboard/page.tsx       캔버스 목록·관리
  think/[id]/page.tsx      추론 캔버스 (본체)
  think/[id]/handoff/      인계 화면
  api/ai/route.ts          구조화 출력만 (generateObject + zod)
  api/extract/route.ts     URL 본문 추출
lib/
  types.ts     내부 데이터 계약
  labels.ts    내부 타입 ↔ 한국어 라벨 — 매핑의 유일한 지점
  store.ts     zustand + persist(localStorage). 서버 DB·계정 없음
  ui.ts        화면 상태 (저장하지 않음)
  blocks.ts    md ↔ 노션식 블록
  tidy.ts      관계 기준 격자 배치
  issues.ts    미확인 항목 + 어긋남 감지 (P0)
  spotlight.ts 단계 단추가 비추는 묶음
  export.ts    그래프 → 인계 문서 템플릿
components/
  canvas/      Canvas · SemanticNode · Edges · SourceChip · SelectionToolbar
  panels/      Inspector · Source · Review · Decision · ColdStart · Refine · Issue
```

---

## 규칙

- **UI 문구는 한국어.** 코드 식별자는 영어. 주석은 한국어로 *왜* 를 적는다 — 무엇을 하는지는 코드가 말한다.
- **노드 본문은 md 문자열 하나가 유일한 소스.** 첫 `# ` 가 제목, `## ` 가 섹션. 별도 문서를 만들지 않는다.
- **되돌리기는 구조 변경만 담는다** (추가·삭제·관계·이동). 타이핑은 담지 않는다 — 스택이 글자로 가득 차면 쓸모가 없다.
- **AI 키가 없어도 앱은 돌아가야 한다.** 키가 없으면 `aiOff` 로 답하고, 직접 작성·근거 선택·결정·내보내기는 그대로 된다.
- 스택: Next.js(App Router) · TS · Tailwind v4 · shadcn/ui · zustand · motion. 캔버스는 직접 그린다 (xyflow 안 씀).

---

## 밟았던 지뢰

같은 데를 다시 밟지 않도록.

- **화면이 흔들린다** → 카드 pointerdown 의 기본 포커스가 캔버스를 스크롤한다.
  `e.preventDefault()` 후 `focus({ preventScroll: true })`.
- **드래그 중 화면이 계속 움직인다** → 이동·확대 effect 를 `doc`/`rects` 에 물리면 매 프레임 다시 돈다.
  요청 번호(nonce)가 바뀔 때만 돌게 한다. 화면이 움직이는 건 **새 카드 추가 / 화면 맞춤 / 확대·축소 단추** 세 가지뿐.
- **자료를 카드에 못 떨어뜨린다** → 끌고 있는 아이콘이 포인터 밑에서 판정을 가로챈다.
  `elementsFromPoint` 로 자기 자신을 건너뛴다.
- **캔버스를 끌면 글자가 파랗게 잡힌다** → 뷰포트에 `select-none`.
- **빈 줄이 블록으로 쌓인다** → `mdToBlocks` 에서 빈 줄을 버리고 `blocksToMd` 에서 다시 넣는다. 왕복은 `blocks.check.ts` 가 지킨다.

---

## 배포

- GitHub `iamnotfemale/motive` (private) → `master` push 시 Vercel 자동 배포
- 프로덕션: https://motive-it.vercel.app
- AI 를 켜려면 Vercel 환경변수에 `AI_GATEWAY_API_KEY`. `.env.example` 참고.
