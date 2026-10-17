import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateText, checkRateLimit } = vi.hoisted(() => ({
  generateText: vi.fn(), checkRateLimit: vi.fn(),
}));
vi.mock("ai", () => ({ generateText }));
vi.mock("@ai-sdk/google", () => ({ google: vi.fn(() => "test-model") }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit }));

import { POST } from "./route";

const exchange = { question: "黑洞是什么？", answer: "黑洞是引力极强的天体。" };
function request(body: unknown = exchange) {
  return new Request("http://localhost/api/chat/title", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("conversation title", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    checkRateLimit.mockReturnValue({ allowed: true });
  });

  it("passes the first question and answer as data and returns a clean title", async () => {
    generateText.mockResolvedValue({ text: "“黑洞的形成与引力”" });
    const response = await POST(request());
    expect(await response.json()).toEqual({ title: "黑洞的形成与引力" });
    expect(JSON.parse(generateText.mock.calls[0][0].prompt)).toEqual(exchange);
  });

  it.each([{}, { ...exchange, answer: "" }, { ...exchange, question: "字".repeat(3001) }])("rejects invalid input before calling the provider", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(generateText).not.toHaveBeenCalled();
  });

  it.each(["", "标题\n额外解释", "长".repeat(31)])("rejects malformed model output", async (text) => {
    generateText.mockResolvedValue({ text });
    expect((await POST(request())).status).toBe(502);
  });

  it("returns a retryable error when the provider fails", async () => {
    generateText.mockRejectedValue(new Error("unavailable"));
    expect((await POST(request())).status).toBe(503);
  });

  it("rate limits title generation", async () => {
    checkRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 2000 });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("2");
    expect(generateText).not.toHaveBeenCalled();
  });
});
