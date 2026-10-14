import Anthropic from "@anthropic-ai/sdk";
import { costUsd, modelInfo } from "./settings";
import type { RawQuestion } from "./verify";
import type { UsageRecord } from "./types";

const SYSTEM_PROMPT = `너는 사용자가 올린 학습 자료로 객관식 문제를 만드는 출제자다. 사용자는 출퇴근길에 이 문제로 자료 내용을 복습한다.

규칙:
1. <source> 원문에 적힌 내용만으로 출제한다. 원문에 없는 사실이나 외부 지식으로 정답·보기·해설을 만들지 않는다. 원문 내용을 바꾸거나 덧붙이지 않는다.
2. source_quote에는 정답의 근거가 되는 원문 문장을 한 글자도 바꾸지 말고 그대로 복사한다. 요약, 맞춤법·띄어쓰기 수정, 생략 부호 사용을 하지 않는다. 1~2문장, 200자 이내.
3. 보기는 정확히 4개, 정답은 하나다. 오답 보기는 원문을 대충 읽으면 헷갈릴 만하지만 원문에 근거해 분명히 틀린 것이어야 한다. "모두 정답", "정답 없음", "위의 보기 중" 같은 보기는 쓰지 않는다.
4. concept에는 문제가 묻는 핵심 개념을 짧게(20자 이내) 적는다. <already_covered>에 있는 개념이나 서로 같은 개념을 묻는 문제는 만들지 않는다.
5. 원문의 앞·중간·뒤에서 고르게 출제한다. 한 부분에 몰리지 않게 한다.
6. 문제·보기·해설은 원문과 같은 언어로 쓴다.
7. explanation에는 정답인 이유를 원문에 근거해 1~2문장으로 쓴다.`;

const QUESTIONS_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          concept: { type: "string" },
          stem: { type: "string" },
          choices: { type: "array", items: { type: "string" } },
          answer_index: { type: "integer" },
          explanation: { type: "string" },
          source_quote: { type: "string" },
        },
        required: ["concept", "stem", "choices", "answer_index", "explanation", "source_quote"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

export interface GenerateRequest {
  apiKey: string;
  model: string;
  fileName: string;
  sectionTitle: string;
  sourceText: string;
  count: number;
  coveredConcepts: string[];
  signal?: AbortSignal;
}

export interface GenerateResult {
  questions: RawQuestion[];
  usage: Omit<UsageRecord, "id">;
}

export class GenerationError extends Error {}

function escapeAttr(s: string): string {
  return s.replace(/[&"<>]/g, (c) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[c]!);
}

export async function generateQuestions(req: GenerateRequest): Promise<GenerateResult> {
  // 개인용 앱이라 API 키를 기기에만 저장하고 브라우저에서 바로 호출한다
  const client = new Anthropic({ apiKey: req.apiKey, dangerouslyAllowBrowser: true, maxRetries: 4 });
  const info = modelInfo(req.model);
  const covered = req.coveredConcepts.length ? req.coveredConcepts.map((c) => `- ${c}`).join("\n") : "(없음)";

  const stream = client.beta.messages.stream(
    {
      model: req.model,
      max_tokens: 32000,
      ...(info.fallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      output_config: { effort: "medium", format: { type: "json_schema", schema: QUESTIONS_SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              // 같은 섹션으로 추가 생성할 때 원문 부분은 캐시에서 읽힌다
              type: "text",
              text: `<source file="${escapeAttr(req.fileName)}" section="${escapeAttr(req.sectionTitle)}">\n${req.sourceText}\n</source>`,
              cache_control: { type: "ephemeral" },
            },
            {
              type: "text",
              text: `<already_covered>\n${covered}\n</already_covered>\n\n위 원문으로 객관식 문제 ${req.count}개를 만들어라.`,
            },
          ],
        },
      ],
    },
    { signal: req.signal },
  );
  const message = await stream.finalMessage();

  const u = message.usage;
  const tokens = {
    inputTokens: u.input_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
  };
  const usage = { at: Date.now(), model: message.model, ...tokens, costUsd: costUsd(message.model, tokens) };

  if (message.stop_reason === "refusal") {
    throw new GenerationError(`모델이 이 부분의 출제를 거절했습니다${message.stop_details?.category ? ` (${message.stop_details.category})` : ""}.`);
  }
  if (message.stop_reason === "max_tokens") {
    throw new GenerationError("응답이 길이 제한에 걸려 잘렸습니다. 다시 시도해 주세요.");
  }
  const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  let parsed: { questions?: RawQuestion[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GenerationError("모델 응답을 해석하지 못했습니다.");
  }
  return { questions: parsed.questions ?? [], usage };
}

export function describeApiError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "API 키가 올바르지 않습니다. 설정에서 확인해 주세요.";
  if (e instanceof Anthropic.PermissionDeniedError) return "이 API 키로는 선택한 모델을 쓸 수 없습니다.";
  if (e instanceof Anthropic.RateLimitError) return "요청 한도에 걸렸습니다. 잠시 후 이어서 생성해 주세요.";
  if (e instanceof Anthropic.APIUserAbortError) return "생성을 멈췄습니다.";
  if (e instanceof Anthropic.APIConnectionError) return "인터넷 연결을 확인해 주세요.";
  if (e instanceof Anthropic.APIError) return `API 오류 (${e.status ?? "?"}): ${e.message}`;
  if (e instanceof Error) return e.message;
  return String(e);
}
