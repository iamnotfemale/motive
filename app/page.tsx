"use client";

/**
 * S01 문제 작성. 가입·폴더·태그 없이 바로 쓴다. (핸드오프 S01)
 * 상태 5종: 빈 상태 / 작성 중 / 입력 없음 오류 / 시작·저장 중 / 저장 실패.
 * AI 분석을 기다리지 않는다 — 캔버스는 바로 뜬다.
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Btn, Spinner } from "@/components/kit";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { S01_EXAMPLE } from "@/lib/demo";
import { useDoc } from "@/lib/store";
import { cn } from "@/lib/utils";

type S01 = "idle" | "typing" | "error" | "saving" | "failed";

export default function ProblemStart() {
  const router = useRouter();
  const createProject = useDoc((s) => s.createProject);
  const createDemoProject = useDoc((s) => s.createDemoProject);
  const projects = useDoc((s) => s.projects);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [state, setState] = useState<S01>("idle");
  const [focused, setFocused] = useState(false);
  const [mounted, setMounted] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setMounted(true), []);

  function start() {
    if (!body.trim()) {
      setState("error");
      bodyRef.current?.focus();
      return;
    }
    setState("saving");
    try {
      const pid = createProject(body, title.trim() || undefined);
      // 저장이 실제로 끝난 뒤에만 넘어간다. 화면 전환은 캔버스가 준비되고 나서.
      setTimeout(() => router.push(`/p/${pid}`), 500);
    } catch {
      setState("failed");
    }
  }

  function openDemo() {
    try {
      router.push(`/p/${createDemoProject()}`);
    } catch {
      toast.error("데모 프로젝트를 만들지 못했어요.");
    }
  }

  const msg = {
    idle: "",
    typing: `${body.trim().length}자 · 저장 전`,
    error: "문제를 한 줄이라도 적어주세요. 정리되지 않은 문장이어도 괜찮아요.",
    saving: "저장하고 캔버스를 준비하는 중…",
    failed: "저장하지 못했어요. 작성 내용은 이 화면에 그대로 있어요.",
  }[state];

  const msgTone =
    state === "error" || state === "failed" ? "text-danger" : "text-muted";

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex h-13 shrink-0 items-center gap-3 px-6">
        <span className="text-[13px] font-semibold tracking-[-0.01em]">Motive</span>
        <span className="flex-1" />
        {mounted && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Btn variant="ghost" size="sm" className="gap-1">
                최근 프로젝트
                <ChevronDown className="size-3.5" />
              </Btn>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {projects.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-[11px] text-faint">최근</DropdownMenuLabel>
                  {projects.slice(0, 6).map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onSelect={() => router.push(`/p/${p.id}`)}
                      className="text-[13px]"
                    >
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      {p.demo && <span className="text-[11px] text-faint">데모</span>}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onSelect={openDemo} className="text-[13px]">
                데모 프로젝트 열기
                <span className="ml-auto text-[11px] text-faint">제출 체크룸</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <div className="flex flex-1 justify-center px-6 pt-[14vh]">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="flex w-full max-w-[720px] flex-col gap-5"
        >
          <div>
            <h1 className="text-[24px] leading-7 font-semibold tracking-[-0.01em]">
              어떤 문제를 풀고 있나요?
            </h1>
            <p className="kr mt-2 text-[13px] leading-[22px] text-muted">
              완벽하게 정리하지 않아도 괜찮아요. 답을 제안하기 전에 무엇이 불확실한지부터 정리해요.
            </p>
          </div>

          <div
            className={cn(
              "rounded-[8px] border bg-surface transition-[border-color,box-shadow] duration-[120ms]",
              state === "error"
                ? "border-danger"
                : focused
                  ? "border-brand shadow-[0_0_0_3px_#eff6ff]"
                  : "border-line",
            )}
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목 (선택)"
              className="block w-full border-0 bg-transparent px-5 pt-4 pb-1 text-[15px] font-medium text-ink placeholder:text-faint"
            />
            <textarea
              ref={bodyRef}
              value={body}
              rows={6}
              onChange={(e) => {
                setBody(e.target.value);
                if (state === "error" || state === "failed") setState(e.target.value.trim() ? "typing" : "idle");
                else setState(e.target.value.trim() ? "typing" : "idle");
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="문제를 한두 문장으로 적어주세요."
              className="kr block w-full resize-none border-0 bg-transparent px-5 pt-2 pb-4 text-[15px] leading-[26px] text-ink placeholder:text-faint"
            />
            <div className="flex items-center gap-3 border-t border-wash px-5 py-3">
              <span className={cn("kr text-[12px] leading-4", msgTone)}>{msg}</span>
              <span className="flex-1" />
              {state === "failed" && (
                <Btn
                  onClick={() => {
                    void navigator.clipboard?.writeText(body);
                    toast("작성 내용을 복사했어요");
                  }}
                >
                  작성 내용 복사
                </Btn>
              )}
              <Btn variant="ink" size="md" onClick={start} disabled={state === "saving"} className="px-4">
                {state === "saving" && <Spinner />}
                {state === "saving" ? "시작하는 중…" : state === "failed" ? "다시 시도" : "프로젝트 시작"}
              </Btn>
            </div>
          </div>

          <div className="flex gap-2.5 text-[13px] leading-5 text-muted">
            <span className="shrink-0 text-faint">예시</span>
            <span className="kr">{S01_EXAMPLE}</span>
            <Btn
              size="xs"
              className="shrink-0"
              onClick={() => {
                setBody(S01_EXAMPLE);
                setState("typing");
                bodyRef.current?.focus();
              }}
            >
              예시 넣기
            </Btn>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
