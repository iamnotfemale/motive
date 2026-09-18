"use client";

/**
 * CMP-01 헤더. 높이 52.
 * 완료율·신뢰도·퍼센트를 두지 않는다. 남은 일을 개수로만 보여준다 (스펙 §6).
 * 어긋남은 나머지 미확인 항목과 분리해서 독립 칩으로 낸다 (스펙 §17.1).
 */
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { Badge, Btn, Dot } from "@/components/kit";
import { PHASES } from "@/lib/labels";
import type { Conflict, Issue } from "@/lib/issues";
import type { Phase, Project, SaveState } from "@/lib/types";
import { cn } from "@/lib/utils";

const SAVE: Record<SaveState, { short: string; long: string; tone: "ok" | "muted" | "danger" }> = {
  saved: {
    short: "저장됨",
    long: "저장됨 · 다른 카드로 이동해도 입력은 유지돼요",
    tone: "ok",
  },
  saving: { short: "저장 중…", long: "저장 중…", tone: "muted" },
  failed: {
    short: "저장 실패",
    long: "변경 내용을 저장하지 못했어요. 이 창을 닫지 말아주세요.",
    tone: "danger",
  },
};

export { SAVE };

interface Props {
  project: Project;
  phase: Phase | null;
  save: SaveState;
  aiOff: boolean;
  issues: Issue[];
  conflicts: Conflict[];
  view: "canvas" | "handoff";
  onPhase: (p: Phase) => void;
  onIssues: () => void;
  onConflicts: () => void;
  onHandoff: () => void;
  onBack: () => void;
}

export function WorkspaceHeader(p: Props) {
  const router = useRouter();
  const save = SAVE[p.save];

  return (
    <header className="relative z-20 flex h-13 shrink-0 items-center gap-2 border-b border-line bg-surface pr-6 pl-5">
      <button
        type="button"
        onClick={() => router.push("/dashboard")}
        className="text-[14px] font-semibold tracking-[-0.01em] hover:text-muted"
      >
        Motive
      </button>
      <span className="mx-1.5 h-4 w-px bg-line" />
      <button
        type="button"
        title={p.project.name}
        className="flex h-7 max-w-[220px] items-center gap-1.5 rounded-[6px] px-2 hover:bg-wash"
      >
        <span className="truncate font-medium">{p.project.name}</span>
        <ChevronDown className="size-3 shrink-0 text-faint" />
      </button>
      {p.project.demo && <Badge outline>데모 자료</Badge>}

      <span className="flex-1" />

      {p.view === "canvas" && (
        <nav className="absolute left-1/2 flex -translate-x-1/2 gap-7" aria-label="단계">
          {PHASES.map((ph) => {
            const on = p.phase === ph.key;
            return (
              <button
                key={ph.key}
                type="button"
                onClick={() => p.onPhase(ph.key)}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "relative h-13 px-0.5 text-[14px] font-medium transition-colors duration-[120ms]",
                  on ? "text-ink" : "text-muted hover:text-ink",
                )}
              >
                {ph.ko}
                {on && (
                  <motion.span
                    layoutId="phase-bar"
                    className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-[2px] bg-ink"
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      )}

      <span className="flex-1" />

      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-[13px] leading-4 whitespace-nowrap",
          save.tone === "danger" ? "text-danger" : save.tone === "ok" ? "text-ok" : "text-muted",
        )}
      >
        <Dot tone={save.tone} />
        {save.short}
      </span>

      {p.aiOff && <Badge outline>AI 미연결</Badge>}

      {p.view === "canvas" ? (
        <>
          {p.conflicts.length > 0 && (
            <Btn
              size="sm"
              variant="ghost"
              onClick={p.onConflicts}
              className="gap-1.5 text-danger hover:text-danger"
            >
              <Dot tone="danger" />
              어긋남 {p.conflicts.length}건
            </Btn>
          )}
          <Btn size="sm" variant="ghost" onClick={p.onIssues}>
            {p.issues.length > 0 ? `인계 전 확인 ${p.issues.length}개` : "인계 준비됨"}
          </Btn>
          <Btn variant="ink" size="md" onClick={p.onHandoff} className="px-3.5">
            개발 인계
          </Btn>
        </>
      ) : (
        <Btn onClick={p.onBack}>캔버스로 돌아가기</Btn>
      )}
    </header>
  );
}
