import type { TextUIPart, UIMessage } from "ai";
import {
  getLearningMode,
  type LearningMode,
} from "./learning-modes";
import { getSearchMode, type SearchMode } from "./search-modes";

const MAX_SESSIONS = 10;

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
  schemaVersion: 2;
  id: string;
  title: string;
  personaId: string;
  learningMode: LearningMode;
  searchMode: SearchMode;
  messages: StoredMessage[];
  favoriteMessageIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SessionPreferences {
  personaId: string;
  learningMode: LearningMode;
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

    return [
      {
        schemaVersion: 2,
        id: session.id,
        title: session.title,
        personaId:
          typeof session.personaId === "string"
            ? session.personaId
            : "default",
        learningMode: getLearningMode(
          typeof session.learningMode === "string"
            ? session.learningMode
            : "chat",
        ).id,
        searchMode: getSearchMode(
          typeof session.searchMode === "string"
            ? session.searchMode
            : "auto",
        ).id,
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

export function upsertSession(
  sessions: ChatSession[],
  id: string,
  messages: StoredMessage[],
  preferences: SessionPreferences,
  now = Date.now(),
): ChatSession[] {
  if (messages.length === 0) return sessions;

  const existing = sessions.find((session) => session.id === id);
  const nextSession: ChatSession = {
    schemaVersion: 2,
    id,
    title: deriveTitle(messages),
    ...preferences,
    messages,
    favoriteMessageIds: existing?.favoriteMessageIds ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  return [nextSession, ...sessions.filter((session) => session.id !== id)]
    .toSorted((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SESSIONS);
}
