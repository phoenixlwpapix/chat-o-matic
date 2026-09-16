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
  it("migrates legacy sessions to schema v3 defaults", () => {
    const sessions = normalizeSessions([
      {
        id: "legacy",
        title: "旧对话",
        messages,
        createdAt: 1,
        updatedAt: 2,
      },
    ]);

    expect(sessions[0]).toMatchObject({
      schemaVersion: 3,
      personaId: "default",
      searchMode: "auto",
      favoriteMessageIds: [],
    });
  });

  it("persists the selected persona when creating a session", () => {
    const sessions = upsertSession(
      [],
      "session-1",
      messages,
      {
        personaId: "mad-scientist",
        searchMode: "off",
      },
      100,
    );

    expect(sessions[0]).toMatchObject({
      id: "session-1",
      title: "黑洞是什么？",
      personaId: "mad-scientist",
      searchMode: "off",
      createdAt: 100,
      updatedAt: 100,
    });
  });

  it("restores and updates an existing session without changing creation time", () => {
    const existing: ChatSession = {
      schemaVersion: 3,
      id: "session-1",
      title: "旧标题",
      personaId: "default",
      searchMode: "auto",
      messages,
      favoriteMessageIds: ["message-1"],
      createdAt: 50,
      updatedAt: 75,
    };

    const sessions = upsertSession(
      [existing],
      "session-1",
      messages,
      {
        personaId: "philosophical-cat",
        searchMode: "always",
      },
      200,
    );

    expect(sessions[0]).toMatchObject({
      personaId: "philosophical-cat",
      searchMode: "always",
      favoriteMessageIds: ["message-1"],
      createdAt: 50,
      updatedAt: 200,
    });
  });

  it("keeps history order and timestamps unchanged when a session is only viewed", () => {
    const viewedSession: ChatSession = {
      schemaVersion: 3,
      id: "viewed-session",
      title: "黑洞是什么？",
      personaId: "default",
      searchMode: "auto",
      messages,
      favoriteMessageIds: [],
      createdAt: 25,
      updatedAt: 50,
    };
    const newerSession: ChatSession = {
      ...viewedSession,
      id: "newer-session",
      title: "更新的对话",
      createdAt: 75,
      updatedAt: 100,
    };
    const existingSessions = [newerSession, viewedSession];

    const sessions = upsertSession(
      existingSessions,
      "viewed-session",
      messages,
      { personaId: "default", searchMode: "auto" },
      200,
    );

    expect(sessions).toBe(existingSessions);
    expect(sessions.map((session) => session.id)).toEqual([
      "newer-session",
      "viewed-session",
    ]);
    expect(sessions[1].updatedAt).toBe(50);
  });
});
