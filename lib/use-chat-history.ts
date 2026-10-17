"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import {
  normalizeSessions,
  toggleSessionFavorite,
  upsertSession,
  getFirstExchange,
  updateSessionTitle,
  type ChatSession,
  type SessionPreferences,
  type StoredMessage,
} from "./chat-history";

export { toStoredMessages } from "./chat-history";
export type { ChatSession, StoredMessage } from "./chat-history";

const STORAGE_KEY = "chat-o-matic-history";
const HISTORY_CHANGE_EVENT = "chat-o-matic-history-change";
const EMPTY_SESSIONS: ChatSession[] = [];

let cachedRaw: string | null | undefined;
let cachedSessions = EMPTY_SESSIONS;

function readSessions(): ChatSession[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedSessions;

  cachedRaw = raw;
  if (!raw) {
    cachedSessions = EMPTY_SESSIONS;
    return cachedSessions;
  }

  try {
    cachedSessions = normalizeSessions(JSON.parse(raw));
  } catch {
    cachedSessions = EMPTY_SESSIONS;
  }
  return cachedSessions;
}

function getServerSessions(): ChatSession[] {
  return EMPTY_SESSIONS;
}

function subscribeToHistory(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(HISTORY_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(HISTORY_CHANGE_EVENT, onStoreChange);
  };
}

function writeSessions(sessions: ChatSession[]) {
  const raw = JSON.stringify(sessions);
  localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedSessions = sessions;
  window.dispatchEvent(new Event(HISTORY_CHANGE_EVENT));
}

export function useChatHistory() {
  const sessions = useSyncExternalStore(
    subscribeToHistory,
    readSessions,
    getServerSessions,
  );
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const titleRequests = useRef(new Set<string>());

  const summarizeSession = useCallback(async (id: string) => {
    const session = readSessions().find((item) => item.id === id);
    if (!session || session.titleGenerated || titleRequests.current.has(id)) return;
    const exchange = getFirstExchange(session.messages);
    if (!exchange) return;
    titleRequests.current.add(id);

    try {
      const response = await fetch("/api/chat/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exchange),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) return;
      const data: unknown = await response.json();
      if (
        typeof data !== "object" || data === null ||
        !("title" in data) || typeof data.title !== "string" ||
        !data.title.trim() || data.title.length > 30
      ) return;

      const currentSessions = readSessions();
      const nextSessions = updateSessionTitle(currentSessions, id, data.title.trim());
      if (nextSessions !== currentSessions) writeSessions(nextSessions);
    } catch {
      // Keep the fallback title; a later visit may retry without interrupting chat.
    }
  }, []);

  const saveSession = useCallback(
    (id: string, messages: StoredMessage[], preferences: SessionPreferences) => {
      const currentSessions = readSessions();
      const nextSessions = upsertSession(
        currentSessions,
        id,
        messages,
        preferences,
      );
      if (nextSessions !== currentSessions) writeSessions(nextSessions);
    },
    [],
  );

  const loadSession = useCallback((id: string): ChatSession | null => {
    return readSessions().find((session) => session.id === id) ?? null;
  }, []);

  const deleteSession = useCallback(
    (id: string) => {
      writeSessions(readSessions().filter((session) => session.id !== id));
      if (currentSessionId === id) setCurrentSessionId(null);
    },
    [currentSessionId],
  );

  const toggleFavorite = useCallback((id: string) => {
    const currentSessions = readSessions();
    const nextSessions = toggleSessionFavorite(currentSessions, id);
    if (nextSessions !== currentSessions) writeSessions(nextSessions);
  }, []);

  return {
    sessions,
    currentSessionId,
    setCurrentSessionId,
    saveSession,
    summarizeSession,
    loadSession,
    deleteSession,
    toggleFavorite,
  };
}
