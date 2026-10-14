import { useLiveQuery } from "dexie-react-hooks";
import { activeSession } from "./sessions";
import type { QuizSession } from "./types";

/** 진행 중인 퀴즈(없으면 null, 불러오는 중이면 undefined) */
export function useActiveSession(): QuizSession | null | undefined {
  return useLiveQuery(async () => (await activeSession()) ?? null);
}
