"use client";

/**
 * 의미 그래프가 진실이고 캔버스 좌표는 표현 상태다. (스펙 §5.4)
 * placements 를 지우거나 옮겨도 nodes/edges 는 변하지 않는다.
 *
 * 저장은 localStorage 한 곳. 계정·서버 DB 없음 (스펙 §25, P2).
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  EdgeType,
  EvidenceCandidate,
  Placement,
  Project,
  ReasoningNode,
  SemanticEdge,
  Source,
} from "./types";
import { KIND, type Kind, kindFromId, typeOf } from "./labels";
import { titleOf } from "./md";
import {
  DEMO_PROBLEM,
  DEMO_PROJECT_NAME,
  DEMO_POS,
  DEMO_SOURCE,
  demoEdges,
  demoNodes,
} from "./demo";

/** 되돌리기 대상. 의미 그래프와 배치만 담는다 — 패널·선택은 화면 상태라 빠진다. */
export interface Snapshot {
  nodes: ReasoningNode[];
  edges: SemanticEdge[];
  placements: Record<string, Placement>;
}

export interface Doc {
  nodes: ReasoningNode[];
  edges: SemanticEdge[];
  sources: Source[];
  placements: Record<string, Placement>;
  candidates: EvidenceCandidate[];
  undo: Snapshot[];
  redo: Snapshot[];
  /** 알고도 수용하기로 한 어긋남. 사용자가 명시적으로 눌러야 들어간다 (스펙 §17.1). */
  acknowledged: string[];
  /** 인계 화면에서 사람이 직접 체크한 항목. */
  checks: Record<string, boolean>;
  changedAt: number;
  genAt: number;
}

interface DocState {
  projects: Project[];
  docs: Record<string, Doc>;

  createProject: (problemStatement: string, name?: string) => string;
  createDemoProject: () => string;
  /**
   * 고른 카드들을 같은 캔버스 옆자리에 복제한다.
   * 원본과 고르지 않은 카드는 그대로 두고, 고른 것들 사이의 관계만 복제본에도 잇는다.
   */
  duplicateNodes: (pid: string, ids: string[]) => string[];
  /** 휴지통으로. 데이터는 그대로 두고 deletedAt 만 찍는다. */
  trashProject: (pid: string) => void;
  restoreProject: (pid: string) => void;
  /** 영구 삭제. 휴지통에서만 부른다. */
  deleteProject: (pid: string) => void;
  /** 30일 지난 휴지통 항목을 비운다. 대시보드가 열릴 때 부른다. */
  purgeTrash: () => void;
  /** 전체 백업. 되돌리기 이력은 빼고 프로젝트·문서만 담는다. */
  exportAll: () => string;
  /** 백업 파일을 합친다. 같은 id 는 파일 쪽으로 덮어쓴다. 읽을 수 없으면 false. */
  importAll: (json: string) => boolean;
  renameProject: (pid: string, name: string) => void;

  nextId: (pid: string, kind: Kind) => string;
  addNode: (
    pid: string,
    input: { kind: Kind; md: string; at: Placement; proposed?: boolean; node?: Partial<ReasoningNode> },
  ) => string;
  patchNode: (pid: string, id: string, patch: Partial<ReasoningNode>) => void;
  moveNode: (pid: string, id: string, at: Placement) => void;
  deleteNode: (pid: string, id: string) => void;

  addEdge: (pid: string, e: Omit<SemanticEdge, "id">) => string;
  patchEdge: (pid: string, id: string, patch: Partial<SemanticEdge>) => void;
  removeEdge: (pid: string, id: string) => void;

  addSource: (pid: string, s: Source) => void;
  /** 자료를 지운다. 그 자료에서 뽑은 근거는 남고, 출처가 없다고 표시된다 (스펙 §5.5). */
  deleteSource: (pid: string, id: string) => void;
  patchSource: (pid: string, id: string, patch: Partial<Source>) => void;

  setCandidates: (pid: string, c: EvidenceCandidate[]) => void;
  patchCandidate: (pid: string, id: string, patch: Partial<EvidenceCandidate>) => void;
  /** 승인해야만 실선 Evidence 노드와 관계가 생긴다 (핸드오프 §7). */
  approveCandidate: (pid: string, id: string, at?: Placement) => string | null;

  acknowledgeConflict: (pid: string, key: string) => void;
  toggleCheck: (pid: string, key: string) => void;
  markGenerated: (pid: string) => void;

  /** 구조가 바뀌기 직전에 부른다. 텍스트 편집은 담지 않는다. */
  pushHistory: (pid: string) => void;
  undoStep: (pid: string) => boolean;
  redoStep: (pid: string) => boolean;
  setCollapsed: (pid: string, id: string, collapsed: boolean) => void;
}

const now = () => new Date().toISOString();

const emptyDoc = (): Doc => ({
  nodes: [],
  edges: [],
  sources: [],
  placements: {},
  candidates: [],
  undo: [],
  redo: [],
  acknowledged: [],
  checks: {},
  changedAt: Date.now(),
  genAt: 0,
});

const snapshotOf = (d: Doc): Snapshot => ({
  nodes: d.nodes,
  edges: d.edges,
  placements: d.placements,
});

/** 한 번의 사용자 행동이 여러 변경을 부를 때 중간 스냅샷이 쌓이지 않게 막는다. */
let suppressHistory = false;

/** 제목이 길면 프로젝트 이름으로 앞부분만 쓴다. */
function deriveName(statement: string) {
  const one = statement.trim().split("\n")[0];
  return one.length > 28 ? one.slice(0, 28) + "…" : one || "제목 없는 프로젝트";
}

export const useDoc = create<DocState>()(
  persist(
    (set, get) => {
      /** doc 을 갈아끼우면서 changedAt 을 같이 올린다. 인계 미리보기 오래됨 판정에 쓰인다. */
      const edit = (pid: string, fn: (d: Doc) => Partial<Doc>) =>
        set((s) => {
          const doc = s.docs[pid];
          if (!doc) return s;
          return {
            docs: { ...s.docs, [pid]: { ...doc, ...fn(doc), changedAt: Date.now() } },
            projects: s.projects.map((p) => (p.id === pid ? { ...p, updatedAt: now() } : p)),
          };
        });

      return {
        projects: [],
        docs: {},

        createProject: (problemStatement, name) => {
          const pid = "prj-" + Math.random().toString(36).slice(2, 9);
          const at = now();
          const doc = emptyDoc();
          doc.nodes = [
            {
              id: "P-01",
              type: "problem",
              md: "# " + problemStatement.trim() + "\n",
              createdAt: at,
              updatedAt: at,
            },
          ];
          doc.placements = { "P-01": { x: 72, y: 48 } };
          set((s) => ({
            projects: [
              { id: pid, name: name ?? deriveName(problemStatement), problemStatement, createdAt: at, updatedAt: at },
              ...s.projects,
            ],
            docs: { ...s.docs, [pid]: doc },
          }));
          return pid;
        },

        createDemoProject: () => {
          const pid = "prj-demo-" + Math.random().toString(36).slice(2, 7);
          const at = now();
          const doc = emptyDoc();
          doc.nodes = demoNodes();
          doc.edges = demoEdges();
          doc.sources = [DEMO_SOURCE];
          doc.placements = {
            ...Object.fromEntries(doc.nodes.map((n) => [n.id, DEMO_POS[n.id] ?? { x: 72, y: 48 }])),
            // 자료도 캔버스 위에 아이콘으로 놓인다.
            [DEMO_SOURCE.id]: { x: 1496, y: 48 },
          };
          set((s) => ({
            projects: [
              {
                id: pid,
                name: DEMO_PROJECT_NAME,
                problemStatement: DEMO_PROBLEM,
                demo: true,
                createdAt: at,
                updatedAt: at,
              },
              ...s.projects,
            ],
            docs: { ...s.docs, [pid]: doc },
          }));
          return pid;
        },

        duplicateNodes: (pid, ids) => {
          const doc = get().docs[pid];
          if (!doc || !ids.length) return [];

          const picked = new Set(ids);
          const nodes = doc.nodes.filter((n) => picked.has(n.id));
          const sources = doc.sources.filter((s) => picked.has(s.id));
          if (!nodes.length && !sources.length) return [];

          // 복제본을 원본 오른쪽 빈 곳에 통째로 옮겨 놓는다.
          const spots = [...nodes, ...sources].map((x) => doc.placements[x.id]).filter(Boolean);
          const right = Math.max(...Object.values(doc.placements).map((p) => p.x + 288));
          const minX = Math.min(...spots.map((p) => p.x));
          const minY = Math.min(...spots.map((p) => p.y));
          const dx = right + 120 - minX;
          const dy = 0;

          get().pushHistory(pid);
          suppressHistory = true;

          const ts = now();
          const idMap: Record<string, string> = {};
          const counters: Record<string, number> = {};
          const nextFree = (kind: Kind) => {
            const prefix = KIND[kind].prefix;
            const used = get()
              .docs[pid]!.nodes.filter((n) => n.id.startsWith(prefix + "-"))
              .map((n) => parseInt(n.id.slice(prefix.length + 1), 10))
              .filter((n) => !Number.isNaN(n));
            const base = used.length ? Math.max(...used) : 0;
            counters[prefix] = (counters[prefix] ?? 0) + 1;
            return prefix + "-" + String(base + counters[prefix]).padStart(2, "0");
          };

          const newNodes = nodes.map((n) => {
            const id = nextFree(kindFromId(n.id));
            idMap[n.id] = id;
            return { ...n, id, createdAt: ts, updatedAt: ts };
          });

          const newSources: Source[] = sources.map((s) => {
            const id = "src-" + Math.random().toString(36).slice(2, 9);
            idMap[s.id] = id;
            const copy: Source = { ...s, id, createdAt: ts };
            delete copy.attachedTo;
            return copy;
          });

          // 붙어 있던 자료는 복제본 카드에 다시 붙인다
          for (const s of newSources) {
            const origin = sources.find((x) => idMap[x.id] === s.id);
            if (origin?.attachedTo && idMap[origin.attachedTo]) s.attachedTo = idMap[origin.attachedTo];
          }
          for (const n of newNodes) {
            if (n.sourceId && idMap[n.sourceId]) n.sourceId = idMap[n.sourceId];
          }

          const newEdges = doc.edges
            .filter((e) => idMap[e.from] && idMap[e.to])
            .map((e) => ({
              ...e,
              id: idMap[e.from] + ">" + idMap[e.to] + ":" + e.type,
              from: idMap[e.from],
              to: idMap[e.to],
            }));

          const placements: Record<string, Placement> = {};
          for (const [oldId, newId] of Object.entries(idMap)) {
            const at = doc.placements[oldId];
            if (at) placements[newId] = { ...at, x: at.x + dx, y: at.y + dy };
          }

          edit(pid, (d) => ({
            nodes: [...d.nodes, ...newNodes],
            sources: [...d.sources, ...newSources],
            edges: [...d.edges, ...newEdges],
            placements: { ...d.placements, ...placements },
          }));

          suppressHistory = false;
          return Object.values(idMap);
        },

        trashProject: (pid) =>
          set((s) => ({ projects: s.projects.map((p) => (p.id === pid ? { ...p, deletedAt: now() } : p)) })),

        restoreProject: (pid) =>
          set((s) => ({
            projects: s.projects.map((p) => (p.id === pid ? { ...p, deletedAt: undefined, updatedAt: now() } : p)),
          })),

        deleteProject: (pid) =>
          set((s) => {
            const docs = { ...s.docs };
            delete docs[pid];
            return { projects: s.projects.filter((p) => p.id !== pid), docs };
          }),

        purgeTrash: () => {
          const cut = Date.now() - 30 * 24 * 60 * 60 * 1000;
          for (const p of get().projects) if (p.deletedAt && new Date(p.deletedAt).getTime() < cut) get().deleteProject(p.id);
        },

        exportAll: () => {
          const { projects, docs } = get();
          const slim = Object.fromEntries(Object.entries(docs).map(([k, d]) => [k, { ...d, undo: [], redo: [] }]));
          return JSON.stringify({ app: "motive", version: 1, exportedAt: now(), projects, docs: slim }, null, 2);
        },

        importAll: (json) => {
          let data: { app?: string; projects?: Project[]; docs?: Record<string, Doc> };
          try {
            data = JSON.parse(json);
          } catch {
            return false;
          }
          if (data.app !== "motive" || !Array.isArray(data.projects) || !data.docs) return false;
          const incoming = data.projects;
          const docs = data.docs;
          set((s) => {
            const ids = new Set(incoming.map((p) => p.id));
            return {
              projects: [...incoming, ...s.projects.filter((p) => !ids.has(p.id))],
              docs: { ...s.docs, ...Object.fromEntries(Object.entries(docs).map(([k, d]) => [k, { ...emptyDoc(), ...d, undo: [], redo: [] }])) },
            };
          });
          return true;
        },

        renameProject: (pid, name) =>
          set((s) => ({
            projects: s.projects.map((p) => (p.id === pid ? { ...p, name, updatedAt: now() } : p)),
          })),

        nextId: (pid, kind) => {
          const prefix = KIND[kind].prefix;
          const used = (get().docs[pid]?.nodes ?? [])
            .filter((n) => n.id.startsWith(prefix + "-"))
            .map((n) => parseInt(n.id.slice(prefix.length + 1), 10))
            .filter((n) => !Number.isNaN(n));
          const next = (used.length ? Math.max(...used) : 0) + 1;
          return prefix + "-" + String(next).padStart(2, "0");
        },

        addNode: (pid, { kind, md, at, proposed, node }) => {
          get().pushHistory(pid);
          const id = get().nextId(pid, kind);
          const ts = now();
          edit(pid, (d) => ({
            nodes: [
              ...d.nodes,
              { id, ...typeOf(kind), md, proposed, createdAt: ts, updatedAt: ts, ...node } as ReasoningNode,
            ],
            placements: { ...d.placements, [id]: at },
          }));
          return id;
        },

        patchNode: (pid, id, patch) =>
          edit(pid, (d) => ({
            nodes: d.nodes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: now() } : n)),
          })),

        // 좌표만 바꾼다. 관계는 건드리지 않는다.
        moveNode: (pid, id, at) => edit(pid, (d) => ({ placements: { ...d.placements, [id]: at } })),

        deleteNode: (pid, id) => {
          get().pushHistory(pid);
          edit(pid, (d) => {
            const placements = { ...d.placements };
            delete placements[id];
            return {
              nodes: d.nodes.filter((n) => n.id !== id),
              edges: d.edges.filter((e) => e.from !== id && e.to !== id),
              placements,
            };
          });
        },

        addEdge: (pid, e) => {
          get().pushHistory(pid);
          const id = e.from + ">" + e.to + ":" + e.type;
          edit(pid, (d) => (d.edges.some((x) => x.id === id) ? {} : { edges: [...d.edges, { ...e, id }] }));
          return id;
        },

        patchEdge: (pid, id, patch) =>
          edit(pid, (d) => ({ edges: d.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),

        removeEdge: (pid, id) => {
          get().pushHistory(pid);
          edit(pid, (d) => ({ edges: d.edges.filter((e) => e.id !== id) }));
        },

        addSource: (pid, s) => edit(pid, (d) => ({ sources: [...d.sources, s] })),

        deleteSource: (pid, id) => {
          get().pushHistory(pid);
          edit(pid, (d) => {
            const placements = { ...d.placements };
            delete placements[id];
            return {
              sources: d.sources.filter((s) => s.id !== id),
              candidates: d.candidates.filter((c) => c.sourceId !== id),
              placements,
            };
          });
        },

        patchSource: (pid, id, patch) =>
          edit(pid, (d) => ({ sources: d.sources.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),

        setCandidates: (pid, c) => edit(pid, () => ({ candidates: c })),

        patchCandidate: (pid, id, patch) =>
          edit(pid, (d) => ({ candidates: d.candidates.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),

        approveCandidate: (pid, id, at) => {
          const doc = get().docs[pid];
          const c = doc?.candidates.find((x) => x.id === id);
          if (!c || c.mismatch || c.state === "approved") return null;

          const source = doc.sources.find((s) => s.id === c.sourceId);
          const place = at ?? nextFreeSpot(doc, doc.placements[c.targetId] ?? { x: 72, y: 48 });

          const md = [
            "# “" + c.quote + "”",
            "",
            "## 원문 인용",
            "> " + c.quote,
            "",
            "## 출처",
            (source?.name ?? "알 수 없는 자료") + " · 줄 " + c.line + (source?.tag ? " (" + source.tag + ")" : ""),
            "",
            "## 해석",
            c.claim,
            "",
            "## 한계",
            c.limit,
            "",
          ].join("\n");

          get().pushHistory(pid);
          suppressHistory = true;
          const evidenceId = get().addNode(pid, {
            kind: "evidence",
            md,
            at: place,
            node: {
              sourceId: c.sourceId,
              sourceLocator: { line: c.line, excerpt: c.quote, verified: true },
            },
          });
          get().addEdge(pid, { from: evidenceId, to: c.targetId, type: c.edgeType });
          get().patchCandidate(pid, id, { state: "approved", approvedAs: evidenceId });
          suppressHistory = false;
          return evidenceId;
        },

        acknowledgeConflict: (pid, key) =>
          edit(pid, (d) => (d.acknowledged.includes(key) ? {} : { acknowledged: [...d.acknowledged, key] })),

        toggleCheck: (pid, key) =>
          set((s) => {
            const doc = s.docs[pid];
            if (!doc) return s;
            // 체크는 문서 내용을 바꾸지 않으므로 changedAt 을 올리지 않는다(미리보기가 오래되지 않음).
            return {
              docs: { ...s.docs, [pid]: { ...doc, checks: { ...doc.checks, [key]: !doc.checks[key] } } },
            };
          }),

        markGenerated: (pid) =>
          set((s) => {
            const doc = s.docs[pid];
            if (!doc) return s;
            return { docs: { ...s.docs, [pid]: { ...doc, genAt: Date.now() } } };
          }),

        pushHistory: (pid) =>
          set((s) => {
            const doc = s.docs[pid];
            if (!doc || suppressHistory) return s;
            return {
              docs: {
                ...s.docs,
                [pid]: { ...doc, undo: [...doc.undo.slice(-49), snapshotOf(doc)], redo: [] },
              },
            };
          }),

        undoStep: (pid) => {
          const doc = get().docs[pid];
          if (!doc?.undo.length) return false;
          const prev = doc.undo[doc.undo.length - 1];
          set((s) => ({
            docs: {
              ...s.docs,
              [pid]: {
                ...doc,
                ...prev,
                undo: doc.undo.slice(0, -1),
                redo: [...doc.redo, snapshotOf(doc)],
                changedAt: Date.now(),
              },
            },
          }));
          return true;
        },

        redoStep: (pid) => {
          const doc = get().docs[pid];
          if (!doc?.redo.length) return false;
          const next = doc.redo[doc.redo.length - 1];
          set((s) => ({
            docs: {
              ...s.docs,
              [pid]: {
                ...doc,
                ...next,
                redo: doc.redo.slice(0, -1),
                undo: [...doc.undo, snapshotOf(doc)],
                changedAt: Date.now(),
              },
            },
          }));
          return true;
        },

        setCollapsed: (pid, id, collapsed) =>
          set((s) => {
            const doc = s.docs[pid];
            const at = doc?.placements[id];
            if (!doc || !at) return s;
            return {
              docs: {
                ...s.docs,
                [pid]: { ...doc, placements: { ...doc.placements, [id]: { ...at, collapsed } } },
              },
            };
          }),
      };
    },
    { name: "motive.doc.v1", version: 1 },
  ),
);

/** 겹치지 않는 자리를 찾는다. 기존 카드 배치를 흐트러뜨리지 않는다 (스펙 §12.2). */
export function nextFreeSpot(doc: Doc, near: Placement): Placement {
  const taken = Object.values(doc.placements);
  // 카드가 기본으로 펼쳐지므로 세로로 넉넉히 띄운다.
  const hit = (p: Placement) => taken.some((t) => Math.abs(t.x - p.x) < 320 && Math.abs(t.y - p.y) < 320);
  const ring: Placement[] = [
    { x: near.x, y: near.y + 400 },
    { x: near.x + 364, y: near.y },
    { x: near.x - 364, y: near.y },
    { x: near.x + 364, y: near.y + 400 },
    { x: near.x - 364, y: near.y + 400 },
    { x: near.x, y: near.y + 800 },
  ];
  for (const p of ring) if (!hit(p) && p.x >= 0 && p.y >= 0) return p;
  return { x: near.x + 364, y: near.y + 800 };
}

/* ── 조회 헬퍼 ── */

export const nodeTitle = (n: ReasoningNode) => titleOf(n.md) || "(제목 없음)";

export const kindOfId = kindFromId;

export function edgesOf(doc: Doc, id: string) {
  return doc.edges.filter((e) => e.from === id || e.to === id);
}

export function findNode(doc: Doc, id: string) {
  return doc.nodes.find((n) => n.id === id);
}

export type { EdgeType };
