// Claude API 가짜 응답: 원문 문장을 그대로 인용한 문제 N개 + 검증에 걸려야 하는 가짜 문제 1개
let call = 0;
export const requests = [];
export function mockResponse(body, headers) {
  requests.push({ body, headers });
  call++;
  const content = body.messages[0].content;
  const source = content[0].text.replace(/^<source[^>]*>\n/, "").replace(/\n<\/source>$/, "");
  const count = Number(content[1].text.match(/문제 (\d+)개/)[1]);
  const covered = new Set(content[1].text.split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2)));
  const sentences = source.split(/\n+/).map((s) => s.trim()).filter((s) => s.length > 10);
  const questions = [];
  let i = 0;
  for (const s of sentences) {
    if (questions.length >= count) break;
    const concept = s.slice(0, 18);
    if (covered.has(concept)) continue;
    questions.push({
      concept,
      stem: `다음 중 원문 「${s.slice(0, 12)}…」 에 대한 설명으로 옳은 것은? (#${call}-${i++})`,
      choices: [`【O】${s.slice(0, 30)}`, `오답A ${s.slice(5, 25)}`, `오답B ${s.slice(3, 20)}`, `오답C ${s.slice(1, 15)}`],
      answer_index: 0,
      explanation: "원문에 그렇게 적혀 있다.",
      source_quote: s,
    });
  }
  questions.push({ concept: `가짜${call}`, stem: "가짜 문제", choices: ["a", "b", "c", "d"], answer_index: 0, explanation: "", source_quote: "원문에 없는 지어낸 문장입니다." });
  const text = JSON.stringify({ questions });
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  return (
    ev("message_start", { message: { id: `msg_${call}`, type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 2000, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }) +
    ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } }) +
    ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: text.slice(0, 50) } }) +
    ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: text.slice(50) } }) +
    ev("content_block_stop", { index: 0 }) +
    ev("message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 3000 } }) +
    ev("message_stop", {})
  );
}
