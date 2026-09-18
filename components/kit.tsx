"use client";

/**
 * 프로토타입에서 반복되는 컨트롤만 모아둔다. 크기·색은 실측값.
 * shadcn/ui 는 동작이 있는 것(Select·Popover·Dialog·Command·Checkbox·Tooltip)에 쓰고,
 * 버튼·배지처럼 디자인이 고정된 것은 여기서 만든다.
 */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const btn = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[6px] font-medium transition-[background,border-color,color] duration-[120ms] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2",
  {
    variants: {
      variant: {
        ink: "border border-ink bg-ink text-white hover:bg-ink-hover",
        outline: "border border-line bg-surface text-ink hover:bg-wash",
        ghost: "border-0 bg-transparent text-muted hover:bg-wash hover:text-ink",
        subtle: "border-0 bg-wash text-ink hover:bg-line",
        dashed:
          "border border-dashed border-line-strong bg-surface text-ink hover:border-brand hover:bg-wash",
        danger: "border border-line bg-surface text-danger hover:bg-wash",
      },
      size: {
        lg: "h-9 px-4 text-[14px]",
        md: "h-8 px-3 text-[14px]",
        sm: "h-7 px-2.5 text-[14px]",
        xs: "h-6 px-2 text-[13px]",
        icon: "h-7 w-7 px-0 text-[14px]",
        "icon-sm": "h-6 w-6 px-0 text-[13px]",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

export interface BtnProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof btn> {}

export const Btn = React.forwardRef<HTMLButtonElement, BtnProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(btn({ variant, size }), className)} {...props} />
  ),
);
Btn.displayName = "Btn";

/** 유형 아이콘. 16x16 viewBox, stroke 기반. lib/labels.ts 의 path 를 그린다. */
export function TypeIcon({ d, size = 14, className }: { d: string; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

export type Tone = "ok" | "warn" | "danger" | "muted" | "brand";

const TONE_TEXT: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
  muted: "text-muted",
  brand: "text-brand",
};

const TONE_BG: Record<Tone, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
  muted: "bg-muted",
  brand: "bg-brand",
};

/** 색만으로 상태를 구분하지 않는다. 점 + 텍스트를 항상 같이 쓴다. */
export function Dot({ tone = "muted", className }: { tone?: Tone; className?: string }) {
  return <span className={cn("size-1.5 shrink-0 rounded-full", TONE_BG[tone], className)} />;
}

export function StatusText({
  tone = "muted",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px] leading-4 font-medium",
        TONE_TEXT[tone],
        className,
      )}
    >
      <Dot tone={tone} />
      {children}
    </span>
  );
}

/** 작은 라벨. 배경 + 텍스트로 구분하고 테두리는 선택. */
export function Badge({
  children,
  tone,
  outline,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  outline?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-4 shrink-0 items-center rounded-[4px] px-1.5 text-[12px] leading-4 whitespace-nowrap",
        outline ? "border border-line bg-surface text-muted" : "bg-wash text-muted",
        tone === "warn" && "bg-[#fffaeb] text-warn",
        tone === "ok" && "bg-[#f4f4f5] text-ok",
        tone === "danger" && "bg-[#fef3f2] text-danger",
        className,
      )}
    >
      {children}
    </span>
  );
}

export const Mono = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={cn("font-mono text-[12px] leading-4 text-faint", className)}>{children}</span>
);

/** 진행률을 알 수 없을 때. 가짜 퍼센트를 만들지 않는다. */
export function Indeterminate({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-1 overflow-hidden rounded-full bg-wash", className)}>
      <span className="absolute top-0 h-full w-2/5 rounded-full bg-brand animate-indet" />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "size-3 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white",
        className,
      )}
    />
  );
}

/** 섹션 제목. 패널 안에서 반복된다. */
export const FieldLabel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("text-[13px] leading-4 font-semibold text-muted", className)}>{children}</div>
);

/** 상태 배너 — 색 + 텍스트 + 실제 다음 행동 버튼. 닫아도 상태가 해결되지 않는다. */
export function Notice({
  tone = "warn",
  children,
  actions,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-[6px] border border-line bg-wash-2 px-3 py-2.5 text-[14px] leading-[19px]",
        className,
      )}
    >
      <Dot tone={tone} />
      <span className="kr flex-1">{children}</span>
      {actions}
    </div>
  );
}
