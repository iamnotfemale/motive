"use client";

/**
 * 콜드스타트 — 답보다 불확실성을 먼저 꺼낸다 (스펙 §11).
 *
 * 일반적인 브레인스토밍을 채우지 않는다. 세 묶음만 낸다:
 * 지금 안다고 보는 것 / 아직 모르는 것 / 생각을 바꿀 조건.
 *
 * 근거(Evidence)는 만들지 않는다 — 자료가 없으므로 지어낼 수 없다 (§11.3).
 * 사용자가 고른 것만 카드가 된다.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge, Btn, FieldLabel, Indeterminate, Notice } from "@/components/kit";
import { PanelClose, SidePanel } from "./Panel";
import { Checkbox } from "@/components/ui/checkbox";
import { coldStart, type ColdStart } from "@/lib/ai";
import { parseMd, serializeMd } from "@/lib/md";
import { findNode, nextFreeSpot, useDoc } from "@/lib/store";
import { flashSaved, useUi } from "@/lib/ui";

type Picked = Record<string, boolean>;

export function ColdStartPanel({ pid }: { pid: string }) {
  const doc = useDoc((s) => s.docs[pid]);
  const store = useDoc.getState;

  const [data, setData] = useState<ColdStart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [picked, setPicked] = useState<Picked>({});

  const problem = doc?.nodes.find((n) => n.type === "problem");
  const statement = problem ? parseMd(problem.md).title : "";

  const load = useCallback(async () => {
    if (!statement) return;
    setBusy(true);
    setError(null);
    const res = await coldStart(statement);
    setBusy(false);
    if (!res.ok) {
      if (res.aiOff) useUi.getState().setAiOff(true);
      setError(
        res.aiOff
          ? "AI가 연결되지 않았어요. 가설과 검토 질문을 직접 추가할 수 있어요."
          : res.message,
      );
      return;
    }
    setData(res.data);
    // 기본값은 전부 켜두되, 확정은 아래 버튼을 눌러야 일어난다.
    setPicked(
      Object.fromEntries([
        ...res.data.claims.map((_, i) => [`c${i}`, true]),
        ...res.data.questions.map((_, i) => [`q${i}`, true]),
        ...res.data.mindChangeConditions.map((_, i) => [`m${i}`, true]),
      ]),
    );
  }, [statement]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!doc || !problem) return null;

  const count = Object.values(picked).filter(Boolean).length;

  function commit() {
    if (!data || !doc || !problem) return;
    const anchor = doc.placements[problem.id] ?? { x: 72, y: 48 };
    let added = 0;

    data.claims.forEach((c, i) => {
      if (!picked[`c${i}`]) return;
      const at = nextFreeSpot(useDoc.getState().docs[pid]!, anchor);
      const id = store().addNode(pid, {
        kind: "claim",
        md: `# ${c.text}\n\n## 본문\n${c.reason}\n\n## 검증 계획\n\n\n## 결과 기록\n아직 없음.\n\n## 검토 상태\n미검증 — 문제 진술에서 추론한 가정이에요.\n`,
        at,
        node: { status: "unverified" },
      });
      store().addEdge(pid, { from: problem.id, to: id, type: "investigates" });
      added += 1;
    });

    data.questions.forEach((q, i) => {
      if (!picked[`q${i}`]) return;
      const at = nextFreeSpot(useDoc.getState().docs[pid]!, anchor);
      store().addNode(pid, {
        kind: "question",
        md: `# ${q.text}\n\n## 상태\n열림\n\n## 왜 중요한가\n${q.whyItMatters}\n`,
        at,
        node: { status: "open" },
      });
      added += 1;
    });

    // 생각을 바꿀 조건은 노드 유형이 아니다. 문제 카드에 섹션으로 붙여 맥락과 같이 남긴다.
    const conditions = data.mindChangeConditions.filter((_, i) => picked[`m${i}`]).map((m) => m.text);
    if (conditions.length) {
      const current = findNode(useDoc.getState().docs[pid]!, problem.id)!;
      const parsed = parseMd(current.md);
      const body = conditions.map((t) => `- ${t}`).join("\n");
      const i = parsed.sections.findIndex((s) => s.h === "생각을 바꿀 조건");
      const sections =
        i === -1
          ? [...parsed.sections, { h: "생각을 바꿀 조건", body, kind: "list" as const }]
          : parsed.sections.map((s, n) =>
              n === i ? { ...s, body: [s.body, body].filter(Boolean).join("\n") } : s,
            );
      store().patchNode(pid, problem.id, { md: serializeMd({ ...parsed, sections }) });
      added += conditions.length;
    }

    flashSaved();
    useUi.getState().closePanel();
    toast(`${added}개 항목을 캔버스에 올렸어요`, {
      description: "전부 추론한 가정이에요. 근거는 아직 없어요.",
    });
  }

  return (
    <SidePanel testId="coldstart">
      <div className="flex items-center gap-2 border-b border-line px-5 py-4">
        <span className="font-semibold">불확실한 것부터 정리</span>
        <Badge tone="warn">미확정</Badge>
        <span className="flex-1" />
        <PanelClose onClose={() => useUi.getState().closePanel()} />
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto px-5 py-4">
        <p className="kr rounded-[6px] bg-wash px-3 py-2.5 text-[13px] leading-[22px]">{statement}</p>

        {busy && (
          <div className="flex flex-col gap-2.5 rounded-[8px] border border-line p-4">
            <span className="text-[13px] font-medium">문제 진술에서 가정과 빈칸을 찾는 중</span>
            <Indeterminate />
            <p className="text-[12px] leading-[18px] text-muted">
              답을 만들지 않아요. 지금 무엇을 모르는지만 꺼내요.
            </p>
          </div>
        )}

        {error && (
          <Notice
            tone="warn"
            actions={
              <Btn size="sm" onClick={() => void load()}>
                다시 시도
              </Btn>
            }
          >
            {error}
          </Notice>
        )}

        {data && (
          <>
            <Group
              label="지금 안다고 보는 것"
              hint="문제 진술에 이미 들어 있는 가정이에요. 사실이 아니라 추론이에요."
              items={data.claims.map((c, i) => ({ key: `c${i}`, text: c.text, sub: c.reason }))}
              picked={picked}
              onToggle={(k) => setPicked((p) => ({ ...p, [k]: !p[k] }))}
            />
            <Group
              label="아직 모르는 것"
              hint="답에 따라 방향이 달라지는 질문이에요."
              items={data.questions.map((q, i) => ({ key: `q${i}`, text: q.text, sub: q.whyItMatters }))}
              picked={picked}
              onToggle={(k) => setPicked((p) => ({ ...p, [k]: !p[k] }))}
            />
            <Group
              label="생각을 바꿀 조건"
              hint="이것이 나오면 지금 틀을 버려야 해요. 문제 카드에 적힙니다."
              items={data.mindChangeConditions.map((m, i) => ({ key: `m${i}`, text: m.text }))}
              picked={picked}
              onToggle={(k) => setPicked((p) => ({ ...p, [k]: !p[k] }))}
            />
          </>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-line px-5 py-3">
        <span className="flex-1 text-[12px] text-muted">
          {data ? `${count}개 선택됨` : "확정하기 전에는 캔버스에 올라가지 않아요"}
        </span>
        <Btn onClick={() => useUi.getState().closePanel()}>나중에</Btn>
        <Btn variant="ink" disabled={!data || count === 0} onClick={commit}>
          선택한 항목 올리기
        </Btn>
      </div>
    </SidePanel>
  );
}

function Group({
  label,
  hint,
  items,
  picked,
  onToggle,
}: {
  label: string;
  hint: string;
  items: { key: string; text: string; sub?: string }[];
  picked: Picked;
  onToggle: (key: string) => void;
}) {
  if (!items.length) return null;
  return (
    <section className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <p className="kr text-[12px] leading-[18px] text-muted">{hint}</p>
      {items.map((it) => (
        <label
          key={it.key}
          className="flex cursor-pointer items-start gap-2.5 rounded-[6px] border border-dashed border-line p-3 hover:bg-wash-2"
        >
          <Checkbox
            checked={Boolean(picked[it.key])}
            onCheckedChange={() => onToggle(it.key)}
            className="mt-0.5"
          />
          <span className="flex flex-col gap-1">
            <span className="kr text-[13px] leading-5">{it.text}</span>
            {it.sub && <span className="kr text-[12px] leading-[18px] text-muted">{it.sub}</span>}
          </span>
        </label>
      ))}
    </section>
  );
}
