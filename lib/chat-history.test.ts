import { describe, expect, it } from "vitest";
import {
  normalizeSessions,
  upsertSession,
  type ChatSession,
  type StoredMessage,
} from "./chat-history";

const messages: StoredMessage[] = [
  {
    id: "message-1",
    role: "user",
    parts: [{ type: "text", text: "黑洞是什么？" }],
  },
];

describe("chat history", () => {
  it("migrates legacy sessions to the default persona", () => {
    const sessions = normalizeSessions([
      {
        id: "legacy",
        title: "旧对话",
        messages,
        createdAt: 1,
        updatedAt: 2,
      },
    ]);

    expect(sessions[0].personaId).toBe("default");
  });

  it("persists the selected persona when creating a session", () => {
    const sessions = upsertSession(
      [],
      "session-1",
      messages,
      "mad-scientist",
      100,
    );

    expect(sessions[0]).toMatchObject({
      id: "session-1",
      title: "黑洞是什么？",
      personaId: "mad-scientist",
      createdAt: 100,
      updatedAt: 100,
    });
  });

  it("restores and updates an existing session without changing creation time", () => {
    const existing: ChatSession = {
      id: "session-1",
      title: "旧标题",
      personaId: "default",
      messages,
      createdAt: 50,
      updatedAt: 75,
    };

    const sessions = upsertSession(
      [existing],
      "session-1",
      messages,
      "philosophical-cat",
      200,
    );

    expect(sessions[0]).toMatchObject({
      personaId: "philosophical-cat",
      createdAt: 50,
      updatedAt: 200,
    });
  });
});
