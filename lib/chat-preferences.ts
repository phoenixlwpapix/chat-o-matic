import { MAX_USER_NAME_LENGTH } from "./constants";
import { normalizeChatFont, normalizeChatFontSize, type ChatFont, type ChatFontSize } from "./chat-typography";
import { getPersonaById } from "./personas";
import { getSearchMode, type SearchMode } from "./search-modes";
import { normalizeReplyLanguage, type ReplyLanguage } from "./reply-languages";

export interface ChatPreferences {
  schemaVersion: 5;
  personaId: string;
  searchMode: SearchMode;
  replyLanguage: ReplyLanguage;
  userAvatar: string | null;
  userName: string;
  chatFont: ChatFont;
  chatFontSize: ChatFontSize;
}

export const DEFAULT_CHAT_PREFERENCES: ChatPreferences = {
  schemaVersion: 5,
  personaId: "default",
  searchMode: "auto",
  replyLanguage: "auto",
  userAvatar: null,
  userName: "",
  chatFont: "default",
  chatFontSize: 16,
};

const AVATAR_DATA_URL_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,/;
const MAX_AVATAR_DATA_URL_LENGTH = 500_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeChatPreferences(value: unknown): ChatPreferences {
  if (!isRecord(value)) return DEFAULT_CHAT_PREFERENCES;

  return {
    schemaVersion: 5,
    replyLanguage: normalizeReplyLanguage(value.replyLanguage),
    chatFont: normalizeChatFont(value.chatFont),
    chatFontSize: normalizeChatFontSize(value.chatFontSize),
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
