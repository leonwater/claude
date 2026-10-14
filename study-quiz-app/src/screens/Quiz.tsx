import { useEffect, useMemo, useRef, useState } from "react";
import { recordAnswer } from "../lib/answers";
import { db } from "../lib/db";
import { shuffle } from "../lib/verify";
import { accuracy, correctsToGraduate } from "../lib/wrongNote";
import type { AnswerMode, Question, WrongNote } from "../lib/types";
import type { Navigate } from "../App";
import { pct, ProgressBar, Screen } from "../ui";

interface Result {
  question: Question;
  correct: boolean;
  noteAfter?: WrongNote;
}

export function Quiz({
  setId,
  mode,
  questionIds,
  back,
  home,
  go,
}: {
  setId: number;
  mode: AnswerMode;
  questionIds: number[];
  back: () => void;
  home: () => void;
  go: Navigate;
}) {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const saving = useRef(false);

  useEffect(() => {
    db.questions.bulkGet(questionIds).then((qs) => setQuestions(qs.filter((q): q is Question => !!q)));
  }, [questionIds]);

  const q = questions?.[index];
  // 같은 문제를 다시 풀 때 위치로 외우지 않도록 보기 순서를 매번 섞는다
  const order = useMemo(() => (q ? shuffle([0, 1, 2, 3]) : []), [q]);

  if (!questions) return <Screen title="" onBack={back}>{null}</Screen>;
  const title = mode === "quiz" ? "퀴즈" : "오답 복습";

  if (!q) {
    const correct = results.filter((r) => r.correct).length;
    const wrong = results.filter((r) => !r.correct);
    const graduatedNow = results.filter((r) => r.noteAfter?.graduatedAt);
    return (
      <Screen title={`${title} 결과`} onBack={home}>
        <div className="score">
          <div className="score-big">
            {correct} / {results.length}
          </div>
          <div className="muted">정답률 {pct(results.length ? correct / results.length : 0)}</div>
        </div>
        {graduatedNow.length > 0 && <div className="notice good">🎓 {graduatedNow.length}문항이 오답노트에서 졸업했습니다.</div>}
        {wrong.length > 0 && (
          <section className="panel">
            <h2>틀린 문제 ({wrong.length})</h2>
            <ul className="review-list">
              {wrong.map(({ question: w }) => (
                <li key={w.id}>
                  <div>{w.stem}</div>
                  <div className="answer">정답: {w.choices[w.answerIndex]}</div>
                </li>
              ))}
            </ul>
          </section>
        )}
        <button className="primary block" onClick={() => go({ name: "wrong", setId })}>
          오답노트 보기
        </button>
        <button className="block" onClick={home}>
          처음으로
        </button>
      </Screen>
    );
  }

  const answered = chosen !== null;
  const isCorrect = answered && order[chosen] === q.answerIndex;

  const choose = async (displayIdx: number) => {
    // 기록이 끝난 뒤에 채점 화면을 보여 줘야 빠르게 넘겨도 결과·오답노트가 어긋나지 않는다
    if (answered || saving.current) return;
    saving.current = true;
    const correct = order[displayIdx] === q.answerIndex;
    try {
      await recordAnswer(q, correct, mode);
      const noteAfter = await db.wrongNotes.get(q.id!);
      setResults((r) => [...r, { question: q, correct, noteAfter }]);
      setChosen(displayIdx);
    } finally {
      saving.current = false;
    }
  };

  const next = () => {
    setChosen(null);
    setIndex((i) => i + 1);
  };

  const note = results[results.length - 1]?.question.id === q.id ? results[results.length - 1].noteAfter : undefined;

  return (
    <Screen title={`${title} ${index + 1} / ${questions.length}`} onBack={back}>
      <ProgressBar value={index + (answered ? 1 : 0)} max={questions.length} />
      <div className="question">{q.stem}</div>
      <ol className="choices">
        {order.map((orig, displayIdx) => {
          const state = !answered
            ? ""
            : orig === q.answerIndex
              ? "correct"
              : displayIdx === chosen
                ? "wrong"
                : "dim";
          return (
            <li key={orig}>
              <button className={`choice ${state}`} onClick={() => choose(displayIdx)} disabled={answered}>
                <span className="choice-no">{displayIdx + 1}</span>
                <span>{q.choices[orig]}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {answered && (
        <div className={`feedback ${isCorrect ? "good" : "bad"}`}>
          <strong>{isCorrect ? "정답입니다" : "틀렸습니다"}</strong>
          {q.explanation && <p>{q.explanation}</p>}
          <blockquote>
            {q.sourceQuote}
            {q.sourcePage && <cite> — p.{q.sourcePage}</cite>}
          </blockquote>
          {note && (
            <p className="small">
              {note.graduatedAt
                ? `🎓 정답률 ${pct(accuracy(note))} (${note.corrects}/${note.attempts}) — 오답노트에서 졸업!`
                : `오답노트 정답률 ${pct(accuracy(note))} (${note.corrects}/${note.attempts}) · 졸업까지 연속 ${correctsToGraduate(note)}번`}
            </p>
          )}
          <button className="primary block" onClick={next}>
            {index + 1 < questions.length ? "다음 문제" : "결과 보기"}
          </button>
        </div>
      )}
    </Screen>
  );
}
