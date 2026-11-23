import { z } from "zod";

export const SENTENCE_ROLES = {
  subject: "主语", predicate: "谓语", object: "宾语", complement: "补语",
  modifier: "修饰语", clause: "从句", connector: "连接词", other: "其他成分",
} as const;

const sentenceSchema = z.object({
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
  // Models split phrases, not character offsets. Ignore only whitespace at chunk boundaries.
  const compact = (text: string) => text.replace(/\s/g, "");
  if (compact(sentence.chunks.map((chunk) => chunk.text).join("")) !== compact(sentence.sentence)) {
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

export const SENTENCE_PROMPT = `【句子拆解卡】
【自动触发】只要本轮任务是在解释、理解或分析某个英文句子的含义、结构或语法（例如“解释一下这句话 + 英文”“这句什么意思”“帮我理解这个长句”“翻译并解释”“分析句子结构”，或上下文中已给出该英文句且用户问“解释这句”），就主动输出一个 sentence 代码块作为主要回答，不需要用户再说“拆解”。正文只在必要时补一两句关键逻辑或语气说明，不在卡片外重复分点讲解，也不询问是否需要拆解。多句材料先选用户指定或最关键的一句，每次默认一张卡。
【不触发的情况】普通英文闲聊、单个词语释义、一般中文知识解释、出阅读题，以及互动故事或轻松吐槽中仅顺带引用英文台词/梗且用户未要求讲语法或句意时，不触发。用户明确要求“只翻译”“不要分析”“纯文字”时遵守其要求；已有拆解卡后仅追问某个片段、词义或讲简单些时直接聚焦回答，不重复整张卡。
严格 JSON 示例：
\`\`\`sentence
{"sentence":"The book that I bought yesterday is interesting.","translation":"我昨天买的那本书很有趣。","backbone":"The book is interesting.","chunks":[{"text":"The book","role":"subject","explanation":"主语，说明谈论的对象是那本书。"},{"text":"that I bought yesterday","role":"clause","explanation":"定语从句，修饰 book，说明是哪一本书；that 在从句中作 bought 的宾语。"},{"text":"is","role":"predicate","explanation":"系动词，连接主语和表语。"},{"text":"interesting.","role":"complement","explanation":"表语，说明这本书很有趣。"}],"vocabulary":[{"word":"interesting","meaning":"有趣的；这里用来描述书。"}]}
\`\`\`
- sentence 保留原句，不改写；chunks 按原文顺序完整覆盖句子，保留大小写和标点，不重叠、不省略，片段间空格可省略。按意群和语法结构适度切分（通常 3–8 块），不要逐个单词拆碎；复杂从句可作一块并在 explanation 中说明内部结构。
- role 只允许 subject、predicate、object、complement、modifier、clause、connector、other；使用当前回复语言解释成分在本句的具体作用，避免堆术语。backbone 提炼主干；translation 给自然译文；vocabulary 只解释必要关键词，可为空。句子与主干各最多 1200 字符、译文 1600 字符、片段 1–16 个、每段解释 1000 字符、词汇最多 8 个，整卡 JSON 最多 10000 字符。不输出 HTML、脚本或嵌套代码块。
- 对未提交的互动题或材料题组，仅分析已有文字、提供理解提示，不揭晓正确选项、不填写完形空位、不借语法拆解泄露答案；完整拆解若会泄题，先给不泄题的文字提示。`;
