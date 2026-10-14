import type { Paragraph } from "./types";

export interface SectionDraft {
  title: string;
  paragraphs: Paragraph[];
  charCount: number;
}

export interface SectionOptions {
  /** 이 길이를 넘으면 다음 문단 경계에서 섹션을 끊는다 */
  target: number;
  /** 섹션이 이 길이를 넘지 않도록 강제로 끊는다 */
  max: number;
  /** 제목을 만나도 이보다 짧으면 앞 섹션에 이어 붙인다 */
  min: number;
}

export const DEFAULT_SECTION_OPTIONS: SectionOptions = { target: 5000, max: 8000, min: 1200 };

/**
 * 너무 긴 문단을 줄바꿈 → 문장 끝 → 강제 절단 순서로 나눈다.
 * 글자를 버리거나 바꾸지 않으며, 조각을 이어 붙이면 원문과 같다.
 */
export function splitLong(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const pieces: string[] = [];
  let rest = text;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    let cut = window.lastIndexOf("\n");
    if (cut < max * 0.5) {
      const sentenceEnd = Math.max(
        window.lastIndexOf(". "),
        window.lastIndexOf("다. "),
        window.lastIndexOf("? "),
        window.lastIndexOf("! "),
        window.lastIndexOf("。"),
      );
      cut = sentenceEnd >= max * 0.5 ? sentenceEnd + 1 : -1;
    }
    if (cut < max * 0.5) cut = max;
    pieces.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest.length) pieces.push(rest);
  return pieces;
}

function pageLabel(paragraphs: Paragraph[]): string | null {
  const pages = paragraphs.map((p) => p.page).filter((p): p is number => p !== undefined);
  if (!pages.length) return null;
  const lo = Math.min(...pages);
  const hi = Math.max(...pages);
  return lo === hi ? `p.${lo}` : `p.${lo}–${hi}`;
}

/** 문단 목록을 출제 단위인 섹션으로 묶는다. 제목이 있으면 제목 기준, 없으면 길이 기준. */
export function buildSections(
  paragraphs: Paragraph[],
  fileLabel: string,
  opts: SectionOptions = DEFAULT_SECTION_OPTIONS,
): SectionDraft[] {
  const expanded: Paragraph[] = [];
  for (const p of paragraphs) {
    if (!p.text.trim()) continue;
    for (const piece of splitLong(p.text, opts.max)) expanded.push({ ...p, text: piece });
  }

  const drafts: SectionDraft[] = [];
  let current: Paragraph[] = [];
  let size = 0;
  let heading: string | null = null;
  let title: string | null = null;
  let part = 0;

  const flush = () => {
    if (!current.length) return;
    part += 1;
    drafts.push({ title: title ?? `${fileLabel} ${pageLabel(current) ?? `#${part}`}`, paragraphs: current, charCount: size });
    current = [];
    size = 0;
  };

  for (const p of expanded) {
    const startsNewByHeading = p.heading && size >= opts.min;
    const exceeds = size > 0 && (size >= opts.target || size + p.text.length > opts.max);
    if (startsNewByHeading || exceeds) flush();
    if (p.heading) heading = p.text.trim().slice(0, 80);
    if (!current.length) title = p.heading ? heading : heading ? `${heading} (계속)` : null;
    current.push(p);
    size += p.text.length;
  }
  flush();
  return drafts;
}

export function sectionText(paragraphs: Paragraph[]): string {
  return paragraphs.map((p) => p.text).join("\n\n");
}
