import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db, deleteSet } from "../lib/db";
import { planSections } from "../lib/generate";
import { SUBJECT_NAMES } from "../lib/builtin";
import { buildQuiz, buildSubjectQuiz, QUIZ_SIZES, SUBJECT_QUIZ_SIZES } from "../lib/quiz";
import { startSession } from "../lib/sessions";
import { useActiveSession } from "../lib/useActive";
import { sectionText } from "../lib/sections";
import { countChars, estimateCost, modelInfo, settings } from "../lib/settings";
import { startJob, stopJob, useJob } from "../jobs";
import type { Navigate } from "../App";
import { ActiveQuizNotice, formatBytes, formatUsd, ProgressBar, Screen, SizePicker } from "../ui";

const SUBJECT_TABS = [1, 2, 3, 0];

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
  const [subject, setSubject] = useState<number>(1);
  const [showSections, setShowSections] = useState(false);
  const active = useActiveSession();

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

  const builtin = !!set.builtin;
  const sizes: readonly number[] = builtin ? SUBJECT_QUIZ_SIZES[subject] : QUIZ_SIZES;
  const chosenSize = sizes.includes(size) ? size : sizes[0];
  const subjectCount = (s: number) => (s === 0 ? questions.length : questions.filter((q) => q.subject === s).length);

  const startQuiz = async () => {
    const weights = new Map(sections.map((s) => [s.id!, s.charCount]));
    const picked = builtin ? buildSubjectQuiz(questions, weights, subject, chosenSize) : buildQuiz(questions, weights, chosenSize);
    try {
      const sessionId = await startSession(setId, "quiz", builtin ? subject : null, picked);
      go({ name: "quiz", sessionId });
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
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
      {active && <ActiveQuizNotice onResume={() => go({ name: "quiz", sessionId: active.id! })} />}
      <section className="panel">
        <h2>퀴즈</h2>
        {builtin && (
          <>
            <div className="subject-tabs" role="radiogroup" aria-label="과목">
              {SUBJECT_TABS.map((s) => (
                <button key={s} role="radio" aria-checked={subject === s} className={subject === s ? "on" : ""} onClick={() => setSubject(s)}>
                  <span>{s === 0 ? "종합" : `${s}과목`}</span>
                  <small>{subjectCount(s)}문항</small>
                </button>
              ))}
            </div>
            <p className="muted small">
              {subject === 0 ? "1·2·3과목을 실제 시험 비율(1 : 1 : 3)로 섞어 냅니다." : `${SUBJECT_NAMES[subject]} — 단원별로 고르게 냅니다.`} 안 푼 문제부터 무작위로 나옵니다.
            </p>
          </>
        )}
        <SizePicker value={chosenSize} options={sizes} onChange={setSize} />
        <button className="primary block" disabled={questions.length === 0 || !!active} onClick={startQuiz}>
          {chosenSize}문항 풀기
        </button>
        {!builtin && questions.length > 0 && questions.length < chosenSize && (
          <p className="muted small">문제은행에 {questions.length}문항만 있어 그만큼만 출제됩니다.</p>
        )}
        <button className="block" onClick={() => go({ name: "wrong", setId })}>
          오답노트 <span className="badge warn">{activeNotes}</span>
          {graduated > 0 && <span className="muted small"> · 졸업 {graduated}</span>}
        </button>
      </section>

      {!builtin && (
      <>
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
      </>
      )}
      {builtin ? (
        <p className="muted small">문제는 'ADsP 1·2·3과목 핵심 정리' PDF의 내용만으로 만들었으며, 모든 정답에 원문 근거가 붙어 있습니다.</p>
      ) : (
        <button className="danger link" onClick={remove}>
          이 세트 삭제
        </button>
      )}
    </Screen>
  );
}
