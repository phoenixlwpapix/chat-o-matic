import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { normalizeSessions, toStoredMessages } from "./chat-history";
import { parseChatRequest } from "./chat-request";
import { EQUATION_PART_TYPE, EQUATION_PRACTICE_PROMPT, checkEquationAnswer, createEquationPart, isEquationPracticeRequest, readEquationPart, type EquationPractice } from "./equation-practice";
import { createEquationResponse } from "./equation-response";

const practice: EquationPractice = { question: { coefficient: 2, constant: 3, total: 17 }, stage: "isolate" };
const user: UIMessage = { id: "u", role: "user", parts: [{ type: "text", text: EQUATION_PRACTICE_PROMPT }] };
const nextQuestion = { coefficient: 4, constant: 5, total: -19 };

function generatedQuestion(question: unknown): Awaited<ReturnType<MockLanguageModelV3["doGenerate"]>> {
  return {
    content: [{ type: "text", text: JSON.stringify(question) }],
    finishReason: { unified: "stop", raw: undefined },
    usage: {
      inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 1, text: 1, reasoning: undefined },
    },
    warnings: [],
  };
}

describe("two-step equation practice", () => {
  it("keeps mistakes on the current step and checks the final solution", () => {
    expect(checkEquationAnswer(practice, "2x = 17")).toMatchObject({ stage: "isolate", feedback: "subtract" });
    expect(checkEquationAnswer(practice, "1 4")).toMatchObject({ stage: "isolate", feedback: "format" });
    const next = checkEquationAnswer(practice, "２ｘ ＝ １４");
    expect(next).toEqual({ ...practice, stage: "solve" });
    expect(checkEquationAnswer(next, "14")).toMatchObject({ stage: "solve", feedback: "divide" });
    expect(checkEquationAnswer(next, "x = 7")).toEqual({ ...practice, stage: "done" });
    expect(checkEquationAnswer({ question: { coefficient: 3, constant: 4, total: -11 }, stage: "solve" }, "x = −5").stage).toBe("done");
  });

  it("recognizes the dedicated request without routing a normal explanation into practice", () => {
    expect(isEquationPracticeRequest(EQUATION_PRACTICE_PROMPT)).toBe(true);
    expect(isEquationPracticeRequest("分步练习：一元一次方程")).toBe(true);
    expect(isEquationPracticeRequest("请分步讲解这个方程")).toBe(false);
  });

  it("restores the active step and sends a different verified question through the chat stream", async () => {
    const part = createEquationPart(checkEquationAnswer(practice, "14"));
    const assistant: UIMessage = { id: "a", role: "assistant", parts: [part] };
    const messages = toStoredMessages([user, assistant]);
    const [session] = normalizeSessions([{ id: "s", title: "方程", createdAt: 1, updatedAt: 2, messages }]);
    expect(readEquationPart(session.messages[1].parts[0])).toEqual(part);

    const next = { ...user, id: "u2" };
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "s", trigger: "submit-message", messages: [...session.messages, next] }),
    });
    const validated = await parseChatRequest(request);
    let calls = 0;
    const model = new MockLanguageModelV3({ doGenerate: async () => generatedQuestion(++calls === 1
      ? { coefficient: 2, constant: 3, solution: 7 }
      : { coefficient: 4, constant: 5, solution: -6 }) });
    const stream = await (await createEquationResponse(validated.messages, model, request.signal)).text();
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(JSON.stringify(model.doGenerateCalls[1].prompt)).toContain("上次重复了");
    const dataLine = stream.split("\n").find((line) => line.startsWith(`data: {"type":"${EQUATION_PART_TYPE}"`));
    expect(dataLine).toBeDefined();
    const nextPart = readEquationPart(JSON.parse(dataLine!.slice("data: ".length)));
    expect(nextPart?.data.updateDataModel.value).toEqual({ question: nextQuestion, stage: "isolate" });
  });

  it("returns a retryable failure when both generated drafts are invalid", async () => {
    const model = new MockLanguageModelV3({ doGenerate: generatedQuestion({ coefficient: 4, constant: 5, solution: 2.5 }) });
    const response = await createEquationResponse([user], model, new AbortController().signal);
    expect(response.status).toBe(503);
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("请再试一次") });
  });

  it("rejects a repeat from browser history even in a fresh chat", async () => {
    const model = new MockLanguageModelV3({ doGenerate: generatedQuestion({ coefficient: 2, constant: 3, solution: 7 }) });
    const response = await createEquationResponse([user], model, new AbortController().signal, [practice.question]);
    expect(response.status).toBe(503);
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(JSON.stringify(model.doGenerateCalls[0].prompt)).toContain("2x + 3 = 17");
  });
});
