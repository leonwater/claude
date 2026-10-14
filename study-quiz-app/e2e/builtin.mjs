// 내장 ADsP 문제은행: 과목별 문항 수, 오답 해설, 이어 풀기, 새 퀴즈 잠금, 끝내기, 종합 비율, 그림
import { check, run } from "./harness.mjs";

await run("builtin", 4174, async ({ url, page, shot }) => {
  const stem = () => page.locator(".question").textContent();
    await page.goto(url);
    await page.getByText("ADsP 1·2·3과목 핵심 정리").waitFor();
    check((await page.textContent("main")).includes("내장 문제 420문항"), "내장 문제은행 420문항 탑재");
    await shot("1-home");
    await page.getByText("ADsP 1·2·3과목 핵심 정리").click();

    // 과목별 문항 수 선택지
    const sizesOf = async () => (await page.locator(".segmented button").allTextContents()).join(",");
    const expect = { "1과목": "10,20,30", "2과목": "10,20,26", "3과목": "10,25,50", "종합": "10,25,50" };
    for (const [tab, sizes] of Object.entries(expect)) {
      await page.locator(".subject-tabs button", { hasText: tab }).click();
      check((await sizesOf()) === sizes, `${tab} 문항 수 선택지 ${sizes}`);
    }
    await shot("2-setup");

    // 3과목 10문항 시작, 2문제 풀고 앱 재시작
    await page.locator(".subject-tabs button", { hasText: "3과목" }).click();
    await page.getByRole("radio", { name: "10" }).click();
    await page.getByRole("button", { name: "10문항 풀기" }).click();
    await page.locator(".choice").first().waitFor();
    check((await page.locator(".topbar h1").textContent()).includes("3과목"), "3과목 퀴즈 시작");
    // 일부러 오답 선택 → 정답과 해설 표시
    const answerIdx = await page.evaluate(async () => {
      const open = indexedDB.open("study-quiz");
      const db = await new Promise((r) => (open.onsuccess = () => r(open.result)));
      const get = (store, key) => new Promise((r) => { const q = db.transaction(store).objectStore(store).get(key); q.onsuccess = () => r(q.result); });
      const all = (store) => new Promise((r) => { const q = db.transaction(store).objectStore(store).getAll(); q.onsuccess = () => r(q.result); });
      const s = (await all("sessions")).find((x) => x.finishedAt === null);
      const q = await get("questions", s.questionIds[s.index]);
      return s.choiceOrders[s.index].indexOf(q.answerIndex);
    });
    await page.locator(".choice").nth((answerIdx + 1) % 4).click();
    await page.locator(".right-answer").waitFor();
    const fb = await page.locator(".feedback").textContent();
    check(fb.includes("틀렸습니다") && fb.includes("정답:") && fb.includes("해설"), "오답 시 정답과 해설 표시");
    await shot("3-wrong");
    await page.getByRole("button", { name: "다음 문제" }).click();
    await page.locator(".topbar h1", { hasText: "2 / 10" }).waitFor();
    await page.locator(".feedback").waitFor({ state: "detached" });
    const secondStem = await stem();
    await page.locator(".choice").first().click();
    await page.locator(".feedback").waitFor();
    const answeredChoices = await page.locator(".choice").allTextContents();

    await page.reload();
    await page.locator(".feedback").waitFor();
    check((await stem()) === secondStem, "앱을 다시 열면 같은 문제(2번, 채점 화면)에서 이어짐");
    check(JSON.stringify(await page.locator(".choice").allTextContents()) === JSON.stringify(answeredChoices), "보기 순서도 그대로 유지");
    check((await page.locator(".topbar h1").textContent()).includes("2 / 10"), "진행 위치 2/10 유지");

    // 다른 퀴즈 시작 차단
    await page.getByLabel("뒤로").click();
    await page.getByText("진행 중인 퀴즈가 있습니다").waitFor();
    await page.getByText("ADsP 1·2·3과목 핵심 정리").click();
    check(await page.getByRole("button", { name: /문항 풀기/ }).isDisabled(), "진행 중에는 새 퀴즈 시작 버튼 비활성");
    await shot("4-blocked");
    await page.getByRole("button", { name: "이어 풀기" }).click();
    check((await stem()) === secondStem, "이어 풀기로 복귀");

    // 끝내기 → 결과 → 새 퀴즈 가능
    await page.locator(".topbar").getByRole("button", { name: "끝내기" }).click();
    await page.locator(".score-big").waitFor();
    check((await page.locator(".score-big").textContent()).replace(/\s/g, "").endsWith("/2"), "끝내기 후 푼 2문제 결과 표시");
    await page.getByRole("button", { name: "처음으로" }).click();
    check((await page.locator(".notice", { hasText: "진행 중인 퀴즈" }).count()) === 0, "끝낸 뒤 진행 중 안내 사라짐");

    // 종합 50문항: 비율과 그림
    await page.getByText("ADsP 1·2·3과목 핵심 정리").click();
    await page.locator(".subject-tabs button", { hasText: "종합" }).click();
    await page.getByRole("radio", { name: "50" }).click();
    await page.getByRole("button", { name: "50문항 풀기" }).click();
    await page.locator(".choice").first().waitFor();
    const mix = await page.evaluate(async () => {
      const open = indexedDB.open("study-quiz");
      const db = await new Promise((r) => (open.onsuccess = () => r(open.result)));
      const all = (store) => new Promise((r) => { const q = db.transaction(store).objectStore(store).getAll(); q.onsuccess = () => r(q.result); });
      const s = (await all("sessions")).find((x) => x.finishedAt === null);
      const qs = await all("questions");
      const picked = s.questionIds.map((id) => qs.find((q) => q.id === id));
      return { bySubject: [1, 2, 3].map((n) => picked.filter((q) => q.subject === n).length), images: picked.filter((q) => q.image).length, unique: new Set(s.questionIds).size };
    });
    check(JSON.stringify(mix.bySubject) === "[10,10,30]" && mix.unique === 50, `종합 50문항 = 1과목 10 · 2과목 10 · 3과목 30, 중복 없음`);
    // 그림 문제가 나올 때까지 풀어 보고 그림 로딩 확인
    let sawImage = false;
    for (let i = 0; i < 50 && !sawImage; i++) {
      if (await page.locator(".figure img").count()) {
        await page.locator(".figure img").evaluate((img) => img.decode());
        const w = await page.locator(".figure img").evaluate((img) => img.naturalWidth);
        sawImage = w > 0;
        await shot("5-image");
        await page.locator(".figure").click();
        await page.locator(".zoom img").waitFor();
        await page.locator(".zoom").click();
        break;
      }
      await page.locator(".choice").first().click();
      await page.getByRole("button", { name: /다음 문제|결과 보기/ }).click();
      await page.locator(".topbar h1", { hasText: ` ${i + 2} / 50` }).waitFor();
    }
    check(mix.images === 0 || sawImage, `그림 문제 표시·확대 (이번 퀴즈 그림 문제 ${mix.images}개)`);
    // 모든 그림 파일 로딩 확인
    const imgs = await page.evaluate(async () => {
      const names = ["analysis_matrix","assoc_table","bigdata_method","boxplot_ab","coins","confusion","dendrogram","distance","elbow","error_table","kurtosis","level_quad","lm_out","maturity","outlier_dist","overfit_panel","pca_out","perceptron","priority_quad","readiness","scatter4","scree","skew_neg","skew_pos","sst_reg","summary_out","ttest_out","underfit_panel","uniform_ev"];
      const r = await Promise.all(names.map((n) => fetch(`./adsp/${n}.png`).then((x) => x.ok)));
      return r.filter(Boolean).length;
    });
    check(imgs === 29, "그림 29개 모두 로딩");
});
