"use client";

/**
 * 왼쪽 레일과 그 옆에서 밀려나오는 패널.
 *
 * 문서 트리가 아니다 (스펙 §22). 자료함은 목록일 뿐이고, 검색은 창을 띄우지 않고
 * 레일 바로 옆에서 바로 친다.
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { FolderOpen, Grid2x2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Badge, Btn, Dot, Spinner } from "@/components/kit";
import { Icon } from "@/components/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { extractUrl } from "@/lib/extract";
import { autoSummarize } from "@/lib/ai";
import { KIND, kindOf } from "@/lib/labels";
import { RAIL_ACTIONS, type ActionKey } from "@/lib/phases";
import { nextFreeSpot, nodeTitle, useDoc } from "@/lib/store";
import { flashSaved, useUi, type LeftPanel } from "@/lib/ui";
import type { Phase, SourceState } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATE: Record<SourceState, { ko: string; tone: "ok" | "warn" | "muted" | "danger" }> = {
  reading: { ko: "읽는 중", tone: "muted" },
  read: { ko: "읽음", tone: "ok" },
  attached: { ko: "첨부만", tone: "muted" },
  "no-text": { ko: "텍스트 없음", tone: "warn" },
  failed: { ko: "읽기 실패", tone: "danger" },
};

export function LeftRail({
  phase,
  open,
  grid,
  onOpen,
  onGrid,
  onAction,
}: {
  phase: Phase;
  open: LeftPanel;
  grid: boolean;
  onOpen: (p: LeftPanel) => void;
  onGrid: (v: boolean) => void;
  onAction: (key: ActionKey) => void;
}) {
  return (
    <div
      data-ui="rail"
      className="absolute top-5 left-4 z-10 flex w-12 flex-col items-center gap-0.5 rounded-[10px] border border-line bg-surface py-1.5 shadow-[0_2px_12px_rgba(24,24,27,.07)]"
    >
      <RailButton
        label="자료함"
        active={open === "sources"}
        onClick={() => onOpen(open === "sources" ? null : "sources")}
      >
        <FolderOpen className="size-[18px]" />
      </RailButton>
      <RailButton
        label="검색"
        active={open === "search"}
        onClick={() => onOpen(open === "search" ? null : "search")}
      >
        <Search className="size-[18px]" />
      </RailButton>

      <RailButton label="격자" active={grid} onClick={() => onGrid(!grid)}>
        <Grid2x2 className="size-[18px]" />
      </RailButton>

      <span className="my-1.5 h-px w-6 bg-line" />

      {RAIL_ACTIONS[phase].map((a) => (
        <RailButton key={a.key} label={a.ko} onClick={() => onAction(a.key)}>
          <Icon name={a.icon} className="size-[18px]" />
        </RailButton>
      ))}
    </div>
  );
}

function RailButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          onClick={onClick}
          className={cn(
            "flex h-8 w-9 items-center justify-center rounded-[6px] text-muted transition-colors duration-[120ms] hover:bg-wash hover:text-ink",
            active && "bg-[#eff6ff] text-brand",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function LeftPanelView({
  pid,
  panel,
  onFiles,
  onFocusNode,
}: {
  pid: string;
  panel: Exclude<LeftPanel, null>;
  onFiles: (files: File[]) => void;
  onFocusNode: (id: string) => void;
}) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      data-ui="leftpanel"
      className="absolute top-5 bottom-24 left-[76px] z-10 flex w-[272px] flex-col overflow-hidden rounded-[10px] border border-line bg-surface shadow-[0_6px_24px_rgba(24,24,27,.10)]"
    >
      {panel === "sources" ? (
        <SourcesPanel pid={pid} onFiles={onFiles} />
      ) : (
        <SearchPanel pid={pid} onFocusNode={onFocusNode} />
      )}
    </motion.aside>
  );
}

function PanelHead({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
      <span className="text-[14px] font-semibold">{title}</span>
      {count !== undefined && <span className="text-[13px] text-muted">{count}</span>}
      <span className="flex-1" />
      <Btn
        variant="ghost"
        size="icon-sm"
        aria-label="닫기"
        onClick={() => useUi.getState().openLeft(null)}
      >
        <X className="size-3.5" />
      </Btn>
    </div>
  );
}

function SourcesPanel({ pid, onFiles }: { pid: string; onFiles: (f: File[]) => void }) {
  const doc = useDoc((s) => s.docs[pid]);
  const store = useDoc.getState;
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function addUrl() {
    const value = url.trim();
    if (!value || !doc) return;
    setLoading(true);
    const out = await extractUrl(value);
    setLoading(false);

    const sid = "src-" + Math.random().toString(36).slice(2, 9);
    store().addSource(pid, {
      id: sid,
      kind: "url",
      name: value.replace(/^https?:\/\//, "").slice(0, 60),
      text: out.text,
      uri: value,
      state: out.problem ? "no-text" : "read",
      createdAt: new Date().toISOString(),
    });
    store().moveNode(pid, sid, nextFreeSpot(useDoc.getState().docs[pid]!, { x: 72, y: 48 }));
    if (!out.problem) void autoSummarize(pid, { id: sid, name: value, text: out.text });
    setUrl("");
    flashSaved();

    if (out.problem) {
      toast.warning(out.problem, { description: "자료함에는 남겨뒀어요." });
      return;
    }
    useUi.getState().select([sid]);
    useUi.getState().openPanel("source");
  }

  if (!doc) return null;
  const broken = doc.sources.filter((s) => s.state === "no-text" || s.state === "failed");

  return (
    <>
      <PanelHead title="자료함" count={doc.sources.length} />

      <div className="flex flex-col gap-1.5 border-b border-line p-3">
        <Btn size="sm" className="justify-start" onClick={() => fileRef.current?.click()}>
          파일 첨부
        </Btn>
        <div className="flex gap-1.5">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void addUrl()}
            placeholder="주소 붙여넣기"
            aria-label="자료 주소"
            className="h-7 min-w-0 flex-1 rounded-[6px] border border-line bg-surface px-2 text-[13px] focus:border-brand"
          />
          <Btn size="sm" onClick={() => void addUrl()} disabled={!url.trim() || loading}>
            {loading ? <Spinner className="border-ink/30 border-t-ink" /> : "읽기"}
          </Btn>
        </div>
        <p className="text-[12px] leading-4 text-muted">파일을 캔버스로 끌어다 놓아도 돼요.</p>
      </div>

      {broken.length > 0 && (
        <div className="mx-3 mt-3 flex items-start gap-2 rounded-[6px] border border-line bg-wash-2 px-2.5 py-2 text-[13px] leading-4">
          <Dot tone="warn" className="mt-1" />
          <span className="kr flex-1">{broken.length}개 자료에서 텍스트를 찾지 못했어요.</span>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-1 overflow-auto p-3">
        {doc.sources.length === 0 && (
          <p className="kr rounded-[6px] border border-dashed border-line p-4 text-center text-[13px] leading-[19px] text-muted">
            아직 자료가 없어요.
          </p>
        )}
        {doc.sources.map((s) => {
          const state = STATE[s.state];
          const used = doc.nodes.filter((n) => n.sourceId === s.id).length;
          return (
            <button
              key={s.id}
              type="button"
              aria-label={`자료 ${s.name}`}
              onClick={() => {
                if (s.state !== "read") {
                  toast.warning("이 자료에서 읽을 텍스트를 찾지 못했어요.");
                  return;
                }
                useUi.getState().setReview({
                  sourceId: s.id,
                  step: "pick-target",
                  targetId: null,
                  pickedLine: null,
                  backTo: "candidates",
                });
                useUi.getState().openPanel("review");
              }}
              className="flex flex-col gap-1 rounded-[6px] border border-line px-2.5 py-2 text-left hover:bg-wash-2"
            >
              <span className="truncate font-mono text-[13px]" title={s.name}>
                {s.name}
              </span>
              <span className="flex items-center gap-2 text-[12px] text-muted">
                <span className="inline-flex items-center gap-1">
                  <Dot tone={state.tone} />
                  {state.ko}
                </span>
                {s.tag && <Badge>{s.tag}</Badge>}
                <span className="flex-1" />
                {used > 0 && <span>근거 {used}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".md,.markdown,.txt,.text,.csv,.json,.log,.pdf"
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}

function SearchPanel({ pid, onFocusNode }: { pid: string; onFocusNode: (id: string) => void }) {
  const doc = useDoc((s) => s.docs[pid]);
  const q = useUi((s) => s.search);
  const inputRef = useRef<HTMLInputElement>(null);

  // 패널이 밀려 들어온 뒤에 커서를 준다. 바로 부르면 애니메이션 중이라 놓친다.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  const needle = q.trim().toLowerCase();
  const hits = !doc
    ? []
    : doc.nodes.filter((n) => {
        if (!needle) return false;
        return (
          n.id.toLowerCase().includes(needle) ||
          n.md.toLowerCase().includes(needle) ||
          KIND[kindOf(n)].ko.includes(needle)
        );
      });

  return (
    <>
      <PanelHead title="검색" count={needle ? hits.length : undefined} />
      <div className="border-b border-line p-3">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => useUi.getState().setSearch(e.target.value)}
          placeholder="카드 내용·ID·유형"
          aria-label="카드 검색"
          className="h-8 w-full rounded-[6px] border border-line bg-surface px-2.5 text-[14px] focus:border-brand"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 overflow-auto p-3">
        {!needle && (
          <p className="kr px-1 text-[13px] leading-[19px] text-muted">
            제목과 본문에서 찾아요. 누르면 그 카드로 이동해요.
          </p>
        )}
        {needle && hits.length === 0 && (
          <p className="px-1 text-[13px] text-muted">결과가 없어요.</p>
        )}
        {hits.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => onFocusNode(n.id)}
            className="flex flex-col gap-0.5 rounded-[6px] border border-line px-2.5 py-2 text-left hover:bg-wash-2"
          >
            <span className="flex items-center gap-1.5 text-[12px] text-muted">
              <span className="font-mono">{n.id}</span>
              {KIND[kindOf(n)].ko}
            </span>
            <span className="kr line-clamp-2 text-[13px] leading-[19px]">{nodeTitle(n)}</span>
          </button>
        ))}
      </div>
    </>
  );
}
