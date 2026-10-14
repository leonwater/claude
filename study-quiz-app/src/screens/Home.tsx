import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { settings } from "../lib/settings";
import type { Navigate } from "../App";
import { ProgressBar, Screen } from "../ui";

export function Home({ go }: { go: Navigate }) {
  const rows = useLiveQuery(async () => {
    const sets = await db.sets.orderBy("createdAt").reverse().toArray();
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

  return (
    <Screen
      title="자료 퀴즈"
      actions={
        <button className="icon-btn" onClick={() => go({ name: "settings" })} aria-label="설정">
          ⚙︎
        </button>
      }
    >
      {!hasKey && (
        <div className="notice">
          처음이라면 <button className="link" onClick={() => go({ name: "settings" })}>설정</button>에서 Claude API 키를 입력해 주세요.
          문제를 만들 때만 필요하고, 문제 풀이는 오프라인에서도 됩니다.
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
                파일 {files}개 · 문제 {questions}/{set.bankTarget}
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
