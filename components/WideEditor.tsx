"use client";

/**
 * 전체 화면 편집기. 카드 하나의 본문만 노션처럼 넓게 본다.
 * 저장되는 것은 같은 md 문자열이다 — 별도 문서를 만들지 않는다 (핸드오프 §7).
 */
import { motion } from "motion/react";
import { Minimize2, X } from "lucide-react";
import { BlockEditor } from "@/components/BlockEditor";
import { Btn, Mono, TypeIcon } from "@/components/kit";
import { KIND, kindOf } from "@/lib/labels";
import { setTitle, titleOf } from "@/lib/md";
import { findNode, useDoc } from "@/lib/store";
import { flashSaved, useUi } from "@/lib/ui";

export function WideEditor({ pid }: { pid: string }) {
  const doc = useDoc((s) => s.docs[pid]);
  const patchNode = useDoc((s) => s.patchNode);
  const id = useUi((s) => s.sel[0]);
  const node = doc && id ? findNode(doc, id) : undefined;
  if (!doc || !node) return null;

  const meta = KIND[kindOf(node)];
  const write = (md: string) => {
    patchNode(pid, node.id, { md });
    flashSaved();
  };

  return (
    <motion.div
      data-ui="wide"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      className="fixed inset-0 z-50 flex flex-col bg-canvas"
    >
      <header className="flex h-13 shrink-0 items-center gap-2 border-b border-line bg-surface px-6">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted">
          <TypeIcon d={meta.icon} size={15} />
          {meta.ko}
        </span>
        <Mono>{node.id}</Mono>
        <span className="flex-1" />
        <Btn size="sm" onClick={() => useUi.getState().setWide(false)}>
          <Minimize2 className="size-4" />
          좁게 보기
        </Btn>
        <Btn variant="ghost" size="icon" aria-label="닫기 (Esc)" onClick={() => useUi.getState().setWide(false)}>
          <X className="size-4" />
        </Btn>
      </header>

      <div className="flex-1 overflow-auto px-6 py-12">
        <div className="mx-auto w-full max-w-[740px]">
          <textarea
            value={titleOf(node.md)}
            rows={1}
            placeholder="제목을 입력하세요"
            aria-label="카드 제목"
            onChange={(e) => write(setTitle(node.md, e.target.value))}
            className="kr field-sizing-content mb-6 w-full resize-none border-0 bg-transparent p-0 text-[34px] leading-[44px] font-bold tracking-[-0.02em] text-ink placeholder:font-normal placeholder:text-faint"
          />
          <BlockEditor nodeId={node.id} title={titleOf(node.md)} md={node.md} onChange={write} />
        </div>
      </div>
    </motion.div>
  );
}
