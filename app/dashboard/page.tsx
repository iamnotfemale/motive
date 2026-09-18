"use client";

/**
 * 관리 페이지(워크스페이스 홈). 와이어프레임 `Motive Home` 을 옮겼다.
 * 아이디어(캔버스 목록) / 파일(자료) / 설정. 캔버스를 열면 /think/[id] 로 간다.
 */
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Folder, LayoutGrid, List, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Search, Settings, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/kit";
import { SceneFrame, REL, type Rel, type SceneNode, type SceneSpec } from "@/components/landing/Scene";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { edgeLabel, kindOf } from "@/lib/labels";
import { titleOf } from "@/lib/md";
import { useDoc, type Doc } from "@/lib/store";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

type View = "ideas" | "files" | "trash" | "settings";

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d}일 전` : new Date(iso).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
};

const THUMB_W = 1120;
const THUMB_H = 420;

/** 실제 캔버스를 썸네일 장면으로. 카드 배치를 좌상단에 붙이고 프레임 크기는 고정. */
function thumbOf(doc: Doc): SceneSpec {
  const relOf = (label: string) => (Object.keys(REL) as Rel[]).find((k) => REL[k] === label) ?? "related";
  const placed = doc.nodes.filter((n) => doc.placements[n.id]);
  const srcs = doc.sources.filter((s) => doc.placements[s.id]);
  const xs = [...placed, ...srcs].map((n) => doc.placements[n.id]);
  const minX = xs.length ? Math.min(...xs.map((p) => p.x)) : 0;
  const minY = xs.length ? Math.min(...xs.map((p) => p.y)) : 0;
  const nodes: SceneNode[] = [
    ...placed.map((n) => {
      const title = titleOf(n.md) || "(제목 없음)";
      return {
        id: n.id,
        type: kindOf(n),
        title,
        lines: Math.min(3, Math.max(1, Math.ceil(title.length / 18))),
        x: doc.placements[n.id].x - minX + 24,
        y: doc.placements[n.id].y - minY + 24,
        proposed: n.proposed,
      };
    }),
    ...srcs.map((s) => ({
      id: s.id,
      type: "source" as const,
      title: s.name,
      state: s.state === "read" ? "읽음" : s.state === "no-text" ? "텍스트 없음" : "첨부",
      x: doc.placements[s.id].x - minX + 24,
      y: doc.placements[s.id].y - minY + 24,
    })),
  ];
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  return {
    nodes,
    edges: doc.edges.map((e) => [e.from, e.to, relOf(edgeLabel(e, byId.get(e.to)))]),
  };
}

export default function Dashboard() {
  return (
    <Suspense>
      <DashboardInner />
    </Suspense>
  );
}

function DashboardInner() {
  const router = useRouter();
  const params = useSearchParams();
  const allProjects = useDoc((s) => s.projects);
  const projects = useMemo(() => allProjects.filter((p) => !p.deletedAt), [allProjects]);
  const trashed = useMemo(() => allProjects.filter((p) => p.deletedAt), [allProjects]);
  const docs = useDoc((s) => s.docs);
  const createProject = useDoc((s) => s.createProject);
  const createDemoProject = useDoc((s) => s.createDemoProject);
  const trashProject = useDoc((s) => s.trashProject);
  const restoreProject = useDoc((s) => s.restoreProject);
  const deleteProject = useDoc((s) => s.deleteProject);
  const renameProject = useDoc((s) => s.renameProject);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const unsub = useDoc.persist.onFinishHydration(() => setHydrated(true));
    if (useDoc.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  useEffect(() => {
    if (hydrated) useDoc.getState().purgeTrash();
  }, [hydrated]);

  // 소개 페이지의 "데모 프로젝트 열기" → /dashboard?demo=1
  useEffect(() => {
    if (!hydrated || params.get("demo") !== "1") return;
    const existing = projects.find((p) => p.demo);
    router.replace(`/think/${existing ? existing.id : createDemoProject()}`);
  }, [hydrated, params, projects, createDemoProject, router]);

  const [view, setView] = useState<View>("ideas");
  const [open, setOpen] = useState(true);
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [q, setQ] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [newBody, setNewBody] = useState("");
  const [newErr, setNewErr] = useState(false);
  const newRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (newOpen) newRef.current?.focus();
  }, [newOpen]);

  const ql = q.trim().toLowerCase();
  const canvases = useMemo(
    () => projects.filter((p) => !ql || p.name.toLowerCase().includes(ql) || p.problemStatement.toLowerCase().includes(ql)),
    [projects, ql],
  );

  function startNew() {
    const b = newBody.trim();
    if (!b) {
      setNewErr(true);
      newRef.current?.focus();
      return;
    }
    const pid = createProject(b);
    setNewOpen(false);
    setNewBody("");
    router.push(`/think/${pid}`);
  }

  function remove(p: Project) {
    trashProject(p.id);
    toast("휴지통으로 옮겼어요", { action: { label: "되돌리기", onClick: () => restoreProject(p.id) } });
  }

  function rename(p: Project) {
    const name = prompt("캔버스 이름", p.name)?.trim();
    if (name && name !== p.name) renameProject(p.id, name);
  }

  const sources = useMemo(
    () =>
      projects.flatMap((p) =>
        (docs[p.id]?.sources ?? []).map((s) => ({
          ...s,
          project: p,
          used: (docs[p.id]?.nodes ?? []).filter((n) => n.sourceId === s.id).length,
        })),
      ),
    [projects, docs],
  );

  const NAV: { key: View; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "ideas", label: "아이디어", icon: <LayoutGrid className="size-4" />, count: projects.length },
    { key: "files", label: "파일", icon: <FileText className="size-4" />, count: sources.length },
  ];

  const navBtn = (active: boolean) =>
    cn(
      "flex h-[34px] w-full items-center gap-2.5 rounded-[6px] px-2.5 text-left text-[14px] transition-[background] duration-[120ms] hover:bg-wash hover:text-ink",
      active ? "bg-wash font-semibold text-ink" : "text-[#52525b]",
    );

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Sidebar */}
      <aside
        className="sticky top-0 flex h-screen shrink-0 flex-col gap-1 border-r border-line bg-wash-2 px-2.5 py-3 transition-[width] duration-200"
        style={{ width: open ? 248 : 60 }}
      >
        <div className="flex h-9 items-center gap-2 px-1.5">
          {open && <Link href="/" className="flex flex-1 items-center gap-2 pl-1.5 text-[15px] font-semibold tracking-[-0.01em]"><Image src="/logo.png" alt="" width={22} height={17} />Motive</Link>}
          <Btn variant="ghost" size="icon" onClick={() => setOpen((o) => !o)} title={open ? "사이드바 접기" : "사이드바 펼치기"}>
            {open ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
          </Btn>
        </div>
        <button
          type="button"
          onClick={() => {
            setView("ideas");
            setTimeout(() => document.getElementById("dash-q")?.focus(), 0);
          }}
          className={cn(navBtn(false), "mt-1 text-muted")}
          title="검색"
        >
          <Search className="size-4 shrink-0" />
          {open && <span className="flex-1">검색</span>}
        </button>
        <div className="mx-1.5 my-2 h-px bg-line" />
        {NAV.map((n) => (
          <button key={n.key} type="button" onClick={() => setView(n.key)} className={navBtn(view === n.key)} title={n.label}>
            <span className="shrink-0">{n.icon}</span>
            {open && (
              <>
                <span className="flex-1 whitespace-nowrap">{n.label}</span>
                {n.count != null && <span className="text-[12px] text-faint">{n.count}</span>}
              </>
            )}
          </button>
        ))}
        {open && projects.length > 0 && (
          <>
            <div className="mt-3.5 px-2.5 text-[12px] font-medium tracking-[.02em] text-faint">프로젝트</div>
            {projects.slice(0, 8).map((p) => (
              <Link key={p.id} href={`/think/${p.id}`} className="flex h-8 min-w-0 items-center gap-2.5 rounded-[6px] px-2.5 text-[14px] hover:bg-wash">
                <Folder className="size-4 shrink-0 text-muted" />
                <span className="flex-1 truncate">{p.name}</span>
                {p.demo && <span className="text-[11px] text-faint">데모</span>}
              </Link>
            ))}
          </>
        )}
        <span className="flex-1" />
        <button type="button" onClick={() => setView("trash")} className={cn(navBtn(view === "trash"), view !== "trash" && "text-muted")} title="휴지통">
          <Trash2 className="size-4 shrink-0" />
          {open && (
            <>
              <span className="flex-1">휴지통</span>
              {trashed.length > 0 && <span className="text-[12px] text-faint">{trashed.length}</span>}
            </>
          )}
        </button>
        <button type="button" onClick={() => setView("settings")} className={cn(navBtn(view === "settings"), view !== "settings" && "text-muted")} title="설정">
          <Settings className="size-4 shrink-0" />
          {open && <span>설정</span>}
        </button>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-[5] flex h-13 items-center gap-2 border-b border-line bg-surface px-6">
          <span className="font-semibold tracking-[-0.01em]">{{ ideas: "아이디어", files: "파일", trash: "휴지통", settings: "설정" }[view]}</span>
          <span className="flex-1" />
          <span className="inline-flex items-center gap-1.5 text-[13px] text-[#3f3f46]"><span className="size-1.5 rounded-full bg-[#3f3f46]" />이 브라우저에 저장됨</span>
          <Link href="/" className="h-7 rounded-[6px] px-2.5 text-[13px] leading-7 text-muted hover:bg-wash hover:text-ink">소개 페이지</Link>
        </div>

        <div className="mx-auto w-full max-w-[1240px] flex-1 px-[clamp(24px,4vw,64px)] pt-10 pb-20">
          {!hydrated ? (
            <div className="text-[14px] text-muted">불러오는 중…</div>
          ) : view === "ideas" ? (
            <div className="flex flex-col gap-8 animate-fade-up">
              <div className="flex flex-wrap items-end gap-4">
                <Head title="아이디어" count={projects.length} />
                <span className="flex-1" />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex h-9 w-60 items-center gap-2 rounded-[6px] border border-line bg-surface px-2.5 focus-within:border-brand">
                    <Search className="size-[15px] shrink-0 text-faint" />
                    <input id="dash-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="캔버스 검색" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint" />
                  </label>
                  <div className="flex overflow-hidden rounded-[6px] border border-line bg-surface">
                    {(["grid", "list"] as const).map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setLayout(l)}
                        title={l === "grid" ? "카드 보기" : "목록 보기"}
                        className={cn("flex size-[34px] items-center justify-center", l === "list" && "border-l border-line", layout === l ? "bg-wash text-ink" : "text-muted hover:bg-wash")}
                      >
                        {l === "grid" ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
                      </button>
                    ))}
                  </div>
                  <Btn variant="ink" size="lg" onClick={() => { setNewOpen(true); setNewErr(false); }} className="gap-1.5">
                    <Plus className="size-4" />새 캔버스
                  </Btn>
                </div>
              </div>

              {newOpen && (
                <div className="rounded-[8px] border border-brand bg-surface py-1 shadow-[0_0_0_3px_#eff6ff] animate-fade-up">
                  <textarea
                    ref={newRef}
                    value={newBody}
                    rows={3}
                    onChange={(e) => { setNewBody(e.target.value); setNewErr(false); }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setNewOpen(false);
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) startNew();
                    }}
                    placeholder="어떤 문제를 풀고 있나요? 한두 문장이면 됩니다."
                    className="kr block w-full resize-none border-0 bg-transparent px-5 pt-4 pb-2 text-[16px] leading-7 outline-none placeholder:text-faint"
                  />
                  <div className="flex items-center gap-2.5 border-t border-wash px-5 pt-2 pb-3">
                    <span className={cn("text-[13px]", newErr ? "text-danger" : "text-muted")}>
                      {newErr ? "문제를 한 줄이라도 적어주세요." : newBody.trim() ? `${newBody.trim().length}자 · 저장 전` : "가입 없이 바로 시작합니다"}
                    </span>
                    <span className="flex-1" />
                    <Btn onClick={() => setNewOpen(false)}>취소</Btn>
                    <Btn variant="ink" onClick={startNew}>캔버스 시작</Btn>
                  </div>
                </div>
              )}

              {projects.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-[10px] border border-dashed border-line px-4 py-14 text-center">
                  <p className="kr text-[14px] text-muted">아직 캔버스가 없어요. 문제 한 줄로 시작하거나 데모를 열어보세요.</p>
                  <div className="flex gap-2">
                    <Btn variant="ink" onClick={() => setNewOpen(true)}>새 캔버스</Btn>
                    <Btn onClick={() => router.push(`/think/${createDemoProject()}`)}>데모 프로젝트 열기</Btn>
                  </div>
                </div>
              ) : canvases.length === 0 ? (
                <div className="py-10 text-center text-[13px] text-muted">검색 결과가 없어요.</div>
              ) : layout === "grid" ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
                  {canvases.map((p) => {
                    const doc = docs[p.id];
                    const spec = doc ? thumbOf(doc) : { nodes: [], edges: [] };
                    return (
                      <div key={p.id} className="group relative flex flex-col overflow-hidden rounded-[10px] border border-line bg-surface transition-[border-color,box-shadow] duration-[120ms] hover:border-line-strong hover:shadow-[0_4px_12px_rgba(24,24,27,.06)]">
                        <Link href={`/think/${p.id}`} className="contents">
                          <SceneFrame
                            spec={spec}
                            w={THUMB_W}
                            h={THUMB_H}
                            immediate
                            className="pointer-events-none border-b border-wash"
                            style={{ backgroundColor: "#fcfcfc", backgroundImage: "radial-gradient(circle at 1px 1px,#e4e4e7 1px,transparent 0)", backgroundSize: "16px 16px" }}
                            overlay={spec.nodes.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-[13px] text-faint">아직 카드가 없습니다</div>}
                          />
                          <div className="flex flex-col gap-2 px-4 pt-3.5 pb-3">
                            <div className="flex items-center gap-2 pr-7">
                              <span className="flex-1 truncate text-[15px] font-semibold">{p.name}</span>
                              {p.demo && <span className="rounded-[4px] border border-line px-1.5 text-[12px] leading-[18px] text-muted">데모 자료</span>}
                            </div>
                            <div className="kr line-clamp-2 text-[13px] leading-[19px] text-muted">{p.problemStatement}</div>
                            <div className="mt-0.5 flex items-center gap-2.5 text-[12px] text-muted">
                              <span>카드 {doc?.nodes.length ?? 0}</span>
                              <span>자료 {doc?.sources.length ?? 0}</span>
                              <span className="flex-1" />
                              <span>{ago(p.updatedAt)}</span>
                            </div>
                          </div>
                        </Link>
                        <CardMenu onRename={() => rename(p)} onDelete={() => remove(p)} className="absolute right-2.5 bottom-[72px]" />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
                  <div className="grid h-9 grid-cols-[minmax(0,2fr)_72px_72px_96px_32px] items-center gap-3 border-b border-line bg-wash-2 px-4 text-[12px] text-muted">
                    <span>캔버스</span><span>카드</span><span>자료</span><span className="text-right">수정</span><span />
                  </div>
                  {canvases.map((p) => {
                    const doc = docs[p.id];
                    return (
                      <div key={p.id} className="grid h-12 grid-cols-[minmax(0,2fr)_72px_72px_96px_32px] items-center gap-3 border-b border-wash px-4 text-[14px] hover:bg-wash-2">
                        <Link href={`/think/${p.id}`} className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-medium">{p.name}</span>
                          {p.demo && <span className="text-[11px] text-faint">데모</span>}
                        </Link>
                        <span className="text-muted">{doc?.nodes.length ?? 0}</span>
                        <span className="text-muted">{doc?.sources.length ?? 0}</span>
                        <span className="text-right text-muted">{ago(p.updatedAt)}</span>
                        <CardMenu onRename={() => rename(p)} onDelete={() => remove(p)} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : view === "files" ? (
            <div className="flex flex-col gap-7 animate-fade-up">
              <Head title="파일" count={sources.length} />
              <div className="kr text-[13px] text-muted">캔버스에 떨어뜨린 자료입니다. 원문은 그대로 보관되고, 근거 카드는 파일과 줄 번호로 여기에 연결됩니다.</div>
              {sources.length === 0 ? (
                <div className="kr rounded-[10px] border border-dashed border-line px-4 py-10 text-center text-[13px] text-muted">아직 자료가 없어요. 파일 첨부는 캔버스 안에서 합니다 — 어느 카드에 붙일지 정해야 하기 때문입니다.</div>
              ) : (
                <div className="-mx-2 flex flex-col">
                  <div className="grid h-9 grid-cols-[minmax(0,2.4fr)_140px_minmax(0,1.2fr)_80px_96px] items-center gap-4 border-b border-line px-2 text-[12px] text-muted">
                    <span>이름</span><span>상태</span><span>캔버스</span><span>근거</span><span className="text-right">추가</span>
                  </div>
                  {sources.map((s) => {
                    const tone = s.state === "read" ? "#3f3f46" : s.state === "no-text" || s.state === "failed" ? "#9a6700" : "#71717a";
                    const stateKo = { read: "읽음", reading: "읽는 중", attached: "첨부만", "no-text": "텍스트 없음", failed: "실패" }[s.state];
                    return (
                      <Link key={s.id} href={`/think/${s.project.id}`} className="grid h-14 grid-cols-[minmax(0,2.4fr)_140px_minmax(0,1.2fr)_80px_96px] items-center gap-4 rounded-[6px] border-b border-wash px-2 text-[14px] hover:bg-wash">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <FileText className="size-4 shrink-0 text-faint" />
                          <span className="truncate font-mono text-[13px]">{s.name}</span>
                          {s.tag && <span className="rounded-[4px] bg-wash px-1.5 text-[12px] leading-[18px] text-muted whitespace-nowrap">{s.tag}</span>}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: tone }}><span className="size-1.5 rounded-full" style={{ background: tone }} />{stateKo}</span>
                        <span className="truncate text-muted">{s.project.name}</span>
                        <span className="text-muted">{s.used || "—"}</span>
                        <span className="text-right text-muted">{ago(s.createdAt)}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ) : view === "trash" ? (
            <div className="flex flex-col gap-6 animate-fade-up">
              <Head title="휴지통" count={trashed.length} />
              {trashed.length === 0 ? (
                <div className="kr rounded-[10px] border border-dashed border-line px-4 py-10 text-center text-[13px] text-muted">비어 있습니다. 지운 캔버스는 30일 동안 여기에 남습니다.</div>
              ) : (
                <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
                  {trashed.map((p) => (
                    <div key={p.id} className="flex h-12 items-center gap-3 border-b border-wash px-4 text-[14px]">
                      <span className="flex-1 truncate font-medium">{p.name}</span>
                      <span className="text-[12px] text-faint">{ago(p.deletedAt!)} 지움</span>
                      <Btn size="sm" onClick={() => { restoreProject(p.id); toast("복원했어요"); }}>복원</Btn>
                      <Btn size="sm" variant="danger" onClick={() => { if (confirm(`"${p.name}" 을 영구 삭제할까요? 되돌릴 수 없어요.`)) deleteProject(p.id); }}>영구 삭제</Btn>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <SettingsView />
          )}
        </div>
      </main>
    </div>
  );
}

function Head({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[13px] text-muted">Workspace</span>
      <h1 className="flex items-baseline gap-2.5 text-[28px] leading-[34px] font-semibold tracking-[-0.02em]">
        {title}
        {count != null && <span className="text-[14px] font-normal text-faint">{count}</span>}
      </h1>
    </div>
  );
}

function CardMenu({ onRename, onDelete, className }: { onRename: () => void; onDelete: () => void; className?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Btn variant="ghost" size="icon" className={className} title="더 보기">
          <MoreHorizontal className="size-4" />
        </Btn>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onSelect={onRename} className="text-[14px]">이름 바꾸기</DropdownMenuItem>
        <DropdownMenuItem onSelect={onDelete} className="text-[14px] text-danger">지우기</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SettingsView() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [ai, setAi] = useState<"checking" | "on" | "off">("checking");
  const [used, setUsed] = useState("");
  useEffect(() => {
    fetch("/api/ai", { method: "POST", body: "{}" })
      .then((r) => r.json())
      .then((d) => setAi(d?.aiOff ? "off" : "on"))
      .catch(() => setAi("off"));
    const bytes = new Blob([localStorage.getItem("motive.doc.v1") ?? ""]).size;
    setUsed(bytes < 1024 * 1024 ? `약 ${Math.max(1, Math.round(bytes / 1024))} KB 사용` : `약 ${(bytes / 1024 / 1024).toFixed(1)} MB 사용`);
  }, []);

  function exportAll() {
    const blob = new Blob([useDoc.getState().exportAll()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `motive-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importFile(f: File | undefined) {
    if (!f) return;
    const ok = useDoc.getState().importAll(await f.text());
    toast(ok ? "백업을 합쳤어요" : "Motive 백업 파일이 아니에요");
    if (fileRef.current) fileRef.current.value = "";
  }

  function wipe() {
    if (!confirm("이 브라우저의 Motive 데이터를 모두 지울까요? 프로젝트도 함께 사라져요.")) return;
    localStorage.removeItem("motive.doc.v1");
    location.href = "/dashboard";
  }

  const row = "grid grid-cols-[160px_1fr] items-start gap-x-4 gap-y-3.5 text-[14px]";
  return (
    <div className="flex max-w-[720px] flex-col gap-8 animate-fade-up">
      <Head title="설정" />
      <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
        <div className={cn(row, "p-4")}>
          <span className="text-muted">계정</span>
          <span className="kr">없음. 가입 없이 쓰고, 데이터는 이 브라우저에만 저장됩니다.</span>
          <span className="text-muted">저장 위치</span>
          <span className="flex flex-wrap items-center gap-2.5"><span className="font-mono text-[13px]">localStorage · motive.doc.v1</span><span className="text-[12px] text-muted">{used}</span></span>
          <span className="text-muted">AI 연결</span>
          <span className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: ai === "on" ? "#3f3f46" : "#9a6700" }}>
              <span className="size-1.5 rounded-full" style={{ background: ai === "on" ? "#3f3f46" : "#9a6700" }} />
              {ai === "checking" ? "확인 중…" : ai === "on" ? "연결됨" : "미연결 — 직접 작성과 인계는 그대로 됩니다"}
            </span>
            <span className="kr text-[13px] text-muted">서버 환경변수 <span className="font-mono">OPENROUTER_API_KEY</span> 로 켭니다. 근거 후보 찾기와 문제 다듬기에만 쓰이고, 원문은 동의한 경우에만 전송됩니다.</span>
          </span>
          <span className="text-muted">단축키</span>
          <span className="flex flex-wrap gap-3.5 text-[13px] text-[#52525b]">
            <span><b className="font-mono font-medium text-ink">⌘K</b> 검색</span>
            <span><b className="font-mono font-medium text-ink">N</b> 카드 추가</span>
            <span><b className="font-mono font-medium text-ink">V / H</b> 선택 · 손</span>
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-3 rounded-[10px] border border-line bg-surface p-4">
        <div className="font-semibold">데이터</div>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={exportAll}>전체 내보내기 (.json)</Btn>
          <Btn onClick={() => fileRef.current?.click()}>가져오기</Btn>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => importFile(e.target.files?.[0])} />
          <span className="flex-1" />
          <Btn variant="danger" onClick={wipe}>이 브라우저의 데이터 지우기</Btn>
        </div>
        <div className="kr text-[13px] text-muted">브라우저 데이터를 지우면 프로젝트도 함께 사라집니다. 먼저 내보내 두세요. 가져오기는 같은 id 의 캔버스를 파일 쪽으로 덮어씁니다.</div>
      </div>
    </div>
  );
}
