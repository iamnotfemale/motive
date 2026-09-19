"use client";

/**
 * 체험 안내 카드. 캔버스 오른쪽 아래에 떠 있고, 문서 상태에서 다음 걸음 하나만 가리킨다.
 * 화면을 막지 않고, 언제든 숨길 수 있고, 처음부터 다시 할 수 있다.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
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

const ORDER: { key: TutorialStep; ko: string }[] = [
  { key: "evidence", ko: "인터뷰에서 근거 찾기" },
  { key: "more", ko: "다른 자료로 가설 반박하기" },
  { key: "revisit", ko: "문제 다시 정의하기" },
  { key: "decide", ko: "결정 남기기" },
  { key: "handoff", ko: "인계 문서 만들기" },
];

export function TutorialGuide({ pid }: { pid: string }) {
  const router = useRouter();
  const doc = useDoc((s) => s.docs[pid]);
  const [hidden, setHidden] = useState(false);
  const [welcome, setWelcome] = useState(true);
  const [draft, setDraft] = useState<string | null>(null);
  if (!doc) return null;

  const { step, counter } = tutorialStep(doc);
  const idx = ORDER.findIndex((o) => o.key === step);
  const done = step === "done";

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
        className="absolute right-6 bottom-6 z-20 h-8 rounded-[6px] border border-line bg-surface px-3 text-[13px] font-medium shadow-[0_4px_12px_rgba(24,24,27,.08)] hover:bg-wash"
      >
        체험 안내 {done ? "" : `${idx + 1}/${ORDER.length}`}
      </button>
    );

  return (
    <div
      data-ui="tutorial"
      className="absolute right-6 bottom-6 z-20 flex w-[340px] flex-col gap-3 rounded-[10px] border border-line bg-surface p-4 shadow-[0_8px_24px_rgba(24,24,27,.12)] animate-fade-up"
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
            이 팀은 처음에 <b>“스터디 매칭 서비스”</b>를 만들려고 했습니다. 하지만 3주간의 리서치가 진행되면서 문제 정의가 완전히 달라집니다. 직접 따라가 보세요.
          </p>
          <Btn variant="ink" className="justify-between" onClick={() => { setWelcome(false); findEvidence(TUTORIAL_SOURCES[0].id); }}>
            인터뷰 자료에서 근거 찾기 <ChevronRight className="size-4" />
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
                <p className="kr text-[13px] leading-5 text-muted">인터뷰에서 근거 후보를 뽑고, 어느 카드에 어떤 관계로 붙일지 직접 고르세요.</p>
                <Btn variant="ink" onClick={() => findEvidence(TUTORIAL_SOURCES[0].id)}>인터뷰에서 근거 찾기</Btn>
              </>
            )}
            {step === "more" && (
              <>
                <p className="kr text-[13px] leading-5 text-muted">
                  가설 H-01에 반대 근거 {counter}건. 하나로 가설을 뒤집기엔 부족해요. 다른 자료도 확인해 볼까요?
                </p>
                <div className="flex gap-2">
                  <Btn className="flex-1" onClick={() => findEvidence("tut-competitor")}>경쟁 조사</Btn>
                  <Btn className="flex-1" onClick={() => findEvidence("tut-survey")}>설문 결과</Btn>
                </div>
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
                  onClick={() => {
                    const id = reviseProblem(pid, (draft ?? REVISED_PROBLEM).trim());
                    setDraft(null);
                    useUi.getState().select([id]);
                    toast("문제를 다시 정의했어요", { description: "Motive는 최종 문제만 남기지 않고, 왜 바뀌었는지도 함께 보존합니다." });
                  }}
                >
                  이 문장으로 P-02 만들기
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
                  onClick={() => {
                    const id = createTutorialDecision(pid, (draft ?? SUGGESTED_DECISION).trim());
                    setDraft(null);
                    useUi.getState().select([id]);
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
                <Btn variant="ink" onClick={() => router.push(`/think/${pid}/handoff`)}>인계 문서 만들기</Btn>
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
