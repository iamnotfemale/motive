"use client";

/**
 * CMP-02 도구 레일 + CMP-06 액션 도크.
 * 레일은 문서 트리가 아니다 — 아이콘 4개짜리 48px 세로 바다 (스펙 §22).
 */
import { useRef } from "react";
import { Folder, MousePointer2, Plus, Search } from "lucide-react";
import { Btn } from "@/components/kit";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Kind } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function ToolRail({
  shelfOpen,
  onShelf,
  onSearch,
  onAdd,
}: {
  shelfOpen: boolean;
  onShelf: () => void;
  onSearch: () => void;
  onAdd: () => void;
}) {
  const items = [
    { icon: MousePointer2, title: "선택", active: true, go: () => {} },
    { icon: Plus, title: "블록 추가", active: false, go: onAdd },
    { icon: Folder, title: "자료함", active: shelfOpen, go: onShelf },
    { icon: Search, title: "검색 (⌘K)", active: false, go: onSearch },
  ];
  return (
    <div
      data-ui="rail"
      className="absolute top-5 left-4 z-5 flex w-12 flex-col items-center gap-0.5 rounded-[8px] border border-line bg-surface py-1.5 shadow-[0_2px_8px_rgba(24,24,27,.06)]"
    >
      {items.map(({ icon: Icon, title, active, go }) => (
        <Tooltip key={title}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={go}
              aria-label={title}
              className={cn(
                "flex h-8 w-9 items-center justify-center rounded-[6px] text-muted transition-colors duration-[120ms] hover:bg-wash hover:text-ink",
                active && "bg-wash text-ink",
              )}
            >
              <Icon className="size-[18px]" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{title}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

interface DockProps {
  zoom: number;
  shelfOpen: boolean;
  onAdd: (kind: Kind) => void;
  onAttachFile: (files: File[]) => void;
  onTidy: () => void;
  onZoom: (z: number) => void;
  onFit: () => void;
}

export function ActionDock(p: DockProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div
      data-ui="dock"
      style={{ bottom: p.shelfOpen ? 284 : 24 }}
      className="absolute left-1/2 z-9 flex h-12 -translate-x-1/2 items-center gap-0.5 rounded-[8px] border border-line bg-surface px-1.5 shadow-[0_4px_16px_rgba(24,24,27,.08)] transition-[bottom] duration-200"
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Btn variant="ghost" className="gap-1.5 text-ink hover:text-ink">
            <span className="text-[16px] text-muted">+</span>
            블록 추가
          </Btn>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-60">
          <DropdownMenuItem onSelect={() => p.onAdd("claim")}>
            가설 추가
            <DropdownMenuShortcut>H</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
            자료로 근거 찾기
            <DropdownMenuShortcut>E</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => p.onAdd("question")}>
            검토 질문 추가
            <DropdownMenuShortcut>C</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-muted">다른 블록</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onSelect={() => p.onAdd("solution")}>해결안</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => p.onAdd("note")}>메모</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>결정 — 해결안에서 만들어요</DropdownMenuItem>
              <DropdownMenuItem disabled>요구사항 — 결정에서 만들어요</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      <Btn variant="ghost" className="text-ink hover:text-ink" onClick={() => fileRef.current?.click()}>
        자료 첨부
      </Btn>
      <Btn variant="ghost" className="text-ink hover:text-ink" onClick={p.onTidy}>
        정리
      </Btn>

      <span className="mx-1.5 h-5 w-px bg-line" />

      <Btn variant="ghost" size="icon" onClick={() => p.onZoom(p.zoom * 0.9)} aria-label="축소">
        −
      </Btn>
      <Btn
        variant="ghost"
        size="sm"
        onClick={() => p.onZoom(1)}
        title="100%로 복귀"
        className="min-w-12 font-mono text-ink hover:text-ink"
      >
        {Math.round(p.zoom * 100)}%
      </Btn>
      <Btn variant="ghost" size="icon" onClick={() => p.onZoom(p.zoom * 1.1)} aria-label="확대">
        +
      </Btn>
      <Btn variant="ghost" size="icon" onClick={p.onFit} aria-label="화면 맞춤" title="화면 맞춤">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
        </svg>
      </Btn>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".md,.markdown,.txt,.text,.csv,.json,.log,.pdf"
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) p.onAttachFile(files);
        }}
      />
    </div>
  );
}
