"use client";

/**
 * 자료에서 원문 텍스트를 뽑는다. 줄 번호 인용을 해야 하므로 줄 구조를 보존한다.
 *
 * 뽑지 못하면 지어내지 않는다. `no-text` 로 두고 사용자가 직접 붙여넣게 한다 (스펙 §14.3).
 */
import type { SourceKind } from "./types";

export interface Extracted {
  text: string;
  kind: SourceKind;
  /** 텍스트를 찾지 못한 이유. 화면 문구로 그대로 쓴다. */
  problem?: string;
}

const TEXT_EXT = /\.(md|markdown|txt|text|csv|json|log)$/i;

export function kindOfFile(file: File): SourceKind {
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") return "pdf";
  if (/\.(md|markdown)$/i.test(file.name)) return "markdown";
  return "text";
}

export async function extractFile(file: File): Promise<Extracted> {
  const kind = kindOfFile(file);

  if (kind === "pdf") return extractPdf(file);

  if (TEXT_EXT.test(file.name) || file.type.startsWith("text/") || file.type === "") {
    const text = await file.text();
    if (!text.trim())
      return { text: "", kind, problem: "이 파일에서 읽을 텍스트를 찾지 못했어요." };
    return { text, kind };
  }

  return {
    text: "",
    kind,
    problem: "지원하지 않는 형식이에요. 텍스트를 직접 붙여넣을 수 있어요.",
  };
}

async function extractPdf(file: File): Promise<Extracted> {
  try {
    const pdfjs = await import("pdfjs-dist");
    // 워커는 번들된 모듈 URL 로 띄운다. CDN 을 쓰지 않는다.
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();

    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    const pages: string[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const line = content.items
        .map((it) => ("str" in it ? it.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      pages.push(`## p.${i}`, line, "");
    }

    const text = pages.join("\n").trim();
    if (!text.replace(/## p\.\d+/g, "").trim())
      return {
        text: "",
        kind: "pdf",
        problem: "이 PDF에서 읽을 텍스트를 찾지 못했어요. 스캔 이미지일 수 있어요.",
      };

    return { text, kind: "pdf" };
  } catch {
    return { text: "", kind: "pdf", problem: "PDF를 읽지 못했어요. 파일이 손상됐을 수 있어요." };
  }
}

/** 붙여넣은 URL 은 서버에서 받아온다. 브라우저에서 바로 받으면 CORS 로 막힌다. */
export async function extractUrl(url: string): Promise<Extracted> {
  try {
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return { text: "", kind: "url", problem: "주소를 열지 못했어요." };
    const data = (await res.json()) as { text?: string; problem?: string };
    if (!data.text) return { text: "", kind: "url", problem: data.problem ?? "본문을 찾지 못했어요." };
    return { text: data.text, kind: "url" };
  } catch {
    return { text: "", kind: "url", problem: "주소를 열지 못했어요." };
  }
}

/** 원문 줄 배열. 인용 위치(줄 번호)는 1부터 센다. */
export const linesOf = (text: string) => text.split("\n");

/** 제안된 인용이 원문에 실제로 있는지. 없으면 승인할 수 없다. */
export function verifyQuote(text: string, quote: string): { ok: boolean; line?: number } {
  const needle = quote.trim().replace(/\s+/g, " ");
  if (!needle) return { ok: false };
  const lines = linesOf(text);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].replace(/\s+/g, " ").includes(needle)) return { ok: true, line: i + 1 };
  }
  return { ok: false };
}
