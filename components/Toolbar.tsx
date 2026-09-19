"use client";

/**
 * 아래 도구 막대. 무한 캔버스라 도구가 화면에 떠 있어야 한다.
 *
 * 왼쪽부터 도구(선택·손·격자·블록 추가) → 되돌리기 → 정리 → 단계별 핵심 행동 → 확대·축소.
 * 단계별 행동만 `정의 / 탐색 / 검토 / 결정 / 인계` 에 따라 바뀐다 (lib/phases.ts).
 */
import { Hand, Maximize2, MousePointer2, Paperclip, Plus, Redo2, Sparkles, Undo2 } from "lucide-react";
import { Btn } from "@/components/kit";
import { Icon } from "@/components/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { KIND, type Kind } from "@/lib/labels";
import { DOCK_ACTIONS, type ActionKey } from "@/lib/phases";
import type { Phase } from "@/lib/types";
import type { Tool } from "@/lib/ui";
import { cn } from "@/lib/utils";

interface Props {
  tool: Tool;
  zoom: number;
  phase: Phase;
  canUndo: boolean;
  canRedo: boolean;
  onTool: (t: Tool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onTidy: () => void;
  onZoom: (z: number) => void;
  /** 고른 카드가 있으면 그 카드에 맞춰 확대한다. */
  onFit: () => void;
  hasSelection: boolean;
  onAction: (key: ActionKey) => void;
  /** 지금 비추고 있는 단추. 눌린 상태로 보여준다. */
  spotlightKey: string | null;
  onAddKind: (kind: Kind) => void;
}

const ADD_KINDS: Kind[] = ["claim", "question", "note", "evidence", "solution"];

export function Toolbar(p: Props) {
  const tools: { key: Tool; icon: typeof Hand; label: string; hint: string }[] = [
    { key: "select", icon: MousePointer2, label: "선택", hint: "V" },
    { key: "hand", icon: Hand, label: "손으로 이동", hint: "H · Space" },
  ];

  return (
    <div
      data-ui="dock"
      className="absolute bottom-6 left-1/2 z-9 flex h-12 -translate-x-1/2 items-center gap-0.5 rounded-[10px] border border-line bg-surface px-1.5 shadow-[0_6px_24px_rgba(24,24,27,.10)]"
    >
      {tools.map((t) => (
        <Tooltip key={t.key}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={t.label}
              aria-pressed={p.tool === t.key}
              onClick={() => p.onTool(t.key)}
              className={cn(
                "flex size-8 items-center justify-center rounded-[6px] text-muted transition-colors duration-[120ms] hover:bg-wash hover:text-ink",
                p.tool === t.key && "bg-[#eff6ff] text-brand",
              )}
            >
              <t.icon className="size-[18px]" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {t.label}
            {t.hint && <span className="ml-1.5 font-mono text-[12px] opacity-60">{t.hint}</span>}
          </TooltipContent>
        </Tooltip>
      ))}

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="블록 추가"
                aria-pressed={p.tool === "add"}
                className={cn(
                  "flex size-8 items-center justify-center rounded-[6px] text-muted transition-colors duration-[120ms] hover:bg-wash hover:text-ink",
                  p.tool === "add" && "bg-[#eff6ff] text-brand",
                )}
              >
                <Plus className="size-[19px]" />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            블록 추가<span className="ml-1.5 font-mono text-[13px] opacity-60">N</span>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent side="top" align="start" className="w-56">
          {ADD_KINDS.map((k) => (
            <DropdownMenuItem key={k} onSelect={() => p.onAddKind(k)}>
              {KIND[k].ko} 추가
              <DropdownMenuShortcut>{KIND[k].prefix}</DropdownMenuShortcut>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => p.onTool("add")}>
            캔버스에 놓아서 추가
            <DropdownMenuShortcut>N</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>결정 — 해결안에서 만들어요</DropdownMenuItem>
          <DropdownMenuItem disabled>요구사항 — 결정에서 만들어요</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sep />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="되돌리기"
            disabled={!p.canUndo}
            onClick={p.onUndo}
            className="flex size-8 items-center justify-center rounded-[6px] text-muted hover:bg-wash hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Undo2 className="size-[18px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          되돌리기<span className="ml-1.5 font-mono text-[12px] opacity-60">⌘Z</span>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="다시 실행"
            disabled={!p.canRedo}
            onClick={p.onRedo}
            className="flex size-8 items-center justify-center rounded-[6px] text-muted hover:bg-wash hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Redo2 className="size-[18px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          다시 실행<span className="ml-1.5 font-mono text-[12px] opacity-60">⇧⌘Z</span>
        </TooltipContent>
      </Tooltip>

      <Sep />

      <Btn variant="ghost" className="gap-1.5 text-ink hover:text-ink" onClick={p.onTidy}>
        <Sparkles className="size-4 text-muted" />
        정리
      </Btn>

      <Sep />

      {/* 단계별 핵심 행동 */}
      {DOCK_ACTIONS[p.phase].map((a) => (
        <Tooltip key={a.key}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={a.ko}
              aria-pressed={p.spotlightKey === a.key}
              onClick={() => p.onAction(a.key)}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-[6px] px-2 text-[14px] font-medium transition-colors duration-[120ms] hover:bg-wash",
                p.spotlightKey === a.key ? "bg-[#eff6ff] text-brand" : "text-ink",
              )}
            >
              {a.key === "attach" ? (
                <Paperclip className={cn("size-4", p.spotlightKey === a.key ? "text-brand" : "text-muted")} />
              ) : (
                <Icon
                  name={a.icon}
                  className={cn("size-4", p.spotlightKey === a.key ? "text-brand" : "text-muted")}
                />
              )}
              <span className="whitespace-nowrap">{a.ko}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{a.ko}</TooltipContent>
        </Tooltip>
      ))}

      <Sep />

      <button
        type="button"
        aria-label="축소"
        onClick={() => p.onZoom(p.zoom * 0.85)}
        className="flex size-7 items-center justify-center rounded-[6px] text-[16px] text-muted hover:bg-wash"
      >
        −
      </button>
      <button
        type="button"
        title="100%로 복귀"
        onClick={() => p.onZoom(1)}
        className="h-7 min-w-12 rounded-[6px] font-mono text-[14px] text-ink hover:bg-wash"
      >
        {Math.round(p.zoom * 100)}%
      </button>
      <button
        type="button"
        aria-label="확대"
        onClick={() => p.onZoom(p.zoom * 1.18)}
        className="flex size-7 items-center justify-center rounded-[6px] text-[16px] text-muted hover:bg-wash"
      >
        +
      </button>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={p.hasSelection ? "고른 카드에 맞춤" : "전체 맞춤"}
            onClick={p.onFit}
            className="flex size-7 items-center justify-center rounded-[6px] text-muted hover:bg-wash hover:text-ink"
          >
            <Maximize2 className="size-[17px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {p.hasSelection ? "고른 카드에 맞춰 확대" : "전체에 맞춤"}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px bg-line" />;
