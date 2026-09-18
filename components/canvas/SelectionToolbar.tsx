"use client";

/**
 * 고른 카드 위에 붙는 도구 막대.
 * 카드를 누르면 오른쪽 패널이 자동으로 열리지 않는다 — 여기서 직접 연다.
 */
import { motion } from "motion/react";
import { ChevronsDownUp, ChevronsUpDown, FileText, GitFork, Sparkles, Target, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  count: number;
  /** 카드 하나만 골랐을 때. 문서로 보기는 그때만 뜬다. */
  single: boolean;
  x: number;
  y: number;
  collapsed: boolean;
  onOpen: () => void;
  onFocus: () => void;
  onCollapse: () => void;
  onDelete: () => void;
  onAi: () => void;
  onFork: () => void;
}

export function SelectionToolbar(p: Props) {
  const items = [
    ...(p.single ? [{ icon: FileText, label: "문서로 보기", go: p.onOpen, danger: false }] : []),
    ...(p.single ? [{ icon: Target, label: "주변만 보기", go: p.onFocus, danger: false }] : []),
    {
      icon: p.collapsed ? ChevronsUpDown : ChevronsDownUp,
      label: p.collapsed ? "펼치기" : "접기",
      go: p.onCollapse,
      danger: false,
    },
    { icon: Sparkles, label: "AI에게 묻기", go: p.onAi, danger: false },
    ...(p.count > 1
      ? [{ icon: GitFork, label: "복제해 새 갈래 만들기", go: p.onFork, danger: false }]
      : []),
    { icon: Trash2, label: "지우기", go: p.onDelete, danger: true },
  ];

  return (
    <motion.div
      data-ui="selection"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.14 }}
      style={{ left: p.x, top: p.y - 14 }}
      className="absolute z-20 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-[10px] border border-line bg-surface p-1 shadow-[0_6px_20px_rgba(24,24,27,.12)]"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {p.count > 1 && (
        <>
          <span className="px-2 text-[14px] whitespace-nowrap text-muted">
            <span className="font-medium text-brand">{p.count}개</span> 선택
          </span>
          <span className="mx-0.5 h-5 w-px bg-line" />
        </>
      )}
      {items.map(({ icon: I, label, go, danger }) => (
        <Tooltip key={label}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={label}
              onClick={go}
              className={
                danger
                  ? "flex size-8 items-center justify-center rounded-[6px] text-muted hover:bg-wash hover:text-danger"
                  : "flex size-8 items-center justify-center rounded-[6px] text-muted hover:bg-wash hover:text-ink"
              }
            >
              <I className="size-[17px]" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{label}</TooltipContent>
        </Tooltip>
      ))}
    </motion.div>
  );
}
