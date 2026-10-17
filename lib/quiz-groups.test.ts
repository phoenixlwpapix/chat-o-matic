import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { buildQuizContinuationPrompt, getMessageQuizCards, getMessageQuizzes, parseQuizCard, QUIZ_FOLLOW_UP_PROMPTS, readQuizAnswers, withQuizAnswerContext } from "./quizzes";
import { collectQuizResults, buildQuizSummaryAnalysisPrompt } from "./quiz-summary";
import { getResponseActionContext, getResponseActions, isQuizGroupContext } from "./response-actions";
import { normalizeSessions, toStoredMessages } from "./chat-history";
import { parseChatRequest } from "./chat-request";

const questions = Array.from({ length: 3 }, (_, index) => ({ type: "single", question: `问题 ${index + 1}`, options: ["A cat", "A dog"], answer: [0], explanation: `解析 ${index + 1}` }));
const group = { type: "reading", passage: "Sam has a cat. **“Pets”** make him happy.", questions };
const raw = JSON.stringify(group);
// Use the exact rendered JSON, including the shared Markdown normalization.
function message(selected = true): UIMessage {
  const original: UIMessage = { id: "group", role: "assistant", parts: [{ type: "text", text: `\`\`\`quiz\n${raw}\n\`\`\`` }] };
  const renderedRaw = getMessageQuizCards(original)[0].raw;
  return { ...original, metadata: { quizAnswers: selected ? [{ key: "0:0", raw: renderedRaw, selected: [], selections: [[0], [1], [0]] }] : [] } };
}

describe("shared-passage quiz groups", () => {
  it("accepts reading groups, legacy cards and numbered cloze groups", () => {
    expect(parseQuizCard(raw)?.type).toBe("reading");
    expect(parseQuizCard(JSON.stringify(questions[0]))?.type).toBe("single");
    expect(parseQuizCard(JSON.stringify({ ...group, type: "cloze", passage: "Sam [1] a [2]. He is [3]." }))?.type).toBe("cloze");
    for (const changes of [{ questions: [] }, { questions: Array(7).fill(questions[0]) }, { type: "cloze", passage: "No blanks." }, { type: "cloze", passage: "[1] [1] [3]" }, { type: "cloze", passage: "[1] [2] [4]" }, { type: "cloze", passage: "[1] [2] [3]", questions: questions.map((question) => ({ ...question, type: "multiple" })) }]) {
      expect(parseQuizCard(JSON.stringify({ ...group, ...changes }))).toBeNull();
    }
    expect(parseQuizCard("x".repeat(10_001))).toBeNull();
  });

  it("requires all questions to be answered in one valid submission", () => {
    const storedRaw = getMessageQuizCards(message())[0].raw;
    const answer = { key: "0:0", raw: storedRaw, selected: [], selections: [[0], [1], [0]] };
    expect(readQuizAnswers({ quizAnswers: [answer] })).toEqual([answer]);
    for (const changes of [{ selections: [[0]] }, { selections: [[0], [], [0]] }, { selections: [[0], [6], [0]] }, { selections: [[0], [0, 0], [0]] }, { selections: undefined }, { selected: [0] }]) {
      expect(readQuizAnswers({ quizAnswers: [{ ...answer, ...changes }] })).toEqual([]);
    }
    expect(readQuizAnswers({ quizAnswers: [{ key: "0:0", raw: JSON.stringify(questions[0]), selected: [] }] })).toEqual([]);
  });

  it("recognizes the same group with valid longer closing fences", () => {
    const original = message();
    const longer = { ...original, parts: [{ type: "text" as const, text: `\`\`\`quiz\n${raw}\n\`\`\`\`` }] };
    expect(getMessageQuizCards(longer)).toHaveLength(1);
    expect(collectQuizResults([longer])).toMatchObject({ correct: 2, incorrect: 1, unanswered: 0 });
  });

  it("counts each small question and restores the entire submission and explanation context", () => {
    const original = message();
    const restored = normalizeSessions([{ id: "s", title: "阅读", createdAt: 1, updatedAt: 1, messages: toStoredMessages([original]) }])[0].messages;
    expect(getMessageQuizCards(original)).toHaveLength(1);
    expect(getMessageQuizzes(original)).toHaveLength(3);
    for (const messages of [[original], restored]) {
      const summary = collectQuizResults(messages);
      expect(summary).toMatchObject({ correct: 2, incorrect: 1, unanswered: 0 });
      expect(summary.results).toHaveLength(3);
      expect(buildQuizSummaryAnalysisPrompt(summary)).toContain("第2题：问题 2");
      expect(JSON.stringify(withQuizAnswerContext(messages))).toContain("我的选择：B. A dog");
      expect(getResponseActionContext(messages, "group")).toBe("quiz-answered");
    }
    expect(collectQuizResults([message(false)])).toMatchObject({ correct: 0, incorrect: 0, unanswered: 3, results: [] });
    const stale = { ...original, parts: [{ type: "text" as const, text: `\`\`\`quiz\n${raw.replace("Sam", "Bob")}\n\`\`\`` }] };
    expect(collectQuizResults([stale]).results).toHaveLength(0);
    expect(withQuizAnswerContext([stale])).toHaveLength(1);
  });

  it("offers group continuations and wrong-answer explanations, including after explanation and summary", () => {
    const messages: UIMessage[] = [message()];
    expect(isQuizGroupContext(messages, "group")).toBe(true);
    const actions = getResponseActions("quiz-answered", true);
    expect(actions.find((action) => action.id === "next-quiz")?.label).toBe("再练一组");
    expect(actions.find((action) => action.id === "explain-quiz")?.prompt).toBe(QUIZ_FOLLOW_UP_PROMPTS.explainGroup);
    expect(getResponseActions("quiz-unanswered", true).find((action) => action.id === "next-quiz")?.label).toBe("换一组题");
    messages.push({ id: "explain", role: "user", parts: [{ type: "text", text: QUIZ_FOLLOW_UP_PROMPTS.explainGroup }] }, { id: "reply", role: "assistant", parts: [{ type: "text", text: "第二题的线索是……" }] });
    expect(getResponseActionContext(messages, "reply")).toBe("quiz-explanation");
    expect(isQuizGroupContext(messages, "reply")).toBe(true);
    const continuation = buildQuizContinuationPrompt([...messages, { id: "next", role: "user", parts: [{ type: "text", text: QUIZ_FOLLOW_UP_PROMPTS.next }] }]);
    expect(continuation).toContain("组内必须共用文章");
    expect(continuation).toContain("默认一篇材料配3道小题");
  });

  it("accepts grouped answers in chat API history", async () => {
    const result = await parseChatRequest(new Request("http://localhost/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "s", trigger: "submit-message", messages: [message(), { id: "next", role: "user", parts: [{ type: "text", text: QUIZ_FOLLOW_UP_PROMPTS.next }] }] }) }));
    expect(collectQuizResults(result.messages).results).toHaveLength(3);
  });
});
