import { recordAnswer } from "./answers";
import { db } from "./db";
import { shuffle } from "./verify";
import type { AnswerMode, Question, QuizSession } from "./types";

/** 끝내기를 누르지 않은 퀴즈. 한 번에 하나만 있을 수 있다 */
export async function activeSession(): Promise<QuizSession | undefined> {
  return (await db.sessions.orderBy("startedAt").reverse().toArray()).find((s) => s.finishedAt === null);
}

export class ActiveSessionError extends Error {
  constructor() {
    super("진행 중인 퀴즈가 있습니다. 끝내기를 누른 뒤 새 퀴즈를 시작할 수 있습니다.");
  }
}

export async function startSession(
  setId: number,
  mode: AnswerMode,
  subject: number | null,
  questions: Question[],
): Promise<number> {
  if (await activeSession()) throw new ActiveSessionError();
  return (await db.sessions.add({
    setId,
    mode,
    subject,
    questionIds: questions.map((q) => q.id!),
    // 같은 문제를 다시 풀 때 위치로 외우지 않도록 보기 순서를 매번 섞는다
    choiceOrders: questions.map((q) => shuffle(q.choices.map((_, i) => i))),
    index: 0,
    answers: [],
    startedAt: Date.now(),
    finishedAt: null,
  })) as number;
}

/** 현재 문제에 답한다. 이미 답했으면 아무 것도 하지 않는다 */
export async function answerCurrent(sessionId: number, question: Question, chosen: number): Promise<QuizSession> {
  const session = (await db.sessions.get(sessionId))!;
  if (session.answers.length > session.index || session.finishedAt !== null) return session;
  const correct = session.choiceOrders[session.index][chosen] === question.answerIndex;
  await recordAnswer(question, correct, session.mode);
  const answers = [...session.answers, { questionId: question.id!, chosen, correct }];
  await db.sessions.update(sessionId, { answers });
  return { ...session, answers };
}

export async function goNext(sessionId: number): Promise<void> {
  const session = (await db.sessions.get(sessionId))!;
  if (session.answers.length > session.index) await db.sessions.update(sessionId, { index: session.index + 1 });
}

export async function finishSession(sessionId: number): Promise<void> {
  await db.sessions.update(sessionId, { finishedAt: Date.now() });
}
