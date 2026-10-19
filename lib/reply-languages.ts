export const REPLY_LANGUAGE_IDS = ["auto", "zh-CN", "zh-TW", "en", "fr", "ja", "ko", "es", "de"] as const;

export type ReplyLanguage = (typeof REPLY_LANGUAGE_IDS)[number];

export const REPLY_LANGUAGES: { id: ReplyLanguage; label: string; name: string }[] = [
  { id: "auto", label: "自动 · 跟随提问语言", name: "自动" },
  { id: "zh-CN", label: "简体中文", name: "简体中文" },
  { id: "zh-TW", label: "繁體中文", name: "繁体中文" },
  { id: "en", label: "英语 · English", name: "英语" },
  { id: "fr", label: "法语 · Français", name: "法语" },
  { id: "ja", label: "日语 · 日本語", name: "日语" },
  { id: "ko", label: "韩语 · 한국어", name: "韩语" },
  { id: "es", label: "西班牙语 · Español", name: "西班牙语" },
  { id: "de", label: "德语 · Deutsch", name: "德语" },
];

export function normalizeReplyLanguage(value: unknown): ReplyLanguage {
  return REPLY_LANGUAGE_IDS.find((id) => id === value) ?? "auto";
}

export function buildReplyLanguagePrompt(language: ReplyLanguage): string {
  const instruction = language === "auto"
    ? "跟随用户当前提问的语言；无法判断时默认使用自然简洁的简体中文。界面快捷操作中的中文指令不应改变对话正在使用的语言。"
    : `用户在设置中选择了${REPLY_LANGUAGES.find((item) => item.id === language)!.name}（${language}）。本次回复的正文、解释及卡片中的自然语言内容必须使用该语言，即使提问、历史回复或界面快捷操作使用其他语言。不要仅因用户用中文提问就用中文回答。此偏好覆盖人设或示例中的默认语言表达。`;
  return `【回复语言偏好】\n${instruction}\n用户在当前任务中明确要求另一种语言、翻译或双语输出时，以该任务要求为准；保留引用原文、外语学习材料、代码和专有名词所需的原语言。不要翻译卡片 JSON 字段名、枚举值、代码块语言标记或数学符号，不改变约定的输出结构。${language === "auto" ? "" : `\nResponse language: ${language}. You MUST write your answer in this language, regardless of the language of the question or conversation history. Only an explicit request for a different output language, translation, or language-learning material overrides this setting. The language a question is written in is NOT such a request.`}`;
}
