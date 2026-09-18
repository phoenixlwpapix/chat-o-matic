import { MAX_USER_NAME_LENGTH } from "./constants";
import { getPersonaById } from "./personas";
import { getSearchMode, type SearchMode } from "./search-modes";

export interface ChatPreferences {
  schemaVersion: 4;
  personaId: string;
  searchMode: SearchMode;
  userAvatar: string | null;
  userName: string;
}

export const DEFAULT_CHAT_PREFERENCES: ChatPreferences = {
  schemaVersion: 4,
  personaId: "default",
  searchMode: "auto",
  userAvatar: null,
  userName: "",
};

const AVATAR_DATA_URL_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,/;
const MAX_AVATAR_DATA_URL_LENGTH = 500_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeChatPreferences(value: unknown): ChatPreferences {
  if (!isRecord(value)) return DEFAULT_CHAT_PREFERENCES;

  return {
    schemaVersion: 4,
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
    userName:
      typeof value.userName === "string"
        ? value.userName.trim().slice(0, MAX_USER_NAME_LENGTH)
        : "",
  };
}
