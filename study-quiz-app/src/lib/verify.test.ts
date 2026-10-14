import { describe, expect, it } from "vitest";
import { isDuplicate, locateQuotePage, quoteInSource, rejectReason, shuffleChoices, similarity, type RawQuestion } from "./verify";

const source = "TCP는 연결 지향 프로토콜이다.\n클라이언트는 SYN을 보내고,\n서버는 SYN-ACK로 응답한다. 마지막으로 클라이언트가 ACK를 보낸다.";

const good: RawQuestion = {
  concept: "3-way handshake",
  stem: "TCP 연결 수립에서 서버가 보내는 패킷은?",
  choices: ["SYN-ACK", "SYN", "FIN", "RST"],
  answer_index: 0,
  explanation: "서버는 SYN-ACK로 응답한다.",
  source_quote: "서버는 SYN-ACK로 응답한다.",
};

describe("근거 문장 검증", () => {
  it("원문 그대로면 통과 (줄바꿈·공백 차이는 무시)", () => {
    expect(quoteInSource("클라이언트는 SYN을 보내고, 서버는 SYN-ACK로 응답한다.", source)).toBe(true);
  });
  it("글자가 하나라도 바뀌면 탈락", () => {
    expect(quoteInSource("서버는 SYN-ACK로 응답합니다.", source)).toBe(false);
    expect(quoteInSource("서버는 SYN/ACK로 응답한다.", source)).toBe(false);
  });
  it("너무 짧은 인용은 탈락", () => {
    expect(quoteInSource("TCP", source)).toBe(false);
  });
  it("앞뒤 생략 부호는 허용", () => {
    expect(quoteInSource("…서버는 SYN-ACK로 응답한다…", source)).toBe(true);
  });
  it("인용이 있는 페이지를 찾는다", () => {
    const paragraphs = [{ text: "첫 페이지 내용입니다.", page: 1 }, { text: "둘째 페이지에는 핵심 문장이 있다.", page: 2 }];
    expect(locateQuotePage("핵심 문장이 있다", paragraphs)).toBe(2);
    expect(locateQuotePage("없는 문장입니다만", paragraphs)).toBeUndefined();
  });
});

describe("문제 형식 검증", () => {
  it("정상 문제는 통과", () => expect(rejectReason(good, source)).toBeNull());
  it("보기 개수, 중복 보기, 정답 번호, 근거를 검사한다", () => {
    expect(rejectReason({ ...good, choices: ["a", "b", "c"] }, source)).toBe("보기가 4개가 아님");
    expect(rejectReason({ ...good, choices: ["SYN", "SYN ", "FIN", "RST"] }, source)).toBe("중복 보기");
    expect(rejectReason({ ...good, answer_index: 4 }, source)).toBe("정답 번호 오류");
    expect(rejectReason({ ...good, source_quote: "서버는 응답을 하지 않는다." }, source)).toBe("근거 문장이 원문에 없음");
  });
});

describe("중복 판정", () => {
  const existing = [{ concept: "3-way handshake", stem: "TCP 연결 수립에서 서버가 보내는 패킷은?", answer: "SYN-ACK" }];
  it("같은 개념은 중복", () => {
    expect(isDuplicate({ concept: "3-Way Handshake", stem: "전혀 다른 질문", answer: "x" }, existing)).toBe(true);
  });
  it("거의 같은 문장은 중복", () => {
    expect(similarity("TCP 연결 수립에서 서버가 보내는 패킷은? SYN-ACK", "TCP 연결 수립 시 서버가 보내는 패킷은? SYN-ACK")).toBeGreaterThan(0.8);
    expect(isDuplicate({ concept: "서버 응답", stem: "TCP 연결 수립 시 서버가 보내는 패킷은?", answer: "SYN-ACK" }, existing)).toBe(true);
  });
  it("다른 문제는 중복 아님", () => {
    expect(isDuplicate({ concept: "연결 지향", stem: "TCP의 특징으로 옳은 것은?", answer: "연결 지향" }, existing)).toBe(false);
  });
});

describe("보기 섞기", () => {
  it("정답 위치를 따라간다", () => {
    for (let seed = 0; seed < 20; seed++) {
      let x = seed + 1;
      const rng = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
      const r = shuffleChoices(["정답", "b", "c", "d"], 0, rng);
      expect(r.choices[r.answerIndex]).toBe("정답");
      expect([...r.choices].sort()).toEqual(["b", "c", "d", "정답"]);
    }
  });
});
