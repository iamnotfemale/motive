"use client";

/**
 * 브라우저 confirm/prompt 대신 쓰는 앱 안 확인창. 한 화면에 하나만 뜬다.
 * 되돌릴 수 없는 일(영구 삭제·초기화)에만 쓴다. 되돌릴 수 있는 일은 토스트 + 되돌리기.
 */
import { useEffect, useState } from "react";
import { Btn } from "@/components/kit";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "확인",
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[400px] gap-4 rounded-[10px] p-5">
        <DialogHeader className="gap-1.5">
          <DialogTitle className="text-[16px]">{title}</DialogTitle>
          {description && <DialogDescription className="kr text-[14px] leading-5 text-muted">{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-end">
          <Btn onClick={onClose}>취소</Btn>
          <Btn
            variant={danger ? "danger" : "ink"}
            autoFocus
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PromptDialog({
  open,
  title,
  initial,
  placeholder,
  confirmLabel = "저장",
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  initial: string;
  placeholder?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);
  const submit = () => {
    const v = value.trim();
    if (v) onSubmit(v);
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[400px] gap-4 rounded-[10px] p-5">
        <DialogHeader>
          <DialogTitle className="text-[16px]">{title}</DialogTitle>
        </DialogHeader>
        <input
          autoFocus
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="h-9 w-full rounded-[6px] border border-line bg-surface px-3 text-[14px] outline-none focus:border-brand"
        />
        <DialogFooter className="gap-2 sm:justify-end">
          <Btn onClick={onClose}>취소</Btn>
          <Btn variant="ink" disabled={!value.trim()} onClick={submit}>{confirmLabel}</Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
