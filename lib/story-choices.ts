import { z } from "zod";
import type { UIMessage } from "ai";

const storyChoicesSchema = z.object({
  prompt: z.string().trim().min(1).max(500),
  options: z.array(z.string().trim().min(1).max(300)).min(2).max(3),
}).strict().refine(({ options }) => new Set(options).size === options.length);

export function parseStoryChoices(raw: string) {
  if (raw.length > 4000) return null;
  try {
    const result = storyChoicesSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch { return null; }
}

export const buildStoryChoicePrompt = (option: string) => `我选择：${option}`;

/** The following user turn is the durable selection record; free input remains valid. */
export function getStoryChoiceReply(messages: UIMessage[], replyId: string): string | undefined {
  const index = messages.findIndex((message) => message.id === replyId);
  const next = index < 0 ? undefined : messages[index + 1];
  return next?.role === "user" ? next.parts.filter((part) => part.type === "text").map((part) => part.text).join("\n") : undefined;
}
