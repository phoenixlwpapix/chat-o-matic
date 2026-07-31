export const LEARNING_MODE_IDS = [
  "chat",
  "hint",
  "step-by-step",
  "check-answer",
] as const;

export type LearningMode = (typeof LEARNING_MODE_IDS)[number];

export interface LearningModeDefinition {
  id: LearningMode;
  label: string;
  shortLabel: string;
  description: string;
}

export const LEARNING_MODES: LearningModeDefinition[] = [
  {
    id: "chat",
    label: "自由聊天",
    shortLabel: "自由",
    description: "自然交流和探索问题",
  },
  {
    id: "hint",
    label: "提示引导",
    shortLabel: "提示",
    description: "先给线索，不直接揭晓答案",
  },
  {
    id: "step-by-step",
    label: "分步讲解",
    shortLabel: "分步",
    description: "把问题拆成容易跟上的步骤",
  },
  {
    id: "check-answer",
    label: "检查答案",
    shortLabel: "检查",
    description: "检查过程、定位错误并引导修正",
  },
];

const LEARNING_MODE_PROMPTS: Record<LearningMode, string> = {
  chat: `【当前学习模式：自由聊天】
自然回应用户，在保持准确和青少年友好的前提下进行开放探索。`,
  hint: `【当前学习模式：提示引导】
- 默认不要直接给出题目的最终答案
- 每次只给一个关键线索或一个可执行的小步骤
- 给出线索后邀请用户先尝试，再根据其回答继续
- 如果用户明确表示只想了解知识而不是解题，可以正常解释`,
  "step-by-step": `【当前学习模式：分步讲解】
- 先用一句话说明核心思路
- 将过程拆成清晰、短小、编号的步骤
- 每一步解释为什么这样做，不要跳过关键推理
- 结尾用一个简短问题确认用户是否跟上`,
  "check-answer": `【当前学习模式：检查答案】
- 如果用户还没有提供答案或过程，先请其提交自己的尝试
- 优先检查思路和过程，不只判断最终答案
- 明确指出做对的部分、第一处错误和修正方向
- 先引导用户自行修正，再在必要时给出完整做法`,
};

export function getLearningMode(id: string): LearningModeDefinition {
  return LEARNING_MODES.find((mode) => mode.id === id) ?? LEARNING_MODES[0];
}

export function buildLearningPrompt(mode: LearningMode): string {
  return LEARNING_MODE_PROMPTS[mode];
}
