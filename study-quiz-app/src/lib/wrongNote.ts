import type { WrongNote } from "./types";

/** 정답률이 이 값을 "넘으면"(>) 오답노트에서 졸업한다 */
export const GRADUATION_THRESHOLD = 0.7;

export function accuracy(note: Pick<WrongNote, "attempts" | "corrects">): number {
  return note.attempts ? note.corrects / note.attempts : 0;
}

export function isActive(note: WrongNote | undefined): note is WrongNote {
  return !!note && note.graduatedAt === null;
}

/**
 * 한 번 풀 때마다 오답노트 상태를 갱신한다. 바뀔 게 없으면 받은 note를 그대로 돌려준다.
 * - 오답노트에 없는 문제(또는 이미 졸업한 문제)를 틀리면 새로 등록(1회 시도, 0회 정답)
 * - 오답노트에 있는 문제는 맞든 틀리든 시도/정답 수를 누적하고, 정답률이 70%를 넘으면 졸업
 */
export function applyAnswer(
  note: WrongNote | undefined,
  ids: { questionId: number; setId: number },
  correct: boolean,
  now: number,
): WrongNote | undefined {
  if (!isActive(note)) {
    if (correct) return note;
    return { ...ids, attempts: 1, corrects: 0, addedAt: now, lastSeenAt: now, graduatedAt: null };
  }
  const attempts = note.attempts + 1;
  const corrects = note.corrects + (correct ? 1 : 0);
  const graduated = corrects / attempts > GRADUATION_THRESHOLD;
  return { ...note, attempts, corrects, lastSeenAt: now, graduatedAt: graduated ? now : null };
}

/** 졸업까지 남은 연속 정답 수 */
export function correctsToGraduate(note: Pick<WrongNote, "attempts" | "corrects">): number {
  let { attempts, corrects } = note;
  let k = 0;
  while (corrects / Math.max(attempts, 1) <= GRADUATION_THRESHOLD) {
    attempts++;
    corrects++;
    k++;
  }
  return k;
}

/** 복습 순서: 정답률 낮은 순 → 오래 안 본 순 */
export function reviewOrder(notes: WrongNote[]): WrongNote[] {
  return notes
    .filter((n) => n.graduatedAt === null)
    .slice()
    .sort((a, b) => accuracy(a) - accuracy(b) || a.lastSeenAt - b.lastSeenAt);
}
