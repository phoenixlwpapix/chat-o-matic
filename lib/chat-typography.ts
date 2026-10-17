export const CHAT_FONTS = {
  default: { label: "默认字体", family: 'var(--font-noto-sans-sc), "PingFang SC", "Microsoft YaHei", sans-serif' },
  system: { label: "系统字体", family: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  serif: { label: "宋体风格", family: '"Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", serif' },
} as const;

export type ChatFont = keyof typeof CHAT_FONTS;
export const CHAT_FONT_SIZES = [14, 16, 18, 20] as const;
export type ChatFontSize = (typeof CHAT_FONT_SIZES)[number];

export function normalizeChatFont(value: unknown): ChatFont {
  return value === "system" || value === "serif" ? value : "default";
}

export function normalizeChatFontSize(value: unknown): ChatFontSize {
  return CHAT_FONT_SIZES.find((size) => size === value) ?? 16;
}
