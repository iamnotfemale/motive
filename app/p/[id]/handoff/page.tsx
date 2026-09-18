"use client";

/**
 * S07 개발 인계. 캔버스를 대체하는 일시적 화면이다.
 *
 * 점검을 끝내지 않아도 내보낼 수 있다. 점검 여부로 문서 내용이 달라지지 않는다 (핸드오프 §8).
 * `사업성 검증 완료` 류 문구를 쓰지 않는다.
 */
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Badge, Btn, Dot } from "@/components/kit";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { USER_CHECKS, buildAgentFiles, buildHandoffPreview, systemChecks } from "@/lib/export";
import { summarize } from "@/lib/issues";
import { useDoc } from "@/lib/store";
import { useUi } from "@/lib/ui";
import { cn } from "@/lib/utils";

export default function Handoff({ params }: { params: Promise<{ id: string }> }) {
  const { id: pid } = use(params);
  const router = useRouter();

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const unsub = useDoc.persist.onFinishHydration(() => setHydrated(true));
    if (useDoc.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  const project = useDoc((s) => s.projects.find((p) => p.id === pid));
  const doc = useDoc((s) => s.docs[pid]);
  const toggleCheck = useDoc((s) => s.toggleCheck);
  const markGenerated = useDoc((s) => s.markGenerated);
  const ui = useUi();

  const [view, setView] = useState<"preview" | "raw">("preview");
  const [downloaded, setDownloaded] = useState(false);

  const { issues, conflicts } = useMemo(
    () => (doc ? summarize(doc) : { issues: [], conflicts: [] }),
    [doc],
  );

  const sys = useMemo(() => (doc && project ? systemChecks(doc, project) : []), [doc, project]);
  const md = useMemo(
    () => (doc && project ? buildHandoffPreview(doc, project) : ""),
    [doc, project],
  );

  useEffect(() => {
    if (doc && doc.genAt === 0) markGenerated(pid);
  }, [doc, pid, markGenerated]);

  if (!hydrated) return <div className="p-10 text-[13px] text-muted">불러오는 중…</div>;
  if (!project || !doc) {
    router.replace("/");
    return null;
  }

  const userDone = USER_CHECKS.filter((c) => doc.checks[c.key]).length;
  const sysFailed = sys.filter((c) => !c.ok).length;
  const remaining = USER_CHECKS.length - userDone + sysFailed;
  const complete = remaining === 0;
  const stale = doc.genAt > 0 && doc.changedAt > doc.genAt;

  function download() {
    const files = buildAgentFiles(doc!, project!);
    files.forEach((f, i) => {
      setTimeout(() => {
        const url = URL.createObjectURL(new Blob([f.content], { type: "text/markdown;charset=utf-8" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = f.name;
        a.click();
        URL.revokeObjectURL(url);
      }, i * 180);
    });
    setDownloaded(true);
    toast(`${files.length}개 파일을 내려받았어요`, {
      description: complete ? "PROJECT_HANDOFF + 에이전트 컨텍스트 4종" : "확인하지 않은 항목도 그대로 들어 있어요",
    });
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas">
      <WorkspaceHeader
        project={project}
        phase="handoff"
        save={ui.save}
        aiOff={ui.aiOff}
        issues={issues}
        conflicts={conflicts}
        view="handoff"
        onPhase={() => {}}
        onIssues={() => {}}
        onConflicts={() => {}}
        onHandoff={() => {}}
        onBack={() => router.push(`/p/${pid}`)}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.995 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="flex min-h-0 flex-1"
      >
        <aside className="flex w-[300px] shrink-0 flex-col border-r border-line bg-surface">
          <div className="flex flex-col gap-1.5 px-5 pt-5 pb-3">
            <h2 className="text-[15px] font-semibold">인계 전 확인</h2>
            <p className={cn("kr text-[13px] leading-[18px]", complete ? "text-ok" : "text-muted")}>
              {complete
                ? "인계에 필요한 정보를 확인했어요"
                : `남은 확인 ${remaining}개 · 확인 없이도 초안으로 내보낼 수 있어요`}
            </p>
          </div>

          <div className="flex flex-1 flex-col gap-3.5 overflow-auto px-3 pb-4">
            <section className="flex flex-col gap-0.5">
              <h3 className="px-2 py-1.5 text-[11px] leading-4 font-semibold tracking-[.02em] text-faint">
                시스템 확인
              </h3>
              {sys.map((c) => (
                <div key={c.key} className="flex items-start gap-2.5 rounded-[6px] p-2">
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] text-white",
                      c.ok ? "bg-ok" : "bg-warn",
                    )}
                  >
                    {c.ok ? "✓" : "!"}
                  </span>
                  <span className="flex min-w-0 flex-col gap-px">
                    <span className="text-[13px] leading-[18px] font-medium">{c.title}</span>
                    <span className={cn("kr text-[12px] leading-4", c.ok ? "text-muted" : "text-warn")}>
                      {c.sub}
                    </span>
                  </span>
                </div>
              ))}
            </section>

            <section className="flex flex-col gap-0.5">
              <h3 className="px-2 py-1.5 text-[11px] leading-4 font-semibold tracking-[.02em] text-faint">
                내가 확인할 항목
              </h3>
              {USER_CHECKS.map((c) => {
                const on = Boolean(doc.checks[c.key]);
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => toggleCheck(pid, c.key)}
                    className="flex w-full items-start gap-2.5 rounded-[6px] p-2 text-left transition-colors duration-[120ms] hover:bg-wash-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border text-[10px] text-white transition-colors duration-[120ms]",
                        on ? "border-brand bg-brand" : "border-line bg-surface",
                      )}
                    >
                      {on ? "✓" : ""}
                    </span>
                    <span className="flex min-w-0 flex-col gap-px">
                      <span className="text-[13px] leading-[18px] font-medium">{c.title}</span>
                      <span className="kr text-[12px] leading-4 text-muted">{c.sub}</span>
                    </span>
                  </button>
                );
              })}
            </section>

            {conflicts.length > 0 && (
              <section className="mx-2 flex flex-col gap-2 rounded-[6px] border border-line bg-wash-2 p-3">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-danger">
                  <Dot tone="danger" />
                  어긋남 {conflicts.length}건
                </span>
                <p className="kr text-[12px] leading-[18px] text-muted">
                  문서 9절에 그대로 들어갑니다. 지우지 않아요.
                </p>
              </section>
            )}
          </div>

          <p className="kr border-t border-line px-5 py-3 text-[12px] leading-4 text-muted">
            확인은 인계 문서에 남는 판단이에요. 검증 완료를 뜻하지 않아요.
          </p>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-13 shrink-0 items-center gap-2 border-b border-line bg-surface px-6">
            <span className="font-mono text-[13px] font-semibold">PROJECT_HANDOFF.md</span>
            {project.demo && <Badge>데모 자료</Badge>}
            <div className="ml-2 flex rounded-[6px] bg-wash p-0.5">
              {(["preview", "raw"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    "h-6.5 rounded-[6px] px-2.5 text-[12px] font-medium transition-colors duration-[120ms]",
                    view === v
                      ? "bg-surface text-ink shadow-[0_1px_2px_rgba(24,24,27,.08)]"
                      : "text-muted hover:text-ink",
                  )}
                >
                  {v === "preview" ? "미리보기" : "원문"}
                </button>
              ))}
            </div>
            <span className="flex-1" />
            <Btn
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(md);
                  toast("Markdown을 복사했어요");
                } catch {
                  setView("raw");
                  toast.error("복사하지 못했어요", { description: "원문 탭에서 직접 선택해 주세요" });
                }
              }}
            >
              Markdown 복사
            </Btn>
            <Btn size="sm" variant={complete ? "ink" : "outline"} onClick={download}>
              {downloaded ? "다시 다운로드" : complete ? "파일 다운로드" : "초안으로 다운로드"}
            </Btn>
          </div>

          {stale && (
            <div className="mx-6 mt-3 flex items-center gap-2.5 rounded-[6px] border border-line bg-wash-2 px-3 py-2 text-[13px] leading-[18px]">
              <Dot tone="warn" />
              <span className="flex-1">캔버스가 바뀐 뒤 미리보기가 오래됐어요.</span>
              <Btn size="sm" onClick={() => markGenerated(pid)}>
                새로 만들기
              </Btn>
            </div>
          )}

          <div className="flex-1 overflow-auto px-6 pt-6 pb-10">
            {view === "preview" ? (
              <article
                style={{ opacity: stale ? 0.6 : 1 }}
                className="mx-auto max-w-[720px] rounded-[8px] border border-line bg-surface px-10 py-8 transition-opacity"
              >
                <Preview md={md} />
              </article>
            ) : (
              <pre className="mx-auto max-w-[720px] rounded-[8px] border border-line bg-wash-2 px-7 py-6 font-mono text-[13px] leading-5 wrap-break-word whitespace-pre-wrap text-ink select-text">
                {md}
              </pre>
            )}

            <p className="mx-auto mt-4 max-w-[720px] text-[12px] leading-[18px] text-muted">
              다운로드하면 <span className="font-mono">PROJECT_HANDOFF.md</span> 와 함께 코딩 에이전트용{" "}
              <span className="font-mono">PROJECT_CONTEXT · DECISIONS · EVIDENCE · AGENTS</span> 4개 파일이
              같이 나와요.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/** Markdown 미리보기. 문서를 읽히는 게 목적이라 제목·목록·인용만 구분한다. */
function Preview({ md }: { md: string }) {
  return (
    <div className="flex flex-col">
      {md.split("\n").map((line, i) => {
        if (line.startsWith("#### "))
          return (
            <h5 key={i} className="kr mt-4 text-[13px] font-semibold">
              {line.slice(5)}
            </h5>
          );
        if (line.startsWith("### "))
          return (
            <h4 key={i} className="kr mt-5 text-[14px] font-semibold">
              {line.slice(4)}
            </h4>
          );
        if (line.startsWith("## "))
          return (
            <h3 key={i} className="kr mt-7 border-t border-line pt-5 text-[16px] font-semibold">
              {line.slice(3)}
            </h3>
          );
        if (line.startsWith("# "))
          return (
            <h2 key={i} className="kr text-[22px] leading-8 font-semibold tracking-[-0.01em]">
              {line.slice(2)}
            </h2>
          );
        if (line.startsWith("> "))
          return (
            <p key={i} className="kr mt-3 border-l-2 border-line pl-3 text-[13px] text-muted">
              {line.slice(2)}
            </p>
          );
        if (line.startsWith("- "))
          return (
            <p key={i} className="kr mt-1.5 flex gap-2 text-[14px] leading-[24px]">
              <span className="shrink-0 text-faint">•</span>
              <span>{line.slice(2)}</span>
            </p>
          );
        if (line.startsWith("  "))
          return (
            <p key={i} className="kr pl-6 text-[13px] leading-[22px] text-muted">
              {line.trim()}
            </p>
          );
        if (line === "---") return <hr key={i} className="mt-6 border-line" />;
        if (!line.trim()) return <span key={i} className="h-2" />;
        return (
          <p key={i} className="kr mt-1.5 text-[14px] leading-[26px]">
            {line}
          </p>
        );
      })}
    </div>
  );
}
