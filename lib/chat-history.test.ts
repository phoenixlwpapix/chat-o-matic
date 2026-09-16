import { describe, expect, it } from "vitest";
import {
  normalizeSessions,
  toggleSessionFavorite,
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
  it("migrates legacy sessions to schema v4 defaults", () => {
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
      schemaVersion: 4,
      personaId: "default",
      searchMode: "auto",
      isFavorite: false,
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
      schemaVersion: 4,
      id: "session-1",
      title: "旧标题",
      personaId: "default",
      searchMode: "auto",
      isFavorite: false,
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
      schemaVersion: 4,
      id: "viewed-session",
      title: "黑洞是什么？",
      personaId: "default",
      searchMode: "auto",
      isFavorite: false,
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

  it("keeps favorite sessions when the history limit is exceeded", () => {
    const existingSessions: ChatSession[] = Array.from(
      { length: 20 },
      (_, index) => ({
        schemaVersion: 4,
        id: `session-${index}`,
        title: `对话 ${index}`,
        personaId: "default",
        searchMode: "auto",
        isFavorite: index === 0,
        messages,
        favoriteMessageIds: [],
        createdAt: index,
        updatedAt: index,
      }),
    ).toSorted((a, b) => b.updatedAt - a.updatedAt);

    const sessions = upsertSession(
      existingSessions,
      "new-session",
      [{ ...messages[0], id: "new-message" }],
      { personaId: "default", searchMode: "auto" },
      100,
    );

    expect(sessions).toHaveLength(20);
    expect(sessions.some((session) => session.id === "session-0")).toBe(true);
    expect(sessions.some((session) => session.id === "session-1")).toBe(false);
  });

  it("limits favorites to ten sessions and still allows unfavoriting", () => {
    const sessions: ChatSession[] = Array.from({ length: 11 }, (_, index) => ({
      schemaVersion: 4,
      id: `session-${index}`,
      title: `对话 ${index}`,
      personaId: "default",
      searchMode: "auto",
      isFavorite: index < 10,
      messages,
      favoriteMessageIds: [],
      createdAt: index,
      updatedAt: index,
    }));

    expect(toggleSessionFavorite(sessions, "session-10")).toBe(sessions);

    const withSpace = toggleSessionFavorite(sessions, "session-0");
    const updated = toggleSessionFavorite(withSpace, "session-10");
    expect(updated.find((session) => session.id === "session-0")?.isFavorite).toBe(false);
    expect(updated.find((session) => session.id === "session-10")?.isFavorite).toBe(true);
  });
});
