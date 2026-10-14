import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db } from "../lib/db";
import { accuracy, correctsToGraduate, GRADUATION_THRESHOLD, reviewOrder } from "../lib/wrongNote";
import type { Navigate } from "../App";
import { pct, ProgressBar, Screen, SizePicker } from "../ui";

const ALL = 0;

export function WrongNotes({ setId, go, back }: { setId: number; go: Navigate; back: () => void }) {
  const data = useLiveQuery(async () => {
    const notes = reviewOrder(await db.wrongNotes.where({ setId }).toArray());
    const questions = await db.questions.bulkGet(notes.map((n) => n.questionId));
    const graduated = await db.wrongNotes.where({ setId }).filter((n) => n.graduatedAt !== null).count();
    return { items: notes.map((n, i) => ({ note: n, question: questions[i] })).filter((x) => x.question), graduated };
  }, [setId]);
  const [size, setSize] = useState(ALL);

  if (!data) return <Screen title="오답노트" onBack={back}>{null}</Screen>;
  const { items, graduated } = data;
  const options = [10, 20, 30, 40].filter((n) => n < items.length);

  const start = () => {
    const ids = items.slice(0, size === ALL ? items.length : size).map((x) => x.note.questionId);
    go({ name: "quiz", setId, mode: "review", questionIds: ids });
  };

  return (
    <Screen title="오답노트" onBack={back}>
      <p className="muted small">
        정답률이 {pct(GRADUATION_THRESHOLD)}를 넘으면 오답노트에서 졸업합니다. 처음 틀린 문제는 3번 연속 맞히면 졸업해요.
        {graduated > 0 && ` 지금까지 ${graduated}문항 졸업.`}
      </p>
      {items.length === 0 ? (
        <p className="center muted">오답노트가 비어 있습니다 👏</p>
      ) : (
        <>
          <section className="panel">
            <h2>복습하기</h2>
            {options.length > 0 && (
              <SizePicker value={size} options={[...options, ALL]} onChange={setSize} label={(n) => (n === ALL ? "전체" : String(n))} />
            )}
            <button className="primary block" onClick={start}>
              {size === ALL || size >= items.length ? `전체 ${items.length}문항` : `${size}문항`} 복습
            </button>
          </section>
          <ul className="note-list">
            {items.map(({ note, question }) => (
              <li key={note.questionId}>
                <div className="note-stem">{question!.stem}</div>
                <div className="row small">
                  <span>
                    정답률 <strong>{pct(accuracy(note))}</strong> ({note.corrects}/{note.attempts})
                  </span>
                  <span className="muted">졸업까지 연속 {correctsToGraduate(note)}번</span>
                </div>
                <ProgressBar value={accuracy(note)} max={GRADUATION_THRESHOLD} tone="warn" />
              </li>
            ))}
          </ul>
        </>
      )}
    </Screen>
  );
}
