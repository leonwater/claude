/** 원문에서 추출한 문단. 텍스트는 추출된 그대로 보관한다. */
export interface Paragraph {
  text: string;
  /** PDF 페이지 번호(1부터). PDF가 아니면 없음 */
  page?: number;
  /** 제목(헤딩)으로 인식된 문단인지 */
  heading?: boolean;
}

export interface StudySet {
  id?: number;
  title: string;
  createdAt: number;
  /** 문제은행 목표 문항 수 */
  bankTarget: number;
  /** 앱에 내장된 문제은행이면 그 이름(예: "adsp"). 사용자가 올린 세트는 없음 */
  builtin?: string;
  bankVersion?: number;
}

export interface StoredFile {
  id?: number;
  setId: number;
  name: string;
  size: number;
  pages?: number;
  /** 추출 텍스트의 SHA-256. 원문이 바뀌지 않았는지 확인하는 기준 */
  textSha256: string;
}

export interface Section {
  id?: number;
  setId: number;
  fileId: number;
  fileName: string;
  order: number;
  title: string;
  paragraphs: Paragraph[];
  charCount: number;
}

export interface Question {
  id?: number;
  setId: number;
  sectionId: number;
  concept: string;
  stem: string;
  /** 보기 4개 */
  choices: string[];
  answerIndex: number;
  explanation: string;
  /** 정답 근거 원문 문장(원문에 글자 그대로 존재함이 검증됨) */
  sourceQuote: string;
  sourcePage?: number;
  createdAt: number;
  timesSeen: number;
  lastSeenAt: number;
  /** 내장 문제은행의 고정 ID(업데이트 시 같은 문제를 찾는 데 사용) */
  key?: string;
  /** 내장 문제은행의 과목 번호(1·2·3) */
  subject?: number;
  /** 문제에 딸린 그림 파일 이름 */
  image?: string | null;
  /** 풀이 맨 밑에 보여 줄 용어정리(문제와 보기에 나온 PDF 용어) */
  glossary?: GlossaryTerm[];
  /** 보기마다, 그 보기를 골랐을 때 보여 줄 설명(정답 보기는 null) */
  choiceInfo?: (string[] | null)[];
}

export interface GlossaryTerm {
  term: string;
  def: string;
}

export type AnswerMode = "quiz" | "review";

export interface Attempt {
  id?: number;
  setId: number;
  questionId: number;
  correct: boolean;
  mode: AnswerMode;
  at: number;
}

export interface WrongNote {
  questionId: number;
  setId: number;
  attempts: number;
  corrects: number;
  addedAt: number;
  lastSeenAt: number;
  /** 정답률 70% 초과로 졸업한 시각. null이면 오답노트에 남아 있음 */
  graduatedAt: number | null;
}

export interface SessionAnswer {
  questionId: number;
  /** 화면에 보인 보기 번호(0~3) */
  chosen: number;
  correct: boolean;
}

/** 진행 중이거나 끝난 퀴즈. 앱을 꺼도 이어서 풀 수 있도록 저장한다 */
export interface QuizSession {
  id?: number;
  setId: number;
  mode: AnswerMode;
  /** 0 = 종합, 1·2·3 = 과목. 과목 구분이 없는 세트는 null */
  subject: number | null;
  questionIds: number[];
  /** 문제별 보기 표시 순서(원래 보기 번호의 배열) */
  choiceOrders: number[][];
  /** 지금 보고 있는 문제 번호 */
  index: number;
  answers: SessionAnswer[];
  startedAt: number;
  /** 끝내기를 누른 시각. null이면 진행 중 */
  finishedAt: number | null;
}

export interface UsageRecord {
  id?: number;
  at: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
}
