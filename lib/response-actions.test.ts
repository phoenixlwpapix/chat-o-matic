import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { getResponseActionContext, getResponseActions } from "./response-actions";
import { QUIZ_FOLLOW_UP_PROMPTS, buildQuizContinuationPrompt, getMessageQuizzes } from "./quizzes";
import { normalizeSessions, toStoredMessages } from "./chat-history";

const raw = JSON.stringify({ type: "single", question: "Read the passage: Sam has a cat. What pet does Sam have?", options: ["A cat", "A dog"], answer: [0], explanation: "The passage says Sam has a cat." });
const card: UIMessage = { id: "card", role: "assistant", parts: [{ type: "text", text: `\`\`\`quiz\n${raw}\n\`\`\`` }] };

describe("contextual reply actions", () => {
  it("offers new-question difficulty actions instead of explanation simplification before answering", () => {
    const context = getResponseActionContext([card], card.id);
    const actions = getResponseActions(context);
    expect(context).toBe("quiz-unanswered");
    expect(actions.map((action) => action.id)).toEqual(["easier-quiz", "harder-quiz", "next-quiz"]);
    expect(actions.find((action) => action.id === "next-quiz")?.label).toBe("换一道题");
    for (const id of ["easier-quiz", "harder-quiz"] as const) {
      const action = actions.find((item) => item.id === id)!;
      expect(action.prompt).toBe(QUIZ_FOLLOW_UP_PROMPTS[id === "easier-quiz" ? "easier" : "harder"]);
      expect(buildQuizContinuationPrompt([card, { id: "u", role: "user", parts: [{ type: "text", text: action.prompt }] }])).toContain("词义理解");
    }
  });

  it("offers explanation only after submission, including restored history", () => {
    const answered: UIMessage = { ...card, metadata: { quizAnswers: [{ key: "0:0", raw, selected: [1] }] } };
    const restored = normalizeSessions([{ id: "s", title: "练习", createdAt: 1, updatedAt: 1, messages: toStoredMessages([answered]) }])[0].messages;
    const context = getResponseActionContext(restored, card.id);
    expect(context).toBe("quiz-answered");
    expect(getResponseActions(context).map((action) => action.id)).toEqual(["next-quiz", "explain-quiz", "easier-quiz", "harder-quiz", "quiz-summary"]);
    const stale = { ...card, metadata: { quizAnswers: [{ key: "0:0", raw: raw.replace("Sam", "Bob"), selected: [1] }] } };
    expect(getResponseActionContext([stale], card.id)).toBe("quiz-unanswered");
  });

  it("separates simpler explanations from easier questions and removes generic duplicate quiz actions", () => {
    const messages: UIMessage[] = [card,
      { id: "u", role: "user", parts: [{ type: "text", text: QUIZ_FOLLOW_UP_PROMPTS.explain }] },
      { id: "explanation", role: "assistant", parts: [{ type: "text", text: "文章直接提到了猫。" }] },
    ];
    const actions = getResponseActions(getResponseActionContext(messages, "explanation"));
    expect(actions.map((action) => action.id)).toEqual(["next-quiz", "easier-quiz", "harder-quiz", "simplify", "quiz-summary"]);
    expect(actions.find((action) => action.id === "simplify")?.label).toBe("讲解更简单");
    const simplify = actions.find((action) => action.id === "simplify")!;
    expect(simplify.prompt).toBe(QUIZ_FOLLOW_UP_PROMPTS.simplifyExplanation);
    messages.push(
      { id: "simplify", role: "user", parts: [{ type: "text", text: simplify.prompt }] },
      { id: "simpler-explanation", role: "assistant", parts: [{ type: "text", text: "Sam 有猫，所以选猫。" }] },
    );
    expect(getResponseActionContext(messages, "simpler-explanation")).toBe("quiz-explanation");
    expect(getResponseActions("answer").map((action) => action.id)).toEqual(["simplify", "example", "quiz", "verify"]);
    expect(getResponseActionContext(messages, "missing")).toBe("answer");
  });

  it("recognizes valid alternate fences but does not treat incomplete or invalid data as a playable card", () => {
    const alternate: UIMessage = { ...card, parts: [{ type: "text", text: `~~~~quiz\n${raw}\n~~~~` }] };
    expect(getMessageQuizzes(alternate)).toHaveLength(1);
    expect(getResponseActionContext([alternate], card.id)).toBe("quiz-unanswered");
    for (const text of ['```quiz\n{"type":', '```quiz\n{}\n```']) {
      const incomplete: UIMessage = { ...card, parts: [{ type: "text", text }] };
      expect(getResponseActionContext([incomplete], card.id)).toBe("answer");
    }
  });
});
