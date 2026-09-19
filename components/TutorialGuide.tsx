"use client";

/**
 * 체험 안내 카드. 캔버스 오른쪽 아래에 떠 있고, 문서 상태에서 다음 걸음 하나만 가리킨다.
 * 화면을 막지 않고, 언제든 숨길 수 있고, 처음부터 다시 할 수 있다.
 */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, ChevronRight, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/kit";
import { useDoc } from "@/lib/store";
import {
  REVISED_PROBLEM,
  SUGGESTED_DECISION,
  TUTORIAL_SOURCES,
  createTutorialDecision,
  createTutorialProject,
  reviseProblem,
  tutorialStep,
  type TutorialStep,
} from "@/lib/tutorial";
import { useUi } from "@/lib/ui";
import { cn } from "@/lib/utils";

const ORDER: { key: TutorialStep | "look"; ko: string }[] = [
  { key: "evidence", ko: "인터뷰에서 근거 뽑기" },
  { key: "more", ko: "다른 자료로 가설 반박하기" },
  { key: "revisit", ko: "문제 다시 정의하기" },
  { key: "look", ko: "잠깐, 다르게 보기" },
  { key: "decide", ko: "결정 남기기" },
  { key: "handoff", ko: "인계 문서 만들기" },
];

export function TutorialGuide({ pid }: { pid: string }) {
  const router = useRouter();
  const doc = useDoc((s) => s.docs[pid]);
  const [hidden, setHidden] = useState(false);
  const [welcome, setWelcome] = useState(true);
  const [draft, setDraft] = useState<string | null>(null);
  // 둘러보기는 문서로 알 수 없는 체험이라 이 카드가 기억한다. 세 가지 다 해 보면 넘어간다.
  const [tried, setTried] = useState<Record<string, boolean>>({});
  const [skipLook, setSkipLook] = useState(false);
  const showEdges = useUi((s) => s.showEdges);
  const sel = useUi((s) => s.sel[0]);
  const panel = useUi((s) => s.panel);
  const reviewStep = useUi((s) => s.review?.step);

  const derived = doc ? tutorialStep(doc) : { step: "evidence" as TutorialStep, counter: 0 };
  const LOOK_ORDER = ["edges", "focus", "wide"] as const;
  const lookDone = skipLook || LOOK_ORDER.every((k) => tried[k]);
  const nextLook = LOOK_ORDER.find((k) => !tried[k]) ?? null;
  const step: TutorialStep | "look" = derived.step === "decide" && !lookDone ? "look" : derived.step;
  const counter = derived.counter;

  // 지금 눌러야 할 곳에 파란 테두리. 단계와 열린 패널을 보고 정한다.
  useEffect(() => {
    let h: string | null = null;
    if (hidden) h = null;
    else if (step === "evidence" || step === "more") {
      if (panel === "review") h = reviewStep === "pick-target" || reviewStep === "candidates" ? "H-01" : null;
      else if (panel === "source") h = sel && TUTORIAL_SOURCES.some((s) => s.id === sel) ? sel : null;
      else h = step === "evidence" ? TUTORIAL_SOURCES[0].id : null;
    }
    useUi.getState().setHint(h);
    return () => useUi.getState().setHint(null);
  }, [step, panel, reviewStep, sel, hidden]);

  if (!doc) return null;
  const idx = ORDER.findIndex((o) => o.key === step);
  const done = step === "done";

  const picked = TUTORIAL_SOURCES.find((s) => s.id === sel);

  /** 자료 패널(제목·미리보기·요약)을 연다. 근거 찾기는 그 다음. */
  function openSource(sourceId: string) {
    useUi.getState().select([sourceId]);
    useUi.getState().openPanel("source");
  }

  function findEvidence(sourceId: string) {
    useUi.getState().select([sourceId]);
    useUi.getState().setReview({ sourceId, step: "pick-target", targetId: null, pickedLine: null, backTo: "candidates" });
    useUi.getState().openPanel("review");
  }

  function restart() {
    if (!confirm("데모를 처음부터 다시 시작할까요? 현재 데모에서 만든 변경사항은 사라집니다.")) return;
    useDoc.getState().deleteProject(pid);
    router.replace(`/think/${createTutorialProject()}`);
  }

  if (hidden)
    return (
      <button
        type="button"
        onClick={() => setHidden(false)}
        className="absolute bottom-6 left-[76px] z-20 h-8 rounded-[6px] border border-line bg-surface px-3 text-[13px] font-medium shadow-[0_4px_12px_rgba(24,24,27,.08)] hover:bg-wash"
      >
        체험 안내 {done ? "" : `${idx + 1}/${ORDER.length}`}
      </button>
    );

  return (
    <div
      data-ui="tutorial"
      className="absolute bottom-6 left-[76px] z-20 flex w-[320px] flex-col gap-3 rounded-[10px] border border-line bg-surface p-4 shadow-[0_8px_24px_rgba(24,24,27,.12)] animate-fade-up"
    >
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold tracking-[.02em] text-muted">체험 안내</span>
        <span className="text-[12px] text-faint">{done ? "완료" : `${idx + 1} / ${ORDER.length}`}</span>
        <span className="flex-1" />
        <Btn variant="ghost" size="icon-sm" title="처음부터 다시" onClick={restart}><RotateCcw className="size-3.5" /></Btn>
        <Btn variant="ghost" size="icon-sm" title="숨기기" onClick={() => setHidden(true)}><X className="size-3.5" /></Btn>
      </div>

      {welcome && step === "evidence" ? (
        <div className="flex flex-col gap-3">
          <p className="kr text-[14px] leading-6">
            이 팀은 처음에 <b>“스터디 매칭 서비스”</b>를 만들려고 했어요. 캔버스에 그 첫 생각이 놓여 있습니다 — <b>P-01 문제 · H-01 가설 · S-01 해결안</b>. 오른쪽 줄은 3주 동안 모은 자료 5개예요.
          </p>
          <p className="kr text-[13px] leading-5 text-muted">
            자료를 읽어 근거를 뽑고 가설에 연결하면, 문제 정의가 어떻게 바뀌는지 따라갈 수 있어요. 이 카드가 매번 다음 한 걸음을 알려줍니다. 먼저 인터뷰부터 읽어 볼까요?
          </p>
          <Btn variant="ink" className="hint-pulse justify-between" onClick={() => { setWelcome(false); openSource(TUTORIAL_SOURCES[0].id); }}>
            1단계 · 인터뷰 자료 열어보기 <ChevronRight className="size-4" />
          </Btn>
        </div>
      ) : (
        <>
          <ol className="flex flex-col gap-1">
            {ORDER.map((o, i) => {
              const state = done || i < idx ? "done" : i === idx ? "now" : "todo";
              return (
                <li key={o.key} className={cn("flex items-center gap-2 text-[14px] leading-5", state === "todo" && "text-faint", state === "now" && "font-semibold")}>
                  <span className={cn("flex size-4 items-center justify-center rounded-full border", state === "done" ? "border-ink bg-ink text-white" : state === "now" ? "border-brand" : "border-line")}>
                    {state === "done" && <Check className="size-2.5" />}
                    {state === "now" && <span className="size-1.5 rounded-full bg-brand" />}
                  </span>
                  {o.ko}
                </li>
              );
            })}
          </ol>

          <div className="flex flex-col gap-2 border-t border-line pt-3">
            {step === "evidence" && (
              <>
                <p className="kr text-[13px] leading-5 text-muted">
                  파란 테두리가 깜빡이는 곳을 누르면 됩니다. ①  오른쪽 자료 패널 아래 <b>근거 뽑기</b> ② 대상 목록에서 <b>H-01 가설</b> ③ 후보 중 <b>이 카드의 근거로 추가</b>. 승인한 인용이 근거 카드가 되어 가설에 연결됩니다.
                </p>
                <div className="flex gap-2">
                  <Btn className="flex-1" onClick={() => openSource(TUTORIAL_SOURCES[0].id)}>인터뷰 보기</Btn>
                  <Btn variant="ink" className="flex-1" onClick={() => findEvidence(TUTORIAL_SOURCES[0].id)}>근거 뽑기</Btn>
                </div>
              </>
            )}
            {step === "more" && (
              <>
                <p className="kr text-[13px] leading-5 text-muted">
                  근거가 생겼어요. 이제 가설 <b>H-01</b>에 <b>반대 근거</b>로 연결된 것이 하나는 있어야 문제를 다시 볼 수 있어요. 인터뷰에서 “사람 구하는 건 별로 안 어려웠어요”를 H-01에 반대 근거로 승인하거나, 다른 자료에서 찾아보세요.
                </p>
                <div className="flex gap-2">
                  <Btn className="flex-1" onClick={() => openSource("tut-competitor")}>경쟁 조사 보기</Btn>
                  <Btn className="flex-1" onClick={() => openSource("tut-survey")}>설문 결과 보기</Btn>
                </div>
                {picked && (
                  <Btn variant="ink" onClick={() => findEvidence(picked.id)}>{picked.name} 에서 근거 뽑기</Btn>
                )}
                <p className="kr text-[12px] leading-4 text-faint">근거는 저장되는 것보다 무엇을 바꾸는지가 중요합니다.</p>
              </>
            )}
            {step === "revisit" && (
              <>
                <p className="kr text-[13px] leading-5 text-muted">반대 근거 {counter}건이 가설을 흔들고 있어요. 문제를 다시 정의해 볼까요? 기존 문제는 지우지 않고 P-02를 만듭니다.</p>
                <textarea
                  value={draft ?? REVISED_PROBLEM}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={4}
                  className="kr w-full resize-none rounded-[6px] border border-line bg-wash-2 px-3 py-2 text-[13px] leading-5 focus:border-brand"
                />
                <Btn
                  variant="ink"
                  className="hint-pulse"
                  onClick={() => {
                    const id = reviseProblem(pid, (draft ?? REVISED_PROBLEM).trim());
                    setDraft(null);
                    useUi.getState().select([id]);
                    useUi.getState().requestCenter(id);
                    toast("문제를 다시 정의했어요", { description: "Motive는 최종 문제만 남기지 않고, 왜 바뀌었는지도 함께 보존합니다." });
                  }}
                >
                  이 문장으로 P-02 만들기
                </Btn>
              </>
            )}
            {step === "look" && (
              <>

                <p className="kr text-[13px] leading-5 text-muted">문제가 바뀌었어요. 결정하기 전에 캔버스를 다르게 보는 세 가지를 잠깐 써 보세요.</p>
                <div className="flex flex-col gap-1.5">
                  <Btn
                    className={cn("justify-between", nextLook === "edges" && "hint-pulse")}
                    onClick={() => {
                      useUi.getState().setShowEdges(!showEdges);
                      setTried((t) => ({ ...t, edges: true }));
                    }}
                  >
                    <span>{showEdges ? "관계선 숨기고 카드만 보기" : "관계선 다시 보이기"}</span>
                    {tried.edges && <Check className="size-3.5 text-ok" />}
                  </Btn>
                  <Btn
                    className={cn("justify-between", nextLook === "focus" && "hint-pulse")}
                    onClick={() => {
                      const id = doc.nodes.some((n) => n.id === "H-01") ? "H-01" : doc.nodes[0]?.id;
                      if (!id) return;
                      const on = useUi.getState().focusView === id;
                      useUi.getState().select([id]);
                      useUi.getState().setFocusView(on ? null : id);
                      setTried((t) => ({ ...t, focus: true }));
                    }}
                  >
                    <span>가설 H-01 주변만 보기</span>
                    {tried.focus && <Check className="size-3.5 text-ok" />}
                  </Btn>
                  <Btn
                    className={cn("justify-between", nextLook === "wide" && "hint-pulse")}
                    onClick={() => {
                      const id = doc.nodes.find((n) => n.type === "problem" && n.id !== "P-01")?.id ?? "P-01";
                      useUi.getState().select([id]);
                      useUi.getState().setWide(true);
                      setTried((t) => ({ ...t, wide: true }));
                    }}
                  >
                    <span>새 문제 P-02 넓게 보기</span>
                    {tried.wide && <Check className="size-3.5 text-ok" />}
                  </Btn>
                </div>
                <p className="kr text-[12px] leading-4 text-faint">아래 도구 막대에서도 언제든 켜고 끌 수 있어요. 카드를 고르면 위쪽 막대에 “주변만 보기”가 있습니다.</p>
                <Btn variant="ghost" size="sm" onClick={() => { setSkipLook(true); useUi.getState().setShowEdges(true); useUi.getState().setFocusView(null); }}>
                  {lookDone ? "다음" : "건너뛰고 결정으로"}
                </Btn>
              </>
            )}
            {step === "decide" && (
              <>
                <p className="kr text-[13px] leading-5 text-muted">지금까지의 맥락으로 결정을 제안할 수 있어요. 기각한 방향(매칭 플랫폼·할 일 앱)도 이유와 함께 남습니다.</p>
                <textarea
                  value={draft ?? SUGGESTED_DECISION}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={4}
                  className="kr w-full resize-none rounded-[6px] border border-line bg-wash-2 px-3 py-2 text-[13px] leading-5 focus:border-brand"
                />
                <Btn
                  variant="ink"
                  className="hint-pulse"
                  onClick={() => {
                    const id = createTutorialDecision(pid, (draft ?? SUGGESTED_DECISION).trim());
                    setDraft(null);
                    useUi.getState().select([id]);
                    useUi.getState().requestCenter(id);
                    useUi.getState().openPanel("inspector");
                    toast("결정을 남겼어요", { description: "S-01 매칭은 기각으로, 새 해결안은 채택으로 표시됩니다." });
                  }}
                >
                  결정 생성
                </Btn>
              </>
            )}
            {step === "handoff" && (
              <>
                <p className="kr text-[13px] leading-5 text-muted">결과물이 아니라, 다음 사람이 이어서 생각할 수 있는 Context를 만듭니다. 기각한 대안·미검증·반대 근거가 그대로 들어갑니다.</p>
                <Btn variant="ink" className="hint-pulse" onClick={() => router.push(`/think/${pid}/handoff`)}>인계 문서 만들기</Btn>
              </>
            )}
            {done && (
              <>
                <p className="kr text-[13px] leading-5">
                  체험이 끝났습니다. 여러 자료에서 나온 근거를 연결하고, 가설을 반박하고, 문제를 다시 정의하고, 결정까지 Context로 남겼습니다.
                </p>
                <div className="flex gap-2">
                  <Btn className="flex-1" onClick={() => setHidden(true)}>자유롭게 둘러보기</Btn>
                  <Btn variant="ink" className="flex-1" onClick={() => router.push("/dashboard")}>내 프로젝트 시작</Btn>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
