"use client";

/**
 * 노션식 블록 편집기. 저장되는 것은 여전히 md 문자열 하나다 (lib/blocks.ts).
 *
 * - `/` 로 블록 유형 메뉴
 * - `## `, `- `, `> ` 같은 표식을 치면 그 자리에서 유형이 바뀜
 * - 손잡이를 끌어 순서 변경
 * - 빈 블록에서 Backspace 로 삭제
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { GripVertical, Plus } from "lucide-react";
import {
  BLOCK_MENU,
  CODE_LANGS,
  type Block,
  type BlockType,
  type CodeLang,
  autoType,
  blocksToMd,
  emptyBlock,
  mdToBlocks,
} from "@/lib/blocks";
import { cn } from "@/lib/utils";

interface Props {
  /** 다른 카드로 옮겨갈 때 블록을 다시 읽기 위한 키. */
  nodeId: string;
  title: string;
  md: string;
  onChange: (md: string) => void;
}

/** 손잡이를 블록 첫 줄 가운데에 맞춘다. 줄 높이가 유형마다 달라서 값을 따로 둔다. */
const GRIP_TOP: Record<BlockType, string> = {
  h1: "mt-[7px]",
  h2: "mt-[5px]",
  h3: "mt-[4px]",
  text: "mt-[4px]",
  list: "mt-[4px]",
  check: "mt-[4px]",
  quote: "mt-[4px]",
  code: "mt-[9px]",
  divider: "mt-[9px]",
};

export function BlockEditor({ nodeId, title, md, onChange }: Props) {
  const [blocks, setBlocks] = useState<Block[]>(() => mdToBlocks(md));
  const [slash, setSlash] = useState<{ id: string; query: string } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  // 안내 문구는 지금 커서가 있는 빈 블록에만 띄운다. 노션과 같게.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const focusNext = useRef<{ id: string; at: "start" | "end" } | null>(null);

  // 카드를 바꿀 때만 다시 읽는다. 편집 중에 밖에서 md 가 돌아와도 커서를 잃지 않는다.
  useEffect(() => {
    setBlocks(mdToBlocks(md));
    setSlash(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  useEffect(() => {
    const want = focusNext.current;
    if (!want) return;
    focusNext.current = null;
    const el = refs.current[want.id];
    if (!el) return;
    // preventScroll 이 없으면 브라우저가 조상 요소를 스크롤해 캔버스가 튄다.
    el.focus({ preventScroll: true });
    const pos = want.at === "start" ? 0 : el.value.length;
    el.setSelectionRange(pos, pos);
  }, [blocks]);

  const commit = useCallback(
    (next: Block[]) => {
      setBlocks(next);
      onChange(blocksToMd(title, next));
    },
    [onChange, title],
  );

  const patch = (id: string, p: Partial<Block>) =>
    commit(blocks.map((b) => (b.id === id ? { ...b, ...p } : b)));

  const insertAfter = (id: string, type: BlockType = "text") => {
    const i = blocks.findIndex((b) => b.id === id);
    const nb = emptyBlock(type);
    const next = [...blocks];
    next.splice(i + 1, 0, nb);
    focusNext.current = { id: nb.id, at: "start" };
    commit(next);
  };

  const removeBlock = (id: string) => {
    const i = blocks.findIndex((b) => b.id === id);
    if (i === -1) return;
    const prev = blocks[i - 1];
    if (prev) focusNext.current = { id: prev.id, at: "end" };
    commit(blocks.filter((b) => b.id !== id));
  };

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>, b: Block) {
    const el = e.currentTarget;

    if (slash?.id === b.id && (e.key === "Escape" || e.key === "ArrowDown" || e.key === "ArrowUp")) {
      if (e.key === "Escape") setSlash(null);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey && b.type !== "code") {
      e.preventDefault();
      if (slash) return;
      const after = el.value.slice(el.selectionStart);
      const before = el.value.slice(0, el.selectionStart);
      const i = blocks.findIndex((x) => x.id === b.id);
      // 목록·체크는 같은 유형으로 이어지고, 나머지는 본문으로 떨어진다
      const nextType: BlockType = b.type === "list" || b.type === "check" ? b.type : "text";
      const nb: Block = { ...emptyBlock(nextType), text: after };
      const next = [...blocks];
      next[i] = { ...b, text: before };
      next.splice(i + 1, 0, nb);
      focusNext.current = { id: nb.id, at: "start" };
      commit(next);
      return;
    }

    if (e.key === "Backspace" && el.selectionStart === 0 && el.selectionEnd === 0) {
      if (b.text === "") {
        e.preventDefault();
        if (blocks.length > 1) removeBlock(b.id);
        return;
      }
      if (b.type !== "text") {
        // 유형만 벗긴다. 내용은 남긴다.
        e.preventDefault();
        patch(b.id, { type: "text", checked: undefined });
        return;
      }
    }

    if (e.key === "ArrowUp" && el.selectionStart === 0) {
      const i = blocks.findIndex((x) => x.id === b.id);
      if (i > 0) {
        e.preventDefault();
        focusNext.current = { id: blocks[i - 1].id, at: "end" };
        setBlocks([...blocks]);
      }
    }
    if (e.key === "ArrowDown" && el.selectionStart === el.value.length) {
      const i = blocks.findIndex((x) => x.id === b.id);
      if (i < blocks.length - 1) {
        e.preventDefault();
        focusNext.current = { id: blocks[i + 1].id, at: "start" };
        setBlocks([...blocks]);
      }
    }
  }

  function onInput(b: Block, value: string) {
    // `/` 로 시작하면 블록 메뉴
    if (value.startsWith("/")) {
      setSlash({ id: b.id, query: value.slice(1) });
      patch(b.id, { text: value });
      return;
    }
    if (slash?.id === b.id) setSlash(null);

    // 표식을 치면 유형 전환
    const auto = autoType(value);
    if (auto && auto.type !== b.type) {
      if (auto.type === "divider") {
        const i = blocks.findIndex((x) => x.id === b.id);
        const nb = emptyBlock("text");
        const next = [...blocks];
        next[i] = { ...b, type: "divider", text: "" };
        next.splice(i + 1, 0, nb);
        focusNext.current = { id: nb.id, at: "start" };
        commit(next);
        return;
      }
      patch(b.id, {
        type: auto.type,
        text: auto.rest,
        ...(auto.type === "check" ? { checked: false } : { checked: undefined }),
      });
      focusNext.current = { id: b.id, at: "start" };
      return;
    }

    patch(b.id, { text: value });
  }

  function applyType(id: string, type: BlockType) {
    setSlash(null);
    if (type === "divider") {
      const i = blocks.findIndex((x) => x.id === id);
      const nb = emptyBlock("text");
      const next = [...blocks];
      next[i] = { ...next[i], type: "divider", text: "" };
      next.splice(i + 1, 0, nb);
      focusNext.current = { id: nb.id, at: "start" };
      commit(next);
      return;
    }
    focusNext.current = { id, at: "end" };
    commit(
      blocks.map((b) =>
        b.id === id
          ? { ...b, type, text: "", ...(type === "check" ? { checked: false } : { checked: undefined }) }
          : b,
      ),
    );
  }

  function reorder(from: string, to: string) {
    if (from === to) return;
    const a = blocks.findIndex((b) => b.id === from);
    const bIdx = blocks.findIndex((b) => b.id === to);
    if (a === -1 || bIdx === -1) return;
    const next = [...blocks];
    const [moved] = next.splice(a, 1);
    next.splice(bIdx, 0, moved);
    commit(next);
  }

  if (blocks.length === 0) {
    return (
      <button
        type="button"
        onClick={() => commit([emptyBlock()])}
        className="flex w-full items-center gap-2 rounded-[6px] px-2 py-2 text-left text-[14px] text-faint hover:bg-wash-2"
      >
        <Plus className="size-3.5" />내용을 입력하세요. <span className="font-mono">/</span> 로 블록을 고를 수 있어요.
      </button>
    );
  }

  return (
    <div className="flex flex-col">
      {blocks.map((b) => (
        <div
          key={b.id}
          onDragOver={(e) => {
            if (!dragId) return;
            e.preventDefault();
            setOverId(b.id);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragId) reorder(dragId, b.id);
            setDragId(null);
            setOverId(null);
          }}
          className={cn(
            "group relative -mx-6 flex items-start gap-1 px-6 py-px",
            overId === b.id && dragId && "before:absolute before:inset-x-6 before:-top-px before:h-0.5 before:bg-brand",
            dragId === b.id && "opacity-40",
          )}
        >
          <div className="flex w-6 shrink-0 justify-end opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              type="button"
              draggable
              onDragStart={() => setDragId(b.id)}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              aria-label="블록 옮기기"
              className={cn(
                "cursor-grab rounded-[4px] p-0.5 text-faint hover:bg-wash active:cursor-grabbing",
                GRIP_TOP[b.type],
              )}
            >
              <GripVertical className="size-3.5" />
            </button>
          </div>

          {b.type === "divider" ? (
            <div className="flex-1 py-2.5">
              <hr className="border-line" />
            </div>
          ) : (
            <div className={cn("relative flex min-w-0 flex-1 items-start gap-2", b.type === "code" && "mt-7")}>
              {b.type === "list" && <span className="pt-[3px] text-faint select-none">•</span>}
              {b.type === "check" && (
                <button
                  type="button"
                  onClick={() => patch(b.id, { checked: !b.checked })}
                  aria-label={b.checked ? "완료 해제" : "완료"}
                  className={cn(
                    "mt-1 flex size-4 shrink-0 items-center justify-center rounded-[4px] border text-[11px] text-white",
                    b.checked ? "border-brand bg-brand" : "border-line bg-surface",
                  )}
                >
                  {b.checked ? "✓" : ""}
                </button>
              )}
              {b.type === "quote" && <span className="mt-1 h-[calc(100%-8px)] w-0.5 shrink-0 bg-line" />}
              {b.type === "code" && (
                <div className="absolute -top-[26px] left-0 z-10 flex gap-0.5 rounded-t-[6px] border border-b-0 border-line bg-wash px-1 py-0.5">
                  {CODE_LANGS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => patch(b.id, { lang: l as CodeLang })}
                      className={cn(
                        "h-5 rounded-[4px] px-1.5 font-mono text-[12px]",
                        (b.lang ?? "python") === l ? "bg-surface text-ink" : "text-muted hover:text-ink",
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              )}

              <textarea
                ref={(el) => {
                  refs.current[b.id] = el;
                }}
                value={b.text}
                rows={1}
                spellCheck={false}
                placeholder={
                  focusedId === b.id
                    ? "내용을 입력하거나 / 를 눌러보세요"
                    : b.type === "h2" || b.type === "h3"
                      ? "제목"
                      : ""
                }
                onChange={(e) => onInput(b, e.target.value)}
                onKeyDown={(e) => onKeyDown(e, b)}
                onFocus={() => setFocusedId(b.id)}
                onBlur={() => {
                  setFocusedId((cur) => (cur === b.id ? null : cur));
                  if (slash?.id === b.id) setSlash(null);
                }}
                className={cn(
                  "kr field-sizing-content min-w-0 flex-1 resize-none border-0 bg-transparent p-0 text-ink placeholder:text-faint",
                  b.type === "h1" && "text-[24px] leading-[32px] font-bold tracking-[-0.01em]",
                  b.type === "h2" && "text-[19px] leading-[28px] font-semibold tracking-[-0.01em]",
                  b.type === "h3" && "text-[16px] leading-[25px] font-semibold",
                  b.type === "code" &&
                    "rounded-b-[6px] bg-wash-2 px-3 py-2 font-mono text-[14px] leading-[21px]",
                  b.type === "quote" && "text-[15px] leading-[25px] text-muted",
                  (b.type === "text" || b.type === "list" || b.type === "check") &&
                    "text-[15px] leading-[25px]",
                  b.checked && "text-muted line-through",
                )}
              />

              {slash?.id === b.id && (
                <SlashMenu
                  query={slash.query}
                  onPick={(t) => applyType(b.id, t)}
                  onClose={() => setSlash(null)}
                />
              )}
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={() => insertAfter(blocks[blocks.length - 1].id)}
        className="mt-1 flex items-center gap-1.5 rounded-[6px] px-1.5 py-1.5 text-left text-[14px] text-faint hover:bg-wash-2 hover:text-muted"
      >
        <Plus className="size-3.5" />
        블록 추가
      </button>
    </div>
  );
}

function SlashMenu({
  query,
  onPick,
  onClose,
}: {
  query: string;
  onPick: (t: BlockType) => void;
  onClose: () => void;
}) {
  const items = BLOCK_MENU.filter(
    (m) => !query || m.ko.replace(/\s/g, "").includes(query.replace(/\s/g, "")),
  );
  return (
    <div
      onMouseDown={(e) => e.preventDefault()}
      className="absolute top-full left-0 z-30 mt-1 w-60 overflow-hidden rounded-[8px] border border-line bg-surface shadow-[0_8px_24px_rgba(24,24,27,.12)] animate-pop-in"
    >
      <div className="border-b border-line px-3 py-2 text-[13px] text-muted">
        블록 찾기{query && <span className="ml-1 text-ink">{query}</span>}
      </div>
      <div className="max-h-64 overflow-auto p-1">
        {items.length === 0 && <div className="px-2 py-3 text-[14px] text-muted">결과가 없어요.</div>}
        {items.map((m) => (
          <button
            key={m.type}
            type="button"
            onClick={() => onPick(m.type)}
            className="flex w-full items-center gap-2.5 rounded-[6px] px-2 py-1.5 text-left text-[14px] hover:bg-wash"
          >
            <span className="flex w-5 shrink-0 justify-center font-mono text-[12px] text-faint">
              {m.type === "text" ? "T" : m.type === "divider" ? "—" : m.hint.slice(0, 3)}
            </span>
            <span className="flex-1">{m.ko}</span>
            <span className="font-mono text-[12px] text-faint">{m.hint}</span>
          </button>
        ))}
      </div>
      <button type="button" onClick={onClose} className="sr-only">
        닫기
      </button>
    </div>
  );
}
