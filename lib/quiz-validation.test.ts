import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { simulateReadableStream, type UIMessage, type UIMessageChunk } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import {
  createQuizValidationTransform,
  hasMissingVisualReference,
  hasUserImageContext,
  QuizValidationError,
  validateQuizDraft,
} from "./quiz-validation";
import { CHAT_ERROR_MESSAGES, getClientChatErrorMessage } from "./chat-errors";
import { parseQuizCard } from "./quizzes";

beforeEach(() => { vi.spyOn(console, "warn").mockImplementation(() => {}); vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

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
  it.each([
    [new QuizValidationError("calculator-missing"), CHAT_ERROR_MESSAGES.quizInvalid],
    [new QuizValidationError("unsolved"), CHAT_ERROR_MESSAGES.quizUnsolved],
    [new QuizValidationError("missing-visual"), CHAT_ERROR_MESSAGES.quizMissingVisual],
    [new DOMException("timed out", "TimeoutError"), CHAT_ERROR_MESSAGES.timeout],
    [Object.assign(new Error("quota"), { statusCode: 429 }), CHAT_ERROR_MESSAGES.quota],
  ])("logs the actual error and preserves the public category for %s", async (error, expected) => {
    const result = await run([delta(`\`\`\`quiz\n${JSON.stringify(draft)}\n\`\`\``)], vi.fn(async () => { throw error; }));
    const event = result.chunks.find((chunk) => chunk.type === "error");
    expect(event?.type === "error" && getClientChatErrorMessage(event.errorText)).toBe(expected);
    expect(console.error).toHaveBeenCalledWith("Quiz validation failed", expect.objectContaining({ name: error.name, message: error.message }));
  });
  it("holds partial fences and releases only the corrected card, never the draft or postscript", async () => {
    const { text, validate, chunks } = await run([delta("来做一道题。\n\n`"), delta("``qu"), delta(`iz\n${JSON.stringify(draft)}\n\`\`\`\n等等，答案应该改成4.8天。`)]);
    expect(validate).toHaveBeenCalledWith(JSON.stringify(draft));
    expect(text).toContain(JSON.stringify(corrected));
    expect(text).toContain("来做一道题。");
    expect(text).not.toContain("等等");
    expect(text).not.toContain(JSON.stringify(draft));
    expect(chunks.filter((chunk) => chunk.type === "data-quiz-status")).toEqual([
      { type: "data-quiz-status", data: { stage: "generating" }, transient: true },
      { type: "data-quiz-status", data: { stage: "validating" }, transient: true },
      { type: "data-quiz-status", data: { stage: "done" }, transient: true },
    ]);
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
    expect(result.chunks).toContainEqual({ type: "data-quiz-status", data: { stage: "done" }, transient: true });
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
  it("retries missing calculations separately without combining forced tools with JSON mode", async () => {
    let call = 0;
    const responses: GenerateResponse[] = [
      checked(JSON.stringify(corrected), true),
      { ...checked("{}"), content: [{ type: "tool-call", toolCallId: "retry-calc", toolName: "calculate", input: JSON.stringify({ expression: "(1-(1/12+1/15)*4)/(1/12)" }) }], finishReason: { unified: "tool-calls", raw: undefined } },
      checked(JSON.stringify(corrected), true),
    ];
    const model = new MockLanguageModelV3({ doGenerate: async () => responses[call++] });
    expect(parseQuizCard(await validateQuizDraft(JSON.stringify(draft), model))).toEqual(corrected);
    expect(model.doGenerateCalls[1].toolChoice).toEqual({ type: "tool", toolName: "calculate" });
    expect(model.doGenerateCalls[1].responseFormat).not.toMatchObject({ type: "json" });
    expect(model.doGenerateCalls[2].responseFormat).toMatchObject({ type: "json" });
    expect(JSON.stringify(model.doGenerateCalls[2].prompt)).toContain("4.800000000000001");
    expect(console.warn).toHaveBeenCalledWith("Quiz review rejected", expect.objectContaining({ reason: "calculator-missing" }));
  });
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
    expect(uncalculated.doGenerateCalls).toHaveLength(3);
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
    expect(JSON.stringify(model.doGenerateCalls[0].prompt)).not.toContain("再来一题");
  });
});

describe("missing visual reference guard", () => {
  const visualCircuitDraft = {
    type: "single" as const,
    question: "如图所示的电路中，电源电压保持不变，闭合开关 S 后，滑片 P 向右移动时电流表示数如何变化？",
    options: ["变大", "变小", "不变", "无法判断"],
    answer: [1],
    explanation: "如图所示，滑片右移电阻增大，电流变小。",
  };
  const selfContainedCircuit = {
    type: "single" as const,
    question: "电源电压保持 6V 不变，定值电阻 $R_1=10\\,\\Omega$ 与滑动变阻器 $R_2$ 串联，电流表测电路电流。闭合开关后，将滑片向阻值增大的方向移动，电流表示数如何变化？",
    options: ["变大", "变小", "不变", "先变大后变小"],
    answer: [1],
    explanation: "串联电路总电阻等于各电阻之和，滑动变阻器接入阻值增大导致总电阻增大，电源电压不变，由 $I=U/R$ 可知电流表示数变小。",
  };

  it("detects missing diagram references in Chinese and English without false positives on self-contained text", () => {
    const shouldFlag = [
      "如图所示的电路中，电源电压为 6V。",
      "如图，在△ABC 中，AB=AC。",
      "如图甲所示，滑片 P 向右移动。",
      "如图（1）所示的装置。",
      "如图甲、乙所示，两灯连接方式相同。",
      "在图1中，电流表测量干路电流。",
      "见下图，求阴影面积。",
      "根据右图判断电流方向。",
      "闭合开关后，图中电流表示数为 0.5A。",
      "根据图中数据，下列说法正确的是？",
      "根据电路图，灯 L1 与 L2 的连接方式是？",
      "由图可知，物体的速度为 2 m/s。",
      "看图计算该三角形的面积。",
      "下列各图中，能正确测量通过 L1 电流的是？",
      "哪幅图正确表示了光的折射？",
      "In the circuit shown in the figure, find the current.",
      "Look at the diagram below to find angle x.",
      "Based on the graph above, what is the speed?",
      "Figure 1 shows two resistors connected to a battery.",
    ];
    for (const question of shouldFlag) {
      expect(hasMissingVisualReference(question), question).toBe(true);
    }

    const shouldAllow = [
      selfContainedCircuit.question,
      "在画电路图时，导线一般应画成横平竖直。",
      "下列关于电路图的说法中，正确的是？",
      "关于二次函数 $y=x^2$ 的图像，下列说法正确的是？",
      "在一幅比例尺为 1:50000 的地图中，两地的图上距离为 4 cm，实际距离是多少？",
      "小明去图书馆借了 3 本书，还剩几本？",
      "In the circuit, a 6V battery is connected in series with a 10Ω resistor and a 20Ω resistor. Find the current.",
      "Which of the following statements about a circuit diagram is correct?",
      "Sam found an old treasure map. Look at the map, he whispered.",
    ];
    for (const question of shouldAllow) {
      expect(hasMissingVisualReference(question), question).toBe(false);
    }
  });

  it("recognizes when the user actually uploaded an image for the current turn", () => {
    const imageMessage: UIMessage = {
      id: "u1",
      role: "user",
      parts: [
        { type: "file", mediaType: "image/png", url: "data:image/png;base64,AA==" },
        { type: "text", text: "帮我看看这张电路图" },
      ],
    };
    const assistantReply: UIMessage = { id: "a1", role: "assistant", parts: [{ type: "text", text: "这是一个串联电路。" }] };
    expect(hasUserImageContext([imageMessage])).toBe(true);
    expect(hasUserImageContext([imageMessage, assistantReply, { id: "u2", role: "user", parts: [{ type: "text", text: "根据刚才的图出一道选择题" }] }])).toBe(true);
    expect(hasUserImageContext([imageMessage, assistantReply, { id: "u3", role: "user", parts: [{ type: "text", text: "帮我出几道新的初中物理电路练习题" }] }])).toBe(false);
    expect(hasUserImageContext([{ id: "u4", role: "user", parts: [{ type: "text", text: "出一道如图所示的电路题" }] }])).toBe(false);
  });

  it("proactively asks the reviewer to rewrite a missing-visual draft into a self-contained pure-text quiz", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => checked(JSON.stringify(selfContainedCircuit)),
    });
    const result = await validateQuizDraft(JSON.stringify(visualCircuitDraft), model);
    expect(parseQuizCard(result)).toEqual(selfContainedCircuit);
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(JSON.stringify(model.doGenerateCalls[0].prompt)).toContain("答题卡不展示任何图片");
  });

  it("rejects and retries when the reviewer output still cites a missing figure, then fails closed if unresolved", async () => {
    let call = 0;
    const recoveringModel = new MockLanguageModelV3({
      doGenerate: async () => call++ === 0 ? checked(JSON.stringify(visualCircuitDraft)) : checked(JSON.stringify(selfContainedCircuit)),
    });
    expect(parseQuizCard(await validateQuizDraft(JSON.stringify(visualCircuitDraft), recoveringModel))).toEqual(selfContainedCircuit);
    expect(recoveringModel.doGenerateCalls).toHaveLength(2);
    expect(console.warn).toHaveBeenCalledWith("Quiz review rejected", expect.objectContaining({ reason: "missing-visual" }));

    const stuckModel = new MockLanguageModelV3({
      doGenerate: async () => checked(JSON.stringify(visualCircuitDraft)),
    });
    await expect(validateQuizDraft(JSON.stringify(visualCircuitDraft), stuckModel)).rejects.toMatchObject({ reason: "missing-visual" });
    expect(stuckModel.doGenerateCalls).toHaveLength(2);
  });

  it("passes the rewritten self-contained card to separate calculator retry when needed", async () => {
    const rewrittenNumeric = {
      type: "single" as const,
      question: "电源电压 6V，定值电阻 $R_1=10\\,\\Omega$ 与 $R_2=20\\,\\Omega$ 串联，求电路中的电流。",
      options: ["0.1 A", "0.2 A", "0.3 A", "0.6 A"],
      answer: [1],
      explanation: "总电阻 $R=10+20=30\\,\\Omega$，电流 $I=6/30=0.2\\,\\text{A}$。",
    };
    let call = 0;
    const responses: GenerateResponse[] = [
      checked(JSON.stringify(rewrittenNumeric), true),
      { ...checked("{}"), content: [{ type: "tool-call", toolCallId: "calc-circuit", toolName: "calculate", input: JSON.stringify({ expression: "6/(10+20)" }) }], finishReason: { unified: "tool-calls", raw: undefined } },
      checked(JSON.stringify(rewrittenNumeric), true),
    ];
    const model = new MockLanguageModelV3({ doGenerate: async () => responses[call++] });
    expect(parseQuizCard(await validateQuizDraft(JSON.stringify(visualCircuitDraft), model))).toEqual(rewrittenNumeric);
    expect(JSON.stringify(model.doGenerateCalls[1].prompt)).toContain("串联");
    expect(JSON.stringify(model.doGenerateCalls[1].prompt)).not.toContain("如图所示");
    expect(JSON.stringify(model.doGenerateCalls[2].prompt)).toContain("串联");
  });

  it("allows diagram references when the user explicitly uploaded an image", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => checked(JSON.stringify(visualCircuitDraft)),
    });
    const result = await validateQuizDraft(JSON.stringify(visualCircuitDraft), model, undefined, { allowVisualReference: true });
    expect(parseQuizCard(result)).toEqual(visualCircuitDraft);
    expect(model.doGenerateCalls).toHaveLength(1);
  });
});
