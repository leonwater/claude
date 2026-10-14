import { describe, expect, it } from "vitest";
import { buildQuiz } from "./quiz";
import type { Question } from "./types";

let nextId = 1;
function q(sectionId: number, concept: string, timesSeen = 0): Question {
  return {
    id: nextId++, setId: 1, sectionId, concept, stem: `${concept}?`, choices: ["a", "b", "c", "d"], answerIndex: 0,
    explanation: "", sourceQuote: "", createdAt: 0, timesSeen, lastSeenAt: timesSeen,
  };
}

describe("buildQuiz", () => {
  it("섹션 분량 비율대로 고르게 뽑는다", () => {
    const bank = [1, 2, 3, 4].flatMap((s) => Array.from({ length: 20 }, (_, i) => q(s, `s${s}-c${i}`)));
    const quiz = buildQuiz(bank, new Map([[1, 1], [2, 1], [3, 1], [4, 1]]), 20);
    expect(quiz).toHaveLength(20);
    const counts = [1, 2, 3, 4].map((s) => quiz.filter((x) => x.sectionId === s).length);
    expect(counts).toEqual([5, 5, 5, 5]);
    expect(new Set(quiz.map((x) => x.id)).size).toBe(20);
  });

  it("한 퀴즈에 같은 개념은 한 번만", () => {
    const bank = [q(1, "같은 개념"), q(1, "같은 개념"), q(1, "다른 개념"), q(2, "또 다른")];
    const quiz = buildQuiz(bank, new Map([[1, 3], [2, 1]]), 3);
    expect(quiz.filter((x) => x.concept === "같은 개념")).toHaveLength(1);
  });

  it("덜 풀어본 문제를 먼저 낸다", () => {
    const fresh = Array.from({ length: 10 }, (_, i) => q(1, `new${i}`, 0));
    const seen = Array.from({ length: 10 }, (_, i) => q(1, `old${i}`, 3));
    const quiz = buildQuiz([...seen, ...fresh], new Map([[1, 1]]), 10);
    expect(quiz.every((x) => x.timesSeen === 0)).toBe(true);
  });

  it("은행이 부족하면 있는 만큼만", () => {
    expect(buildQuiz([q(1, "a"), q(2, "b")], new Map(), 10)).toHaveLength(2);
  });
});
