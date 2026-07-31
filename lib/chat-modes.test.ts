import { describe, expect, it } from "vitest";
import { normalizeChatPreferences } from "./chat-preferences";
import { buildLearningPrompt } from "./learning-modes";
import {
  buildChatSystemPrompt,
  buildSearchPrompt,
  isSearchEnabled,
} from "./search-modes";

describe("chat mode prompts", () => {
  it("adds the selected learning behavior without replacing the persona", () => {
    const result = buildChatSystemPrompt(
      "PERSONA",
      buildLearningPrompt("hint"),
      buildSearchPrompt("auto"),
    );

    expect(result).toContain("PERSONA");
    expect(result).toContain("不要直接给出题目的最终答案");
    expect(result).toContain("联网策略：自动");
  });

  it("requires sources in always-search mode", () => {
    expect(buildSearchPrompt("always")).toContain("必须先使用 Google Search");
  });

  it("warns against guessing when search is disabled", () => {
    expect(buildSearchPrompt("off")).toContain("不要猜测");
    expect(isSearchEnabled("off")).toBe(false);
    expect(isSearchEnabled("auto")).toBe(true);
  });
});

describe("chat preferences", () => {
  it("keeps valid locally stored defaults", () => {
    expect(
      normalizeChatPreferences({
        schemaVersion: 1,
        learningMode: "step-by-step",
        searchMode: "off",
      }),
    ).toEqual({
      schemaVersion: 1,
      learningMode: "step-by-step",
      searchMode: "off",
    });
  });

  it("falls back safely when locally stored values are invalid", () => {
    expect(
      normalizeChatPreferences({
        learningMode: "unknown",
        searchMode: 123,
      }),
    ).toEqual({
      schemaVersion: 1,
      learningMode: "chat",
      searchMode: "auto",
    });
  });
});
