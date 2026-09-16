import { getPersonaById } from "./personas";
import { getSearchMode, type SearchMode } from "./search-modes";

export interface ChatPreferences {
  schemaVersion: 2;
  personaId: string;
  searchMode: SearchMode;
}

export const DEFAULT_CHAT_PREFERENCES: ChatPreferences = {
  schemaVersion: 2,
  personaId: "default",
  searchMode: "auto",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeChatPreferences(value: unknown): ChatPreferences {
  if (!isRecord(value)) return DEFAULT_CHAT_PREFERENCES;

  return {
    schemaVersion: 2,
    personaId: getPersonaById(
      typeof value.personaId === "string" ? value.personaId : "default",
    ).id,
    searchMode: getSearchMode(
      typeof value.searchMode === "string" ? value.searchMode : "auto",
    ).id,
  };
}
