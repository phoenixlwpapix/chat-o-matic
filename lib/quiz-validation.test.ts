import { describe, expect, it, vi } from "vitest";
import { simulateReadableStream, type UIMessageChunk } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { createQuizValidationTransform, validateQuizDraft } from "./quiz-validation";
import { parseQuizCard } from "./quizzes";

const draft = { type: "single", question: "甲12天、乙15天完成，合做4天后甲还需几天？", options: ["2.4天", "3天", "4天", "5天"], answer: [1], explanation: "4.8天，等等，选项没有。" };
const corrected = { ...draft, options: ["2.4天", "3天", "4.8天", "5天"], answer: [2], explanation: "剩余工作量为2/5，除以甲的效率1/12，需4.8天。" };

type GenerateResponse = Awaited<ReturnType<MockLanguageModelV3["doGenerate"]>>;
function response(output: unknown): GenerateResponse {
  return { content: [{ type: "text", text: JSON.stringify(output) }], finishReason: { unified: "stop", raw: undefined }, usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } }, warnings: [] };
}
const checked = (quizJson: string, needsCalculation = false) => response({ solved: true, needsCalculation, result: "4.8天", quiz: JSON.parse(quizJson) });
const delta = (text: string): UIMessageChunk => ({ type: "text-delta", id: "t", delta: text });
async function run(chunks: UIMessageChunk[], validate = vi.fn(async () => JSON.stringify(corrected))) {
  const source = simulateReadableStream({ chunks: [{ type: "text-start", id: "t" }, ...chunks, { type: "text-end", id: "t" }, { type: "finish" }], initialDelayInMs: null, chunkDelayInMs: null });
  const result: UIMessageChunk[] = [];
  const reader = source.pipeThrough(createQuizValidationTransform(validate)).getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    result.push(value);
  }
  return { chunks: result, text: result.filter((chunk) => chunk.type === "text-delta").map((chunk) => chunk.delta).join(""), validate };
}

describe("reviewed quiz stream", () => {
  it("holds partial fences and releases only the corrected card, never the draft or postscript", async () => {
    const { text, validate } = await run([delta("来做一道题。\n\n`"), delta("``qu"), delta(`iz\n${JSON.stringify(draft)}\n\`\`\`\n等等，答案应该改成4.8天。`)]);
    expect(validate).toHaveBeenCalledWith(JSON.stringify(draft));
    expect(text).toContain(JSON.stringify(corrected));
    expect(text).toContain("来做一道题。");
    expect(text).not.toContain("等等");
    expect(text).not.toContain(JSON.stringify(draft));
  });
  it("preserves ordinary prose, non-quiz cards and search sources without review", async () => {
    const text = "普通回答。\n\n```chart\n{}\n```\n以及 `quiz` 这个单词。";
    const source: UIMessageChunk = { type: "source-url", sourceId: "s", url: "https://example.com", title: "source" };
    const result = await run([delta(text), source]);
    expect(result.text).toBe(text);
    expect(result.chunks).toContainEqual(source);
    expect(result.validate).not.toHaveBeenCalled();
  });
  it("streams ordinary text immediately, without waiting for a newline or completion", async () => {
    let finish: () => void = () => {};
    const source = new ReadableStream<UIMessageChunk>({ start(controller) {
      controller.enqueue({ type: "text-start", id: "t" }); controller.enqueue(delta("这是普通回答"));
      finish = () => controller.close();
    } });
    const reader = source.pipeThrough(createQuizValidationTransform(vi.fn())).getReader();
    await reader.read();
    expect((await reader.read()).value).toEqual(delta("这是普通回答"));
    finish();
  });
  it("repairs alternate and truncated quiz fences through the same review", async () => {
    for (const block of [`~~~~quiz\r\n${JSON.stringify(draft)}\r\n~~~~~`, `\`\`\`quiz\n${JSON.stringify(draft)}`]) {
      const result = await run([...block].map(delta));
      expect(result.validate).toHaveBeenCalledWith(JSON.stringify(draft));
      expect(result.text).toContain(JSON.stringify(corrected));
    }
  });
  it("fails closed when review is unavailable and does not review aborted generation", async () => {
    const result = await run([delta(`\`\`\`quiz\n${JSON.stringify(draft)}\n\`\`\``)], vi.fn(async () => { throw new Error("quota"); }));
    expect(result.text).not.toContain("quiz");
    expect(result.chunks.some((chunk) => chunk.type === "error")).toBe(true);
    expect(result.chunks.at(-1)?.type).toBe("finish");
    const aborted = await run([delta("```quiz\n{\"type\":"), { type: "abort" }]);
    expect(aborted.text).toBe("");
    expect(aborted.validate).not.toHaveBeenCalled();
  });
  it("emits only one reviewed card rather than leaking additional unreviewed cards", async () => {
    const result = await run([delta(`\`\`\`quiz\n${JSON.stringify(draft)}\n\`\`\`\n\`\`\`quiz\n{}\n\`\`\``)]);
    expect(result.validate).toHaveBeenCalledTimes(1);
    expect(result.text.match(/```quiz/g)).toHaveLength(1);
  });
});

describe("quiz reviewer", () => {
  it("retries structural failures, then returns a parseable corrected card", async () => {
    let call = 0;
    const model = new MockLanguageModelV3({ doGenerate: async () => call++ === 0 ? checked("{}") : checked(JSON.stringify(corrected)) });
    expect(parseQuizCard(await validateQuizDraft(JSON.stringify(draft), model))).toEqual(corrected);
    expect(model.doGenerateCalls).toHaveLength(2);
  });
  it("rejects unsolved questions and numeric reviews without calculator evidence", async () => {
    const unsolved = new MockLanguageModelV3({ doGenerate: response({ solved: false, needsCalculation: false, result: "条件不足", quiz: null }) });
    await expect(validateQuizDraft("{}", unsolved)).rejects.toThrow("did not pass");
    expect(unsolved.doGenerateCalls).toHaveLength(1);
    const uncalculated = new MockLanguageModelV3({ doGenerate: checked(JSON.stringify(corrected), true) });
    await expect(validateQuizDraft(JSON.stringify(draft), uncalculated)).rejects.toThrow("did not pass");
    expect(uncalculated.doGenerateCalls).toHaveLength(2);
  });
  it("uses the calculator tool result when repairing a numerical question", async () => {
    let call = 0;
    const responses: GenerateResponse[] = [
      { ...checked("{}"), content: [{ type: "tool-call", toolCallId: "calc", toolName: "calculate", input: JSON.stringify({ expression: "(1-(1/12+1/15)*4)/(1/12)" }) }], finishReason: { unified: "tool-calls", raw: undefined } },
      checked(JSON.stringify(corrected), true),
    ];
    const model = new MockLanguageModelV3({ doGenerate: async () => responses[call++] });
    const result = await validateQuizDraft(JSON.stringify(draft), model);
    const card = parseQuizCard(result);
    expect(card && !("questions" in card) ? card.answer : null).toEqual([2]);
    expect(JSON.stringify(model.doGenerateCalls[1].prompt)).toContain('4.800000000000001');
  });
});
