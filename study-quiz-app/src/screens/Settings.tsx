import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db, exportAll, importAll } from "../lib/db";
import { isNative, saveTextFile } from "../lib/native";
import { MODELS, settings, type ModelId } from "../lib/settings";
import { formatUsd, Screen } from "../ui";

export function Settings({ back }: { back: () => void }) {
  const [key, setKey] = useState(settings.apiKey());
  const [model, setModel] = useState<ModelId>(settings.model());
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const total = useLiveQuery(async () => (await db.usage.toArray()).reduce((a, u) => a + u.costUsd, 0));

  const save = () => {
    settings.setApiKey(key);
    settings.setModel(model);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const download = async () => {
    try {
      await saveTextFile(`study-quiz-backup-${new Date().toISOString().slice(0, 10)}.json`, await exportAll());
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const restore = async (file: File | undefined) => {
    if (!file || !confirm("지금 기기의 데이터를 백업 파일 내용으로 바꿀까요?")) return;
    try {
      await importAll(await file.text());
      setMsg("복원했습니다.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen title="설정" onBack={back}>
      <section className="panel">
        <h2>Claude API</h2>
        <label className="field">
          <span>API 키</span>
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-..." autoComplete="off" />
        </label>
        <p className="muted small">
          키는 이 {isNative ? "앱" : "기기의 브라우저"}에만 저장되고 Anthropic API로만 전송됩니다. Claude Console에서 월 사용 한도를 걸어 두세요.
        </p>
        <label className="field">
          <span>출제 모델</span>
          <select value={model} onChange={(e) => setModel(e.target.value as ModelId)}>
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} — 입력 ${m.inPerM} / 출력 ${m.outPerM} (100만 토큰당)
              </option>
            ))}
          </select>
        </label>
        <button className="primary block" onClick={save}>
          {saved ? "저장됨 ✓" : "저장"}
        </button>
        <p className="muted small">지금까지 쓴 API 비용: {formatUsd(total ?? 0)}</p>
      </section>

      <section className="panel">
        <h2>백업</h2>
        <p className="muted small">
          자료와 기록은 이 {isNative ? "앱" : "기기의 브라우저"}에만 있습니다. {isNative ? "앱을 지우면 함께 지워지니" : ""} 가끔 백업해 두세요.
        </p>
        <button className="block" onClick={download}>
          {isNative ? "백업 파일 내보내기" : "백업 파일 내려받기"}
        </button>
        <label className="file-drop compact">
          <input type="file" accept="application/json,.json" onChange={(e) => restore(e.target.files?.[0])} />
          <span>백업에서 복원</span>
        </label>
        {msg && <div className="notice">{msg}</div>}
      </section>
    </Screen>
  );
}
