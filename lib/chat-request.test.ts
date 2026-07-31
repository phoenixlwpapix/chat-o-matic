import { describe, expect, it } from "vitest";
import { ChatRequestError, parseChatRequest } from "./chat-request";

function createRequest(body: unknown): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validBody() {
  return {
    id: "chat-1",
    trigger: "submit-message",
    personaId: "default",
    messages: [
      {
        id: "message-1",
        role: "user",
        parts: [{ type: "text", text: "你好" }],
      },
    ],
  };
}

describe("parseChatRequest", () => {
  it("accepts the AI SDK request envelope", async () => {
    const result = await parseChatRequest(createRequest(validBody()));

    expect(result.personaId).toBe("default");
    expect(result.learningMode).toBe("chat");
    expect(result.searchMode).toBe("auto");
    expect(result.messages).toHaveLength(1);
  });

  it("accepts supported learning and search modes", async () => {
    const result = await parseChatRequest(
      createRequest({
        ...validBody(),
        learningMode: "step-by-step",
        searchMode: "always",
      }),
    );

    expect(result.learningMode).toBe("step-by-step");
    expect(result.searchMode).toBe("always");
  });

  it.each([
    ["learningMode", "instant-answer"],
    ["searchMode", "sometimes"],
  ])("rejects an invalid %s", async (field, value) => {
    await expect(
      parseChatRequest(createRequest({ ...validBody(), [field]: value })),
    ).rejects.toMatchObject({
      message: "请求参数不正确",
      status: 400,
    });
  });

  it("rejects unknown envelope fields", async () => {
    const body = { ...validBody(), unexpected: true };

    await expect(parseChatRequest(createRequest(body))).rejects.toMatchObject({
      name: "ChatRequestError",
      message: "请求参数不正确",
      status: 400,
    } satisfies Partial<ChatRequestError>);
  });

  it("rejects oversized user messages", async () => {
    const body = validBody();
    body.messages[0].parts[0].text = "字".repeat(3001);

    await expect(parseChatRequest(createRequest(body))).rejects.toMatchObject({
      message: "单条消息最多 3000 个字符",
      status: 400,
    });
  });

  it("rejects unknown personas", async () => {
    const body = { ...validBody(), personaId: "unknown" };

    await expect(parseChatRequest(createRequest(body))).rejects.toMatchObject({
      message: "人设不存在",
      status: 400,
    });
  });

  it("reports malformed JSON", async () => {
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    await expect(parseChatRequest(request)).rejects.toMatchObject({
      message: "JSON 格式不正确",
      status: 400,
    });
  });
});
