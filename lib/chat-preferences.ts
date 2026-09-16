import { getPersonaById } from "./personas";
import { getSearchMode, type SearchMode } from "./search-modes";

export interface ChatPreferences {
  schemaVersion: 3;
  personaId: string;
  searchMode: SearchMode;
  userAvatar: string | null;
}

export const DEFAULT_CHAT_PREFERENCES: ChatPreferences = {
  schemaVersion: 3,
  personaId: "default",
  searchMode: "auto",
  userAvatar: null,
};

const AVATAR_DATA_URL_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,/;
const MAX_AVATAR_DATA_URL_LENGTH = 500_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeChatPreferences(value: unknown): ChatPreferences {
  if (!isRecord(value)) return DEFAULT_CHAT_PREFERENCES;

  return {
    schemaVersion: 3,
    personaId: getPersonaById(
      typeof value.personaId === "string" ? value.personaId : "default",
    ).id,
    searchMode: getSearchMode(
      typeof value.searchMode === "string" ? value.searchMode : "auto",
    ).id,
    userAvatar:
      typeof value.userAvatar === "string" &&
      value.userAvatar.length <= MAX_AVATAR_DATA_URL_LENGTH &&
      AVATAR_DATA_URL_PATTERN.test(value.userAvatar)
        ? value.userAvatar
        : null,
  };
}
