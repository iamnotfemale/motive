/**
 * `정리` — 관계를 기준으로 격자에 다시 놓는다.
 *
 * 스펙 §12.2 는 "전체 자동 배치를 핵심 기능으로 만들지 말 것"이라고 한다.
 * 그래서 이 함수는 사용자가 단추를 눌렀을 때만 돌고, 되돌리기로 한 번에 취소된다.
 * 배치를 바꿀 뿐 관계는 건드리지 않는다 (§5.4).
 */
import { kindOf } from "./labels";
import type { ReasoningNode, SemanticEdge, Source } from "./types";

export interface Size {
  w: number;
  h: number;
}
export interface Spot {
  x: number;
  y: number;
}

const COL_GAP = 76;
const ROW_GAP = 72;
const ORIGIN = { x: 56, y: 40 };

/**
 * 관계에서 위·아래를 읽는다.
 * 근거와 검토 질문은 자기가 가리키는 카드 **아래에** 달린다 — 화살표 방향과 반대다.
 */
function hierarchy(edge: SemanticEdge, kindOfId: (id: string) => string): { parent: string; child: string } | null {
  if (edge.type === "related") return null;
  const fromKind = kindOfId(edge.from);

  // 근거·검토 질문은 대상에 매달린다
  if (fromKind === "evidence" || fromKind === "question") return { parent: edge.to, child: edge.from };
  // 결정이 무엇을 근거로 삼았는지도 위쪽이다
  if (edge.type === "based_on") return { parent: edge.to, child: edge.from };
  // 문제 → 가설, 결정 → 해결안·요구사항
  return { parent: edge.from, child: edge.to };
}

/** 가장 긴 경로 기준 층 나누기. 순환이 있어도 멈춘다. */
export function levelsOf(
  nodes: ReasoningNode[],
  edges: SemanticEdge[],
  kindOfId: (id: string) => string,
): Map<string, number> {
  const level = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  const links = edges
    .map((e) => hierarchy(e, kindOfId))
    .filter((x): x is { parent: string; child: string } => Boolean(x))
    .filter((x) => level.has(x.parent) && level.has(x.child));

  // 노드 수만큼만 완화한다. 순환이 있으면 거기서 멈추고 더 내리지 않는다.
  for (let pass = 0; pass < nodes.length; pass++) {
    let moved = false;
    for (const { parent, child } of links) {
      const want = level.get(parent)! + 1;
      if (level.get(child)! < want) {
        level.set(child, want);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return level;
}

/**
 * 층마다 한 줄씩. 자식은 부모 바로 아래에 모이고(같은 가설의 근거들이 이웃), 줄 안에서는 겹치지 않게 오른쪽으로 민다.
 * 붙은 자료는 카드 오른쪽 자리를 같이 차지하고, 붙지 않은 자료는 맨 아랫줄에 모은다.
 */
export function tidyLayout(
  nodes: ReasoningNode[],
  edges: SemanticEdge[],
  sources: Source[],
  sizes: Record<string, Size>,
): Record<string, Spot> {
  if (!nodes.length) return {};

  const kindById = new Map(nodes.map((n) => [n.id, kindOf(n) as string]));
  const kindOfId = (id: string) => kindById.get(id) ?? "note";
  const level = levelsOf(nodes, edges, kindOfId);

  const rows = new Map<number, ReasoningNode[]>();
  for (const n of nodes) {
    const l = level.get(n.id) ?? 0;
    rows.set(l, [...(rows.get(l) ?? []), n]);
  }

  const sortedLevels = [...rows.keys()].sort((a, b) => a - b);

  const sizeOf = (id: string): Size => sizes[id] ?? { w: 288, h: 160 };
  const out: Record<string, Spot> = {};
  const attached = new Map<string, Source[]>();
  for (const s of sources) {
    if (!s.attachedTo) continue;
    attached.set(s.attachedTo, [...(attached.get(s.attachedTo) ?? []), s]);
  }

  // 카드가 차지하는 폭·높이. 붙은 자료는 카드 오른쪽에 세워지므로 그 자리를 같이 잡는다.
  const footprint = (id: string): Size => {
    const size = sizeOf(id);
    const chips = attached.get(id) ?? [];
    if (!chips.length) return size;
    const stack = chips.reduce((a, c) => a + sizeOf(c.id).h + 10, -10);
    return { w: size.w + 28 + Math.max(...chips.map((c) => sizeOf(c.id).w)), h: Math.max(size.h, stack) };
  };

  /** 첫 부모의 가로 중심. 자식을 그 아래에 모아 선이 짧고 덜 꼬이게 한다. */
  const parentCenter = (id: string): number | null => {
    for (const e of edges) {
      const h = hierarchy(e, kindOfId);
      if (h?.child === id && out[h.parent]) return out[h.parent].x + sizeOf(h.parent).w / 2;
    }
    return null;
  };

  let y = ORIGIN.y;
  for (const l of sortedLevels) {
    const row = rows.get(l)!;
    // 줄 안 순서: 부모 중심 x 순 — 같은 부모의 자식(예: 한 가설의 근거들)이 이웃하고 선이 교차하지 않는다.
    const want = new Map(row.map((n) => [n.id, parentCenter(n.id)]));
    row.sort((a, b) => {
      const wa = want.get(a.id);
      const wb = want.get(b.id);
      if (wa != null && wb != null && wa !== wb) return wa - wb;
      if ((wa == null) !== (wb == null)) return wa == null ? 1 : -1;
      return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
    });

    let cursor = ORIGIN.x;
    let tallest = 0;
    for (const n of row) {
      const fp = footprint(n.id);
      const w = want.get(n.id);
      // 부모 바로 아래를 원하되, 왼쪽 이웃과는 겹치지 않는다
      const x = Math.max(cursor, w != null ? w - sizeOf(n.id).w / 2 : cursor);
      out[n.id] = { x: Math.round(x), y: Math.round(y) };
      let cy = y;
      for (const c of attached.get(n.id) ?? []) {
        out[c.id] = { x: Math.round(x + sizeOf(n.id).w + 28), y: Math.round(cy) };
        cy += sizeOf(c.id).h + 10;
      }
      tallest = Math.max(tallest, fp.h);
      cursor = x + fp.w + COL_GAP;
    }
    y += tallest + ROW_GAP;
  }

  // 아무 카드에도 붙지 않은 자료는 맨 아래 한 줄로
  const loose = sources.filter((s) => !s.attachedTo || !out[s.id]);
  let lx = ORIGIN.x;
  for (const s of loose) {
    out[s.id] = { x: Math.round(lx), y: Math.round(y) };
    lx += sizeOf(s.id).w + COL_GAP;
  }

  return out;
}
