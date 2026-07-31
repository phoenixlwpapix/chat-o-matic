"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_CHAT_PREFERENCES,
  normalizeChatPreferences,
  type ChatPreferences,
} from "./chat-preferences";
import type { LearningMode } from "./learning-modes";
import type { SearchMode } from "./search-modes";

const STORAGE_KEY = "chat-o-matic-preferences";
const PREFERENCES_CHANGE_EVENT = "chat-o-matic-preferences-change";

let cachedRaw: string | null | undefined;
let cachedPreferences = DEFAULT_CHAT_PREFERENCES;

function readPreferences(): ChatPreferences {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedPreferences;

  cachedRaw = raw;
  if (!raw) {
    cachedPreferences = DEFAULT_CHAT_PREFERENCES;
    return cachedPreferences;
  }

  try {
    cachedPreferences = normalizeChatPreferences(JSON.parse(raw));
  } catch {
    cachedPreferences = DEFAULT_CHAT_PREFERENCES;
  }
  return cachedPreferences;
}

function getServerPreferences(): ChatPreferences {
  return DEFAULT_CHAT_PREFERENCES;
}

function subscribeToPreferences(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(PREFERENCES_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(PREFERENCES_CHANGE_EVENT, onStoreChange);
  };
}

function writePreferences(preferences: ChatPreferences) {
  const raw = JSON.stringify(preferences);
  localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedPreferences = preferences;
  window.dispatchEvent(new Event(PREFERENCES_CHANGE_EVENT));
}

export function useChatPreferences() {
  const preferences = useSyncExternalStore(
    subscribeToPreferences,
    readPreferences,
    getServerPreferences,
  );

  const setLearningMode = useCallback((learningMode: LearningMode) => {
    writePreferences({ ...readPreferences(), learningMode });
  }, []);

  const setSearchMode = useCallback((searchMode: SearchMode) => {
    writePreferences({ ...readPreferences(), searchMode });
  }, []);

  return {
    learningMode: preferences.learningMode,
    searchMode: preferences.searchMode,
    setLearningMode,
    setSearchMode,
  } as const;
}
