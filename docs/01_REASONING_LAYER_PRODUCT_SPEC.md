# Reasoning Layer — Product & Implementation Specification

> Working title only. Product name is intentionally not locked.

## 0. Product definition

**“이 제품의 결과물은 예쁘게 정리된 노트나 캔버스가 아니라, 사람의 리서치와 의사결정 과정을 에이전트가 그대로 이어받을 수 있는 context다.”**

This product is not a generic brainstorming tool, whiteboard, PKM, or Notion/FigJam replacement.

The product owns the reasoning layer between research and implementation:

**Research → Reasoning → Decision → Agent Context → Build**

The canvas is a way to inspect and manipulate that reasoning. It is not the end product.

The end product is **traceable, machine-readable project context** that a coding agent such as Claude Code, Codex, or another implementation agent can continue from without re-asking the team why a decision was made.

---

# 1. Why this product exists

Hackathon teams, side-project teams, and very early startup teams often already use:

- ChatGPT / Claude for research and ideation
- Notion / Docs for notes
- Figma for design
- GitHub / Linear for implementation
- Claude Code / Codex / OpenCode for coding

The missing layer is not another place to write.

The missing layer is a persistent representation of:

- what the team currently believes,
- what is still unknown,
- what evidence supports or contradicts those beliefs,
- what decisions were made,
- what alternatives were rejected,
- why they were rejected,
- when those decisions should be revisited,
- and what context an implementation agent should inherit.

Today, this logic is usually scattered across chat history, meeting notes, PDFs, interviews, Figma comments, and people's memory.

The product should make that reasoning explicit, inspectable, revisable, and exportable.

---

# 2. Initial target user

Do **not** target “all university students” in the MVP.

Initial target:

> **Hackathon / side-project / early startup teams that perform a lot of research and make many decisions in a short time, then hand implementation to AI coding agents such as Claude Code or Codex.**

Why this target is useful:

- They already have a `Research → Decision → AI Coding` workflow.
- Context loss happens quickly.
- Decisions are made under time pressure.
- Rejected alternatives are frequently re-proposed by teammates or agents.
- The value of high-quality agent context can be demonstrated immediately.
- A complete workflow can be shown within a hackathon demo.

Possible later expansion:

- student research teams,
- product discovery teams,
- startup PM/founder teams,
- research-heavy individual builders,
- technical design / architecture decision workflows.

---

# 3. Non-goals

The MVP is **not**:

- a Notion replacement,
- a general document database,
- a PKM / second-brain app,
- an infinite whiteboard for arbitrary collaboration,
- a mind-map generator,
- a generic AI chatbot with a canvas,
- a task manager,
- a project-management suite,
- a polished real-time multiplayer product,
- a complete coding IDE.

The product may contain Markdown editing and a visual canvas, but those are supporting interfaces for the reasoning graph.

---

# 4. Distinction from NOTT

The existing NOTT project is document-centric personal knowledge management:

- records and documents are primary objects,
- documents can be placed on a canvas,
- document relationships can be created,
- there is a document tree and a persistent AI panel,
- the main value is recording, reconnecting, organizing, and reading personal knowledge.

This project must be materially different.

## NOTT mental model

`Document → Canvas placement → Related documents → Read / organize`

## New product mental model

`Problem → Uncertainty → Evidence → Claim → Decision → Output → Agent context`

### Hard differentiation rules

Do not copy the existing NOTT information architecture.

In particular, the new product should **not** default to:

`left document tree | center canvas | right permanent AI chat`

Instead:

- the canvas is the dominant workspace,
- Sources are raw material rather than the main information hierarchy,
- AI is contextual and action-based rather than a permanent chat personality,
- reasoning entities are first-class objects,
- exports are structured for coding-agent continuation.

### Hackathon implementation rule

If the hackathon prohibits carrying previous work into the event:

- create a fresh repository,
- do not copy NOTT source code,
- do not reuse NOTT components or wireframe assets,
- do not present old implementation as new work,
- conceptual lessons and general design preferences may be used,
- use public libraries such as shadcn/ui, Radix, Tailwind, React Flow / XYFlow, etc. normally according to the event rules.

---

# 5. Product principles

## 5.1 Context, not notes

A clean canvas is not success.

Success means an agent can answer:

- What problem are we solving?
- What do we currently believe?
- What are we unsure about?
- Which sources changed our thinking?
- What evidence supports or contradicts each claim?
- What did the team decide?
- What alternatives were rejected and why?
- Under what condition should we revisit that decision?
- What should be built now?
- What is explicitly out of scope?

without asking the user to reconstruct the history manually.

## 5.2 Uncertainty before answers

At cold start, AI should **not** fill the project with generic hypotheses.

AI should expose uncertainty.

Prefer:

- What we think we know
- What we do not know
- What would change our mind

over generic brainstorming.

## 5.3 Human decisions remain explicit

AI may:

- extract,
- cluster,
- suggest,
- point out contradictions,
- propose questions,
- summarize evidence.

AI must not silently turn a suggestion into a human decision.

A `Decision` exists because the user or team explicitly commits it.

## 5.4 Graph is source of truth

Canvas position is presentation state.

The semantic graph is the source of truth.

Moving a card must not alter reasoning relationships.

## 5.5 Traceability over polish

Every important conclusion should be traceable back to evidence and sources.

A less beautiful graph with traceable provenance is more valuable than a beautiful but ambiguous canvas.

---

# 6. No progress percentage

Remove all concepts such as:

- `72% Ready`
- project completion %
- linear progress bars
- forced `Problem → Explore → Validate → Decide → Build` completion stages

Research is non-linear.

New evidence may cause:

- a Claim to be weakened,
- a Question to reopen,
- a Decision to be revised,
- even the original Problem to be reframed.

That is legitimate progress.

## 6.1 Show unresolved work directly

Examples:

- `3 Open Questions`
- `2 Unsupported Claims`
- `1 Contradiction`
- `Pricing assumption untested`
- `Feature #3 has no supporting evidence`

These should be clickable and filter/focus the relevant graph items.

## 6.2 Modes are views, not stages

Use five stages, matching `WIREFRAME_DESIGN_BRIEF.md` 3.1:

`정의 / 탐색 / 검토 / 결정 / 인계`

Users can move between them freely.

They do not imply completion order.

Suggested meaning:

- **정의 (Define)** — Problem, Claims, Questions, unknowns
- **탐색 (Explore)** — Sources, Evidence gathering
- **검토 (Review)** — Evidence confirmation, contradictions, provenance
- **결정 (Decide)** — Decisions, alternatives, revisit conditions
- **인계 (Handoff)** — Outputs and context export

These labels are the UI surface. Internal mode keys may be
`define / explore / review / decide / handoff`.

---

# 7. Core data model

Keep the reasoning model intentionally small.

## 7.1 Reasoning node types

### Claim

A statement the team currently believes or is considering.

Examples:

- “Hackathon teams lose important decision context across tools.”
- “Students have more difficulty recovering why a decision was made than organizing notes.”

A Claim may be weak, well-supported, contradicted, or unresolved.

### Question

Something not yet known, an assumption to validate, or a challenge to the current framing.

Examples:

- “Is the real pain idea organization or decision-context loss?”
- “Will users actively connect evidence, or must this be automated?”

`Challenge` is **not** a separate node type.

A challenge to a Claim is represented as a Question.

### Evidence

A concrete piece of information extracted from or entered from a Source.

Examples:

- an interview quote,
- a survey result,
- a statistic,
- a finding from a paper,
- a technical spike result,
- competitor behavior,
- observed test feedback.

Evidence should preserve provenance.

### Decision

A human commitment based on the current context.

Examples:

- “Focus the MVP on decision trace instead of generic knowledge organization.”
- “Use Supabase Auth.”
- “Exclude multiplayer from the hackathon MVP.”

### Output

A result that moves toward execution.

Possible subtypes:

- Feature
- Requirement
- Experiment
- Constraint
- User Flow
- Technical Requirement
- MVP Scope Item

Avoid creating separate first-class graph node types for all of these in MVP. Store them as `Output` with a subtype.

### Note

A free-form note or insight that is not yet a Claim, Question, or Evidence.

A Note carries no polarity and participates in no issue detection. It exists so the user
is never blocked by a type decision at the moment of writing.

A Note can later be converted into another type.

---

## 7.2 UI labels vs internal types — BINDING

`WIREFRAME_DESIGN_BRIEF.md` 3.2 defines eight Korean card labels. This specification
defines six internal types. **They describe the same model.** The design brief names the
UI surface; this section names the data.

| UI label (design brief) | brief `type` | internal type | note |
| --- | --- | --- | --- |
| 문제 | `problem` | Project.problemStatement + Problem anchor | one per project |
| 가설 | `hypothesis` | `claim` | |
| 근거 | `evidence` | `evidence` | |
| 검토 질문 | `challenge` | `question` | **rename only — not a new type** |
| 해결안 | `solution` | `output` (subtype `solution`) | |
| 결정 | `decision` | `decision` | |
| 요구사항 | `requirement` | `output` (subtype `requirement`) | |
| 메모 | `note` | `note` | |

Rules:

1. The UI shows the Korean labels. Never show `claim`, `question`, or `output` to the user.
2. `검토 질문` is stored as `question`. `Challenge` remains **not** a first-class type (7.1, 30.3).
3. `해결안` and `요구사항` are both `output`, separated by subtype, not by node type.
4. Storage, edges, export, and issue detection operate on the internal types only.
5. If the two documents disagree: the design brief wins for the label, this section wins
   for the type.

Relation labels follow the same split. Design brief 3.3 Korean labels map onto the
internal edge types of section 9:

| UI label | internal edge |
| --- | --- |
| 이 문제에서 출발 | `investigates` (from Problem anchor) |
| 지지 | `supports` |
| 반대 근거 | `contradicts` |
| 검토 필요 | `investigates` |
| 제안의 근거 | `based_on` |
| 채택 | `produces` |
| 보류·기각 | `produces` with `rejected: true` |
| 구현 범위 | `produces` |
| 선행 필요 / 관련 | P1 — not in MVP |

---

# 8. Supporting entities

## 8.1 Project

Top-level workspace.

Fields:

- id
- title
- problemStatement
- createdAt
- updatedAt

## 8.2 Source

Raw research material.

Supported MVP source types:

- PDF
- URL
- Interview note / transcript text
- Markdown
- TXT / pasted text

Possible later types:

- audio transcription,
- Google Docs,
- Slack,
- GitHub issue / PR,
- Figma comments,
- analytics events.

Source fields:

- id
- projectId
- type
- title
- originalUri or filename
- rawText / extractedText
- metadata
- createdAt

A Source is not automatically Evidence.

Evidence must be extracted or authored from the Source.

## 8.3 Placement

Canvas-only visual state.

Fields:

- nodeId
- x
- y
- width
- height
- collapsed
- optional group / viewport metadata

Deleting or moving Placement must not destroy semantic reasoning data unless the user explicitly deletes the underlying node.

---

# 9. Relationship model

The semantic graph needs typed edges.

Minimum MVP relations:

### Source → Evidence

`derived_from`

Evidence must preserve a reference to its Source.

Where possible, also store:

- page number,
- paragraph / section,
- quote span,
- URL,
- timestamp for transcript,
- extraction confidence.

### Evidence → Claim

`supports`

or

`contradicts`

This is the most important polarity-bearing relation.

### Question → Claim

`investigates`

Optional when a Question exists to test or challenge a Claim.

### Decision → Evidence / Claim / Question

`based_on`

A Decision should be able to reference the reasoning it depends on.

### Decision → Output

`produces`

### Later extension

The model should not block later relations such as:

- `revises`
- `supersedes`
- `resulted_in`
- `reopens`
- `invalidates`

but these do not need to be implemented in MVP.

---

# 10. Example reasoning chain

```text
Problem
"해커톤 팀이 아이디어를 발전시키는 과정에서 중요한 맥락을 잃는다."

        ↓

Claim
"학생들은 아이디어 구조화에 어려움을 겪는다."

        ↓ investigates

Question
"실제 문제는 구조화인가, 이전 결정의 맥락을 잃는 것인가?"

        ↑

Evidence — contradicts
"인터뷰 4/7명이 정리보다 결정 이유를 다시 찾기 어렵다고 답함."

        ↓

Decision
"Knowledge organization보다 Decision trace에 집중한다."

        ↓

Output
"MVP must preserve rejected alternatives and revisit conditions."
```

---

# 11. Cold start UX

Cold start is a core product experience.

## 11.1 Input

The user starts with one rough Problem statement.

Example:

> “해커톤 아이디어를 더 잘 발전시키는 도구”

Do not require:

- title,
- tags,
- folder,
- database schema,
- canvas configuration.

## 11.2 AI response

Do not generate generic startup advice.

Avoid output like:

- “사용자는 편리함을 중요하게 여긴다.”
- “협업 기능이 필요하다.”
- “생산성을 높이고 싶어 한다.”

Instead generate three structured sections.

### What we think we know

Implicit Claims already contained in the Problem statement.

Each must be clearly labeled as an inferred assumption, not a fact.

Example:

- “해커톤 팀은 아이디어 발전 과정에서 반복적으로 맥락을 잃는다.” — inferred Claim
- “현재 도구 사이의 전환이 이 문제의 일부다.” — inferred Claim

### What we don't know

Questions whose answers could materially change the product direction.

Example:

- “사용자는 생각을 구조화하는 것이 힘든가, 이전 결정의 이유를 복구하는 것이 힘든가?”
- “개인 사용과 팀 사용 중 어느 쪽에서 pain이 더 큰가?”
- “사용자는 reasoning 관계를 직접 연결할 의향이 있는가?”

### What would change our mind

Evidence that would cause the current framing to be changed or abandoned.

Example:

- “대다수 인터뷰 사용자가 결정 이유를 잃지 않는다고 답한다.”
- “기존 chat history alone is sufficient for target teams.”
- “Users refuse any workflow that requires confirming extracted evidence.”

The user confirms, edits, or rejects these before they become graph objects.

## 11.3 Initial canvas

After confirmation:

- create Claim nodes,
- create Question nodes,
- create a Problem anchor / project statement,
- do not fabricate Evidence,
- visually distinguish AI-proposed items until user confirms them.

---

# 12. Canvas behavior

## 12.1 Canvas is visual representation, not truth

Users can freely move nodes.

Graph relations are independent from x/y positions.

## 12.2 No destructive global auto-layout

Do not make `Arrange by reasoning` a core feature.

Do not destroy the user's canvas arrangement in order to show logic.

## 12.3 Focus View

When a user selects a Claim or Decision, offer **Focus View**.

Focus View temporarily visualizes only the local reasoning chain.

Example:

```text
Evidence + ─┐
            ↓
Question → Claim ← Evidence -
            ↓
         Decision
            ↓
          Output
```

Requirements:

- Focus View does not rewrite saved node coordinates.
- Exiting Focus View restores the previous canvas arrangement.
- It can be generated algorithmically from graph edges.
- The user can expand one hop at a time if needed.

## 12.4 Node interactions

Each node should support:

- select,
- quick edit,
- open detailed Markdown view,
- attach/link Source where relevant,
- inspect graph relationships,
- contextual AI actions,
- delete with confirmation when semantic data would be removed.

---

# 13. Markdown editing

Every reasoning node can have a Markdown detail body.

Examples:

- Claim rationale
- Question notes
- Evidence interpretation
- Decision rationale
- Output requirement detail

Canvas cards show a concise summary.

Opening a node should reveal a focused editor / inspector, not a separate Notion-like document hierarchy.

The same object is rendered in two ways:

`Canvas card ↔ Markdown detail`

No duplicate document should be created.

---

# 14. Source ingestion

## 14.1 Core action

Users should be able to drag a Source into the workspace or onto a relevant Claim / Question.

Supported MVP input:

- PDF
- URL
- Markdown
- TXT
- pasted Interview note / transcript

## 14.2 Extraction flow

Example:

1. User adds a PDF.
2. System parses text.
3. AI receives the Source plus relevant project context.
4. AI proposes Evidence candidates.
5. Each Evidence candidate includes:
   - concise Evidence statement,
   - source provenance,
   - relevant quote / excerpt where allowed,
   - related Claim suggestions,
   - suggested polarity: `supports` or `contradicts`.
6. User confirms, edits, or rejects.
7. Confirmed Evidence is added to the graph.

Do not silently turn all extracted text into Evidence.

## 14.3 Reliability

If the system cannot locate a trustworthy source span:

- do not invent one,
- mark the candidate as unverified,
- require user confirmation.

Provenance is more important than extraction volume.

---

# 15. AI role

AI should feel embedded into the workflow, not added as a generic permanent chat panel.

Preferred contextual actions:

## On Claim

- Find unsupported parts
- What would falsify this?
- Find relevant Evidence in Sources
- Create a Question
- Show contradictions

## On Question

- Suggest research plan
- Generate interview questions
- Search existing Sources
- Define what evidence would answer this

## On Evidence

- Suggest related Claims
- Re-evaluate polarity
- Extract source citation
- Identify limitations

## On Decision

- Find conflicting Evidence
- Summarize rationale
- Identify assumptions
- Suggest revisit condition
- Generate agent-context entry

AI suggestions must remain visibly suggestions until accepted.

---

# 16. Decision model — critical feature

Decision quality is the core value proposition.

A Decision must be able to store:

- decision statement,
- why it was made,
- evidence / claims it is based on,
- alternatives considered,
- rejected alternatives,
- reason each alternative was rejected,
- revisit condition,
- date / timestamp,
- optional author,
- related Outputs.

## 16.1 Example

```md
## Authentication

Decision:
Use Supabase Auth.

Why:
- Team already uses Supabase.
- MVP requires Google OAuth.
- Setup cost is lower.

Evidence:
- Technical spike #12
- Pricing comparison #7

Alternatives considered:
- Clerk
- Auth0

Rejected:

### Clerk
Reason:
Free tier limitation conflicts with expected usage.

### Auth0
Reason:
Higher setup complexity with no meaningful MVP advantage.

Revisit if:
- Enterprise SSO becomes required.
```

The following are especially important:

- **Rejected alternative**
- **Reason rejected**
- **Revisit condition**

This prevents coding agents from repeatedly recommending approaches the team already evaluated and rejected.

---

# 17. Open issues instead of readiness scores

The product should calculate inspectable project issues, not opaque scores.

MVP issue detectors can include:

- Question has no Evidence
- Claim has no supporting Evidence
- Claim has contradictory Evidence
- Decision has no `based_on` references
- Decision has no alternatives considered
- Decision has no revisit condition
- Output has no Decision or Claim provenance

Present these as plain-language issues.

Examples:

- `3 Open Questions`
- `2 Unsupported Claims`
- `1 Contradiction`

Clicking an issue should:

- filter,
- highlight,
- or open Focus View around the relevant items.

Do not convert these into a percentage.

## 17.1 Contradiction detection is the primary differentiator

Of all the detectors above, **contradiction detection carries the most product weight.**

A general chat assistant can summarize, extract, and suggest. It cannot tell the user that
something they committed to three weeks ago conflicts with evidence they added today,
because it holds no persistent typed graph of prior commitments.

This product does. Treat it accordingly:

- Contradiction is a **P0** detector, not one item in a list.
- Surface it where the user will see it, not only inside a filtered view.
- State it plainly, without judgment:

  > `D-01 별도 채팅을 만들지 않는다` 와 어제 추가한 `E-03` 이 어긋납니다.

- Never phrase it as the AI ruling on correctness. No `AI가 틀렸다고 판단함`.
  The product reports the conflict; the human resolves it.
- A contradiction clears only through an explicit user action: revise the Decision,
  reject the Evidence, or mark the conflict as knowingly accepted.

Minimum MVP contradiction sources:

- Evidence with `contradicts` polarity pointing at a Claim that a Decision is `based_on`.
- New Evidence contradicting a Claim that already has supporting Evidence.
- A Decision whose `based_on` Claim has since been contradicted.

---

# 18. MVP workflow

The first version should validate exactly this:

1. User enters a Problem.
2. AI proposes Claims / Questions / Unknowns.
3. User confirms and a reasoning canvas is created.
4. User adds a PDF / URL / Interview note / Markdown Source.
5. AI extracts Evidence candidates.
6. Evidence is linked to relevant Claims.
7. Each Evidence → Claim relation is labeled `supports` or `contradicts`.
8. User writes an explicit Decision.
9. Product exports coding-agent context.

Everything else is secondary.

---

# 19. MVP screens / surfaces

Keep the number of surfaces small.

## A. Problem capture

A calm, nearly empty start screen.

Main prompt:

**What are you trying to figure out?**

Secondary explanation:

> Start with the messy version. We will structure the uncertainty before suggesting answers.

Input can be multiline.

Primary action:

`Frame the problem`

## B. Reasoning workspace

Main canvas.

Top-level mode switch:

`Frame / Investigate / Decide / Ship`

This is a view switch, not progress.

Top area also surfaces unresolved issues.

Example:

`3 Open Questions` `2 Unsupported Claims` `1 Contradiction`

No progress percentage.

## C. Sources drawer / tray

Not a permanent document tree.

Opened on demand.

Contains:

- added Sources,
- parsing state,
- extraction state,
- Evidence candidates.

## D. Contextual inspector

Appears when a node is selected.

Contains:

- node type,
- title / summary,
- Markdown detail,
- related nodes,
- relevant Sources,
- contextual AI actions.

Do not make this a permanent chat column.

## E. Decision editor

Structured Decision view.

Must make rejected alternatives and revisit conditions easy to enter.

## F. Agent Context export

Shows generated artifacts and allows export.

No “72% ready” score.

If context has unresolved issues, show them plainly without preventing export unless technically impossible.

---

# 20. Agent Context export

The most important export is **Decision Context**, not a pretty summary.

Minimum generated files:

- `AGENTS.md`
- `DECISIONS.md`
- `EVIDENCE.md`
- `PROJECT_CONTEXT.md`

Package them as individual files and optionally as a `.zip`.

## 20.1 `PROJECT_CONTEXT.md`

Purpose:

Give the implementation agent a concise current-state overview.

Suggested structure:

```md
# Project Context

## Problem

## Target User

## Current Framing

## Key Claims

## Open Questions

## Current Decisions

## Outputs / MVP Scope

## Constraints

## Explicit Non-Goals

## Known Contradictions

## What to verify before changing direction
```

## 20.2 `DECISIONS.md`

Purpose:

Prevent decision-history loss and repeated rejected suggestions.

Suggested structure:

```md
# Decisions

## Decision: <title>

### Decision
...

### Why
...

### Based on
- Claim ...
- Evidence ...

### Alternatives considered
- ...

### Rejected alternatives

#### <Alternative>
Reason:
...

### Revisit if
...

### Produces
- Output ...
```

This is the core export.

## 20.3 `EVIDENCE.md`

Purpose:

Preserve evidence provenance.

Suggested structure:

```md
# Evidence

## Evidence: <title>

Statement:
...

Polarity:
supports / contradicts

Related Claim:
...

Source:
...

Source location:
page / URL / timestamp / section

Notes / limitations:
...
```

## 20.4 `AGENTS.md`

Purpose:

Tell coding agents how to use the context.

Suggested structure:

```md
# Agent Instructions

## Product intent

## Current scope

## Decisions you must respect

## Rejected approaches you should not re-propose unless revisit conditions are met

## Open questions you may investigate

## Constraints

## Implementation priorities

## Definition of done

## Context files
- PROJECT_CONTEXT.md
- DECISIONS.md
- EVIDENCE.md
```

## 20.5 Export targets beyond coding agents

The four files above are the **coding-agent** target. The underlying graph is not specific
to software implementation, and the same content serves other destinations.

MVP ships the coding-agent target only. The generator must be written so that adding a
target is a template change, not a data-model change.

| Target | Content | Status |
| --- | --- | --- |
| Coding agent | `AGENTS.md`, `DECISIONS.md`, `EVIDENCE.md`, `PROJECT_CONTEXT.md` | **P0** |
| 창업 지원사업 서류 | 문제 정의, 대상 고객, 근거, 기각한 방향과 이유, 차별점 | P1 |
| 연구 계획 | 연구 질문, 선행 검토, 버린 접근과 이유, 남은 불확실성 | P1 |

Implementation constraint: the export layer reads the graph and renders templates. No
target may require a field that only that target uses. If a target needs something the
graph does not hold, that is a signal to reconsider the target, not to widen the model.

---

# 21. Build is part of a loop

Do not design the long-term model as:

`Research → Decide → Build → End`

The eventual loop is:

`Research → Decision → Build → Result / Feedback → Evidence → Decision revision`

The MVP does not need to implement the full loop.

However the data model should not block:

- new Evidence arriving after build,
- a Decision being revised,
- an older Decision being superseded,
- Outputs producing measurable Results,
- a Question reopening.

Avoid hard-coding irreversible stage completion.

---

# 22. Suggested UX information architecture

Do not recreate NOTT's permanent 3-column document layout.

Recommended desktop structure:

```text
┌──────────────────────────────────────────────────────────────┐
│ Project        Frame | Investigate | Decide | Ship          │
│                3 Open Questions · 1 Contradiction    Export │
├──────┬───────────────────────────────────────────────────────┤
│ Rail │                                                       │
│      │                    Reasoning Canvas                   │
│      │                                                       │
│      │     Evidence + → Claim ← Evidence -                  │
│      │                    ↓                                  │
│      │                 Decision                              │
│      │                    ↓                                  │
│      │                  Output                               │
│      │                                                       │
└──────┴───────────────────────────────────────────────────────┘
```

### Compact navigation rail

Possible items:

- Canvas
- Sources
- Decisions
- Exports

Clicking `Sources` may open a drawer or temporary panel.

It should not look like a file tree.

### Context inspector

Only open when needed.

Desktop can use a right-side Sheet / inspector.

It disappears when nothing is selected.

### AI

AI should appear as:

- contextual sparkle actions,
- command palette actions,
- extraction/review states,
- suggestion cards.

Avoid a permanent “AI chat” identity in the main layout.

---

# 23. Visual direction

The product should feel calm, precise, and technical.

Reference qualities:

- **shadcn/ui** — crisp primitives, neutral components, composability
- **Linear** — dense but calm hierarchy, keyboard-first product feel
- **Vercel** — restraint, whitespace, sharp typography, neutral surfaces
- **Notion** — readable editing and low-friction content handling
- **Arky** — visual reasoning / spatial thought inspiration
- **NOTT** — the user's preference for clean Korean typography, thin borders, minimal noise
- **Aceternity UI** — meaningful motion and polished microinteractions, used sparingly

Do not produce a “futuristic AI dashboard.”

Avoid:

- heavy glassmorphism,
- huge gradient blobs,
- constant glowing borders,
- decorative particle backgrounds inside the product,
- oversized marketing cards inside the workspace,
- fake analytics,
- progress gamification,
- excessive rounded-card nesting.

Prefer:

- light-first neutral palette,
- optional dark mode,
- Pretendard or similarly clean Korean sans-serif,
- 1px neutral borders,
- subtle surface contrast,
- compact badges,
- restrained shadow,
- deliberate empty space,
- 8–12px radius range for most surfaces,
- clear typography hierarchy,
- motion only when state or relationship changes.

---

# 24. Meaningful motion

Aceternity-style polish should support understanding.

Good uses:

- Source dragged onto a Claim highlights the semantic target.
- New Evidence appears near the relevant Claim with a short entrance motion.
- A new `supports` / `contradicts` relation animates once when confirmed.
- Contradiction status briefly pulses when discovered.
- Focus View smoothly isolates the local reasoning chain.
- Context export shows file generation in a short, understated sequence.

Bad uses:

- always-on beams,
- floating particles,
- animated gradients behind the canvas,
- bounce on every click,
- delayed drag response,
- animations that interfere with canvas manipulation.

Respect `prefers-reduced-motion`.

---

# 25. Suggested implementation architecture

This is a greenfield recommendation, not a rigid requirement.

Preferred stack for a fast hackathon implementation:

- Next.js with App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Radix primitives
- Lucide icons
- `@xyflow/react` / React Flow for canvas
- Markdown editor / viewer with a simple reliable implementation
- provider-agnostic LLM adapter
- lightweight local persistence for demo reliability, or Supabase if persistence/auth is needed by the event
- server route / action for URL/PDF extraction where browser-only parsing is insufficient

The implementation agent may choose an equivalent stack if the repository already has constraints.

Do not spend MVP time on:

- auth unless required,
- billing,
- teams/permissions,
- realtime multiplayer,
- notifications,
- mobile canvas editing,
- formulas/databases,
- complex rich text.

---

# 26. Suggested TypeScript domain sketch

```ts
type NodeType = "claim" | "question" | "evidence" | "decision" | "output";

type EvidencePolarity = "supports" | "contradicts";

interface ReasoningNode {
  id: string;
  projectId: string;
  type: NodeType;
  title: string;
  summary?: string;
  markdown?: string;
  createdAt: string;
  updatedAt: string;
}

interface ClaimNode extends ReasoningNode {
  type: "claim";
  status?: "proposed" | "accepted" | "uncertain";
}

interface QuestionNode extends ReasoningNode {
  type: "question";
  status?: "open" | "answered" | "reopened";
}

interface EvidenceNode extends ReasoningNode {
  type: "evidence";
  sourceId?: string;
  sourceLocator?: {
    page?: number;
    url?: string;
    timestamp?: string;
    section?: string;
    excerpt?: string;
  };
}

interface DecisionNode extends ReasoningNode {
  type: "decision";
  decision: string;
  alternatives?: {
    name: string;
    rejected?: boolean;
    rejectionReason?: string;
  }[];
  revisitIf?: string[];
}

interface OutputNode extends ReasoningNode {
  type: "output";
  subtype?: "feature" | "requirement" | "experiment" | "constraint" | "user_flow" | "mvp_scope";
}

interface SemanticEdge {
  id: string;
  projectId: string;
  from: string;
  to: string;
  type:
    | "supports"
    | "contradicts"
    | "investigates"
    | "based_on"
    | "produces"
    | "derived_from";
}

interface Source {
  id: string;
  projectId: string;
  type: "pdf" | "url" | "interview" | "markdown" | "text";
  title: string;
  rawText?: string;
  uri?: string;
  metadata?: Record<string, unknown>;
}

interface Placement {
  nodeId: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}
```

Implementation may normalize `derived_from` as an Evidence `sourceId` rather than a graph edge. Semantic behavior matters more than literal schema.

---

# 27. AI output contracts

Prefer structured output over unconstrained prose.

## 27.1 Cold-start framing

Expected shape conceptually:

```json
{
  "claims": [
    {
      "text": "...",
      "reason": "Implicit in the user's problem statement",
      "confidence": "low"
    }
  ],
  "questions": [
    {
      "text": "...",
      "whyItMatters": "...",
      "couldChangeDirection": true
    }
  ],
  "mindChangeConditions": [
    {
      "text": "..."
    }
  ]
}
```

## 27.2 Evidence extraction

```json
{
  "evidenceCandidates": [
    {
      "statement": "...",
      "sourceLocator": {
        "page": 4,
        "excerpt": "..."
      },
      "relatedClaims": [
        {
          "claimId": "...",
          "polarity": "contradicts",
          "reason": "..."
        }
      ]
    }
  ]
}
```

Do not save AI output directly as confirmed reasoning data without user approval.

---

# 28. MVP priorities

## P0 — must work

- Problem capture
- cold-start Claims / Questions / mind-change conditions
- canvas rendering
- manual Claim / Question / Evidence / Decision / Output creation
- PDF/text/Markdown source import
- URL import if reliably achievable
- Evidence extraction
- supports / contradicts
- Decision detail including rejected alternatives + revisit condition
- Focus View for selected Claim or Decision
- unresolved issue detection
- **contradiction detection and surfacing (17.1)**
- UI label to internal type mapping (7.2)
- Markdown detail editing
- generation of:
  - `PROJECT_CONTEXT.md`
  - `DECISIONS.md`
  - `EVIDENCE.md`
  - `AGENTS.md`
- downloadable export

## P1 — useful if time remains

- Interview template
- better source locator UI
- command palette
- drag Source directly onto Claim
- one-click “What would falsify this?” AI action
- export `.zip`
- optional dark mode

## P2 — explicitly defer

- collaboration
- comments/mentions
- user accounts
- project sharing permissions
- mobile editing
- agent directly modifying the app
- GitHub integration
- Figma integration
- automatic post-build feedback loop
- realtime sync
- sophisticated graph analytics
- global auto-layout

---

# 29. Acceptance criteria

The MVP is successful when a fresh user can complete this story:

1. Enter a rough Problem.
2. See useful uncertainty rather than generic brainstorm filler.
3. Confirm Claims and Questions.
4. Add at least one real Source.
5. Accept extracted Evidence with visible provenance.
6. See Evidence support or contradict a Claim.
7. Create a Decision based on that reasoning.
8. Record a rejected alternative and a revisit condition.
9. Export context files.
10. Give those files to a coding agent and have the agent understand:
    - what to build,
    - why,
    - what was rejected,
    - what remains uncertain.

The demo should make this flow understandable without explaining the entire data model verbally.

---

# 30. Agent implementation instructions

When Claude Code or another implementation agent receives this specification:

1. Treat sections 0, 5, 6, 7, 11, 16, 18, 20, and 28 as hard product constraints.
2. Do not add progress percentages or readiness scores.
3. Do not add `Challenge` as a first-class node type.
4. Do not make canvas coordinates the semantic graph.
5. Do not create a permanent AI chat column as the primary AI UX.
6. Do not turn Sources into a document-tree-first information architecture.
7. Prefer user confirmation over silently saving AI-generated reasoning.
8. Preserve evidence provenance.
9. Optimize the MVP for the target flow, not feature count.
10. Keep the UI visually calm and implement interactions before decorative motion.
11. Build from scratch if hackathon rules require fresh implementation.
12. Before implementing a new major feature, ask: **Does this improve agent context quality?**
13. If the answer is no, defer it unless required for the core flow.
14. Follow 7.2 exactly. Korean labels in the UI, internal types in storage and export.
    Do not introduce a `challenge`, `hypothesis`, or `solution` node type in code.
15. Treat contradiction detection (17.1) as P0, not as one detector among many.
16. Keep the export generator template-driven (20.5). Ship the coding-agent target only.

---

# 31. One-sentence product pitch

Korean:

> **리서치와 의사결정의 맥락을 구조화해, 사람이 하던 생각을 AI coding agent가 그대로 이어받게 만드는 reasoning workspace.**

English:

> **A reasoning workspace that turns human research and decisions into context coding agents can continue from.**
