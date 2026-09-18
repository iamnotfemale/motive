"use client";

/**
 * CMP-07 상세 / Markdown. 폭 400, 비모달.
 *
 * 노드 본문은 md 문자열 하나가 유일한 소스다. 작성 모드는 `##` 섹션을 필드로 그릴 뿐,
 * 별도 문서를 만들지 않는다 (핸드오프 §7, 스펙 §13).
 */
import { useMemo, useRef } from "react";
import { toast } from "sonner";
import { Badge, Btn, Dot, Mono, Notice, TypeIcon } from "@/components/kit";
import { SAVE } from "@/components/WorkspaceHeader";
import { PanelClose, SidePanel } from "./Panel";
import { BlockEditor } from "@/components/BlockEditor";
import { parseMd, setTitle, titleOf } from "@/lib/md";
import { KIND, edgeLabel, kindOf } from "@/lib/labels";
import { findNode, nodeTitle, useDoc } from "@/lib/store";
import { flashSaved, useUi } from "@/lib/ui";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "content", ko: "내용" },
  { key: "links", ko: "연결" },
  { key: "sources", ko: "출처" },
] as const;

export function Inspector({ pid }: { pid: string }) {
  const doc = useDoc((s) => s.docs[pid]);
  const patchNode = useDoc((s) => s.patchNode);
  const ui = useUi();
  const id = ui.sel[0];
  const node = doc && id ? findNode(doc, id) : undefined;

  const mdRef = useRef<HTMLTextAreaElement>(null);

  const parsed = useMemo(() => (node ? parseMd(node.md) : null), [node]);

  if (!doc || !node || !parsed) return null;

  const kind = kindOf(node);
  const meta = KIND[kind];
  const save = SAVE[ui.save];

  function write(md: string) {
    patchNode(pid, node!.id, { md });
    flashSaved();
  }

  const links = doc.edges
    .filter((e) => e.from === node.id || e.to === node.id)
    .map((e) => {
      const outgoing = e.from === node.id;
      const otherId = outgoing ? e.to : e.from;
      const other = findNode(doc, otherId);
      return { edge: e, outgoing, otherId, other };
    });

  const source = doc.sources.find((s) => s.id === node.sourceId);
  const sourceMissing = Boolean(node.sourceId && !source);

  return (
    <SidePanel testId="inspector">
      <div className="flex flex-col gap-2.5 px-5 pt-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted">
            <TypeIcon d={meta.icon} />
            {meta.ko}
          </span>
          <Mono>{node.id}</Mono>
          {node.proposed && <Badge tone="warn">미확정</Badge>}
          <span className="flex-1" />
          <Btn
            variant="ghost"
            size="sm"
            onClick={() => useUi.getState().setFocusView(node.id)}
            title="이 카드 주변 추론만 보기"
          >
            주변만 보기
          </Btn>
          <PanelClose onClose={() => useUi.getState().closePanel()} />
        </div>

        <textarea
          value={titleOf(node.md)}
          rows={2}
          placeholder="제목을 입력하세요"
          aria-label="카드 제목"
          onChange={(e) => write(setTitle(node.md, e.target.value))}
          className="kr field-sizing-content w-full resize-none border-0 bg-transparent p-0 text-[15px] leading-6 font-semibold text-ink placeholder:font-normal placeholder:text-faint"
        />

        <div className="-mx-5 flex gap-0.5 border-b border-line px-5">
          {TABS.map((t) => {
            const on = ui.inspTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => useUi.getState().setInspTab(t.key)}
                className={cn(
                  "relative h-8 px-2.5 text-[13px] font-medium",
                  on ? "text-ink" : "text-muted hover:text-ink",
                )}
              >
                {t.ko}
                {on && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-ink" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto px-5 py-4">
        {ui.inspTab === "content" && (
          <>
            <div className="flex items-center gap-2">
              <div className="flex rounded-[6px] bg-wash p-0.5">
                {(["write", "md"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => useUi.getState().setEditMode(m)}
                    className={cn(
                      "h-7 rounded-[6px] px-2.5 text-[13px] font-medium transition-colors duration-[120ms]",
                      ui.editMode === m
                        ? "bg-surface text-ink shadow-[0_1px_2px_rgba(24,24,27,.08)]"
                        : "text-muted hover:text-ink",
                    )}
                  >
                    {m === "write" ? "작성" : "Markdown"}
                  </button>
                ))}
              </div>
              <span className="flex-1" />
              {ui.editMode === "write" && (
                <span className="text-[11px] text-faint">
                  <span className="font-mono">/</span> 로 블록 고르기
                </span>
              )}
            </div>

            {ui.editMode === "write" ? (
              <BlockEditor
                nodeId={node.id}
                title={titleOf(node.md)}
                md={node.md}
                onChange={write}
              />
            ) : (
              <div className="flex flex-col gap-2">
                <textarea
                  ref={mdRef}
                  value={node.md}
                  rows={22}
                  spellCheck={false}
                  onChange={(e) => write(e.target.value)}
                  className="w-full resize-y rounded-[6px] border border-line bg-wash-2 px-3.5 py-3 font-mono text-[13px] leading-5 text-ink transition-[border-color,box-shadow] duration-[120ms] focus:border-brand focus:shadow-[0_0_0_3px_#f4f4f5]"
                />
                <p className="text-[12px] leading-4 text-muted">
                  첫 <code className="font-mono">#</code> 줄이 카드 제목이에요. 나머지는 작성 모드의
                  블록과 그대로 대응해요.
                </p>
              </div>
            )}

            {parsed.unsupported && (
              <Notice
                tone="warn"
                actions={
                  <Btn size="sm" onClick={() => useUi.getState().setEditMode("md")}>
                    Markdown 열기
                  </Btn>
                }
              >
                작성 모드가 지원하지 않는 문법(표·HTML)이 있어요. 원문은 그대로 유지돼요.
              </Notice>
            )}
          </>
        )}

        {ui.inspTab === "links" && (
          <div className="flex flex-col gap-1.5">
            {links.length === 0 && (
              <div className="rounded-[6px] border border-dashed border-line p-4 text-center text-[13px] text-muted">
                아직 연결이 없어요. 캔버스에서 카드 액션으로 연결할 수 있어요.
              </div>
            )}
            {links.map(({ edge, outgoing, otherId, other }) => (
              <button
                key={edge.id}
                type="button"
                onClick={() => useUi.getState().select([otherId])}
                className="flex items-center gap-2.5 rounded-[6px] border border-line bg-surface px-3 py-2.5 text-left text-[13px] leading-[18px] hover:bg-wash-2"
              >
                <span className="shrink-0 font-mono text-[11px] text-muted">
                  {outgoing ? `${node.id} →` : `→ ${node.id}`}
                </span>
                <span className="min-w-0 flex-1 truncate">{other ? nodeTitle(other) : otherId}</span>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] text-muted">
                  {edge.type === "contradicts" && <Dot tone="danger" />}
                  {edgeLabel(edge, findNode(doc, edge.to))}
                </span>
              </button>
            ))}
          </div>
        )}

        {ui.inspTab === "sources" &&
          (node.sourceId ? (
            <div className="flex flex-col gap-1.5 rounded-[6px] border border-line p-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[13px]">{source?.name ?? "알 수 없는 자료"}</span>
                {source?.tag && <Badge>{source.tag}</Badge>}
                <span className="flex-1" />
                {node.sourceLocator?.line && (
                  <span className="text-[12px] text-muted">줄 {node.sourceLocator.line}</span>
                )}
              </div>

              {sourceMissing ? (
                <>
                  <div className="mt-1 flex items-center gap-2.5 text-[13px] leading-[18px] text-danger">
                    <Dot tone="danger" />이 근거의 원본 자료를 찾을 수 없어요.
                  </div>
                  <div className="mt-1 flex gap-1.5">
                    <Btn size="sm" onClick={() => useUi.getState().openLeft("sources")}>
                      자료 다시 연결
                    </Btn>
                    <Btn variant="ghost" size="sm" onClick={() => toast("인계 문서에 상태로 남아요")}>
                      인계에서 상태 표시
                    </Btn>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 text-[12px] text-ok">
                    <Dot tone="ok" />
                    {node.sourceLocator?.verified ? "원문에서 인용 확인됨" : "원문 확인 필요"}
                  </div>
                  {node.sourceLocator?.excerpt && (
                    <p className="kr mt-1 rounded-[6px] bg-wash px-3 py-2 text-[13px] leading-[22px]">
                      {node.sourceLocator.excerpt}
                    </p>
                  )}
                  <Btn
                    size="sm"
                    className="mt-1 self-start"
                    onClick={() => {
                      if (!node.sourceId) return;
                      useUi.getState().setReview({
                        sourceId: node.sourceId,
                        step: "source",
                        targetId: node.id,
                        pickedLine: node.sourceLocator?.line ?? null,
                        backTo: "source",
                      });
                      useUi.getState().openPanel("review");
                    }}
                  >
                    원문 보기
                  </Btn>
                </>
              )}
            </div>
          ) : (
            <div className="rounded-[6px] border border-dashed border-line p-4 text-center text-[13px] text-muted">
              이 블록에 연결된 출처가 없어요. 자료를 카드에 드롭하면 여기에 나타나요.
            </div>
          ))}
      </div>

      <div className="flex min-h-10 items-center gap-2.5 border-t border-line px-5 py-2.5 text-[12px] leading-4">
        <Dot tone={save.tone} />
        <span className={cn("flex-1", save.tone === "danger" ? "text-danger" : "text-muted")}>
          {save.long}
        </span>
        {ui.save === "failed" && (
          <>
            <Btn size="sm" onClick={() => flashSaved()}>
              재시도
            </Btn>
            <Btn
              variant="ghost"
              size="sm"
              onClick={() => {
                void navigator.clipboard?.writeText(node.md);
                toast("작성 내용을 복사했어요");
              }}
            >
              작성 내용 복사
            </Btn>
          </>
        )}
      </div>
    </SidePanel>
  );
}
