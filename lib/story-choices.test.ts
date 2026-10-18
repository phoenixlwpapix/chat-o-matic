import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { buildStoryChoicePrompt, getStoryChoiceReply, parseStoryChoices } from "./story-choices";
import { getMessageQuizCards } from "./quizzes";
import { PERSONAS } from "./personas";

const choices = { prompt: "接下来怎么做？", options: ["沿河前行", "观察足迹"] };
const card: UIMessage = { id: "story", role: "assistant", parts: [{ type: "text", text: `\`\`\`choice\n${JSON.stringify(choices)}\n\`\`\`` }] };

describe("adventure choices", () => {
  it("accepts only complete, distinct actions without grading fields", () => {
    expect(parseStoryChoices(JSON.stringify(choices))).toEqual(choices);
    for (const value of [{ ...choices, options: ["一个"] }, { ...choices, options: ["相同", "相同"] }, { ...choices, options: [" ", "继续"] }, { ...choices, answer: [0] }, { ...choices, options: ["1", "2", "3", "4"] }]) {
      expect(parseStoryChoices(JSON.stringify(value))).toBeNull();
    }
    expect(parseStoryChoices('{"prompt":')).toBeNull();
    expect(parseStoryChoices(" ".repeat(4001))).toBeNull();
  });
  it("restores the immediate choice without borrowing a later turn or grading the story", () => {
    const selected: UIMessage = { id: "u", role: "user", parts: [{ type: "text", text: buildStoryChoicePrompt("沿河前行") }] };
    expect(getStoryChoiceReply([card, selected], "story")).toBe("我选择：沿河前行");
    expect(getStoryChoiceReply([card], "story")).toBeUndefined();
    expect(getStoryChoiceReply([card, { ...card, id: "later" }, selected], "story")).toBeUndefined();
    expect(getStoryChoiceReply([card, selected], "missing")).toBeUndefined();
    expect(getMessageQuizCards(card)).toEqual([]);
  });
  it("instructs only the storyteller to offer ungraded action cards", () => {
    expect(PERSONAS.find((persona) => persona.id === "adventure-master")?.systemPrompt).toContain("```choice");
    expect(PERSONAS.find((persona) => persona.id === "roast-master")?.systemPrompt).not.toContain("```choice");
  });
});
