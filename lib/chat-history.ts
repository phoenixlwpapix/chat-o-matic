import type { TextUIPart, UIMessage } from "ai";
import { getSearchMode, type SearchMode } from "./search-modes";

const MAX_SESSIONS = 20;
export const MAX_FAVORITE_SESSIONS = 10;

export interface StoredTextPart {
  type: "text";
  text: string;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  parts: StoredTextPart[];
}

export interface ChatSession {
  schemaVersion: 4;
  id: string;
  title: string;
  personaId: string;
  searchMode: SearchMode;
  isFavorite: boolean;
  messages: StoredMessage[];
  favoriteMessageIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SessionPreferences {
  personaId: string;
  searchMode: SearchMode;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeMessages(value: unknown): StoredMessage[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((message) => {
    if (
      !isRecord(message) ||
      typeof message.id !== "string" ||
      (message.role !== "user" && message.role !== "assistant") ||
      !Array.isArray(message.parts)
    ) {
      return [];
    }

    const parts = message.parts.flatMap((part): StoredTextPart[] => {
      if (
        !isRecord(part) ||
        part.type !== "text" ||
        typeof part.text !== "string"
      ) {
        return [];
      }
      return [{ type: "text", text: part.text }];
    });

    return [{ id: message.id, role: message.role, parts }];
  });
}

/** Normalize persisted data and migrate sessions created before persona support. */
export function normalizeSessions(value: unknown): ChatSession[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((session): ChatSession[] => {
    if (
      !isRecord(session) ||
      typeof session.id !== "string" ||
      typeof session.title !== "string" ||
      typeof session.createdAt !== "number" ||
      typeof session.updatedAt !== "number"
    ) {
      return [];
    }

    const personaId =
      typeof session.personaId === "string" ? session.personaId : "default";
    return [
      {
        schemaVersion: 4,
        id: session.id,
        title: session.title,
        personaId,
        searchMode: getSearchMode(
          typeof session.searchMode === "string"
            ? session.searchMode
            : "auto",
        ).id,
        isFavorite: session.isFavorite === true,
        messages: normalizeMessages(session.messages),
        favoriteMessageIds: Array.isArray(session.favoriteMessageIds)
          ? session.favoriteMessageIds.filter(
              (id): id is string => typeof id === "string",
            )
          : [],
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    ];
  });
}

export function deriveTitle(messages: StoredMessage[]): string {
  const first = messages.find((message) => message.role === "user");
  if (!first) return "新对话";
  const text = first.parts.map((part) => part.text).join("");
  if (!text.trim()) return "图片对话";
  return text.slice(0, 30).trim();
}

/** Keep history small by omitting base64 image data. Active chats retain images. */
export function toStoredMessages(messages: UIMessage[]): StoredMessage[] {
  return messages.flatMap((message): StoredMessage[] => {
    if (message.role !== "user" && message.role !== "assistant") return [];
    const parts = message.parts
      .filter((part): part is TextUIPart => part.type === "text")
      .map((part) => ({ type: "text" as const, text: part.text }));
    return [{ id: message.id, role: message.role, parts }];
  });
}

function messagesAreEqual(
  first: StoredMessage[],
  second: StoredMessage[],
): boolean {
  if (first.length !== second.length) return false;

  return first.every((message, messageIndex) => {
    const otherMessage = second[messageIndex];
    if (
      message.id !== otherMessage.id ||
      message.role !== otherMessage.role ||
      message.parts.length !== otherMessage.parts.length
    ) {
      return false;
    }

    return message.parts.every(
      (part, partIndex) => part.text === otherMessage.parts[partIndex].text,
    );
  });
}

function trimSessions(sessions: ChatSession[]): ChatSession[] {
  if (sessions.length <= MAX_SESSIONS) return sessions;

  const removeIds = new Set<string>();
  let remaining = sessions.length - MAX_SESSIONS;

  for (let index = sessions.length - 1; index >= 0 && remaining > 0; index--) {
    if (!sessions[index].isFavorite) {
      removeIds.add(sessions[index].id);
      remaining -= 1;
    }
  }

  for (let index = sessions.length - 1; index >= 0 && remaining > 0; index--) {
    if (!removeIds.has(sessions[index].id)) {
      removeIds.add(sessions[index].id);
      remaining -= 1;
    }
  }

  return sessions.filter((session) => !removeIds.has(session.id));
}

export function toggleSessionFavorite(
  sessions: ChatSession[],
  id: string,
): ChatSession[] {
  const session = sessions.find((item) => item.id === id);
  if (!session) return sessions;

  const favoriteCount = sessions.filter((item) => item.isFavorite).length;
  if (!session.isFavorite && favoriteCount >= MAX_FAVORITE_SESSIONS) {
    return sessions;
  }

  return sessions.map((item) =>
    item.id === id ? { ...item, isFavorite: !item.isFavorite } : item,
  );
}

export function upsertSession(
  sessions: ChatSession[],
  id: string,
  messages: StoredMessage[],
  preferences: SessionPreferences,
  now = Date.now(),
): ChatSession[] {
  if (messages.length === 0) return sessions;

  const existing = sessions.find((session) => session.id === id);
  if (
    existing &&
    existing.personaId === preferences.personaId &&
    existing.searchMode === preferences.searchMode &&
    messagesAreEqual(existing.messages, messages)
  ) {
    return sessions;
  }

  const nextSession: ChatSession = {
    schemaVersion: 4,
    id,
    title: deriveTitle(messages),
    ...preferences,
    messages,
    isFavorite: existing?.isFavorite ?? false,
    favoriteMessageIds: existing?.favoriteMessageIds ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const sortedSessions = [
    nextSession,
    ...sessions.filter((session) => session.id !== id),
  ].toSorted((a, b) => b.updatedAt - a.updatedAt);

  return trimSessions(sortedSessions);
}
