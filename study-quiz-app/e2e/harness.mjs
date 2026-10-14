// 브라우저 테스트 공통: 빌드된 앱(dist)을 vite preview로 띄우고 휴대폰 화면 크기의 Chromium을 연다.
// Chromium 경로는 CHROMIUM_PATH 환경변수로 지정한다(없으면 `npx playwright-core install chromium`으로 받은 브라우저).
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright-core";

export const APP_DIR = fileURLToPath(new URL("..", import.meta.url));
export const FIXTURES = fileURLToPath(new URL("./fixtures/", import.meta.url));
const OUT = fileURLToPath(new URL("./output/", import.meta.url));
mkdirSync(OUT, { recursive: true });

export async function startApp(port) {
  const server = spawn(`${APP_DIR}node_modules/.bin/vite`, ["preview", "--port", String(port), "--strictPort"], { cwd: APP_DIR, stdio: "pipe" });
  server.stdout.resume();
  server.stderr.resume();
  const url = `http://localhost:${port}/`;
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(url);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await browser.newContext({ ...devices["Pixel 7"], locale: "ko-KR" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  return {
    url, browser, ctx, page, errors,
    shot: (name) => page.screenshot({ path: `${OUT}${name}.png`, fullPage: true }),
    async close() {
      await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
      server.kill();
    },
  };
}

export function check(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("✓", msg);
}

/** 앱의 IndexedDB에서 테이블 전체를 읽는다(브라우저 안에서 실행) */
export function readTables(page, names) {
  return page.evaluate(async (names) => {
    const open = indexedDB.open("study-quiz");
    const db = await new Promise((r) => (open.onsuccess = () => r(open.result)));
    const out = {};
    for (const n of names) {
      out[n] = await new Promise((r) => {
        const q = db.transaction(n).objectStore(n).getAll();
        q.onsuccess = () => r(q.result);
      });
    }
    return out;
  }, names);
}

export async function run(name, port, body) {
  const app = await startApp(port);
  try {
    await body(app);
    check(app.errors.length === 0, `페이지 오류 없음 ${app.errors.join(" | ")}`);
    console.log(`\n${name}: 통과`);
  } catch (e) {
    await app.shot(`${name}-error`).catch(() => {});
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}
