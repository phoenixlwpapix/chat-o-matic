import { getLearningMode, type LearningMode } from "./learning-modes";
import { getSearchMode, type SearchMode } from "./search-modes";

export interface ChatPreferences {
  schemaVersion: 1;
  learningMode: LearningMode;
  searchMode: SearchMode;
}

export const DEFAULT_CHAT_PREFERENCES: ChatPreferences = {
  schemaVersion: 1,
  learningMode: "chat",
  searchMode: "auto",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeChatPreferences(value: unknown): ChatPreferences {
  if (!isRecord(value)) return DEFAULT_CHAT_PREFERENCES;

  return {
    schemaVersion: 1,
    learningMode: getLearningMode(
      typeof value.learningMode === "string" ? value.learningMode : "chat",
    ).id,
    searchMode: getSearchMode(
      typeof value.searchMode === "string" ? value.searchMode : "auto",
    ).id,
  };
}
