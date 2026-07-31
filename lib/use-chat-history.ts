"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import {
  normalizeSessions,
  upsertSession,
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

  const saveSession = useCallback(
    (id: string, messages: StoredMessage[], preferences: SessionPreferences) => {
      writeSessions(upsertSession(readSessions(), id, messages, preferences));
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

  return {
    sessions,
    currentSessionId,
    setCurrentSessionId,
    saveSession,
    loadSession,
    deleteSession,
  };
}
