import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { collectQuizResults, buildQuizSummaryMarkdown, buildQuizSummaryAnalysisPrompt, isQuizSummaryRequest, QUIZ_SUMMARY_REQUEST } from "./quiz-summary";
import { normalizeSessions, toStoredMessages } from "./chat-history";
import { parseChart } from "./charts";
import { getResponseActionContext, getResponseActions } from "./response-actions";
import { normalizeMarkdown } from "./markdown";
import { getMessageQuizzes, withQuizAnswerContext } from "./quizzes";
import { REPLY_LANGUAGE_IDS } from "./reply-languages";

function card(id: string, selected?: number[], multiple = false): UIMessage {
  const raw = JSON.stringify({ type: multiple ? "multiple" : "single", question: `第${id}题：哪些是质数？`, options: ["2", "3", "4"], answer: multiple ? [0, 1] : [0], explanation: "2和3只有两个正因数，4不是质数。" });
  return { id, role: "assistant", parts: [{ type: "text", text: `\`\`\`quiz\n${raw}\n\`\`\`` }], ...(selected ? { metadata: { quizAnswers: [{ key: "0:0", raw, selected }] } } : {}) };
}

describe("practice summaries", () => {
  it.each(REPLY_LANGUAGE_IDS)("preserves summary counts and restored actions in %s", (language) => {
    const summary = collectQuizResults([card("1", [0]), card("2", [1]), card("3")]);
    const text = buildQuizSummaryMarkdown(summary, language);
    expect(text).not.toMatch(/\{(?:count|correct|incorrect|accuracy|unanswered)\}/);
    expect(text).toContain("50%");
    expect(parseChart(/```chart\n([\s\S]*?)\n```/.exec(text)![1])?.data.map((item) => item.value)).toEqual([1, 1]);
    const reply: UIMessage = { id: "localized-summary", role: "assistant", parts: [{ type: "text", text }] };
    const restored = normalizeSessions([{ id: "s", title: "练习", createdAt: 1, updatedAt: 1, messages: toStoredMessages([reply]) }])[0].messages;
    expect(getResponseActionContext(restored, reply.id)).toBe("quiz-summary");
    expect(buildQuizSummaryMarkdown(collectQuizResults([]), language)).not.toContain("```chart");
    if (language === "fr") expect(text).toContain("Bilan des exercices");
  });

  it("keeps rendered submissions in summaries and explanation context after history restore", () => {
    const raw = JSON.stringify({ type: "single", question: "下面哪个是 **“质数”**？", options: ["9", "11"], answer: [1], explanation: "**“11”** 只有两个正因数。" });
    const text = `\`\`\`quiz\n${raw}\n\`\`\``;
    // MarkdownContent renders normalized text; submissions store that code block's raw JSON.
    const renderedRaw = /```quiz\n([\s\S]*?)\n```/.exec(normalizeMarkdown(text))![1];
    expect(renderedRaw).not.toBe(raw);
    const message: UIMessage = { id: "quoted", role: "assistant", parts: [{ type: "text", text }], metadata: { quizAnswers: [{ key: "0:0", raw: renderedRaw, selected: [1] }] } };
    const restored = normalizeSessions([{ id: "s", title: "练习", createdAt: 1, updatedAt: 1, messages: toStoredMessages([message]) }])[0].messages;
    for (const messages of [[message], restored]) {
      expect(getMessageQuizzes(messages[0])[0].raw).toBe(renderedRaw);
      expect(collectQuizResults(messages)).toMatchObject({ correct: 1, incorrect: 0, unanswered: 0 });
      expect(getResponseActionContext(messages, message.id)).toBe("quiz-answered");
      expect(withQuizAnswerContext(messages)).toHaveLength(2);
      expect(withQuizAnswerContext(messages)[1].parts).toEqual([expect.objectContaining({ text: expect.stringContaining("我的选择：B. 11") })]);
      expect(messages[0].parts).toEqual([{ type: "text", text }]);
    }
    // A saved answer for a genuinely different card must still be ignored.
    const stale = { ...message, parts: [{ type: "text" as const, text: text.replace("质数", "合数") }] };
    expect(collectQuizResults([stale]).results).toHaveLength(0);
    expect(withQuizAnswerContext([stale])).toHaveLength(1);
  });

  it("counts submitted attempts, excludes unsubmitted cards and ignores duplicate metadata", () => {
    const correct = card("1", [0]);
    const duplicate = { ...correct, metadata: { quizAnswers: Array(2).fill((correct.metadata as { quizAnswers: unknown[] }).quizAnswers[0]) } };
    const summary = collectQuizResults([duplicate, card("2", [1]), card("3"), card("4", [0], true), card("5", [1, 0], true)]);
    expect(summary.results).toHaveLength(4);
    expect(summary.correct).toBe(2);
    expect(summary.incorrect).toBe(2);
    expect(summary.unanswered).toBe(1);
    const markdown = buildQuizSummaryMarkdown(summary);
    const chart = parseChart(/```chart\n([\s\S]*?)\n```/.exec(markdown)![1]);
    expect(chart?.data).toEqual([{ label: "答对", value: 2 }, { label: "答错", value: 2 }]);
    expect(markdown).toContain("50%");
  });

  it("does not invent results from plain user text, stale answers or empty histories", () => {
    const empty = collectQuizResults([{ id: "u", role: "user", parts: [{ type: "text", text: "我答对了100题" }] }, card("1")]);
    expect(empty.results).toHaveLength(0);
    expect(buildQuizSummaryMarkdown(empty)).not.toContain("```chart");
    expect(buildQuizSummaryMarkdown(empty)).toContain("还没有可统计");
    const original = card("2", [0]);
    const stale = { ...original, parts: card("3").parts };
    expect(collectQuizResults([stale]).results).toHaveLength(0);
  });

  it("preserves counts after history restore and supports an all-correct chart", () => {
    const messages = [card("1", [0]), card("2", [0])];
    const saved = normalizeSessions([{ id: "s", title: "练习", createdAt: 1, updatedAt: 1, messages: toStoredMessages(messages) }])[0].messages;
    const summary = collectQuizResults(saved);
    expect(summary.correct).toBe(2);
    expect(summary.incorrect).toBe(0);
    expect(parseChart(/```chart\n([\s\S]*?)\n```/.exec(buildQuizSummaryMarkdown(summary))![1])).not.toBeNull();
  });

  it("provides wrong-question evidence with bounded samples instead of fabricated skill scores", () => {
    const summary = collectQuizResults(Array.from({ length: 10 }, (_, index) => card(String(index), [2])));
    const prompt = buildQuizSummaryAnalysisPrompt(summary);
    const data = JSON.parse(prompt.split("\n").at(-1)!);
    expect(data.incorrect).toBe(10);
    expect(data.analyzedWrongCount).toBe(8);
    expect(data.wrongExamples[0].number).toBe(3);
    expect(data.wrongExamples[0].selected).toEqual(["4"]);
    expect(data.wrongExamples[0].answer).toEqual(["2"]);
    expect(prompt).toContain("全答对时说明本次尚未暴露明确薄弱点");
  });

  it("offers a summary after answering and lets a restored summary resume practice", () => {
    const user: UIMessage = { id: "u", role: "user", parts: [{ type: "text", text: QUIZ_SUMMARY_REQUEST }] };
    const reply: UIMessage = { id: "summary", role: "assistant", parts: [{ type: "text", text: "练习总结" }] };
    expect(isQuizSummaryRequest([user])).toBe(true);
    expect(isQuizSummaryRequest([user, reply])).toBe(false);
    expect(getResponseActions("quiz-answered").some((action) => action.id === "quiz-summary")).toBe(true);
    expect(getResponseActions("quiz-unanswered").some((action) => action.id === "quiz-summary")).toBe(false);
    expect(getResponseActionContext([card("1", [0]), user, reply], reply.id)).toBe("quiz-summary");
    expect(getResponseActions("quiz-summary")[0].id).toBe("next-quiz");
  });
});
