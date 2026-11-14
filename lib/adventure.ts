import type { UIMessage } from "ai";
import { z } from "zod";
import { buildStoryChoicePrompt } from "./story-choices";

export const ADVENTURE_PERSONA_ID = "adventure-master";
export const ADVENTURE_SURFACE_ID = "adventure";
export const ADVENTURE_SCENE_PATH = "/scene";
export const ADVENTURE_CATALOG_ID = "a2ui://chat-o-matic/adventure/v1";
export const ADVENTURE_PART_TYPE = "data-adventure";

const distinct = (values: string[]) => new Set(values).size === values.length;
const notes = z.array(z.string().trim().min(1).max(100)).max(6).refine(distinct);
const actions = z.array(z.string().trim().min(1).max(80)).max(3).refine(distinct);

export const adventureStateSchema = z.object({
  location: z.string().trim().min(1).max(80),
  inventory: notes,
  clues: notes,
  actions,
  ended: z.boolean(),
}).strict().refine(({ ended, actions }) => ended ? actions.length === 0 : actions.length >= 2);

export const adventureUpdateSchema = z.object({
  version: z.literal("1.0"),
  updateDataModel: z.object({
    surfaceId: z.literal(ADVENTURE_SURFACE_ID),
    path: z.literal(ADVENTURE_SCENE_PATH),
    value: adventureStateSchema,
  }).strict(),
}).strict();

export type AdventureState = z.infer<typeof adventureStateSchema>;
export type AdventureUpdate = z.infer<typeof adventureUpdateSchema>;
export type AdventurePart = { type: typeof ADVENTURE_PART_TYPE; data: AdventureUpdate };

export function createAdventureUpdate(value: AdventureState): AdventureUpdate {
  return { version: "1.0", updateDataModel: { surfaceId: ADVENTURE_SURFACE_ID, path: ADVENTURE_SCENE_PATH, value } };
}

export function readAdventurePart(part: unknown): AdventurePart | undefined {
  if (!part || typeof part !== "object" || !("type" in part) || part.type !== ADVENTURE_PART_TYPE || !("data" in part)) return;
  const result = adventureUpdateSchema.safeParse(part.data);
  if (result.success) return { type: ADVENTURE_PART_TYPE, data: result.data };
}

export function getLatestAdventure(messages: UIMessage[]) {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message.role !== "assistant") continue;
    const part = readAdventurePart(message.parts.find((item) => item.type === ADVENTURE_PART_TYPE));
    if (part) return { messageId: message.id, update: part.data };
  }
}

export function getSelectedAdventureAction(message: UIMessage | undefined, state: AdventureState) {
  const part = message?.parts[0];
  if (message?.role !== "user" || message.parts.length !== 1 || part?.type !== "text" || state.ended) return;
  return state.actions.find((action) => buildStoryChoicePrompt(action) === part.text);
}

export function withAdventureContext(messages: UIMessage[], personaId: string): UIMessage[] {
  const latest = personaId === ADVENTURE_PERSONA_ID ? getLatestAdventure(messages) : undefined;
  if (!latest) return messages;
  return messages.map((message) => message.id === latest.messageId ? {
    ...message,
    parts: [...message.parts, {
      type: "text",
      text: `\n\n【上一回合的探索面板】\n${JSON.stringify(latest.update.updateDataModel.value)}`,
    }],
  } : message);
}

export const ADVENTURE_PROMPT = `
【互动冒险探索面板】
用户要玩分支冒险、探索场景、闯地牢等互动故事时，每回合只推进一个场景，然后在整条回复末尾附一个 adventure 代码块。用户可以点行动选项，也可以直接输入自己的行动，两种方式都按用户的决定推进故事。若故事尚未正式开场，地点可填“冒险准备”，行动可用来选择世界或角色。
围栏开头一行只写三个反引号和 adventure，换行后写严格 JSON，末尾另起一行用三个反引号结束。例：
\`\`\`adventure
{"location":"海底研究站·气闸室","inventory":["手电筒"],"clues":[],"actions":["检查控制台","查看观察窗"],"ended":false}
\`\`\`
每次都给出完整的最新状态：location 是当前地点；inventory 是玩家当前持有的物品，使用、交出或遗失后按剧情更新；clues 只记已经发现的关键线索，不揭晓谜底；inventory 和 clues 各最多6项、每项最多100字，无内容时用空数组。actions 是当前 2～3 项不同的具体行动，每项最多80字，正文不再重复列出。字段内容跟随回复语言，字段名保持原样。
用户从面板选择了行动时，必须在剧情后更新面板，即使地点、背包与线索没有变化，也要给出当前场景适用的下一步行动。
冒险已明确结束时，给出结局，保留最后的地点、物品、线索，actions 用空数组且 ended 为 true。用户单独要求完整故事、普通聊天、知识回答或开放式收集故事素材时，不输出面板。基于已有行动卡恢复的冒险也采用此格式。不要为同一回合再输出 choice 或 quiz 代码块；用户单独要求有标准答案的练习时可使用 quiz。
`;
