import bank from "../data/adsp_bank.json";
import { db } from "./db";
import type { Question } from "./types";

/** 문제은행 파일을 고치면 올린다. 앱이 켜질 때 기존 풀이 기록은 두고 문제 내용만 갱신한다 */
export const ADSP_BANK_VERSION = 4;
export const ADSP_KEY = "adsp";

export const SUBJECT_NAMES: Record<number, string> = {
  1: "1과목 데이터 이해",
  2: "2과목 데이터분석 기획",
  3: "3과목 데이터분석",
};

interface BankQuestion {
  id: string;
  subject: number;
  chapter: string;
  concept: string;
  stem: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
  sourceQuote: string;
  image: string | null;
  glossary: { term: string; def: string }[];
  choiceInfo: (string[] | null)[];
}

/** 내장 ADsP 문제은행을 기기 DB에 넣는다(처음 실행 또는 문제은행 버전이 바뀐 경우) */
export async function ensureBuiltinBank(): Promise<void> {
  const existing = (await db.sets.toArray()).find((s) => s.builtin === ADSP_KEY);
  if (existing?.bankVersion === ADSP_BANK_VERSION) return;
  const questions = bank.questions as BankQuestion[];
  const chapters = bank.chapters as Record<string, string>;

  await db.transaction("rw", [db.sets, db.sections, db.questions], async () => {
    const setId =
      existing?.id ??
      ((await db.sets.add({ title: bank.title, createdAt: Date.now(), bankTarget: questions.length, builtin: ADSP_KEY })) as number);
    await db.sets.update(setId, { bankVersion: ADSP_BANK_VERSION, bankTarget: questions.length, title: bank.title });

    // 단원을 섹션으로 둔다. 섹션 크기(charCount)는 출제 비율을 정하는 가중치로 쓰이므로 문항 수를 넣는다
    const sections = await db.sections.where({ setId }).toArray();
    const sectionIdByChapter = new Map<string, number>();
    const chapterKeys = Object.keys(chapters).sort();
    for (const [order, ch] of chapterKeys.entries()) {
      const title = `${ch.split("-")[0]}과목 · ${chapters[ch]}`;
      const count = questions.filter((q) => q.chapter === ch).length;
      const found = sections.find((s) => s.title === title);
      if (found) {
        await db.sections.update(found.id!, { order, charCount: count });
        sectionIdByChapter.set(ch, found.id!);
      } else {
        const id = await db.sections.add({ setId, fileId: 0, fileName: "ADsP 핵심 정리", order, title, paragraphs: [], charCount: count });
        sectionIdByChapter.set(ch, id as number);
      }
    }

    const current = await db.questions.where({ setId }).toArray();
    const byKey = new Map(current.map((q) => [q.key, q]));
    for (const b of questions) {
      const content: Partial<Question> = {
        sectionId: sectionIdByChapter.get(b.chapter)!,
        subject: b.subject,
        concept: b.concept,
        stem: b.stem,
        choices: b.choices,
        answerIndex: b.answerIndex,
        explanation: b.explanation,
        sourceQuote: b.sourceQuote,
        image: b.image,
        glossary: b.glossary,
        choiceInfo: b.choiceInfo,
      };
      const old = byKey.get(b.id);
      if (old) await db.questions.update(old.id!, content);
      else await db.questions.add({ ...(content as Question), setId, key: b.id, createdAt: Date.now(), timesSeen: 0, lastSeenAt: 0 });
    }
  });
}
