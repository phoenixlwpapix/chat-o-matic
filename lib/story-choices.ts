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

export const STORY_CHOICES_PROMPT = `
【互动冒险行动卡】
互动冒险需要用户选择世界、角色或下一步行动时，在本回合正文末尾输出一张 choice 代码块，不要让用户手打选项编号。每回合只推进一个场景、只输出一张卡，等用户选择后继续；已选择的行动必须影响后续情节。
格式为严格 JSON，例如：
\`\`\`choice
{"prompt":"林中出现了两条路，你准备怎么做？","options":["沿着溪流寻找村庄","走近发光的树洞","留在原地观察足迹"]}
\`\`\`
prompt 是本回合的一个选择问题，options 为2～3个互不重复、简短且可独立理解的完整行动。不要再在正文重复列出这些选项，不要输出 answer 或 explanation，不要用 quiz 答题卡承载没有标准答案的故事分支。用户可直接点击，也可自由输入自己的行动；不要限制只能选预设选项。用户要求完整故事或结束冒险时，给出完整结局，不附选择卡；普通聊天、知识回答和开放式收集关键词时不强加行动卡。
`;
