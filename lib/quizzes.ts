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
  simplifyExplanation: "请把刚才这道题的解析讲得更简单一些，一次只讲一个重点，保留必要的解题步骤；只简化讲解，不出新题。",
  easier: "请在我指定的练习范围内，重新出难度更低的 quiz 练习，不是简化上一题讲解。普通练习一道；阅读理解或完形填空一篇材料配默认3道小题，整组提交，遵守我明确指定的小题数。数学减少推理步骤；英语降低词汇和句法难度，文章更短、线索更直接。新一组默认换新材料，明确要求同一材料时才保留；组内共用材料。不要讲解旧题，不在提交前公布答案。",
  harder: "请在我指定的练习范围内，重新出难度略高的 quiz 练习，不是把上一题的讲解变复杂。普通练习一道；阅读理解或完形填空一篇材料配默认3道小题，整组提交，遵守我明确指定的小题数。数学适当增加推理步骤；英语提高词汇、句法或理解要求，不超出已知学习阶段。新一组默认换新材料，明确要求同一材料时才保留；组内共用材料。不要讲解旧题，不在提交前公布答案。",
  next: "请在我指定的练习范围内，保持相近难度，直接继续新的 quiz 练习。普通练习只出一道新题；阅读理解或完形填空出下一组：一篇材料配默认3道小题，整组提交，遵守我明确指定的小题数。回看最初主题与后续调整，不把上一题的子考点当作全部范围；轮换考点、解题思路与情境，不只换数字或名字。下一组默认换新文章，明确要求同一材料时才保留；组内必须共用文章。即使之前约定题数已完成，这次点击也表示我主动追加一题（材料题为追加一组）。无论之前对错，都直接出新题或新题组，不停在旧题讲解或总结；提交前不公布答案。",
  explain: "请把当前题的解题思路解释清楚，尤其解释我的选择，不要出新题。",
  explainGroup: "请讲解刚才已提交的材料题组，优先分析错题，逐题指出题号、文章线索和我的选择为何不合适；若全对则简要归纳解题思路。不要出新题。",
} as const;

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
  const text = request?.parts.filter((part) => part.type === "text").map((part) => part.text).join("").trim();
  return text === QUIZ_FOLLOW_UP_PROMPTS.explain || text === QUIZ_FOLLOW_UP_PROMPTS.explainGroup || text === QUIZ_FOLLOW_UP_PROMPTS.simplifyExplanation;
}

/** Give reading continuations a concrete rotating target, rather than a vague
 * request for variety that the model can satisfy by only replacing the story. */
export function buildQuizContinuationPrompt(messages: UIMessage[]): string {
  const last = messages.at(-1);
  if (last?.role !== "user") return "";
  const request = last.parts.filter((part) => part.type === "text").map((part) => part.text).join("");
  if (![QUIZ_FOLLOW_UP_PROMPTS.next, QUIZ_FOLLOW_UP_PROMPTS.easier, QUIZ_FOLLOW_UP_PROMPTS.harder].some((prompt) => prompt === request)) return "";
  const card = messages.flatMap(getMessageQuizCards).at(-1)?.quiz;
  if (!card || (!("questions" in card) && !/\bpassage\b|\bread the\b|阅读|短文|文章|完形/i.test(card.question))) return "";
  return `【本轮阅读续题任务】
用户请求下一组材料练习，难度以本次请求为准。默认一篇材料配3道小题，一个 quiz 块，整组提交；若用户明确限定小题数则遵守，不把3道题误当作3篇文章。每组最多6道，更多题量分组逐次进行。阅读组覆盖适合材料的不同角度，如明确细节、主旨大意、词义理解、推理判断，不机械按题数轮换。完形组须提供带[1]、[2]等编号空位的完整文章和逐空选项。
组内必须共用文章；下一组默认换新文章，仅当用户明确要求根据同一材料继续时保留指定材料并更换问题。输出完整题组，不讲解旧题，提交前不泄露任何小题答案。`;
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

export const QUIZ_PROMPT = `【互动答题卡】
用户要求做题、练习、小测，或点击“出道题”“复习小测”时，优先使用可点击的互动答题卡；主题已知就直接出题，未知只问主题。普通练习每次回答只出一道题；阅读理解与完形填空每次只出一组，一篇文章默认配3道小题。每次只有一个 quiz 块，等待用户提交后再继续。
输出严格 JSON 的 quiz 代码块，例如：
\`\`\`quiz
{"type":"single","question":"下面哪个数是质数？","options":["9","11","15","21"],"answer":[1],"explanation":"11 只有 1 和自身两个正因数，所以是质数。其他三个数都有更多因数。"}
\`\`\`
- 【材料题组格式】阅读理解使用 {"type":"reading","passage":"完整文章","questions":[普通题目对象,普通题目对象,普通题目对象]}；完形填空使用 {"type":"cloze","passage":"含[1]、[2]、[3]编号空位的完整文章","questions":[第1空的普通单选题对象,第2空的普通单选题对象,第3空的普通单选题对象]}。questions 中每个对象均含 type、question、options、answer、explanation，与上面普通题格式相同，不省略字段；完形每空对应一道单选题，空位按[1]到[n]连续编号且每个只出现一次，不在文章里填入答案。整组 JSON 最多10000字符，passage 最多3000字，每组1–6道小题；默认3道，超出6道分组逐次进行。正文不再重复整篇文章。
- 【题量】“做3道阅读题”默认一篇三题；“做3篇阅读”分三组，每篇默认三题，等待整组提交后再继续。用户明确指定小题数时优先遵守；总题数剩余不足三题时只出剩余题数，不超额。用户提供文章或原题时优先保留其材料和题量（较多题分组承接）。阅读组内选择适合材料的不同考查角度，不强行凑题型。整组提交前不展示任何小题答案或解析，避免互相泄题。
- type 允许 single（单选）、multiple（多选）、boolean（判断）；options 为2–6个互不重复的选项，answer 是从0开始的正确选项下标数组且不能重复。单选和判断只有一个正确答案；判断题 options 固定为["正确","错误"]。
- question 最多2000字，每个选项最多500字，explanation 最多3000字。题干、选项和解析可用简单 Markdown；只有真正的数学表达式使用 $…$ / $$…$$，英语单词、例句和语法结构（如 had + 过去分词）用普通文字或 Markdown 斜体，不使用公式；JSON 中的反斜杠须正确转义。不嵌套代码块、图表或答题卡。
- answer 和 explanation 仅放在 JSON 内，界面提交前会隐藏。正文、题干、选项中不要泄露答案、暗示正确选项或提前讲解；共同人设中的“不提前揭晓答案”指用户可见的正文，不禁止填写卡片判题所需字段。
- 【先求解，再编选项】先根据题干独立求出精确答案，核对条件、单位、可解性和解的唯一性，再围绕已求出的答案编写正确选项与干扰项，最后填写 answer 与定稿解析。不要先随意编选项，再一边写解析一边试算或凑答案。数学题须代回题干复核，检查分数、小数等价选项、取整和精度要求；未说明近似时，不能把最接近的选项当作正确答案。
- 输出前逐项确认题干、options、answer 下标与 explanation 指向同一个结果。若算出4.8天，正确选项必须是4.8天，不能标记3天为正确再在解析中改答案。发现草稿错误时先内部修正，JSON 中仅保留一致的最终版本；不把“等等、重新算、选项没有、把选项改成”等试算和自我纠错过程塞进解析，也不在正文暴露这些过程或答案。标准题卡格式仍须完整填写，不因“不提前揭晓答案”省略 JSON 中隐藏的答案字段。
- 无标准答案的观点讨论、开放问答、证明题或用户明确要求文字作答时，不硬改成选择题。
- 【练习范围与多样性】练习范围以用户原始要求和后续明确调整为准，上一题由你自行挑选的子考点、材料或故事情境不是用户的范围限制。每次继续出题前，回看本段练习已出现的题目，优先挑选该范围内尚未覆盖的考点、推理方式或应用情境，保持相近难度。新题必须有实质变化，不能只换数值、人名、选项顺序或问法。不要无依据把答错理解成用户要求反复练同一种题。
- 例如用户要求“三角形”练习，第一题由你选了等腰三角形的边长与周长，后续应在用户适用的知识层级内轮换内角和、三边关系、分类、面积等，不连续出边长周长的换数字题。若用户明确限定“只练等腰三角形周长”，则仍留在该范围内，变化条件与推理方式，不擅自扩大到其他考点。
- 阅读理解和完形填空组内共用一篇文章，文章仅放在 passage 中展示一次，小题放在 questions。新一组默认换全新文章和问题；只有用户明确要求“根据这篇文章继续”等时才复用指定材料，更换问题且仍在 passage 给出完整材料，不写“同上文”。组内问题互补，组间改变情境与考点，不能只换人名或数字。
- 用户提交后，界面已本地判题并显示解析。点击“再来一题”或“再练一组”是明确的新出题请求：无论上一题对错，都必须直接输出一道新的 quiz 卡片（材料练习为完整题组），不停在上一题的解释或总结。即使原定题数已完成，也将该点击视为用户主动追加一道或一组。只有点击“解释一下”“讲解错题”或明确要求讲解时才讲当前练习、不额外出题。平时遵守约定的总题数和难度，不主动追加。
- 快捷操作的含义必须区分：“简单一点的题”和“难一点的题”是降低或提高难度后出一道新互动题；“换一道题”是相近难度的新题；“讲解这题”“讲解更简单”只讲解当前题或简化解析，不出新题。难度调整优先于默认保持相近难度的规则。
- 作答上下文中的“尚未答对”只是上一题的记录，不能覆盖用户最新的继续出题请求；不根据未提供的作答记录编造正确率或夸奖成绩。`;
