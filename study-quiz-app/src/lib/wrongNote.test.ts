import { describe, expect, it } from "vitest";
import { applyAnswer, correctsToGraduate, reviewOrder } from "./wrongNote";
import type { WrongNote } from "./types";

const ids = { questionId: 1, setId: 1 };

function run(seq: boolean[]): (WrongNote | undefined)[] {
  const states: (WrongNote | undefined)[] = [];
  let note: WrongNote | undefined;
  seq.forEach((correct, t) => {
    note = applyAnswer(note, ids, correct, t + 1);
    states.push(note);
  });
  return states;
}

describe("오답노트", () => {
  it("맞힌 문제는 오답노트에 들어가지 않는다", () => {
    expect(run([true])[0]).toBeUndefined();
  });

  it("처음 틀린 문제는 3번 연속 맞히면 75%로 졸업한다", () => {
    const s = run([false, true, true, true]);
    expect(s.map((n) => [n!.corrects, n!.attempts])).toEqual([[0, 1], [1, 2], [2, 3], [3, 4]]);
    expect(s.slice(0, 3).every((n) => n!.graduatedAt === null)).toBe(true);
    expect(s[3]!.graduatedAt).toBe(4);
  });

  it("중간에 또 틀리면 졸업이 늦어진다 (✗✓✗✓✓✓✓ → 5/7)", () => {
    const s = run([false, true, false, true, true, true, true]);
    expect(s[5]!.graduatedAt).toBeNull(); // 4/6 = 66.7%
    expect(s[6]!.graduatedAt).toBe(7); // 5/7 = 71.4%
  });

  it("정확히 70%는 졸업이 아니다", () => {
    const note: WrongNote = { ...ids, attempts: 9, corrects: 6, addedAt: 0, lastSeenAt: 0, graduatedAt: null };
    expect(applyAnswer(note, ids, true, 1)!.graduatedAt).toBeNull(); // 7/10
  });

  it("졸업한 문제를 다시 틀리면 새로 등록된다", () => {
    const s = run([false, true, true, true, false]);
    expect(s[4]).toMatchObject({ attempts: 1, corrects: 0, graduatedAt: null, addedAt: 5 });
  });

  it("졸업한 문제를 맞히면 그대로 둔다", () => {
    const s = run([false, true, true, true, true]);
    expect(s[4]).toBe(s[3]);
  });

  it("졸업까지 남은 연속 정답 수", () => {
    expect(correctsToGraduate({ attempts: 1, corrects: 0 })).toBe(3);
    expect(correctsToGraduate({ attempts: 3, corrects: 2 })).toBe(1);
  });

  it("복습은 정답률 낮은 순, 같으면 오래 안 본 순", () => {
    const mk = (questionId: number, corrects: number, attempts: number, lastSeenAt: number): WrongNote => ({
      questionId, setId: 1, corrects, attempts, lastSeenAt, addedAt: 0, graduatedAt: null,
    });
    const order = reviewOrder([mk(1, 2, 3, 5), mk(2, 0, 1, 9), mk(3, 0, 1, 2), { ...mk(4, 0, 1, 0), graduatedAt: 1 }]);
    expect(order.map((n) => n.questionId)).toEqual([3, 2, 1]);
  });
});
