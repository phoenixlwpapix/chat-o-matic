import type { UIMessage } from "ai";
import { normalizeMarkdown } from "./markdown";
import { parseChart } from "./charts";
import { parseQuizCard } from "./quizzes";
import { parseStoryChoices } from "./story-choices";
import { parseSentence } from "./sentences";

/** Only rendered, valid cards can remove a bubble; ordinary code and malformed JSON keep it. */
export function getMessageLayout(message: Pick<UIMessage, "role" | "parts">, isStreaming = false): "text" | "mixed" | "cards" | "compact-cards" {
  if (message.role !== "assistant") return "text";
  let cards = 0;
  let hasWideCard = false;
  let hasOtherContent = false;
  let hasPendingCard = false;
  for (const part of message.parts) {
    if (part.type === "file") hasOtherContent = true;
    if (part.type !== "text") continue;
    const text = normalizeMarkdown(part.text);
    if (isStreaming && /^[ \t]*(`{3,}|~{3,})(chart|quiz|sentence)[ \t]*\r?\n/m.test(text)) hasPendingCard = true;
    const remaining = text.replace(/^[ \t]*(`{3,}|~{3,})(chart|quiz|sentence|choice)[ \t]*\r?\n([\s\S]*?)^[ \t]*(`{3,}|~{3,})[ \t]*$/gm, (block: string, opening: string, language: string, raw: string, closing: string) => {
      if (opening[0] !== closing[0] || closing.length < opening.length) return block;
      const json = raw.replace(/\r\n/g, "\n").replace(/\n$/, "");
      const valid = language === "chart" ? parseChart(json) : language === "quiz" ? parseQuizCard(json) : language === "choice" ? parseStoryChoices(json) : parseSentence(json);
      if (!valid) return block;
      cards++;
      if (language !== "choice") hasWideCard = true;
      return "";
    });
    if (remaining.trim()) hasOtherContent = true;
  }
  if (hasWideCard || hasPendingCard) return cards && !hasOtherContent ? "cards" : "mixed";
  return cards && !hasOtherContent ? "compact-cards" : "text";
}
