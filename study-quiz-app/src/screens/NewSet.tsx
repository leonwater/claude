import { useState } from "react";
import { db } from "../lib/db";
import { defaultBankTarget } from "../lib/generate";
import { isNative } from "../lib/native";
import { ACCEPT, NATIVE_ACCEPT, MAX_FILE_BYTES, MAX_FILES_PER_SET, parseFile, sha256, type ParsedFile } from "../lib/parse";
import { buildSections, sectionText, type SectionDraft } from "../lib/sections";

import { formatBytes, Screen } from "../ui";

export function NewSet({ back, replaceWithSet }: { back: () => void; replaceWithSet: (setId: number) => void }) {
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setError(null);
    const next = [...files];
    for (const f of list) {
      if (f.size > MAX_FILE_BYTES) {
        setError(`${f.name}: 파일 하나는 ${formatBytes(MAX_FILE_BYTES)}까지 올릴 수 있습니다.`);
        continue;
      }
      if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    if (next.length > MAX_FILES_PER_SET) {
      setError(`한 세트에는 파일을 ${MAX_FILES_PER_SET}개까지 넣을 수 있습니다.`);
      next.length = MAX_FILES_PER_SET;
    }
    setFiles(next);
    if (!title && next[0]) setTitle(next[0].name.replace(/\.[^.]+$/, ""));
  };

  const create = async () => {
    setError(null);
    try {
      // 모든 파일을 먼저 읽어 보고, 하나라도 실패하면 세트를 만들지 않는다
      const parsed: { file: File; result: ParsedFile; drafts: SectionDraft[]; hash: string }[] = [];
      for (const [i, f] of files.entries()) {
        setBusy(`파일 읽는 중 (${i + 1}/${files.length}) ${f.name}`);
        const result = await parseFile(f);
        const label = files.length > 1 ? f.name.replace(/\.[^.]+$/, "") : "";
        const drafts = buildSections(result.paragraphs, label || "본문");
        if (!drafts.length) throw new Error(`${f.name}: 읽을 수 있는 내용이 없습니다.`);
        const text = drafts.map((d) => sectionText(d.paragraphs)).join("\n\n");
        parsed.push({ file: f, result, drafts, hash: await sha256(text) });
      }
      setBusy("저장 중");
      const sectionCount = parsed.reduce((a, p) => a + p.drafts.length, 0);
      const setId = await db.transaction("rw", [db.sets, db.files, db.sections], async () => {
        const id = (await db.sets.add({ title: title.trim() || "제목 없음", createdAt: Date.now(), bankTarget: defaultBankTarget(sectionCount) })) as number;
        let order = 0;
        for (const p of parsed) {
          const fileId = (await db.files.add({ setId: id, name: p.file.name, size: p.file.size, pages: p.result.pages, textSha256: p.hash })) as number;
          for (const d of p.drafts) {
            await db.sections.add({ setId: id, fileId, fileName: p.file.name, order: order++, title: d.title, paragraphs: d.paragraphs, charCount: d.charCount });
          }
        }
        return id;
      });
      replaceWithSet(setId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen title="새 학습 세트" onBack={back}>
      <label className="field">
        <span>세트 이름</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 정보처리기사 1과목" />
      </label>
      <label className="file-drop">
        <input type="file" multiple accept={isNative ? NATIVE_ACCEPT : ACCEPT} onChange={(e) => addFiles(e.target.files)} />
        <span>파일 선택 (여러 개 가능)</span>
        <small>PDF · DOCX · TXT · MD, 파일당 {formatBytes(MAX_FILE_BYTES)}까지</small>
      </label>
      {files.length > 0 && (
        <ul className="file-list">
          {files.map((f) => (
            <li key={f.name + f.size}>
              <span className="ellipsis">{f.name}</span>
              <span className="muted">{formatBytes(f.size)}</span>
              <button className="link" onClick={() => setFiles(files.filter((x) => x !== f))}>
                빼기
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <div className="notice error">{error}</div>}
      <button className="primary block" disabled={!files.length || !!busy} onClick={create}>
        {busy ?? "자료 읽기"}
      </button>
      <p className="muted small">
        파일 내용은 이 기기 안에서 글자 그대로 추출해 저장합니다. 요약하거나 고치지 않습니다.
      </p>
    </Screen>
  );
}
