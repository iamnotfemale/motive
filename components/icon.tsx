"use client";

/** lib/phases.ts 가 문자열로 가리키는 아이콘을 실제 컴포넌트로 바꾼다. */
import {
  BookOpenCheck,
  Box,
  CircleQuestionMark,
  Download,
  Flag,
  FolderOpen,
  Lightbulb,
  Link2,
  ListChecks,
  ListTodo,
  PackageCheck,
  Paperclip,
  Quote,
  ScanSearch,
  Sparkles,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  BookOpenCheck,
  Box,
  CircleQuestionMark,
  Download,
  Flag,
  FolderOpen,
  Lightbulb,
  Link2,
  ListChecks,
  ListTodo,
  PackageCheck,
  Paperclip,
  Quote,
  ScanSearch,
  Sparkles,
  TriangleAlert,
};

export function Icon({ name, className }: { name: string; className?: string }) {
  const C = MAP[name] ?? Box;
  return <C className={className} />;
}
