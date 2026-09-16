import { describe, expect, it } from "vitest";
import { normalizeChatPreferences } from "./chat-preferences";
import {
  buildChatSystemPrompt,
  buildSearchPrompt,
  isSearchEnabled,
} from "./search-modes";

describe("chat mode prompts", () => {
  it("combines the persona and search behavior", () => {
    const result = buildChatSystemPrompt(
      "PERSONA",
      buildSearchPrompt("auto"),
    );

    expect(result).toContain("PERSONA");
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
        schemaVersion: 2,
        personaId: "philosophical-cat",
        searchMode: "off",
      }),
    ).toEqual({
      schemaVersion: 3,
      personaId: "philosophical-cat",
      searchMode: "off",
      userAvatar: null,
    });
  });

  it("falls back safely when locally stored values are invalid", () => {
    expect(
      normalizeChatPreferences({
        personaId: "unknown",
        searchMode: 123,
      }),
    ).toEqual({
      schemaVersion: 3,
      personaId: "default",
      searchMode: "auto",
      userAvatar: null,
    });
  });

  it("keeps supported local avatars and rejects remote images", () => {
    const localAvatar = "data:image/jpeg;base64,YXZhdGFy";
    expect(
      normalizeChatPreferences({ userAvatar: localAvatar }).userAvatar,
    ).toBe(localAvatar);
    expect(
      normalizeChatPreferences({ userAvatar: "https://example.com/avatar.jpg" })
        .userAvatar,
    ).toBeNull();
  });
});
