/**
 * 도구 막대 단추가 비출 블록을 고른다.
 *
 * 무엇을 감추는 게 아니라 무엇을 볼지 고르는 것이다 — 나머지는 흐려질 뿐 그대로 있다.
 * 그래프를 바꾸지 않는다 (스펙 §5.4).
 */
import { detectIssues, openConflicts } from "./issues";
import { kindOf } from "./labels";
import type { ActionKey } from "./phases";
import type { Doc } from "./store";

export interface Spotlight {
  key: ActionKey;
  ko: string;
  ids: string[];
  /** 비출 게 없을 때 화면에 띄울 안내. */
  empty?: string;
}

export function spotlightFor(key: ActionKey, doc: Doc): Spotlight | null {
  const nodes = doc.nodes;
  const byKind = (k: string) => nodes.filter((n) => kindOf(n) === k).map((n) => n.id);

  switch (key) {
    case "add-claim":
      return {
        key,
        ko: "가설",
        ids: byKind("claim"),
        empty: "아직 가설이 없어요. + 에서 가설을 추가해 보세요.",
      };

    case "add-note":
      return {
        key,
        ko: "생각",
        ids: byKind("note"),
        empty: "아직 생각 메모가 없어요. + 에서 추가할 수 있어요.",
      };

    case "add-question":
      return { key, ko: "검토 질문", ids: byKind("question"), empty: "아직 검토 질문이 없어요." };

    case "attach":
      // 올린 자료와 그 자료에서 나온 근거를 같이 본다
      return {
        key,
        ko: "자료",
        ids: [
          ...doc.sources.map((s) => s.id),
          ...nodes.filter((n) => n.sourceId).map((n) => n.id),
        ],
        empty: "아직 올린 자료가 없어요. 파일을 캔버스로 끌어다 놓으세요.",
      };

    case "find-evidence": {
      const evidence = byKind("evidence");
      // 근거가 붙어 있는 대상까지 함께 보여야 관계가 읽힌다
      const targets = doc.edges.filter((e) => evidence.includes(e.from)).map((e) => e.to);
      return {
        key,
        ko: "근거",
        ids: [...evidence, ...targets],
        empty: "아직 승인한 근거가 없어요. 자료를 올리고 검토해 보세요.",
      };
    }

    case "conflicts": {
      // 반대 근거와 그것이 가리키는 카드, 그리고 어긋남으로 묶인 결정
      const counter = doc.edges.filter((e) => e.type === "contradicts" && !e.proposed);
      const ids = new Set<string>();
      for (const e of counter) {
        ids.add(e.from);
        ids.add(e.to);
      }
      for (const c of openConflicts(doc)) for (const id of c.nodeIds) ids.add(id);
      return {
        key,
        ko: "반박",
        ids: [...ids],
        empty: "반대 근거가 아직 없어요.",
      };
    }

    case "issues": {
      const ids = new Set<string>();
      for (const i of detectIssues(doc)) for (const id of i.nodeIds) ids.add(id);
      return {
        key,
        ko: "미확인",
        ids: [...ids],
        empty: "남은 확인 항목이 없어요.",
      };
    }

    case "add-solution":
      return { key, ko: "해결안", ids: byKind("solution"), empty: "아직 해결안이 없어요." };

    case "make-decision": {
      const decisions = byKind("decision");
      // 결정이 채택·기각한 해결안까지 같이
      const linked = doc.edges.filter((e) => decisions.includes(e.from)).map((e) => e.to);
      return {
        key,
        ko: "결정",
        ids: [...decisions, ...linked],
        empty: "아직 확정한 결정이 없어요. 해결안 카드의 `결정 채택` 으로 만들 수 있어요.",
      };
    }

    default:
      return null;
  }
}
