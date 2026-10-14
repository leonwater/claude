import { describe, expect, it } from "vitest";
import { allocate, allocateCapped } from "./allocate";

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

describe("allocate", () => {
  it("비율대로 나누고 합계를 맞춘다", () => {
    expect(allocate([1, 1, 1], 10)).toEqual([4, 3, 3]);
    expect(allocate([3, 1], 8)).toEqual([6, 2]);
  });
  it("최소 개수를 보장한다", () => {
    const r = allocate([100, 1, 1], 20, 3);
    expect(r.every((x) => x >= 3)).toBe(true);
    expect(sum(r)).toBe(20);
  });
  it("최소×개수가 total보다 크면 최소만큼씩", () => {
    expect(allocate([1, 1, 1, 1], 6, 3)).toEqual([3, 3, 3, 3]);
  });
});

describe("allocateCapped", () => {
  it("문제가 모자란 섹션 몫을 다른 섹션으로 넘긴다", () => {
    const r = allocateCapped([1, 1, 1, 1], [1, 10, 10, 10], 20);
    expect(r[0]).toBe(1);
    expect(sum(r)).toBe(20);
  });
  it("전체 문제 수보다 많이 달라고 하면 있는 만큼만", () => {
    expect(allocateCapped([1, 1], [2, 3], 40)).toEqual([2, 3]);
  });
  it("가중치가 아주 작은 섹션도 남는 자리를 받는다", () => {
    expect(sum(allocateCapped([1000, 1], [1, 5], 4))).toBe(4);
  });
});
