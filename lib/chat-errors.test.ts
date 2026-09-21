import { describe, expect, it } from "vitest";
import {
  CHAT_ERROR_MESSAGES,
  getClientChatErrorMessage,
  getPublicChatErrorMessage,
} from "./chat-errors";

describe("chat error messages", () => {
  it("turns provider quota errors into a user-facing quota message", () => {
    expect(
      getPublicChatErrorMessage({
        statusCode: 429,
        message: "RESOURCE_EXHAUSTED",
      }),
    ).toBe(CHAT_ERROR_MESSAGES.quota);
  });

  it("turns an edge 403 HTML response into a friendly message", () => {
    expect(
      getClientChatErrorMessage("<html><title>Forbidden</title></html>", 403),
    ).toBe(CHAT_ERROR_MESSAGES.forbidden);
  });

  it("keeps an explicit JSON API error", () => {
    expect(
      getClientChatErrorMessage(
        JSON.stringify({ error: "请求太频繁了，请稍后再试 ⏳" }),
        429,
      ),
    ).toBe("请求太频繁了，请稍后再试 ⏳");
  });

  it("does not expose an unknown provider error", () => {
    expect(getPublicChatErrorMessage(new Error("secret upstream detail"))).toBe(
      CHAT_ERROR_MESSAGES.generic,
    );
  });
});
