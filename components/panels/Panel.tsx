"use client";

/** 우측 패널 공통 껍데기. 비모달 — 캔버스 선택은 유지된다. */
import { motion } from "motion/react";
import { X } from "lucide-react";
import { Btn } from "@/components/kit";
import { cn } from "@/lib/utils";

export function SidePanel({
  width = 400,
  children,
  className,
  testId,
}: {
  width?: number;
  children: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <motion.aside
      data-ui={testId}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      style={{ width }}
      className={cn(
        "flex shrink-0 flex-col border-l border-line bg-surface shadow-[-4px_0_16px_rgba(24,24,27,.04)]",
        className,
      )}
    >
      {children}
    </motion.aside>
  );
}

export function PanelClose({ onClose, label = "닫기 (Esc)" }: { onClose: () => void; label?: string }) {
  return (
    <Btn variant="ghost" size="icon" onClick={onClose} title={label} aria-label={label}>
      <X className="size-4" />
    </Btn>
  );
}
