// 파일 업로드 → Claude로 문제은행 생성(가짜 API 응답) → 퀴즈 → 오답노트 졸업 → 오프라인 흐름
import { mockResponse, requests } from "./claude-mock.mjs";
import { check, FIXTURES, run } from "./harness.mjs";

await run("upload", 4173, async ({ url, ctx, page, shot }) => {
  await ctx.route("https://api.anthropic.com/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "access-control-allow-origin": "*" }, body: mockResponse(JSON.parse(req.postData()), req.headers()) });
  });
    await page.goto(url);
    await page.getByText("새 학습 세트").waitFor();
    await shot("1-home-empty");

    // 설정: API 키 저장
    await page.getByLabel("설정").click();
    await page.getByPlaceholder("sk-ant-...").fill("sk-ant-test-key");
    await page.getByRole("button", { name: "저장" }).click();
    await page.getByLabel("뒤로").click();

    // 스캔본 PDF는 거절되어야 한다
    await page.getByText("+ 새 학습 세트").click();
    await page.locator('input[type=file]').setInputFiles(`${FIXTURES}scanned.pdf`);
    await page.getByRole("button", { name: "자료 읽기" }).click();
    await page.getByText("스캔(이미지) PDF는 아직 지원하지 않습니다").waitFor();
    check(true, "스캔본 PDF는 오류 메시지와 함께 거절");
    await page.getByRole("button", { name: "빼기" }).click();

    // 여러 파일 업로드 (MD + DOCX)
    await page.locator('input[type=file]').setInputFiles([`${FIXTURES}notes.md`, `${FIXTURES}db.docx`]);
    await page.getByLabel("세트 이름").fill("정보처리 요약");
    await shot("2-new-set");
    await page.getByRole("button", { name: "자료 읽기" }).click();
    await page.getByText("문제은행 만들기").waitFor();
    await page.getByText("섹션").last().click();
    const sectionTitles = await page.locator(".section-list li .ellipsis").allTextContents();
    console.log("  섹션:", sectionTitles);
    check(sectionTitles.some((t) => t.includes("1장")) && sectionTitles.some((t) => t.includes("2장")) && sectionTitles.some((t) => t.includes("3장")), "두 파일의 장 제목이 섹션으로 나뉨");
    await shot("3-set-before");

    // 문제은행 생성
    await page.getByRole("button", { name: /문제은행 만들기/ }).click();
    await page.getByText("문제 40개 더 만들기").waitFor({ timeout: 60000 });
    await shot("4-set-ready");
    const bankText = await page.locator(".panel .row span").first().textContent();
    check(bankText.replace(/\s/g, "") === "80/80문항", `문제은행 80문항 채움 (${bankText.trim()})`);

    // 요청 형식 확인
    const r0 = requests[0];
    check(r0.body.model === "claude-opus-5-5", "기본 모델 claude-opus-5-5");
    check(r0.body.fallbacks === "default" && r0.headers["anthropic-beta"]?.includes("server-side-fallback-2026-07-01"), "거절 시 대체 모델 사용(fallbacks) 설정");
    check(r0.body.output_config?.format?.type === "json_schema" && r0.body.output_config.effort === "medium", "structured output + effort medium");
    check(r0.body.messages[0].content[0].cache_control?.type === "ephemeral", "원문 블록 prompt caching");
    check(r0.headers["anthropic-dangerous-direct-browser-access"] === "true", "브라우저 직접 호출 헤더");

    // 원문 무결성: 저장된 문제의 근거가 모두 원문 그대로인지(가짜 문제는 모두 탈락)
    const stats = await page.evaluate(async () => {
      const open = indexedDB.open("study-quiz");
      const db = await new Promise((r) => (open.onsuccess = () => r(open.result)));
      const all = (store) => new Promise((r) => { const q = db.transaction(store).objectStore(store).getAll(); q.onsuccess = () => r(q.result); });
      const qs = (await all("questions")).filter((q) => !q.key);
      const secs = await all("sections");
      const strip = (s) => s.normalize("NFKC").replace(/\s+/g, "");
      const src = new Map(secs.map((s) => [s.id, strip(s.paragraphs.map((p) => p.text).join(""))]));
      const perSection = {};
      qs.forEach((q) => (perSection[q.sectionId] = (perSection[q.sectionId] ?? 0) + 1));
      return {
        total: qs.length,
        fake: qs.filter((q) => q.stem === "가짜 문제").length,
        quoteOk: qs.every((q) => src.get(q.sectionId).includes(strip(q.sourceQuote))),
        answerPos: [0, 1, 2, 3].map((i) => qs.filter((q) => q.answerIndex === i).length),
        perSection,
        concepts: new Set(qs.map((q) => q.concept)).size,
      };
    });
    console.log("  ", JSON.stringify(stats));
    check(stats.fake === 0, "원문에 없는 근거를 단 문제는 모두 탈락");
    check(stats.quoteOk, "저장된 모든 문제의 근거 문장이 원문에 그대로 존재");
    check(stats.concepts === stats.total, "문제은행에 중복 개념 없음");
    check(stats.answerPos.every((n) => n > 5), `정답 위치가 고르게 섞임 ${stats.answerPos}`);

    // 퀴즈 10문항: 앞 3문제는 일부러 틀림
    await page.getByRole("radio", { name: "10" }).click();
    await page.getByRole("button", { name: "10문항 풀기" }).click();
    const seenStems = [];
    for (let i = 0; i < 10; i++) {
      await page.locator(".topbar h1", { hasText: ` ${i + 1} / 10` }).waitFor();
      await page.locator(".feedback").waitFor({ state: "detached" });
      seenStems.push(await page.locator(".question").textContent());
      const choices = page.locator(".choice");
      await choices.first().waitFor();
      const texts = await choices.allTextContents();
      const right = texts.findIndex((t) => t.includes("【O】"));
      await choices.nth(i < 3 ? (right + 1) % 4 : right).click();
      if (i === 0) await shot("5-quiz-wrong");
      if (i === 3) await shot("6-quiz-right");
      await page.getByRole("button", { name: /다음 문제|결과 보기/ }).click();
    }
    check(new Set(seenStems).size === 10, "퀴즈 10문항 중복 없음");
    await page.getByText("7 / 10").waitFor();
    await shot("7-result");
    check(true, "결과 7/10 표시");
    await page.getByRole("button", { name: "끝내기", exact: true }).click();

    // 오답노트: 3문항, 0% (0/1)
    await page.getByRole("button", { name: "오답노트 보기" }).click();
    await page.locator(".note-list li").first().waitFor();
    check((await page.locator(".note-list li").count()) === 3, "오답노트에 틀린 3문항 등록");
    check((await page.locator(".note-list").textContent()).includes("0% (0/1)"), "정답률 0% (0/1) 표기");
    await shot("8-wrong-notes");

    // 복습 3회 연속 정답 → 졸업
    for (let round = 1; round <= 3; round++) {
      await page.getByRole("button", { name: /복습$/ }).click();
      for (let i = 0; i < 3; i++) {
        await page.locator(".topbar h1", { hasText: ` ${i + 1} / 3` }).waitFor();
        await page.locator(".feedback").waitFor({ state: "detached" });
        const texts = await page.locator(".choice").allTextContents();
        await page.locator(".choice").nth(texts.findIndex((t) => t.includes("【O】"))).click();
        if (round === 3 && i === 0) await shot("9-graduate");
        await page.getByRole("button", { name: /다음 문제|결과 보기/ }).click();
      }
      await page.getByRole("button", { name: "끝내기", exact: true }).click();
      await page.getByRole("button", { name: "오답노트 보기" }).click();
      if (round < 3) {
        const expected = round === 1 ? "50% (1/2)" : "67% (2/3)";
        await page.locator(".note-list li").first().waitFor();
        check((await page.locator(".note-list").textContent()).includes(expected), `복습 ${round}회 후 정답률 ${expected}`);
      }
    }
    await page.getByText("오답노트가 비어 있습니다").waitFor();
    check((await page.textContent("main")).includes("3문항 졸업"), "3회 연속 정답(75%)으로 3문항 모두 졸업");
    await shot("10-wrong-empty");

    // 오프라인: 새로고침해도 앱이 뜨고 퀴즈를 풀 수 있어야 한다
    await page.goto(url);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await ctx.setOffline(true);
    await page.reload();
    await page.getByText("정보처리 요약").click();
    await page.getByRole("button", { name: "10문항 풀기" }).click();
    await page.locator(".choice").first().waitFor();
    check(true, "오프라인에서 새로고침 후 퀴즈 시작 가능");
    await ctx.setOffline(false);
});
