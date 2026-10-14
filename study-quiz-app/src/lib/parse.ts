import type { Paragraph } from "./types";

export const ACCEPT = ".pdf,.docx,.txt,.md,.markdown";
/** 개인용 안전장치: 파일 하나 100MB, 한 세트 20개 */
export const MAX_FILE_BYTES = 100 * 1024 * 1024;
export const MAX_FILES_PER_SET = 20;

export interface ParsedFile {
  paragraphs: Paragraph[];
  pages?: number;
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();
  const buf = await file.arrayBuffer();
  if (name.endsWith(".pdf") || isPdf(buf)) return parsePdf(buf);
  if (name.endsWith(".docx")) return { paragraphs: await parseDocx(buf) };
  if (/\.(txt|md|markdown)$/.test(name)) return { paragraphs: parsePlainText(decodeText(buf), /\.(md|markdown)$/.test(name)) };
  throw new Error(`${file.name}: 지원하지 않는 형식입니다 (PDF, DOCX, TXT, MD만 가능)`);
}

function isPdf(buf: ArrayBuffer): boolean {
  const head = new Uint8Array(buf.slice(0, 5));
  return String.fromCharCode(...head) === "%PDF-";
}

/** UTF-8로 읽다가 깨지면 한국어 구형 인코딩(EUC-KR/CP949)으로 다시 읽는다 */
export function decodeText(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buf);
  if (!utf8.includes("�")) return utf8.replace(/^﻿/, "");
  try {
    return new TextDecoder("euc-kr").decode(buf);
  } catch {
    return utf8;
  }
}

export function parsePlainText(text: string, markdown: boolean): Paragraph[] {
  const out: Paragraph[] = [];
  for (const block of text.replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
    if (!block.trim()) continue;
    if (markdown) {
      // 블록 안의 제목 줄은 별도 문단으로 분리
      let buffer: string[] = [];
      for (const line of block.split("\n")) {
        if (/^#{1,6}\s/.test(line)) {
          if (buffer.length) out.push({ text: buffer.join("\n") });
          buffer = [];
          out.push({ text: line, heading: true });
        } else buffer.push(line);
      }
      if (buffer.join("").trim()) out.push({ text: buffer.join("\n") });
    } else {
      out.push({ text: block });
    }
  }
  return out;
}

async function parsePdf(buf: ArrayBuffer): Promise<ParsedFile> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({ data: new Uint8Array(buf) });
  const doc = await task.promise;
  const paragraphs: Paragraph[] = [];
  let textChars = 0;
  for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();
    let pageText = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      pageText += item.str + (item.hasEOL ? "\n" : "");
    }
    textChars += pageText.trim().length;
    for (const block of pageText.split(/\n\s*\n/)) {
      if (block.trim()) paragraphs.push({ text: block, page: pageNo });
    }
    page.cleanup();
  }
  const pages = doc.numPages;
  await task.destroy();
  if (textChars < pages * 20) {
    throw new Error("글자를 읽을 수 없는 PDF입니다. 스캔(이미지) PDF는 아직 지원하지 않습니다.");
  }
  return { paragraphs, pages };
}

async function parseDocx(buf: ArrayBuffer): Promise<Paragraph[]> {
  const mammoth = await import("mammoth");
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buf });
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out: Paragraph[] = [];
  for (const el of doc.body.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,tr")) {
    const tag = el.tagName.toLowerCase();
    if (tag === "p" && el.closest("li,td,th")) continue;
    let text: string;
    if (tag === "tr") {
      text = [...el.querySelectorAll("td,th")].map((c) => c.textContent?.trim() ?? "").join(" | ");
    } else if (tag === "li") {
      const clone = el.cloneNode(true) as Element;
      clone.querySelectorAll("ul,ol").forEach((n) => n.remove());
      text = `- ${clone.textContent ?? ""}`;
    } else {
      text = el.textContent ?? "";
    }
    if (text.replace(/[-|\s]/g, "")) out.push({ text, heading: /^h[1-6]$/.test(tag) || undefined });
  }
  return out;
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
