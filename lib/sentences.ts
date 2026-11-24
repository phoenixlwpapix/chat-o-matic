import { z } from "zod";

export const SENTENCE_ROLES = {
  subject: "主语", predicate: "谓语", object: "宾语", complement: "补语",
  modifier: "修饰语", clause: "从句", connector: "连接词", other: "其他成分",
} as const;

const WORD_PATTERN = /[\p{L}\p{N}]+/gu;

function extractWords(text: string): string[] {
  return text.toLowerCase().match(WORD_PATTERN) ?? [];
}

function isSingleCharTypo(a: string, b: string): boolean {
  if (a === b) return true;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen < 3 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Verify chunks cover the sentence in order while tolerating boundary punctuation,
 * casing, and occasional 1-char typo autocorrection (e.g. "Theses" -> "These"). */
function chunksMatchSentence(sentence: string, chunks: { text: string }[]): boolean {
  const expected = extractWords(sentence);
  const actual = extractWords(chunks.map((chunk) => chunk.text).join(" "));
  if (!expected.length) {
    const compact = (text: string) => text.replace(/\s/g, "");
    return compact(chunks.map((chunk) => chunk.text).join("")) === compact(sentence);
  }
  if (expected.join("") === actual.join("")) return true;
  if (expected.length !== actual.length) return false;
  let typoCount = 0;
  const maxTypos = Math.min(3, Math.max(1, Math.floor(expected.length * 0.15)));
  for (let index = 0; index < expected.length; index++) {
    if (expected[index] === actual[index]) continue;
    if (!isSingleCharTypo(expected[index], actual[index])) return false;
    if (++typoCount > maxTypos) return false;
  }
  return true;
}

export const sentenceSchema = z.object({
  label: z.string().trim().min(1).max(60).optional(),
  sentence: z.string().trim().min(1).max(1200),
  translation: z.string().trim().min(1).max(1600),
  backbone: z.string().trim().min(1).max(1200),
  chunks: z.array(z.object({
    text: z.string().trim().min(1).max(1200),
    role: z.enum(["subject", "predicate", "object", "complement", "modifier", "clause", "connector", "other"]),
    explanation: z.string().trim().min(1).max(1000),
  }).strict()).min(1).max(16),
  vocabulary: z.array(z.object({ word: z.string().trim().min(1).max(100), meaning: z.string().trim().min(1).max(300) }).strict()).max(8).default([]),
}).strict().superRefine((sentence, ctx) => {
  if (!chunksMatchSentence(sentence.sentence, sentence.chunks)) {
    ctx.addIssue({ code: "custom", message: "拆解片段必须按原文顺序完整覆盖句子，不能改写或省略" });
  }
});

export type SentenceSpec = z.infer<typeof sentenceSchema>;

export function parseSentence(raw: string): SentenceSpec | null {
  if (raw.length > 10_000) return null;
  try {
    const result = sentenceSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch { return null; }
}

/** Extract the raw sentence text even from a partially invalid JSON draft for retry prompts. */
export function extractDraftSentenceText(raw: string): string | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "sentence" in parsed && typeof parsed.sentence === "string" && parsed.sentence.trim()) {
      return parsed.sentence.trim().slice(0, 600);
    }
  } catch { /* ignore malformed JSON */ }
  return null;
}

export const SENTENCE_PROMPT = `【句子拆解卡】
【自动触发】只要本轮任务是在解释、理解或分析某个英文句子的含义、结构或语法（例如“解释一下这句话 + 英文”“这句什么意思”“帮我理解这个长句”“翻译并解释”“分析句子结构”，或上下文中已给出该英文句且用户问“解释这句”），就主动输出 sentence 代码块作为主要回答，不需要用户再说“拆解”。正文只在必要时补一两句整句大意、分句逻辑或笔误提醒，不在卡片外重复分点讲解，也不询问是否需要拆解。多句材料先选用户指定或最关键的一句。
【长难句分步拆解】较短的句子用 1 张 sentence 卡片；遇到超过约 20 个词或含多个并列/复合分句的长难句（如由 , but / , and / ; / although 等连接），先在卡片外用 1–2 句说明整句逻辑和分句关系，再按分句顺次输出 2–3 张较短的 sentence 卡片（每张只拆一个分句，可选填写 label 如“前半句 · 原因”“后半句 · 转折”），每张 3–6 个语块，更易读也更准确。
【不触发的情况】普通英文闲聊、单个词语释义、一般中文知识解释、出阅读题，以及互动故事或轻松吐槽中仅顺带引用英文台词/梗且用户未要求讲语法或句意时，不触发。用户明确要求“只翻译”“不要分析”“纯文字”时遵守其要求；已有拆解卡后仅追问某个片段、词义或讲简单些时直接聚焦回答，不重复整张卡。
严格 JSON 示例：
\`\`\`sentence
{"sentence":"The book that I bought yesterday is interesting.","translation":"我昨天买的那本书很有趣。","backbone":"The book is interesting.","chunks":[{"text":"The book","role":"subject","explanation":"主语，说明谈论的对象是那本书。"},{"text":"that I bought yesterday","role":"clause","explanation":"定语从句，修饰 book，说明是哪一本书；that 在从句中作 bought 的宾语。"},{"text":"is","role":"predicate","explanation":"系动词，连接主语和表语。"},{"text":"interesting.","role":"complement","explanation":"表语，说明这本书很有趣。"}],"vocabulary":[{"word":"interesting","meaning":"有趣的；这里用来描述书。"}]}
\`\`\`
- sentence 与 chunks 必须严格使用同一拼写：若原句有明显拼写笔误（如 Theses、non），可在正文顺带提醒正确写法，但在卡片内 sentence 和 chunks 须保持一致，绝不能一个改错、一个保留原拼写。
- chunks 按原文顺序完整覆盖 sentence 的全部单词，不重叠、不省略。按意群和语法结构适度切分（通常 3–8 块），不要逐个单词拆碎；复杂从句可作一块并在 explanation 中说明内部结构。
- role 只允许 subject、predicate、object、complement、modifier、clause、connector、other；使用当前回复语言解释成分在本句的具体作用，避免堆术语。backbone 提炼主干；translation 给自然译文；vocabulary 只解释必要关键词，可为空。label 可选（最多 60 字），句子与主干各最多 1200 字符、译文 1600 字符、片段 1–16 个、每段解释 1000 字符、词汇最多 8 个，单卡 JSON 最多 10000 字符。不输出 HTML、脚本或嵌套代码块。
- 对未提交的互动题或材料题组，仅分析已有文字、提供理解提示，不揭晓正确选项、不填写完形空位、不借语法拆解泄露答案；完整拆解若会泄题，先给不泄题的文字提示。`;
