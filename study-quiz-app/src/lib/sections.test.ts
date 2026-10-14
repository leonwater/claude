import { describe, expect, it } from "vitest";
import { buildSections, sectionText, splitLong } from "./sections";
import { parsePlainText } from "./parse";

describe("splitLong", () => {
  it("조각을 이으면 원문과 같다", () => {
    const text = "가나다라마바사. ".repeat(500);
    const pieces = splitLong(text, 1000);
    expect(pieces.join("")).toBe(text);
    expect(pieces.every((p) => p.length <= 1000)).toBe(true);
  });
});

describe("buildSections", () => {
  it("마크다운 제목 기준으로 나누고 원문을 그대로 보존한다", () => {
    const body = "본문 문장입니다. ".repeat(100);
    const md = `# 1장 네트워크\n\n${body}\n\n# 2장 운영체제\n\n${body}`;
    const paras = parsePlainText(md, true);
    const sections = buildSections(paras, "파일", { target: 5000, max: 8000, min: 200 });
    expect(sections.map((s) => s.title)).toEqual(["# 1장 네트워크", "# 2장 운영체제"]);
    expect(sections.map((s) => sectionText(s.paragraphs)).join("\n\n")).toBe(paras.map((p) => p.text).join("\n\n"));
  });

  it("제목이 없으면 길이로 나누고 페이지 범위를 제목으로 쓴다", () => {
    const paras = Array.from({ length: 10 }, (_, i) => ({ text: "x".repeat(1000), page: i + 1 }));
    const sections = buildSections(paras, "교재", { target: 3000, max: 4000, min: 500 });
    expect(sections.map((s) => s.title)).toEqual(["교재 p.1–3", "교재 p.4–6", "교재 p.7–9", "교재 p.10"]);
  });

  it("긴 섹션이 나뉘면 뒤쪽에 (계속)을 붙인다", () => {
    const paras = [{ text: "# 큰 장", heading: true }, ...Array.from({ length: 6 }, () => ({ text: "y".repeat(1000) }))];
    const sections = buildSections(paras, "f", { target: 3000, max: 4000, min: 500 });
    expect(sections[0].title).toBe("# 큰 장");
    expect(sections[1].title).toBe("# 큰 장 (계속)");
  });
});
