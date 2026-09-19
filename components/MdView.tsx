"use client";

/**
 * 읽기 전용 Markdown. 카드 편집기(BlockEditor)와 같은 블록 파서를 쓰되 그리기만 한다.
 * 자료 미리보기에서 md 파일을 노션처럼 보여줄 때 쓴다.
 */
import { mdToBlocks } from "@/lib/blocks";
import { cn } from "@/lib/utils";

export function MdView({ md, className }: { md: string; className?: string }) {
  // 파서는 첫 `# ` 줄을 카드 제목으로 보고 건너뛴다. 자료는 제목도 본문이라 빈 제목 줄을 앞에 붙인다.
  const blocks = mdToBlocks("# \n" + md);
  return (
    <div className={cn("kr flex flex-col gap-1 text-[14px] leading-6 text-ink", className)}>
      {blocks.map((b) => {
        switch (b.type) {
          case "h1":
            return <h1 key={b.id} className="mt-3 text-[18px] leading-7 font-semibold">{b.text}</h1>;
          case "h2":
            return <h2 key={b.id} className="mt-3 text-[16px] leading-6 font-semibold">{b.text}</h2>;
          case "h3":
            return <h3 key={b.id} className="mt-2 text-[14px] leading-6 font-semibold">{b.text}</h3>;
          case "list":
            return (
              <div key={b.id} className="flex items-start gap-2 pl-1">
                <span className="mt-[11px] size-1 shrink-0 rounded-full bg-faint" />
                <span>{b.text}</span>
              </div>
            );
          case "check":
            return (
              <div key={b.id} className="flex items-start gap-2 pl-1">
                <span className={cn("mt-1.5 flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border", b.checked ? "border-ink bg-ink text-white" : "border-line")}>{b.checked && "✓"}</span>
                <span className={cn(b.checked && "text-muted line-through")}>{b.text}</span>
              </div>
            );
          case "quote":
            return <blockquote key={b.id} className="border-l-2 border-line pl-3 text-muted">{b.text}</blockquote>;
          case "code":
            return <pre key={b.id} className="overflow-auto rounded-[6px] bg-wash px-3 py-2 font-mono text-[13px] leading-5">{b.text}</pre>;
          case "divider":
            return <hr key={b.id} className="my-2 border-line" />;
          default:
            return b.text.trim() ? <p key={b.id}>{b.text}</p> : <div key={b.id} className="h-2" />;
        }
      })}
    </div>
  );
}
