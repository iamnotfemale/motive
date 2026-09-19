"use client";

/**
 * 서비스 소개 페이지. 와이어프레임 `Motive Landing` 을 옮겼다.
 * 장면(캔버스 그림)은 components/landing/Scene 이 그리고, 스크롤로 들어오면 나타난다.
 */
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Instrument_Serif } from "next/font/google";
import { SceneFrame } from "@/components/landing/Scene";
import { chal, ctx, hero, how, useCases, type UseCaseKey } from "@/components/landing/scenes";
import { cn } from "@/lib/utils";

const serif = Instrument_Serif({ weight: "400", style: ["normal", "italic"], subsets: ["latin"] });

const DOT_BG = {
  backgroundColor: "#fcfcfc",
  backgroundImage: "radial-gradient(circle at 1px 1px,#e4e4e7 1px,transparent 0)",
  backgroundSize: "24px 24px",
} as const;

const btnInk = "inline-flex items-center justify-center rounded-[6px] bg-ink font-medium text-white transition-[background] duration-[120ms] hover:bg-ink-hover hover:text-white";
const btnLine = "inline-flex items-center justify-center rounded-[6px] border border-line bg-surface font-medium text-ink transition-[background] duration-[120ms] hover:bg-wash";

export default function Landing() {
  const [uc, setUc] = useState<UseCaseKey>("hackathon");
  const U = useCases[uc];

  return (
    <div className="flex min-h-screen flex-col bg-wash-2 text-[16px] leading-[1.6]">
      {/* Nav */}
      <div className="sticky top-0 z-50 flex h-14 items-center border-b border-line/70 bg-wash-2/80 px-6 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1120px] items-center gap-2">
          <a href="#top" className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]"><Image src="/logo.png" alt="" width={22} height={17} priority />Motive</a>
          <span className="flex-1" />
          <nav className="hidden gap-1 sm:flex">
            {[["#product", "Product"], ["#usecases", "Use cases"], ["#why", "Why"], ["#oneplace", "Workflow"]].map(([href, label]) => (
              <a key={href} href={href} className="h-8 rounded-[6px] px-2.5 text-[14px] leading-8 text-[#3f3f46] hover:bg-wash hover:text-ink">{label}</a>
            ))}
          </nav>
          <span className="flex-1" />
          <Link href="/dashboard" className={cn(btnInk, "h-9 px-3.5 text-[14px] whitespace-nowrap")}>Start thinking</Link>
        </div>
      </div>

      {/* Hero */}
      <section id="top" className="relative px-6 pt-[clamp(72px,10vw,128px)]" style={{ background: "radial-gradient(70% 55% at 50% -10%, #e8f0fb 0%, rgba(250,250,250,0) 70%)" }}>
        <div className="mx-auto flex max-w-[1120px] flex-col items-center gap-6 text-center animate-fade-up">
          <h1 className={cn(serif.className, "text-[clamp(48px,8vw,104px)] leading-none font-normal tracking-[-0.02em] whitespace-nowrap")}>
            <Typewriter text="Motive Your Idea." />
          </h1>
          <p className="kr max-w-[560px] text-[clamp(16px,1.4vw,19px)] leading-[1.55] text-[#52525b] [text-wrap:pretty]">
            아이디어는 처음부터 정리되어 있지 않습니다.
          </p>
          <div className="mt-1 flex flex-wrap justify-center gap-2.5">
            <Link href="/dashboard" className={cn(btnInk, "h-11 px-5 text-[15px]")}>Start thinking</Link>
            <a href="#product" className={cn(btnLine, "h-11 px-[18px] text-[15px]")}>데모 보기</a>
          </div>
        </div>

        <div id="product" className="mx-auto mt-[clamp(48px,6vw,80px)] max-w-[1120px]">
          <SceneFrame
            spec={hero}
            w={1220}
            h={hero.h}
            className="rounded-[12px] border border-line bg-surface shadow-[0_30px_80px_rgba(24,24,27,.10),0_2px_6px_rgba(24,24,27,.04)]"
          >
            <HeroChrome />
          </SceneFrame>
        </div>
      </section>

      {/* Manifesto */}
      <section id="why" className="px-6 pt-[clamp(112px,14vw,200px)] pb-[clamp(96px,12vw,160px)]">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-[clamp(48px,6vw,88px)]">
          <h2 className={cn(serif.className, "max-w-[16ch] text-[clamp(44px,7.2vw,96px)] leading-none font-normal tracking-[-0.02em] [text-wrap:balance]")}>
            Thinking became non-linear.<br /><em className="text-muted">Our tools didn&apos;t.</em>
          </h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-x-8 gap-y-10 border-t border-line pt-10">
            {[
              ["01", "채팅은 흘러간다.", "어제 왜 그렇게 판단했는지는 스크롤 어딘가에 있다."],
              ["02", "문서는 구조를 먼저 요구한다.", "무엇이 불확실한지 알기 전에 목차부터 정한다. 버린 가설은 적히지 않는다."],
              ["03", "화이트보드는 다시 정리해야 한다.", "포스트잇은 사람만 읽는다. 에이전트에 넘기려면 누군가 처음부터 다시 쓴다."],
            ].map(([n, t, d]) => (
              <div key={n} className="flex flex-col gap-2.5">
                <div className="font-mono text-[13px] text-faint">{n}</div>
                <div className="kr text-[22px] leading-[1.3] font-semibold tracking-[-0.015em]">{t}</div>
                <p className="kr text-[15px] leading-[1.6] text-[#52525b]">{d}</p>
              </div>
            ))}
          </div>
          <p className="kr max-w-[720px] text-[clamp(20px,2.2vw,28px)] leading-[1.45] font-medium tracking-[-0.02em] [text-wrap:pretty]">
            Motive는 문서가 아니라 과정을 남깁니다. 문제, 가설, 근거, 검토 질문, 결정이 카드로 남고, 카드 사이의 관계가 맥락이 됩니다.
          </p>
        </div>
      </section>

      {/* How */}
      <section className="px-6 pb-[clamp(96px,12vw,160px)]">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-10">
          <SectionHead title={<>얼마나 나아갔는지보다,<br />문제가 얼마나 선명해졌는지.</>} desc="가설은 근거를 만나면 바뀌고, 반대 근거가 다음 해결안의 출발점이 되기도 합니다. 그 갈림길을 지우지 않습니다." />
          <SceneFrame spec={how} h={how.h} className="rounded-[12px] border border-line" style={DOT_BG} />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-8 gap-y-6 text-[15px] leading-[1.6] text-[#52525b]">
            <Point b="문제에서 출발">문제 문장이 첫 카드가 되고, 가설은 거기서 갈라져 나옵니다.</Point>
            <Point b="근거에는 방향이 있다">지지, 반대, 제안의 근거. 반대 근거는 지우지 않습니다.</Point>
            <Point b="검토 질문은 결정을 막지 않는다">미검증인 채로 결정하고, 그 위험을 같이 적습니다.</Point>
          </div>
        </div>
      </section>

      {/* Challenge (dark) */}
      <section className="bg-ink px-6 py-[clamp(96px,12vw,160px)] text-white">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-12">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-end gap-x-12 gap-y-6">
            <h2 className="kr text-[clamp(32px,4vw,56px)] leading-[1.1] font-semibold tracking-[-0.03em] [text-wrap:balance]">쌓기보다<br /><span className="text-faint">뒤집기.</span></h2>
            <p className="kr max-w-[460px] text-[16px] leading-[1.65] text-faint">채택한 해결안에 반대 근거가 붙으면 표시합니다. 결정을 되돌리거나, 근거를 기각하거나, 알고 진행하거나. 어느 쪽이든 인계 문서에 남습니다.</p>
          </div>
          <SceneFrame
            spec={chal}
            h={chal.h}
            dark
            className="rounded-[12px] border border-[#27272a]"
            style={{ backgroundColor: "#1c1c1f", backgroundImage: "radial-gradient(circle at 1px 1px,#2a2a2e 1px,transparent 0)", backgroundSize: "24px 24px" }}
          >
            <div className="absolute bottom-4 left-4 flex max-w-[1088px] items-center gap-3 rounded-[10px] border border-line bg-surface py-2 pr-2 pl-3.5 text-[14px] leading-[18px] text-ink shadow-[0_4px_12px_rgba(0,0,0,.2)]">
              <span className="size-1.5 shrink-0 rounded-full bg-danger" />
              <span className="font-medium whitespace-nowrap">어긋남 1건</span>
              <span className="kr min-w-0 text-[#52525b]">D-01이 S-01을 채택했습니다 (9/17). 9/18에 추가한 E-03이 이 해결안과 반대입니다.</span>
              <span className="h-7 rounded-[6px] border border-line px-2.5 leading-[26px] font-medium whitespace-nowrap">결정 되돌리기</span>
              <span className="h-7 rounded-[6px] border border-line px-2.5 leading-[26px] font-medium whitespace-nowrap">근거 기각</span>
              <span className="h-7 px-2.5 leading-7 text-muted whitespace-nowrap">알고 진행</span>
            </div>
          </SceneFrame>
        </div>
      </section>

      {/* Context */}
      <section className="px-6 pt-[clamp(112px,14vw,200px)] pb-[clamp(96px,12vw,160px)]">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-12">
          <div className="flex max-w-[880px] flex-col gap-4">
            <h2 className={cn(serif.className, "text-[clamp(44px,6.6vw,88px)] leading-none font-normal tracking-[-0.02em] [text-wrap:balance]")}>
              Don&apos;t give AI the answer.<br /><em>Give it the context.</em>
            </h2>
            <p className="kr max-w-[640px] text-[clamp(16px,1.4vw,19px)] leading-[1.6] text-[#52525b]">완성된 문서 대신, 출처와 근거, 기각한 대안, 열린 질문, 결정 이유가 정리된 맥락을 넘깁니다. Claude Code나 Codex가 이유를 다시 묻지 않습니다.</p>
          </div>
          <SceneFrame spec={ctx} h={ctx.h} className="rounded-[12px] border border-line" style={DOT_BG}>
            <HandoffPanel h={ctx.h - 80} />
          </SceneFrame>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-8 gap-y-5 border-t border-line pt-8 text-[15px] leading-[1.6] text-[#52525b]">
            <Point b="기각한 대안도 같이">같은 제안이 다시 올라오지 않습니다.</Point>
            <Point b="미검증은 미검증으로">상태를 꾸미지 않고 그대로 적습니다.</Point>
            <Point b="출처는 줄 번호까지">모든 근거가 원문에 닿습니다.</Point>
            <Point b="그냥 Markdown">붙여넣기 한 번이면 됩니다.</Point>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="usecases" className="px-6 pb-[clamp(96px,12vw,160px)]">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-10">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-end gap-x-12 gap-y-6">
            <h2 className="kr text-[clamp(30px,3.6vw,46px)] leading-[1.15] font-semibold tracking-[-0.03em]">짧은 시간에<br />결정을 많이 내리는 팀.</h2>
            <div className="flex flex-wrap gap-1 justify-self-start">
              {(Object.keys(useCases) as UseCaseKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setUc(k)}
                  className={cn("h-9 rounded-[6px] border px-3.5 text-[14px] font-medium transition-[background,border-color] duration-[120ms]", k === uc ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink hover:bg-wash")}
                >
                  {useCases[k].label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex max-w-[640px] flex-col gap-2">
            <div className="kr text-[clamp(22px,2.4vw,30px)] leading-[1.3] font-semibold tracking-[-0.02em]">{U.title}</div>
            <p className="kr text-[16px] leading-[1.65] text-[#52525b]">{U.desc}</p>
            <div className="text-[12px] text-faint">예시 · 합성 자료</div>
          </div>
          <SceneFrame key={uc} spec={U.scene} h={U.scene.h} immediate className="rounded-[12px] border border-line" style={DOT_BG} />
        </div>
      </section>

      {/* One place */}
      <section id="oneplace" className="px-6 pb-[clamp(96px,12vw,160px)]">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-10 border-t border-line pt-10">
          <SectionHead title={<>논의는 여기저기,<br />결론은 어디에도 없던 팀에게.</>} desc="노션에 정리하고, 카톡에서 정하고, 디스코드에 링크를 남기고, ChatGPT에 다시 묻습니다. Motive는 문제를 적는 순간부터 개발에 넘기는 순간까지 한 곳에서 끝냅니다." />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
            {[
              ["정의", "문제를 적는다", "가입 없이 문장 하나로 시작. 첫 카드 P-01이 생깁니다."],
              ["탐색", "가설과 자료를 붙인다", "인터뷰 노트, PDF, 링크를 카드에 놓습니다. 원문은 자료함에 남습니다."],
              ["검토", "근거를 고르고 반박한다", "후보 중 승인한 것만 근거가 되고, 어긋남은 따로 표시됩니다."],
              ["결정", "채택하고 범위를 정한다", "해결안을 채택하고 요구사항과 수용 기준을 적습니다. 기각한 대안도 남습니다."],
              ["인계", "에이전트에 넘긴다", "PROJECT_HANDOFF.md 하나. Claude Code, Codex에 붙여넣으면 됩니다."],
            ].map(([k, t, d], i, arr) => {
              const last = i === arr.length - 1;
              return (
                <div key={k} className={cn("flex flex-col gap-2.5 rounded-[10px] border p-5", last ? "border-ink bg-ink text-white" : "border-line bg-surface")}>
                  <span className="font-mono text-[12px] text-faint">{k}</span>
                  <div className="text-[16px] font-semibold">{t}</div>
                  <div className={cn("kr text-[14px] leading-[1.55]", last ? "text-faint" : "text-[#52525b]")}>{d}</div>
                </div>
              );
            })}
          </div>
          <div className="text-[13px] text-faint">가입 없이 브라우저에 저장됩니다. AI 후보 찾기는 서버 키로 켭니다. 키가 없어도 작성과 인계는 전부 됩니다.</div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-[clamp(96px,12vw,160px)]">
        <div className="relative mx-auto flex max-w-[1120px] flex-col items-center gap-7 overflow-hidden rounded-[16px] border border-line bg-surface px-[clamp(24px,5vw,80px)] py-[clamp(56px,8vw,112px)] text-center">
          <div className="pointer-events-none absolute inset-x-0 -bottom-[40%] h-[70%]" style={{ background: "radial-gradient(60% 60% at 50% 100%, #e8f0fb 0%, rgba(255,255,255,0) 70%)" }} />
          <h2 className="kr relative max-w-[20ch] text-[clamp(32px,4.6vw,64px)] leading-[1.1] font-semibold tracking-[-0.035em] [text-wrap:balance]">기록 대신,<br />다음 생각을 위한 맥락을.</h2>
          <div className="relative flex flex-wrap justify-center gap-2.5">
            <Link href="/dashboard" className={cn(btnInk, "h-12 px-6 text-[16px]")}>Start thinking</Link>
            <Link href="/dashboard?demo=1" className={cn(btnLine, "h-12 px-5 text-[16px]")}>데모 프로젝트 열기</Link>
          </div>
          <div className="relative text-[13px] text-faint">가입 없음 · 브라우저에 저장 · Markdown으로 내보내기</div>
        </div>
      </section>

      <footer className="px-6 pb-10">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-7 gap-y-4 border-t border-line pt-7 text-[14px] text-muted">
          <span className="font-semibold text-ink">Motive</span>
          <span className="flex-1" />
          <a href="#product" className="text-muted">Product</a>
          <a href="#why" className="text-muted">Resources</a>
          <a href="https://github.com/iamnotfemale/motive" className="text-muted" target="_blank" rel="noreferrer">Github</a>
        </div>
      </footer>
    </div>
  );
}

/** 한 글자씩 찍히는 제목. 커서는 계속 깜빡인다. 모션 축소 설정이면 바로 다 보인다. */
function Typewriter({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setN(text.length);
      return;
    }
    let i = 0;
    const start = setTimeout(function tick() {
      i += 1;
      setN(i);
      if (i < text.length) setTimeout(tick, 70 + Math.random() * 60);
    }, 350);
    return () => clearTimeout(start);
  }, [text]);
  return (
    <span aria-label={text}>
      {text.slice(0, n)}
      {/* 자리를 미리 잡아 줄이 흔들리지 않게 */}
      <span className="invisible">{text.slice(n)}</span>
      <span className="ml-[0.06em] inline-block h-[0.8em] w-[0.05em] translate-y-[0.08em] bg-ink animate-[blink_1s_steps(1)_infinite]" />
    </span>
  );
}

function SectionHead({ title, desc }: { title: React.ReactNode; desc: string }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-end gap-x-12 gap-y-6">
      <h2 className="kr text-[clamp(30px,3.6vw,46px)] leading-[1.15] font-semibold tracking-[-0.03em] [text-wrap:balance]">{title}</h2>
      <p className="kr max-w-[460px] text-[16px] leading-[1.65] text-[#52525b]">{desc}</p>
    </div>
  );
}

function Point({ b, children }: { b: string; children: React.ReactNode }) {
  return (
    <div className="kr">
      <b className="font-semibold text-ink">{b}</b> — {children}
    </div>
  );
}

/** 히어로 프레임의 워크스페이스 크롬(헤더·레일·도구 막대). 장식이라 동작은 없다. */
function HeroChrome() {
  return (
    <>
      <div className="absolute inset-x-0 top-0 z-[3] flex h-[52px] items-center gap-2 border-b border-line bg-surface pr-6 pl-5 text-[14px]">
        <span className="font-semibold tracking-[-0.01em]">Motive</span>
        <span className="mx-1.5 h-4 w-px bg-line" />
        <span className="inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2 font-medium">
          제출 체크룸
          <svg width="12" height="12" viewBox="0 0 16 16" className="fill-none stroke-faint stroke-[1.6]"><path d="M4 6l4 4 4-4" /></svg>
        </span>
        <span className="rounded-[4px] border border-line px-1.5 text-[12px] leading-[18px] text-muted">데모 자료</span>
        <div className="absolute left-1/2 flex h-[52px] -translate-x-1/2 gap-7 font-medium">
          {["정의", "탐색", "검토", "결정", "인계"].map((s) => (
            <span key={s} className={cn("relative flex items-center", s === "탐색" ? "text-ink" : "text-muted")}>
              {s}
              {s === "탐색" && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-[2px] bg-ink" />}
            </span>
          ))}
        </div>
        <span className="flex-1" />
        <span className="inline-flex items-center gap-1.5 text-[13px] text-[#3f3f46]"><span className="size-1.5 rounded-full bg-[#3f3f46]" />저장됨</span>
        <span className="h-7 rounded-[6px] px-2.5 leading-7 text-muted">인계 전 확인 2개</span>
        <span className="h-8 rounded-[6px] bg-ink px-3.5 leading-8 font-medium text-white">개발 인계</span>
      </div>
      <div className="absolute top-[72px] left-4 z-[3] flex w-12 flex-col items-center gap-0.5 rounded-[10px] border border-line bg-surface py-1.5 text-muted shadow-[0_2px_12px_rgba(24,24,27,.07)]">
        {[
          "M6 14l1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2",
          "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM21 21l-4.3-4.3",
          "M3 3h18v18H3zM3 12h18M12 3v18",
          "M13.2 6.4L6.7 12.9a3 3 0 1 0 4.2 4.2l7.4-7.4a5 5 0 1 0-7.1-7.1L4.1 9.7",
        ].map((d, i) => (
          <span key={i} className={cn("flex h-8 w-9 items-center justify-center rounded-[6px]", i === 2 && "bg-brand-wash text-brand")}>
            <svg width="18" height="18" viewBox="0 0 24 24" className="fill-none stroke-current stroke-[1.8]" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
          </span>
        ))}
      </div>
      <span className="absolute bottom-5 left-4 z-[3] flex size-11 items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-white">N</span>
      <span className="absolute right-5 bottom-4 z-[3] text-[13px] text-faint">9 카드 · 6 관계</span>
      <div className="absolute bottom-6 left-1/2 z-[3] flex h-12 -translate-x-1/2 items-center gap-0.5 rounded-[10px] border border-line bg-surface px-1.5 text-[14px] text-muted shadow-[0_6px_24px_rgba(24,24,27,.10)]">
        <span className="flex size-8 items-center justify-center rounded-[6px] bg-brand-wash text-brand">
          <svg width="18" height="18" viewBox="0 0 24 24" className="fill-none stroke-current stroke-[1.8]" strokeLinejoin="round"><path d="M4.04 3.04l16.4 7.03a.5.5 0 0 1-.07.94l-6.5 1.6a1 1 0 0 0-.73.73l-1.6 6.5a.5.5 0 0 1-.94.07L3.57 3.5a.5.5 0 0 1 .47-.46z" /></svg>
        </span>
        <span className="flex size-8 items-center justify-center text-[20px] leading-none">+</span>
        <span className="mx-1 h-5 w-px bg-line" />
        <span className="h-8 px-2.5 leading-8 font-medium text-ink">정리</span>
        <span className="mx-1 h-5 w-px bg-line" />
        <span className="h-8 px-2 leading-8 font-medium text-ink">자료</span>
        <span className="h-8 px-2 leading-8 font-medium text-ink">근거 뽑기</span>
        <span className="mx-1 h-5 w-px bg-line" />
        <span className="w-7 text-center text-[16px]">−</span>
        <span className="min-w-12 text-center font-mono text-ink">100%</span>
        <span className="w-7 text-center text-[16px]">+</span>
      </div>
    </>
  );
}

const ROWS: [string, string][] = [
  ["문제", "P-01"],
  ["선택한 해결안", "S-01"],
  ["요구사항 · 수용 기준", "R-01 R-02"],
  ["결정 이유", "D-01"],
  ["반대 근거", "E-02 E-03"],
  ["미검증 가설 · 열린 질문", "H-01 C-01"],
  ["제외 범위", "S-02"],
  ["출처", "interview-demo.md"],
];

function HandoffPanel({ h }: { h: number }) {
  return (
    <div className="absolute top-10 left-[700px] flex w-[400px] flex-col overflow-hidden rounded-[10px] border border-line bg-surface text-[14px] shadow-[0_12px_40px_rgba(24,24,27,.08)]" style={{ height: h }}>
      <div className="flex h-12 items-center gap-2 border-b border-line px-4">
        <span className="font-mono text-[13px] font-semibold whitespace-nowrap">PROJECT_HANDOFF.md</span>
        <span className="flex-1" />
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[#3f3f46] whitespace-nowrap"><span className="size-1.5 rounded-full bg-[#3f3f46]" />인계 준비됨</span>
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-2">
        {ROWS.map(([title, ids], i) => (
          <div key={title} className={cn("flex h-[46px] items-center gap-3 rounded-[6px] px-2.5", (i === 4 || i === 5) && "bg-wash-2")}>
            <span className="w-4 font-mono text-[12px] text-faint">{i + 1}</span>
            <span className="flex-1 font-medium">{title}</span>
            <span className="font-mono text-[12px] text-muted">{ids}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-line px-4 py-3 text-[12px] text-muted">
        <span className="kr flex-1">미확인 항목은 그대로 남깁니다.</span>
        <span className="h-[30px] rounded-[6px] border border-line bg-surface px-2.5 text-[14px] leading-7 font-medium text-ink whitespace-nowrap">Markdown 복사</span>
        <span className="h-[30px] rounded-[6px] bg-ink px-2.5 text-[14px] leading-[30px] font-medium text-white whitespace-nowrap">파일 다운로드</span>
      </div>
    </div>
  );
}
