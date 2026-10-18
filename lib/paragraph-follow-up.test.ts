import { describe, expect, it } from "vitest";
import { buildParagraphFollowUp, isParagraphFollowUpRequest, type ParagraphIntent } from "./paragraph-follow-up";
import { canFinishQuizPractice } from "./quiz-summary";
import { MAX_INPUT_LENGTH } from "./constants";

describe("contextual paragraph follow-ups", () => {
  it.each(["simplify", "example", "question", "sentence"] as const)("carries only the selected quote and keeps %s out of automatic practice completion", (intent: ParagraphIntent) => {
    const quote = "The book **that I bought yesterday** is interesting.";
    const text = buildParagraphFollowUp(quote, intent, "为什么这里用 that？");
    expect(text).toContain(quote);
    expect(isParagraphFollowUpRequest(text)).toBe(true);
    expect(text).toContain("不公布答案、正确选项或补全空位");
    expect(canFinishQuizPractice([{ id: "follow", role: "user", parts: [{ type: "text", text }] }])).toBe(false);
    if (intent === "question") expect(text).toContain("我的问题：为什么这里用 that？");
  });

  it("bounds long quotes, multiline input and custom questions below the chat input limit", () => {
    for (const quote of ["很长的原文".repeat(1000), "x\n".repeat(2000)]) {
      const text = buildParagraphFollowUp(quote, "question", "问".repeat(1000));
      expect(text.length).toBeLessThanOrEqual(MAX_INPUT_LENGTH);
      expect(text).toContain("截取前1800字符");
    }
    expect(isParagraphFollowUpRequest("继续")).toBe(false);
  });
});
