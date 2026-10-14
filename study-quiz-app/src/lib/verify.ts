import type { Paragraph } from "./types";

/** 비교용 정규화: 유니코드 호환 문자 통일 + 따옴표 통일 + 모든 공백 제거 */
export function compact(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[“”„]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/\s+/g, "");
}

function trimEllipsis(s: string): string {
  return s.replace(/^\s*(\.\.\.|…)\s*/, "").replace(/\s*(\.\.\.|…)\s*$/, "");
}

/**
 * 근거 문장이 원문에 글자 그대로 있는지 확인한다.
 * PDF 줄바꿈 차이를 흡수하려고 공백만 무시하고, 나머지 글자는 모두 일치해야 한다.
 */
export function quoteInSource(quote: string, source: string): boolean {
  const q = compact(trimEllipsis(quote));
  return q.length >= 8 && compact(source).includes(q);
}

/** 근거 문장이 들어 있는 PDF 페이지를 찾는다 */
export function locateQuotePage(quote: string, paragraphs: Paragraph[]): number | undefined {
  const q = compact(trimEllipsis(quote));
  let joined = "";
  const starts: number[] = [];
  for (const p of paragraphs) {
    starts.push(joined.length);
    joined += compact(p.text);
  }
  const at = joined.indexOf(q);
  if (at < 0) return undefined;
  let idx = 0;
  while (idx + 1 < starts.length && starts[idx + 1] <= at) idx++;
  return paragraphs[idx].page;
}

export interface RawQuestion {
  concept: string;
  stem: string;
  choices: string[];
  answer_index: number;
  explanation: string;
  source_quote: string;
}

/** 문제 하나를 검사해 문제가 없으면 null, 있으면 탈락 사유를 돌려준다 */
export function rejectReason(q: RawQuestion, source: string): string | null {
  if (!q.stem?.trim()) return "문제 본문 없음";
  if (!Array.isArray(q.choices) || q.choices.length !== 4) return "보기가 4개가 아님";
  if (q.choices.some((c) => !c?.trim())) return "빈 보기";
  if (new Set(q.choices.map(compact)).size !== 4) return "중복 보기";
  if (!Number.isInteger(q.answer_index) || q.answer_index < 0 || q.answer_index > 3) return "정답 번호 오류";
  if (!q.source_quote?.trim()) return "근거 문장 없음";
  if (!quoteInSource(q.source_quote, source)) return "근거 문장이 원문에 없음";
  return null;
}

function bigrams(s: string): Set<string> {
  const c = compact(s).toLowerCase();
  const out = new Set<string>();
  for (let i = 0; i < c.length - 1; i++) out.add(c.slice(i, i + 2));
  return out;
}

/** 글자 2-gram 자카드 유사도. 형태소 분석 없이 한국어에도 동작한다 */
export function similarity(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.size || !B.size) return a === b ? 1 : 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

export const DUPLICATE_THRESHOLD = 0.8;

export interface QuestionKey {
  concept: string;
  stem: string;
  answer: string;
}

export function isDuplicate(candidate: QuestionKey, existing: QuestionKey[]): boolean {
  const cConcept = compact(candidate.concept).toLowerCase();
  const cText = `${candidate.stem} ${candidate.answer}`;
  return existing.some(
    (e) =>
      (cConcept.length > 0 && compact(e.concept).toLowerCase() === cConcept) ||
      similarity(cText, `${e.stem} ${e.answer}`) >= DUPLICATE_THRESHOLD,
  );
}

export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 보기 순서를 섞고 정답 번호를 새 위치로 옮긴다 */
export function shuffleChoices(
  choices: string[],
  answerIndex: number,
  rng: () => number = Math.random,
): { choices: string[]; answerIndex: number } {
  const order = shuffle(choices.map((_, i) => i), rng);
  return { choices: order.map((i) => choices[i]), answerIndex: order.indexOf(answerIndex) };
}
