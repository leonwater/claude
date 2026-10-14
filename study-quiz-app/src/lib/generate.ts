import { allocate } from "./allocate";
import { describeApiError, generateQuestions, GenerationError } from "./claude";
import { db } from "./db";
import { sectionText } from "./sections";
import { settings } from "./settings";
import { isDuplicate, locateQuotePage, rejectReason, shuffleChoices, type QuestionKey } from "./verify";
import type { Question, Section } from "./types";

/** 섹션마다 최소 3문항은 은행에 둔다 */
export const MIN_PER_SECTION = 3;
/** 한 번의 요청으로 만들 최대 문항 수 */
const BATCH = 10;
const CONCURRENCY = 3;
/** 섹션 하나에서 목표를 못 채웠을 때 다시 요청하는 최대 횟수 */
const MAX_ROUNDS_PER_SECTION = 4;

export function defaultBankTarget(sectionCount: number): number {
  return Math.max(80, sectionCount * MIN_PER_SECTION);
}

export interface Progress {
  done: number;
  target: number;
  rejected: number;
  costUsd: number;
  current?: string;
}

export interface SectionPlan {
  section: Section;
  quota: number;
  have: number;
}

export function planSections(sections: Section[], questions: Question[], bankTarget: number): SectionPlan[] {
  const quotas = allocate(sections.map((s) => s.charCount), bankTarget, MIN_PER_SECTION);
  return sections.map((section, i) => ({
    section,
    quota: quotas[i],
    have: questions.filter((q) => q.sectionId === section.id).length,
  }));
}

/**
 * 문제은행을 목표 문항 수까지 채운다. 이미 만든 문제는 그대로 두므로
 * 중간에 멈춰도 다시 실행하면 이어서 만든다.
 */
export async function fillBank(
  setId: number,
  onProgress: (p: Progress) => void,
  outerSignal: AbortSignal,
): Promise<{ errors: string[] }> {
  // 치명적 오류(API 키 오류 등)가 나면 나머지 작업도 함께 멈춘다
  const controller = new AbortController();
  const signal = controller.signal;
  if (outerSignal.aborted) controller.abort();
  else outerSignal.addEventListener("abort", () => controller.abort(), { once: true });

  const apiKey = settings.apiKey();
  if (!apiKey) throw new Error("설정에서 Claude API 키를 먼저 입력해 주세요.");
  const model = settings.model();
  const set = await db.sets.get(setId);
  if (!set) throw new Error("학습 세트를 찾을 수 없습니다.");
  const sections = await db.sections.where({ setId }).sortBy("order");
  const existing = await db.questions.where({ setId }).toArray();
  const plans = planSections(sections, existing, set.bankTarget);

  const target = plans.reduce((a, p) => a + p.quota, 0);
  const progress: Progress = { done: plans.reduce((a, p) => a + Math.min(p.have, p.quota), 0), target, rejected: 0, costUsd: 0 };
  onProgress({ ...progress });

  const keysBySection = new Map<number, QuestionKey[]>();
  for (const q of existing) {
    const list = keysBySection.get(q.sectionId) ?? [];
    list.push({ concept: q.concept, stem: q.stem, answer: q.choices[q.answerIndex] });
    keysBySection.set(q.sectionId, list);
  }

  const errors: string[] = [];
  const queue = plans.filter((p) => p.have < p.quota);

  async function work(plan: SectionPlan) {
    const { section } = plan;
    const source = sectionText(section.paragraphs);
    const keys = keysBySection.get(section.id!) ?? [];
    let need = plan.quota - plan.have;
    for (let round = 0; need > 0 && round < MAX_ROUNDS_PER_SECTION; round++) {
      if (signal.aborted) return;
      progress.current = section.title;
      onProgress({ ...progress });
      const count = Math.min(need, BATCH);
      const { questions, usage } = await generateQuestions({
        apiKey,
        model,
        fileName: section.fileName,
        sectionTitle: section.title,
        sourceText: source,
        count,
        coveredConcepts: keys.map((k) => k.concept),
        signal,
      });
      await db.usage.add(usage);
      progress.costUsd += usage.costUsd;

      const accepted: Question[] = [];
      for (const raw of questions) {
        if (accepted.length >= need) break;
        const key = { concept: raw.concept ?? "", stem: raw.stem ?? "", answer: raw.choices?.[raw.answer_index] ?? "" };
        if (rejectReason(raw, source) || isDuplicate(key, keys)) {
          progress.rejected++;
          continue;
        }
        keys.push(key);
        const shuffled = shuffleChoices(raw.choices, raw.answer_index);
        const now = Date.now();
        accepted.push({
          setId,
          sectionId: section.id!,
          concept: raw.concept.trim(),
          stem: raw.stem.trim(),
          choices: shuffled.choices.map((c) => c.trim()),
          answerIndex: shuffled.answerIndex,
          explanation: raw.explanation?.trim() ?? "",
          sourceQuote: raw.source_quote.trim(),
          sourcePage: locateQuotePage(raw.source_quote, section.paragraphs),
          createdAt: now,
          timesSeen: 0,
          lastSeenAt: 0,
        });
      }
      await db.questions.bulkAdd(accepted);
      need -= accepted.length;
      progress.done += accepted.length;
      onProgress({ ...progress });
    }
    if (need > 0 && !signal.aborted) errors.push(`「${section.title}」에서 ${need}문항을 채우지 못했습니다(검증 탈락).`);
  }

  let cursor = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (cursor < queue.length && !signal.aborted) {
      const plan = queue[cursor++];
      try {
        await work(plan);
      } catch (e) {
        const msg = describeApiError(e);
        if (e instanceof GenerationError) errors.push(`「${plan.section.title}」: ${msg}`);
        else {
          controller.abort();
          throw new Error(msg);
        }
      }
    }
  });
  await Promise.all(workers);
  progress.current = undefined;
  onProgress({ ...progress });
  return { errors };
}
