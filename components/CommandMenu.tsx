"use client";

/** CMP-11 명령 메뉴. ⌘K / Ctrl+K. AI 를 상시 채팅이 아니라 명령으로 둔다 (스펙 §22). */
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { KIND, PHASES, kindOf, type Kind } from "@/lib/labels";
import { nodeTitle, useDoc } from "@/lib/store";
import { useUi } from "@/lib/ui";

export function CommandMenu({ pid, onAdd }: { pid: string; onAdd: (k: Kind) => void }) {
  const router = useRouter();
  const doc = useDoc((s) => s.docs[pid]);
  const open = useUi((s) => s.cmdk);

  const close = () => useUi.getState().setCmdk(false);
  const run = (fn: () => void) => {
    close();
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={(v) => useUi.getState().setCmdk(v)}>
      <CommandInput placeholder="이동, 블록 추가, 카드 열기…" />
      <CommandList>
        <CommandEmpty>결과가 없어요.</CommandEmpty>

        <CommandGroup heading="블록 추가">
          {(["claim", "question", "solution", "note"] as Kind[]).map((k) => (
            <CommandItem key={k} onSelect={() => run(() => onAdd(k))}>
              {KIND[k].ko} 추가
              <CommandShortcut>{KIND[k].prefix}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="이동">
          {PHASES.map((p) => (
            <CommandItem key={p.key} onSelect={() => run(() => useUi.getState().setPhase(p.key))}>
              {p.ko} 단계
            </CommandItem>
          ))}
          <CommandItem onSelect={() => run(() => useUi.getState().openPanel("shelf"))}>
            자료함 열기
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push(`/p/${pid}/handoff`))}>
            개발 인계
          </CommandItem>
        </CommandGroup>

        {doc && doc.nodes.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="카드 열기">
              {doc.nodes.map((n) => (
                <CommandItem
                  key={n.id}
                  value={`${n.id} ${nodeTitle(n)} ${KIND[kindOf(n)].ko}`}
                  onSelect={() =>
                    run(() => {
                      useUi.getState().select([n.id]);
                      useUi.getState().openPanel("inspector");
                    })
                  }
                >
                  <span className="min-w-0 flex-1 truncate">{nodeTitle(n)}</span>
                  <CommandShortcut>{n.id}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
