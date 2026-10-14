import { describe, expect, it } from "vitest";
import { buildSubjectQuiz, SUBJECT_QUIZ_SIZES } from "./quiz";
import bank from "../data/adsp_bank.json";
import type { Question } from "./types";

const chapters = Object.keys(bank.chapters).sort();
const questions: Question[] = bank.questions.map((b, i) => ({
  id: i + 1, setId: 1, sectionId: chapters.indexOf(b.chapter) + 1, subject: b.subject, concept: b.concept, stem: b.stem,
  choices: b.choices, answerIndex: b.answerIndex, explanation: b.explanation, sourceQuote: b.sourceQuote,
  createdAt: 0, timesSeen: 0, lastSeenAt: 0, image: b.image,
}));
const weights = new Map(chapters.map((_, i) => [i + 1, questions.filter((q) => q.sectionId === i + 1).length]));

describe("내장 ADsP 문제은행", () => {
  it("문항 형식이 올바르다", () => {
    expect(questions.length).toBe(420);
    for (const q of questions) {
      expect(q.choices).toHaveLength(4);
      expect(new Set(q.choices).size).toBe(4);
      expect(q.answerIndex).toBeGreaterThanOrEqual(0);
      expect(q.answerIndex).toBeLessThan(4);
      expect(q.explanation.length).toBeGreaterThan(0);
    }
  });

  it("과목 퀴즈는 그 과목 문제만, 모든 단원에서 낸다", () => {
    const quiz = buildSubjectQuiz(questions, weights, 3, 50);
    expect(quiz).toHaveLength(50);
    expect(quiz.every((q) => q.subject === 3)).toBe(true);
    const sectionsHit = new Set(quiz.map((q) => q.sectionId));
    const subject3Sections = new Set(questions.filter((q) => q.subject === 3).map((q) => q.sectionId));
    expect(sectionsHit.size).toBe(subject3Sections.size);
  });

  it("종합 50문항은 1:1:3 비율(10/10/30)", () => {
    const quiz = buildSubjectQuiz(questions, weights, 0, 50);
    const count = (s: number) => quiz.filter((q) => q.subject === s).length;
    expect([count(1), count(2), count(3)]).toEqual([10, 10, 30]);
  });

  it("가장 큰 문항 수로 3번 풀면 과목 전체를 거의 다 본다(덜 푼 문제 우선)", () => {
    const pool = questions.filter((q) => q.subject === 2).map((q) => ({ ...q }));
    const seen = new Set<number>();
    for (let round = 0; round < 3; round++) {
      for (const q of buildSubjectQuiz(pool, weights, 2, SUBJECT_QUIZ_SIZES[2].at(-1)!)) {
        seen.add(q.id!);
        const p = pool.find((x) => x.id === q.id)!;
        p.timesSeen += 1;
        p.lastSeenAt = round + 1;
      }
    }
    expect(seen.size).toBe(pool.length);
  });
});
