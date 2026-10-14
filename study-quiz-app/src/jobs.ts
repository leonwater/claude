import { useSyncExternalStore } from "react";
import { fillBank, type Progress } from "./lib/generate";

export interface Job {
  running: boolean;
  progress?: Progress;
  errors: string[];
  fatal?: string;
  controller?: AbortController;
}

const jobs = new Map<number, Job>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function set(setId: number, job: Job) {
  jobs.set(setId, job);
  emit();
}

export function useJob(setId: number): Job | undefined {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => jobs.get(setId),
  );
}

/** 문제은행 생성은 화면을 옮겨도 계속되도록 화면 밖에서 관리한다 */
export async function startJob(setId: number): Promise<void> {
  if (jobs.get(setId)?.running) return;
  const controller = new AbortController();
  set(setId, { running: true, errors: [], controller });
  let wakeLock: WakeLockSentinel | undefined;
  try {
    wakeLock = await navigator.wakeLock?.request("screen");
  } catch {
    /* 화면 꺼짐 방지를 지원하지 않는 브라우저 */
  }
  try {
    const { errors } = await fillBank(setId, (progress) => set(setId, { ...jobs.get(setId)!, progress }), controller.signal);
    set(setId, { ...jobs.get(setId)!, running: false, errors, controller: undefined });
  } catch (e) {
    set(setId, { ...jobs.get(setId)!, running: false, fatal: e instanceof Error ? e.message : String(e), controller: undefined });
  } finally {
    await wakeLock?.release().catch(() => {});
  }
}

export function stopJob(setId: number) {
  jobs.get(setId)?.controller?.abort();
}
