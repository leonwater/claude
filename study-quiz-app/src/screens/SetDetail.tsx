import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db, deleteSet } from "../lib/db";
import { planSections } from "../lib/generate";
import { buildQuiz, QUIZ_SIZES } from "../lib/quiz";
import { sectionText } from "../lib/sections";
import { countChars, estimateCost, modelInfo, settings } from "../lib/settings";
import { startJob, stopJob, useJob } from "../jobs";
import type { Navigate } from "../App";
import { formatBytes, formatUsd, ProgressBar, Screen, SizePicker } from "../ui";

export function SetDetail({ setId, go, back }: { setId: number; go: Navigate; back: () => void }) {
  const data = useLiveQuery(async () => {
    const set = await db.sets.get(setId);
    if (!set) return null;
    const [files, sections, questions, notes] = await Promise.all([
      db.files.where({ setId }).toArray(),
      db.sections.where({ setId }).sortBy("order"),
      db.questions.where({ setId }).toArray(),
      db.wrongNotes.where({ setId }).toArray(),
    ]);
    return { set, files, sections, questions, notes };
  }, [setId]);
  const job = useJob(setId);
  const [size, setSize] = useState<number>(10);
  const [showSections, setShowSections] = useState(false);

  if (data === undefined) return <Screen title="" onBack={back}>{null}</Screen>;
  if (data === null) return <Screen title="삭제된 세트" onBack={back}>{null}</Screen>;
  const { set, files, sections, questions, notes } = data;

  const plans = planSections(sections, questions, set.bankTarget);
  const missing = plans.reduce((a, p) => a + Math.max(0, p.quota - p.have), 0);
  const activeNotes = notes.filter((n) => n.graduatedAt === null).length;
  const graduated = notes.filter((n) => n.graduatedAt !== null).length;
  const model = settings.model();

  const estimate = (() => {
    const todo = plans.filter((p) => p.have < p.quota);
    const chars = todo.reduce(
      (acc, p) => {
        const c = countChars(sectionText(p.section.paragraphs));
        const calls = Math.ceil((p.quota - p.have) / 10);
        return { hangul: acc.hangul + c.hangul * calls, other: acc.other + c.other * calls, calls: acc.calls + calls };
      },
      { hangul: 0, other: 0, calls: 0 },
    );
    return estimateCost(model, chars, chars.calls, missing);
  })();

  const startQuiz = () => {
    const weights = new Map(sections.map((s) => [s.id!, s.charCount]));
    const picked = buildQuiz(questions, weights, size);
    go({ name: "quiz", setId, mode: "quiz", questionIds: picked.map((q) => q.id!) });
  };

  const addMore = async () => {
    await db.sets.update(setId, { bankTarget: set.bankTarget + 40 });
    void startJob(setId);
  };

  const remove = async () => {
    if (!confirm(`「${set.title}」 세트와 문제, 오답노트를 모두 지울까요?`)) return;
    stopJob(setId);
    await deleteSet(setId);
    back();
  };

  return (
    <Screen title={set.title} onBack={back}>
      <section className="panel">
        <h2>퀴즈</h2>
        <SizePicker value={size} options={QUIZ_SIZES} onChange={setSize} />
        <button className="primary block" disabled={questions.length === 0} onClick={startQuiz}>
          {size}문항 풀기
        </button>
        {questions.length > 0 && questions.length < size && (
          <p className="muted small">문제은행에 {questions.length}문항만 있어 그만큼만 출제됩니다.</p>
        )}
        <button className="block" onClick={() => go({ name: "wrong", setId })}>
          오답노트 <span className="badge warn">{activeNotes}</span>
          {graduated > 0 && <span className="muted small"> · 졸업 {graduated}</span>}
        </button>
      </section>

      <section className="panel">
        <h2>문제은행</h2>
        <div className="row">
          <span>
            {questions.length} / {set.bankTarget}문항
          </span>
          <span className="muted small">{modelInfo(model).label}</span>
        </div>
        <ProgressBar value={job?.running && job.progress ? job.progress.done : questions.length} max={job?.progress?.target ?? set.bankTarget} />

        {job?.running ? (
          <>
            <p className="muted small">
              {job.progress?.current ? `「${job.progress.current}」 출제 중…` : "준비 중…"}
              {job.progress && ` · 검증 탈락 ${job.progress.rejected} · ${formatUsd(job.progress.costUsd)}`}
            </p>
            <p className="muted small">생성이 끝날 때까지 이 앱을 열어 두세요.</p>
            <button className="block" onClick={() => stopJob(setId)}>
              멈추기
            </button>
          </>
        ) : missing > 0 ? (
          <>
            <button className="primary block" onClick={() => void startJob(setId)}>
              {questions.length ? "이어서 만들기" : "문제은행 만들기"} ({missing}문항)
            </button>
            <p className="muted small">예상 비용 약 {formatUsd(estimate)} (대략적인 추정치)</p>
          </>
        ) : (
          <button className="block" onClick={addMore}>
            문제 40개 더 만들기
          </button>
        )}
        {job?.fatal && <div className="notice error">{job.fatal}</div>}
        {!job?.running && job?.errors.length ? (
          <div className="notice">
            {job.errors.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2>자료</h2>
        <ul className="file-list">
          {files.map((f) => (
            <li key={f.id}>
              <span className="ellipsis">{f.name}</span>
              <span className="muted">
                {f.pages ? `${f.pages}p · ` : ""}
                {formatBytes(f.size)}
              </span>
            </li>
          ))}
        </ul>
        <button className="link" onClick={() => setShowSections(!showSections)}>
          섹션 {sections.length}개 {showSections ? "접기" : "보기"}
        </button>
        {showSections && (
          <ul className="section-list">
            {plans.map(({ section, quota, have }) => (
              <li key={section.id}>
                <span className="ellipsis">{section.title}</span>
                <span className="muted small">
                  {have}/{quota}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button className="danger link" onClick={remove}>
        이 세트 삭제
      </button>
    </Screen>
  );
}
