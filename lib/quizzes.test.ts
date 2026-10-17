import { describe, expect, it } from "vitest";
import { parseQuiz, isCorrectAnswer, readQuizAnswers, describeQuizAnswer, withQuizAnswerContext, QUIZ_FOLLOW_UP_PROMPTS, isQuizExplanationReply } from "./quizzes";
import { normalizeSessions, toStoredMessages, upsertSession } from "./chat-history";
import { buildChatSystemPrompt } from "./search-modes";
import { parseChatRequest } from "./chat-request";
import { convertToModelMessages, type UIMessage } from "ai";
import { buildQuizContinuationPrompt } from "./quizzes";

const question = { type: "single", question: "哪个是质数？", options: ["9", "11", "15"], answer: [1], explanation: "11只有两个正因数。" };
const raw = JSON.stringify(question);
const response = { key: "0:0", raw, selected: [1] };

describe("interactive quizzes", () => {
  it("rotates concrete reading skills only for reading-card continuations", () => {
    const card = (id: string, questionText: string): UIMessage => ({ id, role: "assistant", parts: [{ type: "text", text: `\`\`\`quiz\n${JSON.stringify({ ...question, question: questionText })}\n\`\`\`` }] });
    const next: UIMessage = { id: "next", role: "user", parts: [{ type: "text", text: QUIZ_FOLLOW_UP_PROMPTS.next }] };
    const reading = card("a", "Read the passage: A short story. What is the character preparing to do?");
    expect(buildQuizContinuationPrompt([reading, next])).toContain("词义理解");
    expect(buildQuizContinuationPrompt([reading, card("b", "Read the passage: A new story."), next])).toContain("明确细节");
    expect(buildQuizContinuationPrompt([reading, card("math", "三角形内角和是多少？"), next])).toBe("");
    expect(buildQuizContinuationPrompt([reading, { ...next, parts: [{ type: "text", text: QUIZ_FOLLOW_UP_PROMPTS.explain }] }])).toBe("");
    expect(buildQuizContinuationPrompt([card("bad", "普通题目"), next])).toBe("");
  });

  it("recognizes a card explanation reply after history restore without adding actions to unrelated replies", () => {
    const messages: UIMessage[] = [
      { id: "explain", role: "user", parts: [{ type: "text", text: QUIZ_FOLLOW_UP_PROMPTS.explain }] },
      { id: "reply", role: "assistant", parts: [{ type: "text", text: "讲解" }] },
      { id: "other", role: "user", parts: [{ type: "text", text: "你好" }] },
      { id: "greeting", role: "assistant", parts: [{ type: "text", text: "你好" }] },
    ];
    expect(isQuizExplanationReply(messages, "reply")).toBe(true);
    expect(isQuizExplanationReply(messages, "greeting")).toBe(false);
    expect(isQuizExplanationReply(messages, "explain")).toBe(false);
    expect(isQuizExplanationReply(messages, "missing")).toBe(false);
    const restored = normalizeSessions([{ id: "s", title: "讲解", createdAt: 1, updatedAt: 1, messages: toStoredMessages(messages.slice(0, 2)) }]);
    expect(isQuizExplanationReply(restored[0].messages, "reply")).toBe(true);
  });

  it("keeps a request for a new card last after a wrong answer, even at the end of a quiz", async () => {
    const messages: UIMessage[] = [
      { id: "start", role: "user", parts: [{ type: "text", text: "只做一道质数题。" }] },
      { id: "q", role: "assistant", parts: [{ type: "text", text: `\`\`\`quiz\n${raw}\n\`\`\`` }], metadata: { quizAnswers: [{ ...response, selected: [0] }] } },
      { id: "next", role: "user", parts: [{ type: "text", text: QUIZ_FOLLOW_UP_PROMPTS.next }] },
    ];
    const context = withQuizAnswerContext(messages);
    expect(context[2].parts).toEqual([{ type: "text", text: describeQuizAnswer(parseQuiz(raw)!, [0]) }]);
    const converted = await convertToModelMessages(context);
    expect(JSON.stringify(converted.at(-1))).toContain(QUIZ_FOLLOW_UP_PROMPTS.next);
    expect(QUIZ_FOLLOW_UP_PROMPTS.next).toContain("主动追加一题");
    expect(QUIZ_FOLLOW_UP_PROMPTS.next).not.toContain("尚未答对");
    expect(buildChatSystemPrompt("角色", "联网")).toContain("都必须直接输出一道新的 quiz 卡片");
    expect(QUIZ_FOLLOW_UP_PROMPTS.explain).toContain("不要出新题");
  });

  it("provides saved answers only to model context without mutating visible messages", async () => {
    const messages: UIMessage[] = [
      { id: "q", role: "assistant", parts: [{ type: "text", text: `\`\`\`quiz\n${raw}\n\`\`\`` }], metadata: { quizAnswers: [response] } },
      { id: "next", role: "user", parts: [{ type: "text", text: "为什么错了？" }] },
    ];
    const snapshot = JSON.stringify(messages);
    const context = withQuizAnswerContext(messages);
    expect(messages).toHaveLength(2);
    expect(JSON.stringify(messages)).toBe(snapshot);
    expect(context).toHaveLength(3);
    expect(context[1].parts).toEqual([{ type: "text", text: describeQuizAnswer(parseQuiz(raw)!, [1]) }]);
    expect((await convertToModelMessages(context)).at(-1)?.role).toBe("user");
    const stale: UIMessage = { ...messages[0], parts: [{ type: "text", text: "新题目" }] };
    expect(withQuizAnswerContext([stale])).toHaveLength(1);
  });

  it("accepts saved quiz metadata and consecutive submission/follow-up messages in chat requests", async () => {
    const result = await parseChatRequest(new Request("http://localhost/api/chat", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "chat", trigger: "submit-message", messages: [
        { id: "q", role: "assistant", parts: [{ type: "text", text: `\`\`\`quiz\n${raw}\n\`\`\`` }], metadata: { quizAnswers: [response] } },
        { id: "a", role: "user", parts: [{ type: "text", text: "我的选择：B" }] },
        { id: "next", role: "user", parts: [{ type: "text", text: "请出下一题" }] },
      ] }),
    }));
    expect(result.messages).toHaveLength(3);
    const converted = await convertToModelMessages(result.messages);
    expect(converted.at(-1)?.role).toBe("user");
  });

  it("validates the three question types and rejects invalid indices and shapes", () => {
    expect(parseQuiz(raw)).not.toBeNull();
    const parse = (changes: Record<string, unknown>) => parseQuiz(JSON.stringify({ ...question, ...changes }));
    expect(parse({ type: "multiple", answer: [0, 1] })).not.toBeNull();
    expect(parse({ type: "boolean", options: ["正确", "错误"], answer: [0] })).not.toBeNull();
    for (const changes of [{ type: "free" }, { answer: [3] }, { answer: [0, 1] }, { answer: [] }, { answer: [1, 1] }, { options: ["a", "a"] }, { type: "boolean" }, { explanation: "" }, { html: "<script>" }]) {
      expect(parse(changes)).toBeNull();
    }
    expect(parseQuiz('{"type":')).toBeNull();
    expect(parseQuiz("x".repeat(10_001))).toBeNull();
  });

  it("grades multiple choice as an exact set, with no partial or duplicate credit", () => {
    const quiz = parseQuiz(JSON.stringify({ ...question, type: "multiple", answer: [0, 2] }))!;
    expect(isCorrectAnswer(quiz, [2, 0])).toBe(true);
    expect(isCorrectAnswer(quiz, [0])).toBe(false);
    expect(isCorrectAnswer(quiz, [0, 1, 2])).toBe(false);
    expect(isCorrectAnswer(quiz, [0, 0])).toBe(false);
  });

  it("sanitizes stored selections and ignores corrupt or oversized answer records", () => {
    expect(readQuizAnswers({ quizAnswers: [response] })).toEqual([response]);
    expect(readQuizAnswers({ quizAnswers: [{ ...response, selected: [9] }, { ...response, selected: [1, 1] }, { ...response, raw: "{}" }] })).toEqual([]);
    expect(readQuizAnswers(null)).toEqual([]);
    expect(readQuizAnswers({ quizAnswers: Array(12).fill(response) })).toHaveLength(8);
  });

  it("persists answers alongside search metadata and notices answer-only history changes", () => {
    const message = { id: "m", role: "assistant" as const, parts: [{ type: "text" as const, text: `\`\`\`quiz\n${raw}\n\`\`\`` }], metadata: { search: { sourceCount: 2 }, quizAnswers: [response] } };
    const saved = toStoredMessages([message]);
    expect(saved[0].metadata).toEqual(message.metadata);
    const initial = upsertSession([], "s", toStoredMessages([{ ...message, metadata: undefined }]), { personaId: "default", searchMode: "auto" }, 1);
    const updated = upsertSession(initial, "s", saved, { personaId: "default", searchMode: "auto" }, 2);
    expect(updated[0].updatedAt).toBe(2);
    expect(normalizeSessions(JSON.parse(JSON.stringify(updated)))[0].messages[0].metadata).toEqual(message.metadata);
    expect(normalizeSessions(initial)[0].messages[0].metadata).toBeUndefined();
  });

  it("includes one-at-a-time card instructions and keeps follow-up text within request limits", () => {
    expect(buildChatSystemPrompt("角色", "联网")).toContain("每次回答只出一道题");
    const quiz = parseQuiz(JSON.stringify({ ...question, type: "multiple", question: "题".repeat(2000), options: Array.from({ length: 6 }, (_, i) => `${i}${"选".repeat(499)}`), answer: [0, 1, 2, 3, 4, 5] }))!;
    expect(describeQuizAnswer(quiz, quiz.answer).length).toBeLessThan(2500);
  });
});
