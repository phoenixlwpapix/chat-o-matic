import type { UIMessage } from "ai";
import { getSearchMode, type SearchMode } from "./search-modes";
import { getSearchSummary, readSearchSummary, type SearchSummary } from "./search-sources";
import { readQuizAnswers, type QuizAnswer } from "./quizzes";
import { ADVENTURE_PART_TYPE, ADVENTURE_PERSONA_ID, readAdventurePart, type AdventurePart } from "./adventure";
import { createAdventureDraftReader } from "./adventure-draft";

const MAX_SESSIONS = 100;
export const MAX_FAVORITE_SESSIONS = 10;

export interface StoredTextPart {
  type: "text";
  text: string;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  parts: (StoredTextPart | AdventurePart)[];
  metadata?: { search?: SearchSummary; quizAnswers?: QuizAnswer[] };
}

export interface ChatSession {
  schemaVersion: 4;
  id: string;
  title: string;
  titleGenerated?: boolean;
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

function normalizeMessages(value: unknown, personaId: string): StoredMessage[] {
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

    const parts = message.parts.flatMap((part): StoredMessage["parts"] => {
      const card = message.role === "assistant" ? readAdventurePart(part) : undefined;
      if (card) return [card];
      if (
        !isRecord(part) ||
        part.type !== "text" ||
        typeof part.text !== "string"
      ) {
        return [];
      }
      return [{ type: "text", text: part.text }];
    });

    const search = message.role === "assistant" ? readSearchSummary(message.metadata) : undefined;
    const quizAnswers = message.role === "assistant" ? readQuizAnswers(message.metadata) : [];
    const restoredParts = personaId === ADVENTURE_PERSONA_ID && message.role === "assistant" ? restoreAdventureDraft(parts) : parts;
    return [{ id: message.id, role: message.role, parts: restoredParts, ...((search || quizAnswers.length) ? { metadata: { ...(search ? { search } : {}), ...(quizAnswers.length ? { quizAnswers } : {}) } } : {}) }];
  });
}

function restoreAdventureDraft(parts: StoredMessage["parts"]): StoredMessage["parts"] {
  if (parts.some((part) => part.type === ADVENTURE_PART_TYPE)) return parts;
  const index = parts.findLastIndex((part) => part.type === "text" && /(?:`{3,}|~{3,})adventure/i.test(part.text));
  const part = parts[index];
  if (!part || part.type !== "text") return parts;
  const reader = createAdventureDraftReader();
  const visible = reader.push(part.text);
  const result = reader.finish();
  if (!result.found) return parts;
  return [
    ...parts.slice(0, index),
    { ...part, text: visible + result.text },
    ...parts.slice(index + 1),
    ...(result.update ? [{ type: ADVENTURE_PART_TYPE, data: result.update } as const] : []),
  ];
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
        titleGenerated: session.titleGenerated === true,
        personaId,
        searchMode: getSearchMode(
          typeof session.searchMode === "string"
            ? session.searchMode
            : "auto",
        ).id,
        isFavorite: session.isFavorite === true,
        messages: normalizeMessages(session.messages, personaId),
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
  const text = storedText(first);
  if (!text.trim()) return "图片对话";
  return text.slice(0, 30).trim();
}

function storedText(message: StoredMessage) {
  return message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
}

/** Only the first user turn and its answer determine the conversation topic. */
export function getFirstExchange(messages: StoredMessage[]) {
  const userIndex = messages.findIndex((message) => message.role === "user");
  if (userIndex < 0) return null;
  const user = messages[userIndex];
  const assistant = messages[userIndex + 1];
  if (assistant?.role !== "assistant") return null;
  const answer = storedText(assistant).trim();
  if (!answer) return null;
  return {
    question: storedText(user).trim() || "（用户发送了一张图片，请根据回答概括主题）",
    answer: answer.slice(0, 6000),
  };
}

/** A background title must not reorder history or resurrect a deleted session. */
export function updateSessionTitle(
  sessions: ChatSession[],
  id: string,
  title: string,
): ChatSession[] {
  if (!sessions.some((session) => session.id === id && !session.titleGenerated)) {
    return sessions;
  }
  return sessions.map((session) =>
    session.id === id ? { ...session, title, titleGenerated: true } : session,
  );
}

/** Keep history small by omitting base64 image data. Active chats retain images. */
export function toStoredMessages(messages: UIMessage[]): StoredMessage[] {
  return messages.flatMap((message): StoredMessage[] => {
    if (message.role !== "user" && message.role !== "assistant") return [];
    const parts = message.parts.flatMap((part): StoredMessage["parts"] => {
      if (part.type === "text") return [{ type: "text", text: part.text }];
      const card = message.role === "assistant" ? readAdventurePart(part) : undefined;
      return card ? [card] : [];
    });
    const search = message.role === "assistant" ? getSearchSummary(message.parts, message.metadata) : undefined;
    const quizAnswers = message.role === "assistant" ? readQuizAnswers(message.metadata) : [];
    return [{ id: message.id, role: message.role, parts, ...((search || quizAnswers.length) ? { metadata: { ...(search ? { search } : {}), ...(quizAnswers.length ? { quizAnswers } : {}) } } : {}) }];
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
      message.metadata?.search?.sourceCount !== otherMessage.metadata?.search?.sourceCount ||
      JSON.stringify(message.metadata?.quizAnswers) !== JSON.stringify(otherMessage.metadata?.quizAnswers) ||
      message.parts.length !== otherMessage.parts.length
    ) {
      return false;
    }

    return message.parts.every(
      (part, partIndex) => {
        const other = otherMessage.parts[partIndex];
        if (part.type === "text") return other.type === "text" && part.text === other.text;
        return other.type === part.type && JSON.stringify(part.data) === JSON.stringify(other.data);
      },
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
    title: existing?.titleGenerated ? existing.title : deriveTitle(messages),
    titleGenerated: existing?.titleGenerated ?? false,
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
