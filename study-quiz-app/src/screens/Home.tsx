import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { settings } from "../lib/settings";
import { useActiveSession } from "../lib/useActive";
import type { Navigate } from "../App";
import { ActiveQuizNotice, ProgressBar, Screen } from "../ui";

export function Home({ go }: { go: Navigate }) {
  const rows = useLiveQuery(async () => {
    // 내장 문제은행을 맨 위에 둔다
    const sets = (await db.sets.orderBy("createdAt").reverse().toArray()).sort((a, b) => Number(!!b.builtin) - Number(!!a.builtin));
    return Promise.all(
      sets.map(async (s) => ({
        set: s,
        files: await db.files.where({ setId: s.id! }).count(),
        questions: await db.questions.where({ setId: s.id! }).count(),
        wrong: await db.wrongNotes.where({ setId: s.id! }).filter((n) => n.graduatedAt === null).count(),
      })),
    );
  });
  const hasKey = !!settings.apiKey();
  const active = useActiveSession();

  return (
    <Screen
      title="자료 퀴즈"
      actions={
        <button className="icon-btn" onClick={() => go({ name: "settings" })} aria-label="설정">
          ⚙︎
        </button>
      }
    >
      {active && <ActiveQuizNotice onResume={() => go({ name: "quiz", sessionId: active.id! })} />}
      {!hasKey && (
        <div className="notice">
          내장된 ADsP 문제는 바로 풀 수 있습니다. 내 파일로 문제를 새로 만들 때만{" "}
          <button className="link" onClick={() => go({ name: "settings" })}>설정</button>에서 Claude API 키가 필요합니다.
        </div>
      )}
      <button className="primary block" onClick={() => go({ name: "new" })}>
        + 새 학습 세트
      </button>
      {rows?.length === 0 && <p className="muted center">아직 학습 세트가 없습니다. 공부할 파일을 올려 보세요.</p>}
      <ul className="cards">
        {rows?.map(({ set, files, questions, wrong }) => (
          <li key={set.id}>
            <button className="card" onClick={() => go({ name: "set", setId: set.id! })}>
              <div className="card-title">{set.title}</div>
              <div className="card-meta">
                {set.builtin ? `내장 문제 ${questions}문항 · 1·2·3과목/종합` : `파일 ${files}개 · 문제 ${questions}/${set.bankTarget}`}
                {wrong > 0 && <span className="badge warn">오답 {wrong}</span>}
              </div>
              {questions < set.bankTarget && <ProgressBar value={questions} max={set.bankTarget} />}
            </button>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
