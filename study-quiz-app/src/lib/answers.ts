import { db } from "./db";
import { applyAnswer } from "./wrongNote";
import type { AnswerMode, Question } from "./types";

/** 한 문제를 푼 결과를 기록하고 오답노트를 갱신한다 */
export async function recordAnswer(q: Question, correct: boolean, mode: AnswerMode): Promise<void> {
  const now = Date.now();
  await db.transaction("rw", [db.questions, db.attempts, db.wrongNotes], async () => {
    await db.questions.update(q.id!, { timesSeen: q.timesSeen + 1, lastSeenAt: now });
    await db.attempts.add({ setId: q.setId, questionId: q.id!, correct, mode, at: now });
    const before = await db.wrongNotes.get(q.id!);
    const after = applyAnswer(before, { questionId: q.id!, setId: q.setId }, correct, now);
    if (after && after !== before) await db.wrongNotes.put(after);
  });
}
