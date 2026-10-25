import { describe, expect, it } from "vitest";
import bank from "../data/adsp_bank.json";

describe("내장 문제은행의 용어정리와 선지 설명", () => {
  it("모든 문제에 용어정리가 있고 비어 있지 않다", () => {
    for (const q of bank.questions) {
      expect(q.glossary.length, q.id).toBeGreaterThan(0);
      for (const g of q.glossary) {
        expect(g.term.trim().length, q.id).toBeGreaterThan(0);
        expect(g.def.trim().length, q.id).toBeGreaterThan(0);
      }
      expect(new Set(q.glossary.map((g) => g.term)).size, q.id).toBe(q.glossary.length);
    }
  });

  it("오답 보기마다 설명이 있고 정답 보기는 null이다", () => {
    for (const q of bank.questions) {
      expect(q.choiceInfo, q.id).toHaveLength(4);
      q.choiceInfo.forEach((info, i) => {
        if (i === q.answerIndex) expect(info, q.id).toBeNull();
        else {
          expect(Array.isArray(info), `${q.id} 보기 ${i}`).toBe(true);
          expect((info as string[]).length, `${q.id} 보기 ${i}`).toBeGreaterThan(0);
        }
      });
    }
  });

  it("PDF에 없는 선지는 그렇게만 표시한다", () => {
    const none = bank.questions.flatMap((q) => q.choiceInfo.filter((i): i is string[] => !!i && i.length === 1 && i[0] === "PDF에 없는 선지입니다."));
    expect(none.length).toBeGreaterThan(100);
  });

  it("옳은 것 / 옳지 않은 것 문제가 모두 있다", () => {
    const right = bank.questions.filter((q) => q.stem.endsWith("옳은 것은?"));
    const wrong = bank.questions.filter((q) => q.stem.endsWith("옳지 않은 것은?"));
    expect(right.length).toBeGreaterThanOrEqual(40);
    expect(wrong.length).toBeGreaterThanOrEqual(40);
    // 문장형 '옳지 않은 것' 문제의 다른 보기(옳은 문장)는 옳은 설명이라고 알려 준다
    const ox = wrong.filter((q) => q.concept.startsWith("OX "));
    expect(ox.length).toBeGreaterThan(30);
    for (const q of ox) {
      q.choiceInfo.forEach((info, i) => {
        if (i !== q.answerIndex) expect(info?.[0], q.id).toContain("옳은 설명입니다");
      });
    }
  });
});
