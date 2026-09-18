# Motive — Build Plan

> 제품명 **Motive** 확정. 워드마크 `Project` → `Motive` (CMP-01 헤더).
> 대회 규정 확인 완료 — 사전 제작 디자인 사용 가능.

## 0. 이 문서의 위치

| 문서 | 역할 | 충돌 시 |
| --- | --- | --- |
| `docs/01_REASONING_LAYER_PRODUCT_SPEC.md` | 데이터·제품 계약 (내부 타입, 엣지, export, P0) | **타입/데이터는 이 문서가 이김** |
| `docs/WIREFRAME_DESIGN_BRIEF.md` | 디자인 요청서 (5단계, 한국어 라벨, 금지 목록) | **UI 라벨은 이 문서가 이김** |
| `docs/DESIGN_HANDOFF.md` | 화면 계약 S01–S08 · CMP-01–12 · 상태표 | 화면 동작의 기준 |
| `docs/design-tokens.json` | 색·타이포·간격·모션 실값 | 토큰의 유일한 출처 |
| `BUILD_PLAN.md` (이 문서) | 충돌 해소 결과 + 구현 순서 | — |

와이어프레임 프로토타입(`Project Wireframes.dc.html`)은 별도 전달 예정. 픽셀 기준으로만 참고하고
내부 구조는 베끼지 않는다.

## 1. 확정된 충돌 해소

두 원본 문서가 어긋나는 지점. 아래가 최종이며, 원본 문서는 수정하지 않는다.

### 1.1 노드 타입 — 스펙 §7.2 채택
브리프는 8종(`problem/hypothesis/challenge/solution/...`), 스펙은 내부 6종.
**내부 6종만 코드에 존재한다.** `challenge` / `hypothesis` / `solution` 타입을 만들지 않는다(스펙 §30.14).

| UI 라벨 | ID prefix | 내부 type | subtype |
| --- | --- | --- | --- |
| 문제 | `P-` | — (Project.problemStatement + Problem anchor) | 프로젝트당 1개 |
| 가설 | `H-` | `claim` | |
| 근거 | `E-` | `evidence` | |
| 검토 질문 | `C-` | `question` | |
| 해결안 | `S-` | `output` | `solution` |
| 결정 | `D-` | `decision` | |
| 요구사항 | `R-` | `output` | `requirement` |
| 메모 | `N-` | `note` | |

매핑은 `lib/labels.ts` **한 곳**에만 둔다. 저장·엣지·이슈 검출·export는 내부 타입만 본다.
사용자에게 `claim` / `question` / `output` 을 절대 노출하지 않는다.

### 1.2 관계 — 브리프 라벨 ↔ 스펙 엣지

| UI 라벨 | 내부 edge | 비고 |
| --- | --- | --- |
| 이 문제에서 출발 | `investigates` | Problem anchor에서 |
| 지지 | `supports` | |
| 반대 근거 | `contradicts` | danger 점 표식 |
| 검토 필요 | `investigates` | |
| 제안의 근거 | `based_on` | |
| 채택 | `produces` | |
| 보류 | `produces` + `hold: true` | **§1.5 제안 채택** |
| 기각 | `produces` + `rejected: true` | **§1.5 제안 채택** |
| 구현 범위 | `produces` | |
| 선행 필요 / 관련 | P1 — 구현하지 않음 | |

### 1.3 Export — 단일 미리보기 + 4파일 다운로드
- S07 우측 미리보기는 와이어프레임대로 `PROJECT_HANDOFF.md` **한 장**.
- 다운로드 시 스펙 §20의 4파일을 함께 내보낸다:
  `PROJECT_CONTEXT.md` / `DECISIONS.md` / `EVIDENCE.md` / `AGENTS.md`.
- `lib/export.ts` 는 **그래프 → 템플릿 렌더러**. 타깃 추가가 템플릿 추가로 끝나야 하고,
  특정 타깃만 쓰는 필드를 데이터 모델에 추가하지 않는다(스펙 §20.5).
- `.zip` 은 P1. P0는 개별 파일 다운로드.

### 1.4 콜드스타트 — S02 진입 후 선택 실행
- S01 `프로젝트 시작` → 대기 없이 약 700ms 후 S02, P-01 카드 즉시 표시. (핸드오프 S01 유지)
- S02 제안 버튼을 4개로: `가설 추가` / `자료로 근거 찾기` / `검토 질문 추가` / **`불확실한 것부터 정리`**.
- 마지막 버튼을 누를 때만 AI 호출 → 스펙 §11.2의 3분할 제안:
  **아는 것(claim) / 모르는 것(question) / 생각을 바꿀 조건(mindChangeConditions)**.
- 결과는 점선 `AI 제안 · 미확정` 카드. 사용자가 확정해야 실선 노드가 된다(스펙 §5.3, §11.3).
- Evidence는 절대 생성하지 않는다. 일반적인 창업 조언 금지(스펙 §11.2).
- 키 없음(`noKey`)이면 버튼 disabled + 안내.

### 1.5 핸드오프 §10 제안 2건 — 둘 다 채택
- 관계 `보류`와 `기각`을 내부에서 분리 (`hold` / `reject`). 영향: S03 관계 라벨, S06 select, S07 7절.
- 배지용 subtle 색 4종(`#ECFDF3 #FFFAEB #FEDF89 #FECDCA`) + `accent-border #BFDBFE` 추가.
  상태를 색만이 아니라 배경+텍스트로 구분한다.

### 1.6 모순 감지 — P0로 승격, 화면 보강
스펙 §17.1은 P0인데 와이어프레임에는 헤더 `인계 전 확인 N개`와 S06 `postChange` 뿐이다. 보강한다.
- 헤더에 `인계 전 확인 N개` 와 **분리된 `모순 N건` 칩**을 둔다.
- 클릭 → 해당 Decision ↔ Evidence 쌍으로 Focus View.
- 문구는 사실 진술만. `D-01 별도 채팅을 만들지 않는다 와 어제 추가한 E-03 이 어긋납니다.`
  `AI가 틀렸다고 판단함` 류 금지.
- 해소는 사용자 행동으로만: 결정 수정 / 근거 제외 / 알고도 수용 표시.
- 검출 3소스: (a) Decision이 `based_on` 한 Claim을 `contradicts` 하는 Evidence,
  (b) 지지 근거가 이미 있는 Claim에 새 반대 근거, (c) `based_on` Claim이 이후 반박된 Decision.

## 2. 절대 하지 않는 것

스펙 §30 + 브리프 §9 요약. 구현 중 판단이 갈리면 여기로 돌아온다.

- 완료율·신뢰도·`72% Ready`·진행 게이지 **금지**. 남은 항목을 개수로만 보여준다.
- 좌 문서 트리 / 중앙 캔버스 / 우 상시 AI 채팅 (NOTT 구조) **금지**. AI는 선택 대상의 액션·패널로만.
- 캔버스 좌표를 의미 그래프로 쓰지 않는다. 카드를 옮겨도 관계는 변하지 않는다.
- AI 제안을 사용자 확정 없이 저장하지 않는다.
- 근거 provenance(파일·줄·인용)를 잃지 않는다. 찾지 못하면 지어내지 말고 미확인으로 표시.
- 화면에 없는 기능 버튼(`Codex 열기`, `배포하기`, 없는 ZIP 목록) 만들지 않는다.
- `사업성 검증 완료` 류 문구 금지. 점검 완료 문구는 `인계에 필요한 정보를 확인했어요`.

## 3. 스택

- Next.js (App Router) · TypeScript · Tailwind · shadcn/ui · Radix · Lucide
- `@xyflow/react` — 캔버스
- zustand + persist(localStorage) — 로컬 우선. **auth/DB 없음** (스펙 §25, P2)
- AI SDK + Vercel AI Gateway. 모델은 `"provider/model"` 문자열, provider 패키지 직접 의존 금지.
  구조화 출력은 `generateObject` + zod (스펙 §27 계약).
- `pdfjs-dist` — PDF 텍스트 추출(클라이언트). URL은 `/api/extract` 서버 라우트(CORS).
- 폰트 Pretendard (SIL OFL) — jsDelivr CDN 가변 다이내믹 서브셋.

## 4. 구조

```
D:\2026\GDG\BYPPproject
├─ app/
│  ├─ page.tsx                   S01 문제 작성 (5상태)
│  ├─ p/[id]/page.tsx            S02·S03 캔버스 + 패널 5종
│  ├─ p/[id]/handoff/page.tsx    S07 인계
│  └─ api/
│     ├─ ai/route.ts             콜드스타트 · 근거 후보 · 문제 다듬기
│     └─ extract/route.ts        URL 텍스트 추출
├─ lib/
│  ├─ types.ts                   내부 6타입 + subtype + 엣지 6종 (스펙 §26)
│  ├─ labels.ts                  내부타입 ↔ 한국어 라벨 ↔ ID prefix — 매핑 단일 지점
│  ├─ store.ts                   zustand persist. nodes/edges/placements/sources 분리
│  ├─ md.ts                      노드 md 1문자열 ↔ `##` 섹션 파서·직렬화
│  ├─ issues.ts                  미확인 항목 + 모순 검출 3소스
│  └─ export.ts                  그래프 → 템플릿 렌더 (타깃 추가 = 템플릿 추가)
├─ components/                   공통 컨트롤 + CMP-01~12
├─ docs/                         원본 4문서 (수정 금지)
└─ public/demo/interview-demo.md 9줄 합성 자료 (E-01=줄6, E-02=줄9)
```

## 5. 구현 순서

핸드오프 §11 순서 = 이미 의존성 정렬됨.

| # | 단계 | 검증 |
| --- | --- | --- |
| 0 | git init · scaffold · 토큰→Tailwind theme · 공통 컨트롤(버튼 36/32/28, 세그먼트, select, 배지, 토스트 CMP-12) | 토큰 값 1:1 대조 |
| 1 | `types.ts` · `labels.ts` · `store.ts` | 라벨 매핑 self-check |
| 2 | S01 5상태 → S02 전환 (P-01 생성) | 빈 입력 오류 · 저장 실패 경로 |
| 3 | S03 캔버스 셸 CMP-01~06. 선택/hover/focus/다중/관계 선택, 패닝·줌·정리·화면 맞춤, ⌘K | 10노드 예시로 |
| 4 | S05 Inspector. md 단일 소스, 작성↔Markdown 양방향, 저장 3상태 | `md.ts` 왕복 테스트 |
| 5 | S04 자료 검토 8단계 + 자료함 CMP-08·09. 실제 드롭 · PDF/URL 추출 · AI 동의 게이트 | 인용 미일치 · 후보 0개 분기 |
| 6 | S06 결정·요구사항 + `postChange` 후속 변경 검토 | 기각/보류 분리 동작 |
| 7 | `issues.ts` + 모순 칩 + Focus View | 모순 3소스 각각 |
| 8 | S07 인계. 점검 로직 · 미리보기/원문 · 복사 · 4파일 다운로드 · 오래됨 | 생성 파일을 실제 코딩 에이전트에 물려보기 |
| 9 | S08 변형 12종을 실제 오류 경로에 연결 · `prefers-reduced-motion` · 1280 압축 규칙 | — |

## 6. 데모 축 (스펙 §29)

이 흐름을 막는 것만 P0다. 나머지는 전부 후순위.

`문제 입력 → 가설 → 파일 드롭 → 원문 확인 → 근거 승인(반대 근거 E-02) → 결정(기각 대안 + 재검토 조건) → MD 인계`

예시 데이터는 브리프 §7 `제출 체크룸` 시나리오 하나로 통일한다. 화면마다 다른 숫자를 지어내지 않는다.
전 화면에 `데모 자료` 칩, 파일에 `합성 자료` / `가상 안내` 칩.

## 7. 남은 미정

- Pretendard 배포 방식 (CDN vs 자체 호스팅) — 라이선스는 OFL이라 둘 다 가능
- 요구사항 3개 이상일 때 추가 폼 반복 여부 (프로토타입은 R-01, R-02까지)
- 1280 미만 레이아웃 — 디자인 규칙만 있고 화면 없음. 캔버스 터치 조작은 P1

## 8. 구현 현황 (2026-09-19)

`npm run dev` → `npm run check` (md / issues / export 자체 점검) → `npm run build` 전부 통과.

### 끝난 것

| 단계 | 상태 |
| --- | --- |
| 0 토큰·공통 컨트롤 | 완료 — `app/globals.css`, `components/kit.tsx` |
| 1 타입·라벨·스토어 | 완료 — `lib/types.ts` `lib/labels.ts` `lib/store.ts` |
| 2 S01 → S02 | 완료 (5상태) |
| 3 S03 캔버스 셸 | 완료 — 선택/hover/focus/다중/관계 선택, 패닝·줌, ⌘K |
| 4 S05 Inspector | 완료 — md 단일 소스, 작성↔Markdown 양방향, 저장 상태 |
| 5 S04 자료 검토 | 완료 — 파일 드롭·PDF·URL 추출, 동의 게이트, 인용 대조, 승인해야 실선 |
| 6 S06 결정·요구사항 | 완료 — 기각/보류 분리, 재검토 조건 필수 |
| 7 어긋남 감지 | 완료 — 3소스 검출, 헤더 독립 칩, Focus View |
| 8 S07 인계 | 완료 — 미리보기/원문, 복사, 5파일 다운로드, 오래됨 배너 |
| 콜드스타트 | 완료 — S02 `불확실한 것부터 정리`, 확정 전 점선 |

### 남은 것

- 9단계 S08 변형 12종을 실제 오류 경로에 연결 (현재 `noKey`·`no-text`·`인용 미일치`·`후보 0개`·`저장 실패`만)
- 1280 미만 레이아웃 (현재 1440 기준, 1280 압축 규칙 미적용)
- `정리`(기본 배치 복원)·`화면 맞춤` 실제 동작, 관계 변경 메뉴, 노드 삭제·되돌리기
- 다크 모드 (P1), `.zip` 내보내기 (P1)

### 계획과 달라진 것

1. **`@xyflow/react` 를 쓰지 않았다.** 와이어프레임 프로토타입이 transform + 절대 배치 + SVG 로 직접 그리고 있었고,
   그 쪽이 픽셀을 맞추기 쉬우면서 코드도 적다. 캔버스는 `components/canvas/` 200줄 남짓이다.
   자동 배치·미니맵·핸들 드래그가 필요해지면 그때 바꾼다.
2. **색은 `docs/design-tokens.json` 이 아니라 프로토타입 실측값을 썼다.** 프로토타입이 더 나중 산출물이고
   README 가 픽셀 재현을 지정했다. 차이는 zinc 계열(#18181b/#71717a/#e4e4e7) vs gray 계열(#111827/#667085/#E5E7EB).
3. **자료는 캔버스 위 아이콘이다.** 핸드오프는 자료함 중심이었지만, 파일을 캔버스에 끌어다 놓으면
   아이콘 카드로 남고 그 아이콘을 카드 위로 끌어 첨부한다. 자료함은 목록·주소 입력용으로 남겼다.

### AI 키

`.env.example` 참조. 키가 없으면 헤더에 `AI 미연결` 이 뜨고 콜드스타트·근거 후보·문제 다듬기만 막힌다.
원문에서 근거 직접 선택, 결정, 인계 내보내기는 키 없이도 전부 동작한다.

## 9. 캔버스 조작 개편 (2026-09-19)

무한 캔버스 + 피그마식 도구 막대로 바꿨다. 화면 요청 사항을 그대로 반영한 목록:

| 요청 | 구현 |
| --- | --- |
| 손 도구 · 드래그로 블록 추가 · 되돌리기/다시 실행 · 정리 · 격자 | `components/Toolbar.tsx`. 단축키 V / H / N, ⌘Z · ⇧⌘Z |
| 자료 첨부를 클립 아이콘으로 | 도구 막대와 레일 모두 `Paperclip` |
| 자료함을 왼쪽에서 | `components/LeftSide.tsx` — 아래 서랍(CMP-08) 제거, 왼쪽 레일 + 밀려나오는 패널 |
| 검색은 창 없이 그 자리에서 | 같은 왼쪽 패널. ⌘K 명령 메뉴는 따로 남겨둠 |
| 단계별로 좌측·하단 기능 바뀌게 | `lib/phases.ts` 의 `RAIL_ACTIONS` / `DOCK_ACTIONS` |
| 블록 상하좌우에서 끌어 선 연결 | 카드 네 변의 손잡이 → 놓으면 관계 종류를 고르는 메뉴 |
| 한 번 눌러 오른쪽 패널 | 더블클릭 대신 단일 클릭. 더블클릭도 그대로 동작 |
| 섹션 추가 없애기 | 제거. 섹션은 이제 `## ` 제목 블록일 뿐 |
| 새 블록을 화면 가운데로 부드럽게 | `requestCenter` → 420ms ease-out. `prefers-reduced-motion` 이면 즉시 이동 |
| `이 문제에서 출발` 누르면 나머지 회색 | 관계 라벨 클릭 → 그 가지만 남기고 opacity 0.25 |
| 제목 자리에 회색 안내 | `제목을 입력하세요` |
| 노션식 본문 · `/` 명령 · 블록 이동 | `components/BlockEditor.tsx` + `lib/blocks.ts` |
| Del 로 블록 삭제 | Delete/Backspace. ⌘Z 로 복구 |
| 기본 펼침, 접으면 제목만 | 카드 헤더의 접기 버튼. `Placement.collapsed` |

되돌리기는 구조 변경(추가·삭제·관계·이동)만 담는다. 글자 편집은 담지 않는다 —
텍스트는 자동 저장되고, 되돌리기 스택이 타이핑으로 가득 차면 쓸모가 없어진다.

블록 편집기는 md 문자열 하나를 줄 단위로 읽고 다시 쓴다. 빈 줄은 블록이 아니라 서식이라
파싱할 때 버리고 직렬화할 때 다시 넣는다. `npm run check` 의 `blocks.check.ts` 가 왕복을 지킨다.
