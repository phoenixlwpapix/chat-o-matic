export const SEARCH_MODE_IDS = ["auto", "always", "off"] as const;

export type SearchMode = (typeof SEARCH_MODE_IDS)[number];

export interface SearchModeDefinition {
  id: SearchMode;
  label: string;
  shortLabel: string;
  description: string;
}

export const SEARCH_MODES: SearchModeDefinition[] = [
  {
    id: "auto",
    label: "自动联网",
    shortLabel: "自动",
    description: "需要最新资料时自动搜索",
  },
  {
    id: "always",
    label: "强制联网",
    shortLabel: "联网",
    description: "回答前先搜索并提供来源",
  },
  {
    id: "off",
    label: "关闭联网",
    shortLabel: "关闭",
    description: "仅使用模型已有知识回答",
  },
];

const SEARCH_MODE_PROMPTS: Record<SearchMode, string> = {
  auto: `【联网策略：自动】
仅在问题涉及最新信息、可核查事实或搜索能显著提升准确性时使用联网搜索。`,
  always: `【联网策略：强制联网】
回答本次问题前必须先使用 Google Search。回答应以搜索结果为依据，并保留可供用户核查的来源。`,
  off: `【联网策略：关闭】
本次回答不能使用联网搜索。遇到时效性或无法确认的信息，要明确说明知识可能不是最新，不要猜测。`,
};

export function getSearchMode(id: string): SearchModeDefinition {
  return SEARCH_MODES.find((mode) => mode.id === id) ?? SEARCH_MODES[0];
}

export function buildSearchPrompt(mode: SearchMode): string {
  return SEARCH_MODE_PROMPTS[mode];
}

export function isSearchEnabled(mode: SearchMode): boolean {
  return mode !== "off";
}

export function buildChatSystemPrompt(
  personaPrompt: string,
  learningPrompt: string,
  searchPrompt: string,
): string {
  return [personaPrompt, learningPrompt, searchPrompt].join("\n\n");
}
