import { allocateCapped } from "./allocate";
import { compact, shuffle } from "./verify";
import type { Question } from "./types";

export const QUIZ_SIZES = [10, 20, 30, 40] as const;

/**
 * 문제은행에서 n문항을 뽑는다.
 * 1) 섹션 분량 비율로 섹션별 문항 수를 나누고(문제가 모자란 섹션 몫은 다른 섹션으로)
 * 2) 섹션 안에서는 덜 풀어본 문제 → 오래전에 본 문제 순으로 고르며
 * 3) 한 퀴즈에 같은 개념은 한 번만 나오게 한 뒤
 * 4) 섹션이 섞이도록 순서를 섞는다.
 */
export function buildQuiz(
  questions: Question[],
  sectionWeights: Map<number, number>,
  n: number,
  rng: () => number = Math.random,
): Question[] {
  const bySection = new Map<number, Question[]>();
  for (const q of questions) {
    const list = bySection.get(q.sectionId) ?? [];
    list.push(q);
    bySection.set(q.sectionId, list);
  }
  const sectionIds = [...bySection.keys()];
  const quotas = allocateCapped(
    sectionIds.map((id) => sectionWeights.get(id) ?? 1),
    sectionIds.map((id) => bySection.get(id)!.length),
    n,
  );

  const usedConcepts = new Set<string>();
  const picked: Question[] = [];
  const leftovers: Question[] = [];

  sectionIds.forEach((id, i) => {
    const ranked = shuffle(bySection.get(id)!, rng).sort(
      (a, b) => a.timesSeen - b.timesSeen || a.lastSeenAt - b.lastSeenAt,
    );
    let take = quotas[i];
    for (const q of ranked) {
      const key = compact(q.concept).toLowerCase();
      if (take > 0 && !usedConcepts.has(key)) {
        picked.push(q);
        usedConcepts.add(key);
        take--;
      } else {
        leftovers.push(q);
      }
    }
  });

  // 개념 중복 때문에 못 채운 자리는 나머지 문제로 채운다(개념 중복이 없는 것 우선)
  if (picked.length < n) {
    const ranked = leftovers.sort(
      (a, b) =>
        Number(usedConcepts.has(compact(a.concept).toLowerCase())) -
          Number(usedConcepts.has(compact(b.concept).toLowerCase())) ||
        a.timesSeen - b.timesSeen,
    );
    for (const q of ranked) {
      if (picked.length >= n) break;
      picked.push(q);
      usedConcepts.add(compact(q.concept).toLowerCase());
    }
  }
  return shuffle(picked, rng);
}
