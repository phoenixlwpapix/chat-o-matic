import { z } from "zod";
import type { UIMessage } from "ai";
import { normalizeMarkdown } from "./markdown";
import { normalizeLegacyQuizRaw } from "./legacy-quiz-markdown";

export const quizSchema = z.object({
  type: z.enum(["single", "multiple", "boolean"]),
  question: z.string().trim().min(1).max(2000),
  options: z.array(z.string().trim().min(1).max(500)).min(2).max(6),
  answer: z.array(z.number().int().min(0).max(5)).min(1).max(6),
  explanation: z.string().trim().min(1).max(3000),
}).strict().superRefine((quiz, ctx) => {
  if (new Set(quiz.options).size !== quiz.options.length ||
      new Set(quiz.answer).size !== quiz.answer.length ||
      quiz.answer.some((index) => index >= quiz.options.length) ||
      (quiz.type !== "multiple" && quiz.answer.length !== 1) ||
      (quiz.type === "boolean" && (quiz.options.length !== 2 || quiz.options[0] !== "正确" || quiz.options[1] !== "错误"))) {
    ctx.addIssue({ code: "custom", message: "题目选项或答案不合法" });
  }
});

export type QuizSpec = z.infer<typeof quizSchema>;
export const quizGroupSchema = z.object({
  type: z.enum(["reading", "cloze"]),
  passage: z.string().trim().min(1).max(3000),
  questions: z.array(quizSchema).min(1).max(6),
}).strict().superRefine((group, ctx) => {
  if (group.type !== "cloze") return;
  const blanks = Array.from(group.passage.matchAll(/\[(\d+)\]/g), (match) => Number(match[1]));
  if (group.questions.some((question) => question.type !== "single") ||
      blanks.length !== group.questions.length || group.questions.some((_, index) => !blanks.includes(index + 1))) {
    ctx.addIssue({ code: "custom", message: "完形填空须有对应的连续编号空位，每空一道单选题" });
  }
});
export type QuizGroup = z.infer<typeof quizGroupSchema>;
export type QuizCard = QuizSpec | QuizGroup;
export const quizCardSchema = z.union([quizSchema, quizGroupSchema]);
export function getQuizItems(card: QuizCard): QuizSpec[] {
  return "questions" in card ? card.questions : [card];
}
const answerSchema = z.object({
  key: z.string().max(80),
  raw: z.string().max(10_000),
  selected: z.array(z.number().int().min(0).max(5)).max(6),
  selections: z.array(z.array(z.number().int().min(0).max(5)).min(1).max(6)).min(1).max(6).optional(),
}).strict();
export type QuizAnswer = z.infer<typeof answerSchema>;

export function matchesQuizRaw(raw: string, savedRaw: string): boolean {
  return raw === savedRaw || normalizeLegacyQuizRaw(raw) === savedRaw;
}

export const QUIZ_FOLLOW_UP_PROMPTS = {
  simplifyExplanation: "能把刚才的解析讲得更简单一点吗？",
  easier: "换一道简单一点的题",
  harder: "换一道难一点的题",
  next: "再来一题",
  explain: "帮我讲讲这道题的思路和我的选择",
  explainGroup: "帮我讲讲这组题，重点分析错题",
} as const;

export const LEGACY_QUIZ_FOLLOW_UP_PROMPTS = {
  simplifyExplanation: "请把刚才这道题的解析讲得更简单一些，一次只讲一个重点，保留必要的解题步骤；只简化讲解，不出新题。",
  easier: "请在我指定的练习范围内，重新出难度更低的 quiz 练习，不是简化上一题讲解。普通练习一道；阅读理解或完形填空一篇材料配默认3道小题，整组提交，遵守我明确指定的小题数。数学减少推理步骤；英语降低词汇和句法难度，文章更短、线索更直接。新一组默认换新材料，明确要求同一材料时才保留；组内共用材料。不要讲解旧题，不在提交前公布答案。",
  harder: "请在我指定的练习范围内，重新出难度略高的 quiz 练习，不是把上一题的讲解变复杂。普通练习一道；阅读理解或完形填空一篇材料配默认3道小题，整组提交，遵守我明确指定的小题数。数学适当增加推理步骤；英语提高词汇、句法或理解要求，不超出已知学习阶段。新一组默认换新材料，明确要求同一材料时才保留；组内共用材料。不要讲解旧题，不在提交前公布答案。",
  next: "请在我指定的练习范围内，保持相近难度，直接继续新的 quiz 练习。普通练习只出一道新题；阅读理解或完形填空出下一组：一篇材料配默认3道小题，整组提交，遵守我明确指定的小题数。回看最初主题与后续调整，不把上一题的子考点当作全部范围；轮换考点、解题思路与情境，不只换数字或名字。下一组默认换新文章，明确要求同一材料时才保留；组内必须共用文章。即使之前约定题数已完成，这次点击也表示我主动追加一题（材料题为追加一组）。无论之前对错，都直接出新题或新题组，不停在旧题讲解或总结；提交前不公布答案。",
  explain: "请把当前题的解题思路解释清楚，尤其解释我的选择，不要出新题。",
  explainGroup: "请讲解刚才已提交的材料题组，优先分析错题，逐题指出题号、文章线索和我的选择为何不合适；若全对则简要归纳解题思路。不要出新题。",
} as const;

export type QuizFollowUpKey = keyof typeof QUIZ_FOLLOW_UP_PROMPTS;

export function getQuizFollowUpKey(text: string): QuizFollowUpKey | null {
  const trimmed = text.trim();
  for (const key of Object.keys(QUIZ_FOLLOW_UP_PROMPTS) as QuizFollowUpKey[]) {
    if (trimmed === QUIZ_FOLLOW_UP_PROMPTS[key] || trimmed === LEGACY_QUIZ_FOLLOW_UP_PROMPTS[key]) {
      return key;
    }
  }
  return null;
}

export function isQuizFollowUpPrompt(text: string): boolean {
  return getQuizFollowUpKey(text) !== null;
}

export function isNextQuizPrompt(text: string): boolean {
  const trimmed = text.trim();
  return trimmed === QUIZ_FOLLOW_UP_PROMPTS.next || trimmed === LEGACY_QUIZ_FOLLOW_UP_PROMPTS.next;
}

const QUIZ_ACTION_GUIDANCE: Record<QuizFollowUpKey, string> = {
  simplifyExplanation: "【本轮任务：简化解析】把刚才那道题的解析讲得更简单一些，一次只讲一个重点，保留必要步骤；只简化讲解，不要出新题。",
  easier: "【本轮任务：降低难度出新题】在用户指定的练习范围内重新出难度更低的 quiz 练习，不是简化上一题讲解。普通练习一道；阅读理解或完形填空一篇材料配默认3道小题，整组提交，遵守明确指定的小题数。数学减少推理步骤；英语降低词汇和句法难度、缩短篇幅并让线索更直接。新一组默认换新材料，仅在用户明确要求同一材料时保留。不要讲解旧题，提交前不公布答案。",
  harder: "【本轮任务：提高难度出新题】在用户指定的练习范围内重新出难度略高的 quiz 练习，不是把上一题讲解变复杂。普通练习一道；阅读理解或完形填空一篇材料配默认3道小题，整组提交，遵守明确指定的小题数。数学适当增加推理步骤；英语提高词汇、句法或理解要求，不超出已知学习阶段。新一组默认换新材料，仅在用户明确要求同一材料时保留。不要讲解旧题，提交前不公布答案。",
  next: "【本轮任务：继续出新题】在用户指定的练习范围内保持相近难度直接继续新的 quiz 练习。普通练习只出一道新题；阅读或完形出下一组（一篇材料配默认3道小题，遵守明确题量）。回看最初主题与后续调整，轮换考点、推理方式与情境，不只换数字或名字。下一组默认换新文章，仅在用户明确要求同一材料时保留。即使此前约定题数已完成，也视为用户主动追加一道（材料题为追加一组）。无论上一题对错，都直接输出新 quiz 卡片，不停在旧题讲解或总结；提交前不公布答案。",
  explain: "【本轮任务：讲解当前题】把当前题的解题思路解释清楚，尤其分析用户的选择为何对或错；不要出新题。",
  explainGroup: "【本轮任务：讲解已提交题组】优先分析本组错题，逐题指出题号、文章线索和用户的选择为何不合适；若全对则简要归纳解题思路。不要出新题。",
};

const QUIZ_TRIGGER_REQUESTS = new Set([
  "根据刚才讲的内容，出题考考我吧。",
  "请根据刚才讲解的知识，优先用 quiz 互动答题卡出练习。普通练习一道题；阅读理解或完形填空一篇材料配默认3道小题，整组提交。提交前不要在正文泄露答案和解析；不适合客观选择题时再用文字作答。",
]);

export function getMessageQuizCards(message: UIMessage): { raw: string; quiz: QuizCard }[] {
  if (message.role !== "assistant") return [];
  return message.parts.flatMap((part) => {
    if (part.type !== "text") return [];
    // Match the unchanged code-block JSON rendered by MarkdownContent.
    return Array.from(normalizeMarkdown(part.text).matchAll(/^[ \t]*(`{3,}|~{3,})quiz[ \t]*\r?\n([\s\S]*?)^[ \t]*(`{3,}|~{3,})[ \t]*$/gm)).flatMap((match) => {
      if (match[1][0] !== match[3][0] || match[3].length < match[1].length) return [];
      const raw = match[2].replace(/\r\n/g, "\n").replace(/\n$/, "");
      const quiz = parseQuizCard(raw);
      return quiz ? [{ raw, quiz }] : [];
    });
  });
}

/** Flatten groups for statistics, while retaining the parent raw JSON for saved answers. */
export function getMessageQuizzes(message: UIMessage): { raw: string; quiz: QuizSpec; questionIndex: number }[] {
  return getMessageQuizCards(message).flatMap(({ raw, quiz }) => getQuizItems(quiz).map((item, questionIndex) => ({
    raw, questionIndex,
    quiz: "questions" in quiz ? { ...item, question: `第${questionIndex + 1}题：${item.question}\n\n共用材料：${quiz.passage}` } : item,
  })));
}

/** Derive this from conversation text so the action survives history restore. */
export function isQuizExplanationReply(messages: UIMessage[], replyId: string): boolean {
  const index = messages.findIndex((message) => message.id === replyId);
  if (index < 1 || messages[index].role !== "assistant") return false;
  const request = messages.slice(0, index).findLast((message) => message.role === "user");
  const text = request?.parts.filter((part) => part.type === "text").map((part) => part.text).join("").trim() ?? "";
  const key = getQuizFollowUpKey(text);
  return key === "explain" || key === "explainGroup" || key === "simplifyExplanation";
}

/** Give reading continuations a concrete rotating target, rather than a vague
 * request for variety that the model can satisfy by only replacing the story. */
export function buildQuizContinuationPrompt(messages: UIMessage[]): string {
  const last = messages.at(-1);
  if (last?.role !== "user") return "";
  const request = last.parts.filter((part) => part.type === "text").map((part) => part.text).join("");
  const key = getQuizFollowUpKey(request);
  if (key !== "next" && key !== "easier" && key !== "harder") return "";
  const card = messages.flatMap(getMessageQuizCards).at(-1)?.quiz;
  if (!card || (!("questions" in card) && !/\bpassage\b|\bread the\b|阅读|短文|文章|完形/i.test(card.question))) return "";
  return `【本轮阅读续题任务】
用户请求下一组材料练习，难度以本次请求为准。默认一篇材料配3道小题，一个 quiz 块，整组提交；若用户明确限定小题数则遵守，不把3道题误当作3篇文章。每组最多6道，更多题量分组逐次进行。阅读组覆盖适合材料的不同角度，如明确细节、主旨大意、词义理解、推理判断，不机械按题数轮换。完形组须提供带[1]、[2]等编号空位的完整文章和逐空选项。
组内必须共用文章；下一组默认换新文章，仅当用户明确要求根据同一材料继续时保留指定材料并更换问题。输出完整题组，不讲解旧题，提交前不泄露任何小题答案。`;
}

/** Inject detailed practice-flow and action-specific quiz rules only when a quiz
 * session is active or explicitly triggered, keeping ordinary chats lightweight. */
export function buildQuizSessionPrompt(messages: UIMessage[]): string {
  const last = messages.at(-1);
  const request = last?.role === "user"
    ? last.parts.filter((part) => part.type === "text").map((part) => part.text).join("").trim()
    : "";
  const actionKey = getQuizFollowUpKey(request);
  const isTrigger = QUIZ_TRIGGER_REQUESTS.has(request);
  const hasQuizHistory = messages.some((message) => getMessageQuizCards(message).length > 0);
  if (!hasQuizHistory && !actionKey && !isTrigger) return "";

  const parts: string[] = [];
  if (hasQuizHistory || actionKey) parts.push(QUIZ_PRACTICE_FLOW_PROMPT);
  if (actionKey) {
    parts.push(QUIZ_ACTION_GUIDANCE[actionKey]);
  } else if (isTrigger) {
    parts.push("【本轮任务：根据刚才内容出题】优先使用 quiz 互动答题卡出练习；普通练习一道，阅读理解或完形填空一篇材料配默认3道小题，整组提交。提交前不在正文泄露答案和解析；不适合客观选择题时再改为文字作答。");
  }
  const readingContinuation = buildQuizContinuationPrompt(messages);
  if (readingContinuation) parts.push(readingContinuation);
  return parts.join("\n\n");
}

export function parseQuizCard(raw: string): QuizCard | null {
  if (raw.length > 10_000) return null;
  try {
    const result = quizCardSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch { return null; }
}

export function parseQuiz(raw: string): QuizSpec | null {
  if (raw.length > 10_000) return null;
  try {
    const result = quizSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function isCorrectAnswer(quiz: QuizSpec, selected: number[]): boolean {
  return selected.length === quiz.answer.length &&
    new Set(selected).size === selected.length &&
    selected.every((index) => quiz.answer.includes(index));
}

export function readQuizAnswers(metadata: unknown): QuizAnswer[] {
  if (!metadata || typeof metadata !== "object" || !("quizAnswers" in metadata) || !Array.isArray(metadata.quizAnswers)) return [];
  return metadata.quizAnswers.slice(0, 8).flatMap((entry) => {
    const result = answerSchema.safeParse(entry);
    if (!result.success) return [];
    const quiz = parseQuizCard(result.data.raw);
    if (!quiz) return [];
    const grouped = "questions" in quiz;
    if (grouped ? result.data.selected.length !== 0 || !result.data.selections : Boolean(result.data.selections)) return [];
    const selections = result.data.selections ?? [result.data.selected];
    const items = getQuizItems(quiz);
    if (selections.length !== items.length || items.some((item, index) => {
      const selected = selections[index];
      return !selected.length || selected.some((value) => value >= item.options.length) || new Set(selected).size !== selected.length || (item.type !== "multiple" && selected.length !== 1);
    })) return [];
    return [result.data];
  });
}

export function describeQuizAnswer(quiz: QuizSpec, selected: number[]): string {
  // Keep the follow-up within the 3000-character user-message limit.
  return `题目：${quiz.question.slice(0, 1000)}\n我的选择：${selected.map((index) => `${String.fromCharCode(65 + index)}. ${quiz.options[index].slice(0, 200)}`).join("；")}\n卡片判定：${isCorrectAnswer(quiz, selected) ? "答对了" : "尚未答对"}。`;
}

/** Supply saved choices to the model without adding visible chat bubbles. */
export function withQuizAnswerContext(messages: UIMessage[]): UIMessage[] {
  return messages.flatMap((message) => {
    if (message.role !== "assistant") return [message];
    const quizzes = getMessageQuizCards(message);
    const context = readQuizAnswers(message.metadata).filter((answer) =>
      quizzes.some(({ raw }) => matchesQuizRaw(raw, answer.raw)),
    ).map((answer) => {
      const quiz = parseQuizCard(answer.raw)!;
      if (!("questions" in quiz)) return describeQuizAnswer(quiz, answer.selected);
      return `共用材料：${quiz.passage}\n` + quiz.questions.map((item, index) => `第${index + 1}题：${describeQuizAnswer(item, answer.selections![index])}`).join("\n\n");
    });
    if (!context.length) return [message];
    return [message, {
      id: `${message.id}-quiz-context`,
      role: "user" as const,
      parts: [{ type: "text" as const, text: context.join("\n\n") }],
    }];
  });
}

/** Pure schema, self-containment and answer-consistency rules shared with the quiz reviewer. */
export const QUIZ_FORMAT_PROMPT = `输出严格 JSON 的 quiz 代码块，例如：
\`\`\`quiz
{"type":"single","question":"下面哪个数是质数？","options":["9","11","15","21"],"answer":[1],"explanation":"11 只有 1 和自身两个正因数，所以是质数；其余三个数都有更多因数。"}
\`\`\`
- 【单题字段】type 允许 single（单选）、multiple（多选）、boolean（判断）；options 为 2–6 个互不重复选项，answer 为从 0 开始且不重复的正确下标数组。单选和判断仅一个正确答案；判断题 options 必须固定为 ["正确","错误"]（即使在其他回复语言下也保持这两个值）。question 最多 2000 字，每选项最多 500 字，explanation 最多 3000 字。
- 【材料题组】阅读理解用 {"type":"reading","passage":"完整文章","questions":[普通题对象...]}；完形填空用 {"type":"cloze","passage":"含[1]、[2]、[3]编号空位的完整文章","questions":[逐空单选题对象...]}。完形空位按 [1] 到 [n] 连续编号且各出现一次，不在文章中填答案。整组 JSON 最多 10000 字符，passage 最多 3000 字，每组 1–6 道小题（默认 3 道）；正文不重复整篇文章。
- 【排版与公式】题干、选项和解析可用简单 Markdown；仅真正数学表达式用 $...$ / $$...$$，英语单词、例句和语法结构（如 had + 过去分词）用普通文字或斜体；JSON 内反斜杠须正确转义，不嵌套代码块、图表或答题卡。
- 【纯文字自洽（无配图）】答题卡不显示示意图、电路图或照片。除非用户上传了图片并要求围绕该图出题，否则禁止使用“如图所示”“如图”“如图甲”“见下图”“上图/下图/右图”“根据示意图/电路图”“in the figure/diagram shown/below”等依赖未提供图片的措辞。物理电路、受力、光路、几何与函数题须用文字完整描述连接方式、位置关系和已知量，确保不看图即可唯一求解；离不开图的题改出纯文字可表述的同考点题型。
- 【先求解，再编选项】先独立求出精确答案，核对条件、单位、可解性与解的唯一性，再编写正确选项与干扰项，最后填写 answer 与面向学生的定稿解析（简明点出关键思路和常见误区）。数学题须代回复核，检查等价选项、取整与精度；未说明近似时不把“最接近”当正确答案。发现草稿有误先内部修正，确保题干、options、answer 与 explanation 完全一致，绝不把“等等、重新算、选项没有、改成”等试算或自纠过程写进解析或正文。
- 【难度】未指定年级时，默认贴合 10–16 岁常见高小至中学水平，避免默认出大学或超纲竞赛题。`;

export const QUIZ_PROMPT = `【互动答题卡】
用户要求做题、练习、小测或点击出题入口时，优先使用可点击的互动答题卡；主题已知直接出题，未知只问主题。普通练习每次回答只出一道题；阅读理解与完形填空每次只出一组（默认一篇 3 题，“做3道阅读题”按一篇 3 题，“做3篇阅读”分三组逐次进行；用户明确指定小题数或提供材料时优先遵守，超 6 题分组承接）。每次只输出一个 quiz 块，等用户提交后再继续。无标准答案的开放讨论、证明题或用户明确要求文字作答时，不硬改成选择题。
answer 和 explanation 仅放在 JSON 内（界面提交前隐藏），不可省略；正文、题干和选项不得泄露答案、暗示正确选项或提前讲解。
${QUIZ_FORMAT_PROMPT}`;

export const QUIZ_PRACTICE_FLOW_PROMPT = `【刷题节奏与快捷操作】
- 【范围与多样性】练习范围以用户原始要求和后续明确调整为准，上一题自选的子考点或情境不是范围限制。每次续题前先回看已出题目，优先轮换范围内未覆盖的考点、推理方式与情境，保持相近难度；新题须有实质变化，不只换数字、人名或选项顺序，不把答错误解成要求反复练同一种题。
- 【材料题组】组内共用 passage 且问题互补；新一组默认换全新文章与问题，仅在用户明确要求“根据这篇文章继续”时复用材料并更换问题（仍在 passage 写全原文，不写“同上文”）。
- 【续题与按钮】用户提交后界面已本地判题并显示解析。点击“再来一题”“再练一组”或“换一道题”时，无论上一题对错，都必须直接输出新的 quiz 卡片（材料练习为完整题组），不停在旧题解释或总结；即便原定题数已完成，也视为用户主动追加。点击“简单一点”或“难一点”是调整难度后出新题（优先于保持相近难度），不是改写旧题讲解；只有明确要求讲解或简化解析时才只讲解、不出新题。
- 作答上下文中的“尚未答对”仅是历史记录，不覆盖用户继续出题的请求；不根据未提供的记录编造正确率或成绩。`;
