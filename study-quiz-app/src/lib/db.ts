import Dexie, { type EntityTable } from "dexie";
import type {
  Attempt,
  Question,
  Section,
  StoredFile,
  StudySet,
  UsageRecord,
  WrongNote,
} from "./types";

export const db = new Dexie("study-quiz") as Dexie & {
  sets: EntityTable<StudySet, "id">;
  files: EntityTable<StoredFile, "id">;
  sections: EntityTable<Section, "id">;
  questions: EntityTable<Question, "id">;
  attempts: EntityTable<Attempt, "id">;
  wrongNotes: EntityTable<WrongNote, "questionId">;
  usage: EntityTable<UsageRecord, "id">;
};

db.version(1).stores({
  sets: "++id, createdAt",
  files: "++id, setId",
  sections: "++id, setId, [setId+order]",
  questions: "++id, setId, sectionId",
  attempts: "++id, setId, questionId, at",
  wrongNotes: "questionId, setId, graduatedAt",
  usage: "++id, at",
});

const TABLES = ["sets", "files", "sections", "questions", "attempts", "wrongNotes", "usage"] as const;

export async function deleteSet(setId: number): Promise<void> {
  await db.transaction("rw", [db.sets, db.files, db.sections, db.questions, db.attempts, db.wrongNotes], async () => {
    await db.files.where({ setId }).delete();
    await db.sections.where({ setId }).delete();
    await db.questions.where({ setId }).delete();
    await db.attempts.where({ setId }).delete();
    await db.wrongNotes.where({ setId }).delete();
    await db.sets.delete(setId);
  });
}

/** 브라우저 저장소가 지워질 때를 대비한 전체 백업 */
export async function exportAll(): Promise<string> {
  const dump: Record<string, unknown[]> = {};
  for (const t of TABLES) dump[t] = await db.table(t).toArray();
  return JSON.stringify({ app: "study-quiz", version: 1, exportedAt: Date.now(), tables: dump });
}

export async function importAll(json: string): Promise<void> {
  const parsed = JSON.parse(json) as { app?: string; tables?: Record<string, unknown[]> };
  if (parsed.app !== "study-quiz" || !parsed.tables) throw new Error("이 앱의 백업 파일이 아닙니다.");
  await db.transaction("rw", TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      await db.table(t).bulkAdd(parsed.tables![t] ?? []);
    }
  });
}
