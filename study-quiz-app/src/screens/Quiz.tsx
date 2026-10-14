import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { SUBJECT_NAMES } from "../lib/builtin";
import { db } from "../lib/db";
import { answerCurrent, finishSession, goNext } from "../lib/sessions";
import { accuracy, correctsToGraduate } from "../lib/wrongNote";
import type { Question } from "../lib/types";
import type { Navigate } from "../App";
import { pct, ProgressBar, Screen } from "../ui";

const NUMBERS = ["①", "②", "③", "④"];

export function Quiz({ sessionId, back, home, go }: { sessionId: number; back: () => void; home: () => void; go: Navigate }) {
  const data = useLiveQuery(async () => {
    const session = await db.sessions.get(sessionId);
    if (!session) return null;
    const questions = (await db.questions.bulkGet(session.questionIds)) as (Question | undefined)[];
    const q = questions[session.index];
    const note = q ? await db.wrongNotes.get(q.id!) : undefined;
    return { session, questions, note };
  }, [sessionId]);
  const [zoom, setZoom] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (data === undefined) return <Screen title="" onBack={back}>{null}</Screen>;
  if (data === null) return <Screen title="퀴즈 없음" onBack={back}>{null}</Screen>;
  const { session, questions, note } = data;
  const mode = session.mode === "quiz" ? "퀴즈" : "오답 복습";
  const scope = session.subject === null ? "" : session.subject === 0 ? " · 종합" : ` · ${SUBJECT_NAMES[session.subject]?.split(" ")[0]}`;

  const finish = async () => {
    await finishSession(sessionId);
  };
  const askFinish = async () => {
    const left = session.questionIds.length - session.answers.length;
    if (left > 0 && !confirm(`아직 ${left}문제가 남았습니다. 퀴즈를 끝낼까요?\n(지금까지 푼 문제는 기록됩니다)`)) return;
    await finish();
  };

  // 다 풀었거나 끝내기를 누른 경우: 결과
  if (session.finishedAt !== null || session.index >= session.questionIds.length) {
    const results = session.answers.map((a) => ({ ...a, question: questions[session.questionIds.indexOf(a.questionId)] }));
    const correct = results.filter((r) => r.correct).length;
    const wrong = results.filter((r) => !r.correct && r.question);
    const ended = session.finishedAt !== null;
    return (
      <Screen title={`${mode} 결과${scope}`} onBack={ended ? home : undefined}>
        <div className="score">
          <div className="score-big">
            {correct} / {results.length}
          </div>
          <div className="muted">
            정답률 {pct(results.length ? correct / results.length : 0)}
            {results.length < session.questionIds.length && ` · ${session.questionIds.length}문제 중 ${results.length}문제 풂`}
          </div>
        </div>
        {wrong.length > 0 && (
          <section className="panel">
            <h2>틀린 문제 ({wrong.length})</h2>
            <ul className="review-list">
              {wrong.map(({ question: w }) => (
                <li key={w!.id}>
                  <div>{w!.stem}</div>
                  <div className="answer">정답: {w!.choices[w!.answerIndex]}</div>
                </li>
              ))}
            </ul>
          </section>
        )}
        {ended ? (
          <>
            <button className="primary block" onClick={() => go({ name: "wrong", setId: session.setId })}>
              오답노트 보기
            </button>
            <button className="block" onClick={home}>
              처음으로
            </button>
          </>
        ) : (
          <>
            <button className="primary block" onClick={finish}>
              끝내기
            </button>
            <p className="muted small center">끝내기를 눌러야 새 퀴즈를 시작할 수 있습니다.</p>
          </>
        )}
      </Screen>
    );
  }

  const q = questions[session.index];
  if (!q) {
    return (
      <Screen title={mode} onBack={back}>
        <div className="notice error">문제를 찾을 수 없습니다.</div>
        <button className="block" onClick={finish}>
          끝내기
        </button>
      </Screen>
    );
  }
  const order = session.choiceOrders[session.index];
  const answer = session.answers.length > session.index ? session.answers[session.index] : undefined;
  const answered = answer !== undefined;
  const correctDisplay = order.indexOf(q.answerIndex);

  const choose = async (displayIdx: number) => {
    if (answered || busy) return;
    setBusy(true);
    try {
      await answerCurrent(sessionId, q, displayIdx);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title={`${mode}${scope} ${session.index + 1} / ${session.questionIds.length}`}
      onBack={back}
      actions={
        <button className="text-btn" onClick={askFinish}>
          끝내기
        </button>
      }
    >
      <ProgressBar value={session.index + (answered ? 1 : 0)} max={session.questionIds.length} />
      {q.image && (
        <button className="figure" onClick={() => setZoom(q.image!)} aria-label="그림 크게 보기">
          <img src={`./adsp/${q.image}`} alt="문제 그림" />
        </button>
      )}
      <div className="question">{q.stem}</div>
      <ol className="choices">
        {order.map((orig, displayIdx) => {
          const state = !answered ? "" : orig === q.answerIndex ? "correct" : displayIdx === answer.chosen ? "wrong" : "dim";
          return (
            <li key={orig}>
              <button className={`choice ${state}`} onClick={() => choose(displayIdx)} disabled={answered || busy}>
                <span className="choice-no">{displayIdx + 1}</span>
                <span>{q.choices[orig]}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {answered && (
        <div className={`feedback ${answer.correct ? "good" : "bad"}`}>
          <strong>{answer.correct ? "정답입니다" : "틀렸습니다"}</strong>
          {!answer.correct && (
            <p className="right-answer">
              정답: {NUMBERS[correctDisplay]} {q.choices[q.answerIndex]}
            </p>
          )}
          {q.explanation && (
            <p>
              <span className="label">해설</span> {q.explanation}
            </p>
          )}
          <blockquote>
            {q.sourceQuote}
            {q.sourcePage && <cite> — p.{q.sourcePage}</cite>}
          </blockquote>
          {note && note.lastSeenAt >= session.startedAt && (
            <p className="small">
              {note.graduatedAt
                ? `🎓 정답률 ${pct(accuracy(note))} (${note.corrects}/${note.attempts}) — 오답노트에서 졸업!`
                : `오답노트 정답률 ${pct(accuracy(note))} (${note.corrects}/${note.attempts}) · 졸업까지 연속 ${correctsToGraduate(note)}번`}
            </p>
          )}
          <button className="primary block" onClick={() => goNext(sessionId)}>
            {session.index + 1 < session.questionIds.length ? "다음 문제" : "결과 보기"}
          </button>
        </div>
      )}
      {zoom && (
        <div className="zoom" onClick={() => setZoom(null)} role="dialog" aria-label="그림 닫기">
          <img src={`./adsp/${zoom}`} alt="문제 그림 확대" />
        </div>
      )}
    </Screen>
  );
}
