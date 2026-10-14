export const MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (품질 우선)", inPerM: 4, outPerM: 20, cacheReadPerM: 0.2, fallbacks: true },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (균형)", inPerM: 2, outPerM: 10, cacheReadPerM: 0.2, fallbacks: true },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (저렴)", inPerM: 0.1, outPerM: 0.5, cacheReadPerM: 0.01, fallbacks: false },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

export function modelInfo(id: string) {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

const KEY_API = "sq.apiKey";
const KEY_MODEL = "sq.model";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* 저장 불가 환경(사생활 보호 모드 등) */
  }
}

export const settings = {
  apiKey: () => read(KEY_API) ?? "",
  setApiKey: (v: string) => write(KEY_API, v.trim() || null),
  model: (): ModelId => modelInfo(read(KEY_MODEL) ?? "").id,
  setModel: (v: ModelId) => write(KEY_MODEL, v),
};

/** 캐시 쓰기는 입력 단가의 1.25배 */
export function costUsd(
  model: string,
  u: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number },
): number {
  const m = modelInfo(model);
  return (
    (u.inputTokens * m.inPerM +
      u.cacheWriteTokens * m.inPerM * 1.25 +
      u.cacheReadTokens * m.cacheReadPerM +
      u.outputTokens * m.outPerM) /
    1_000_000
  );
}

/**
 * 생성 전에 보여줄 대략적인 비용. 한글은 글자당 약 1토큰, 그 외는 3.5글자당 1토큰으로 어림잡고
 * 문항당 출력(사고 과정 포함) 1,000토큰으로 넉넉히 잡는다. 실제 비용은 생성 후 기록된다.
 */
export function estimateCost(model: string, sourceChars: { hangul: number; other: number }, calls: number, questions: number): number {
  const sourceTokens = sourceChars.hangul + sourceChars.other / 3.5;
  const inputTokens = sourceTokens + calls * 1500;
  return costUsd(model, { inputTokens, outputTokens: questions * 1000, cacheReadTokens: 0, cacheWriteTokens: 0 });
}

export function countChars(text: string): { hangul: number; other: number } {
  const hangul = (text.match(/[가-힣]/g) ?? []).length;
  return { hangul, other: text.length - hangul };
}
