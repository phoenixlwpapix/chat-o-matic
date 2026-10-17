import { describe, expect, it } from "vitest";
import { readUIMessageStream, simulateReadableStream, type UIMessage, type UIMessageChunk } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { createQuizPracticeResponse } from "./quiz-response";
import { QUIZ_FOLLOW_UP_PROMPTS } from "./quizzes";
import { QUIZ_SUMMARY_REQUEST } from "./quiz-summary";
import { getResponseActionContext } from "./response-actions";
import { normalizeSessions, toStoredMessages } from "./chat-history";
import { parseChart } from "./charts";

type ModelResponse = Awaited<ReturnType<MockLanguageModelV3["doStream"]>>;
type ModelChunk = ModelResponse["stream"] extends ReadableStream<infer Chunk> ? Chunk : never;

function modelResponse(chunks: ModelChunk[]): ModelResponse {
  return {
    stream: simulateReadableStream({ chunks: [...chunks, {
      type: "finish", finishReason: { unified: "stop", raw: undefined },
      usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
    }], initialDelayInMs: null, chunkDelayInMs: null }),
  };
}

function textResponse(text: string): ModelResponse {
  return modelResponse([{ type: "text-start", id: "text" }, { type: "text-delta", id: "text", delta: text }, { type: "text-end", id: "text" }]);
}

function decisionResponse(finishPractice: boolean): Awaited<ReturnType<MockLanguageModelV3["doGenerate"]>> {
  return {
    content: [{ type: "text", text: JSON.stringify({ finishPractice }) }],
    finishReason: { unified: "stop", raw: undefined },
    usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
    warnings: [],
  };
}

function practice(request = "继续", unanswered = false): UIMessage[] {
  const messages: UIMessage[] = [{ id: "start", role: "user", parts: [{ type: "text", text: "做3道质数题" }] }];
  for (let index = 0; index < 3; index++) {
    const raw = JSON.stringify({ type: "single", question: `第${index + 1}题，哪个是质数？`, options: ["2", "4"], answer: [0], explanation: "2是质数。" });
    messages.push({ id: `q${index}`, role: "assistant", parts: [{ type: "text", text: `\`\`\`quiz\n${raw}\n\`\`\`` }], metadata: { quizAnswers: unanswered && index === 2 ? [] : [{ key: "0:0", raw, selected: [index === 1 ? 1 : 0] }] } });
    if (index < 2) messages.push({ id: `next${index}`, role: "user", parts: [{ type: "text", text: QUIZ_FOLLOW_UP_PROMPTS.next }] });
  }
  messages.push({ id: "request", role: "user", parts: [{ type: "text", text: request }] });
  return messages;
}

async function readReply(response: Response): Promise<UIMessage> {
  const chunks = (await response.text()).split("\n").filter((line) => line.startsWith("data: ") && line !== "data: [DONE]").map((line) => JSON.parse(line.slice(6)) as UIMessageChunk);
  let reply: UIMessage | undefined;
  for await (const message of readUIMessageStream({ stream: simulateReadableStream({ chunks, initialDelayInMs: null, chunkDelayInMs: null }) })) reply = message;
  expect(chunks.filter((chunk) => chunk.type === "start")).toHaveLength(1);
  expect(chunks.filter((chunk) => chunk.type === "finish")).toHaveLength(1);
  return reply!;
}

describe("practice completion responses", () => {
  it("turns completed practice into precise charts and advice that survive history restore", async () => {
    const model = new MockLanguageModelV3({ doGenerate: decisionResponse(true), doStream: textResponse("建议复习质数的定义。") });
    const messages = practice();
    const response = await createQuizPracticeResponse({ model, messages, personaPrompt: "学习伙伴" });
    const reply = await readReply(response!);
    expect(reply.parts.every((part) => part.type === "text" || part.type === "step-start")).toBe(true);
    const text = reply.parts.filter((part) => part.type === "text").map((part) => part.text).join("");
    expect(text).toContain("已提交 **3 题**");
    expect(text).toContain("67%");
    expect(parseChart(/```chart\n([\s\S]*?)\n```/.exec(text)![1])?.data).toEqual([{ label: "答对", value: 2 }, { label: "答错", value: 1 }]);
    expect(text).toContain("建议复习质数的定义。");
    const restored = normalizeSessions([{ id: "s", title: "练习", createdAt: 1, updatedAt: 1, messages: toStoredMessages([...messages, reply]) }])[0].messages;
    expect(getResponseActionContext(restored, reply.id)).toBe("quiz-summary");
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(JSON.stringify(model.doGenerateCalls[0].prompt)).toContain("做3道质数题");
    expect(model.doStreamCalls).toHaveLength(1);
  });

  it("preserves a normal explanation without appending a summary", async () => {
    const model = new MockLanguageModelV3({ doGenerate: decisionResponse(false) });
    expect(await createQuizPracticeResponse({ model, messages: practice("为什么2是质数？"), personaPrompt: "伙伴" })).toBeNull();
    expect(model.doStreamCalls).toHaveLength(0);
  });

  it.each(Object.values(QUIZ_FOLLOW_UP_PROMPTS))("keeps explicit card actions out of automatic completion: %s", async (request) => {
    const model = new MockLanguageModelV3();
    expect(await createQuizPracticeResponse({ model, messages: practice(request), personaPrompt: "伙伴" })).toBeNull();
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(model.doStreamCalls).toHaveLength(0);
  });

  it("does not end practice with an unsubmitted card", async () => {
    expect(await createQuizPracticeResponse({ model: new MockLanguageModelV3(), messages: practice("继续", true), personaPrompt: "伙伴" })).toBeNull();
  });

  it("keeps the summary button on the direct statistics path", async () => {
    const model = new MockLanguageModelV3({ doStream: textResponse("继续巩固质数。") });
    const response = await createQuizPracticeResponse({ model, messages: practice(QUIZ_SUMMARY_REQUEST), personaPrompt: "伙伴" });
    const reply = await readReply(response!);
    expect(reply.parts.some((part) => part.type === "text" && part.text.includes("已提交 **3 题**"))).toBe(true);
    expect(model.doStreamCalls).toHaveLength(1);
    expect(model.doGenerateCalls).toHaveLength(0);
  });
});
