import { z } from "zod";
import type { UIMessage } from "ai";

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
const answerSchema = z.object({
  key: z.string().max(80),
  raw: z.string().max(10_000),
  selected: z.array(z.number().int().min(0).max(5)).min(1).max(6),
}).strict();
export type QuizAnswer = z.infer<typeof answerSchema>;

export const QUIZ_FOLLOW_UP_PROMPTS = {
  simplifyExplanation: "请把刚才这道题的解析讲得更简单一些，一次只讲一个重点，保留必要的解题步骤；只简化讲解，不出新题。",
  easier: "请在我指定的练习范围内，重新出一道难度更低的 quiz 互动题，不是把上一题的讲解变简单。数学减少推理步骤、简化条件；英语降低词汇和句法难度、阅读文章更短且线索更直接。出一道实质不同的新题，阅读理解默认换新文章，明确要求同一文章时才保留。不要讲解上一题，不在提交前公布答案。",
  harder: "请在我指定的练习范围内，重新出一道难度略高的 quiz 互动题，不是把上一题的讲解写得更复杂。数学适当增加推理步骤；英语适当提高词汇、句法或理解要求，不超出已知学习阶段。出一道实质不同的新题，阅读理解默认换新文章，明确要求同一文章时才保留。不要讲解上一题，不在提交前公布答案。",
  next: "请在我指定的练习范围内，保持相近难度，直接再出一道新的 quiz 互动题。先回看我最初指定的主题及后续明确调整，不要把上一题的具体考点误当成整个练习范围。主动轮换考点、解题思路和情境，下一题优先选择上一题未考查的知识点或能力，不连续重复同一种解题模板，不要只换数字、名字或问法；阅读理解默认换一篇全新文章，再设置一个新问题，只有我明确要求同一篇文章连续出题时才复用文章。不要超出我明确限定的范围。即使之前约定的题数已经完成，这次点击也表示我主动追加一题。无论上一题答对还是答错，都不要停在上一题的讲解或总结；只出一道新题，提交前不公布答案。",
  explain: "请把当前题的解题思路解释清楚，尤其解释我的选择，不要出新题。",
} as const;

export function getMessageQuizzes(message: UIMessage): { raw: string; quiz: QuizSpec }[] {
  if (message.role !== "assistant") return [];
  return message.parts.flatMap((part) => {
    if (part.type !== "text") return [];
    return Array.from(part.text.matchAll(/^[ \t]*(`{3,}|~{3,})quiz[ \t]*\r?\n([\s\S]*?)^[ \t]*\1[ \t]*$/gm)).flatMap((match) => {
      const raw = match[2].replace(/\r\n/g, "\n").replace(/\n$/, "");
      const quiz = parseQuiz(raw);
      return quiz ? [{ raw, quiz }] : [];
    });
  });
}

/** Derive this from conversation text so the action survives history restore. */
export function isQuizExplanationReply(messages: UIMessage[], replyId: string): boolean {
  const index = messages.findIndex((message) => message.id === replyId);
  if (index < 1 || messages[index].role !== "assistant") return false;
  const request = messages.slice(0, index).findLast((message) => message.role === "user");
  const text = request?.parts.filter((part) => part.type === "text").map((part) => part.text).join("").trim();
  return text === QUIZ_FOLLOW_UP_PROMPTS.explain || text === QUIZ_FOLLOW_UP_PROMPTS.simplifyExplanation;
}

/** Give reading continuations a concrete rotating target, rather than a vague
 * request for variety that the model can satisfy by only replacing the story. */
export function buildQuizContinuationPrompt(messages: UIMessage[]): string {
  const last = messages.at(-1);
  if (last?.role !== "user") return "";
  const request = last.parts.filter((part) => part.type === "text").map((part) => part.text).join("");
  if (![QUIZ_FOLLOW_UP_PROMPTS.next, QUIZ_FOLLOW_UP_PROMPTS.easier, QUIZ_FOLLOW_UP_PROMPTS.harder].some((prompt) => prompt === request)) return "";
  const questions = messages.flatMap(getMessageQuizzes).map(({ quiz }) => quiz.question);
  const readingQuestions = questions.filter((question) => /\bpassage\b|\bread the\b|阅读|短文|文章/i.test(question));
  if (!readingQuestions.length || readingQuestions.at(-1) !== questions.at(-1)) return "";
  const angles = ["主旨大意：概括全文的中心意思", "词义理解：根据上下文理解一个词或短语", "明确细节：找到文章明确陈述的信息", "推理判断：根据线索得出未直接陈述的结论", "写作意图：理解作者为什么写这篇文章"];
  const target = angles[readingQuestions.length % angles.length];
  return `【本轮阅读续题任务】
用户已请求一道新题，难度以本次请求（相近、更简单或更难）为准。下一题的具体考查目标是：${target}。围绕此目标设计文章和问题，不继续沿用上一题的提问模板。若该角度与用户明确限定的专项练习不符，遵守用户限定；不能仅因上一题采用某角度就视为用户限定。
默认必须更换整篇文章；仅当用户明确要求同一材料连续出题时保留指定文章。输出一道完整 quiz 卡片，不讲解旧题。`;
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
    const quiz = parseQuiz(result.data.raw);
    const { selected } = result.data;
    if (!quiz || selected.some((index) => index >= quiz.options.length) || new Set(selected).size !== selected.length || (quiz.type !== "multiple" && selected.length !== 1)) return [];
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
    const context = readQuizAnswers(message.metadata).filter((answer) =>
      message.parts.some((part) => part.type === "text" && part.text.includes(answer.raw)),
    ).map((answer) => describeQuizAnswer(parseQuiz(answer.raw)!, answer.selected));
    if (!context.length) return [message];
    return [message, {
      id: `${message.id}-quiz-context`,
      role: "user" as const,
      parts: [{ type: "text" as const, text: context.join("\n\n") }],
    }];
  });
}

export const QUIZ_PROMPT = `【互动答题卡】
用户要求做题、练习、小测，或点击“出道题”“复习小测”时，优先使用可点击的互动答题卡；主题已知就直接出题，未知只问主题。每次回答只出一道题、一个 quiz 块，等待用户提交后再继续，不一次列出多道题。
输出严格 JSON 的 quiz 代码块，例如：
\`\`\`quiz
{"type":"single","question":"下面哪个数是质数？","options":["9","11","15","21"],"answer":[1],"explanation":"11 只有 1 和自身两个正因数，所以是质数。其他三个数都有更多因数。"}
\`\`\`
- type 允许 single（单选）、multiple（多选）、boolean（判断）；options 为2–6个互不重复的选项，answer 是从0开始的正确选项下标数组且不能重复。单选和判断只有一个正确答案；判断题 options 固定为["正确","错误"]。
- question 最多2000字，每个选项最多500字，explanation 最多3000字。题干、选项和解析可用简单 Markdown；只有真正的数学表达式使用 $…$ / $$…$$，英语单词、例句和语法结构（如 had + 过去分词）用普通文字或 Markdown 斜体，不使用公式；JSON 中的反斜杠须正确转义。不嵌套代码块、图表或答题卡。
- answer 和 explanation 仅放在 JSON 内，界面提交前会隐藏。正文、题干、选项中不要泄露答案、暗示正确选项或提前讲解；共同人设中的“不提前揭晓答案”指用户可见的正文，不禁止填写卡片判题所需字段。
- 出题时核对条件、唯一性和答案。无标准答案的观点讨论、开放问答、证明题或用户明确要求文字作答时，不硬改成选择题。
- 【练习范围与多样性】练习范围以用户原始要求和后续明确调整为准，上一题由你自行挑选的子考点、材料或故事情境不是用户的范围限制。每次继续出题前，回看本段练习已出现的题目，优先挑选该范围内尚未覆盖的考点、推理方式或应用情境，保持相近难度。新题必须有实质变化，不能只换数值、人名、选项顺序或问法。不要无依据把答错理解成用户要求反复练同一种题。
- 例如用户要求“三角形”练习，第一题由你选了等腰三角形的边长与周长，后续应在用户适用的知识层级内轮换内角和、三边关系、分类、面积等，不连续出边长周长的换数字题。若用户明确限定“只练等腰三角形周长”，则仍留在该范围内，变化条件与推理方式，不擅自扩大到其他考点。
- 阅读理解默认每次新题使用全新文章，改变内容与情境，并轮换适合该文章的主旨、细节、推断、词义或写作意图等考查角度，不连续使用同一个角度或同一种问法。先在内部识别最近题目的考查角度，再选不同角度设计新材料与问题；例如上一题推断人物准备做什么，下一题可考主旨、词义或明确细节，不能继续用另一个人物的行为推断准备做什么。无需在正文展示这份内部规划。题干中给出本题完整文章，不写“同上文”“Based on the same passage”或只更换人物姓名。只有用户明确要求“一篇多题”“根据这篇文章继续”等时才复用指定材料，此时也要更换问题，不能重复已答过的题目。
- 用户提交后，界面已本地判题并显示解析。点击“再来一题”是明确的新出题请求：无论上一题对错，都必须直接输出一道新的 quiz 卡片，不停在上一题的解释或总结。即使原定题数已完成，也将该点击视为用户追加一题。只有点击“解释一下”或明确要求讲解时才讲当前题、不额外出题。平时遵守约定的总题数和难度，不主动追加。
- 快捷操作的含义必须区分：“简单一点的题”和“难一点的题”是降低或提高难度后出一道新互动题；“换一道题”是相近难度的新题；“讲解这题”“讲解更简单”只讲解当前题或简化解析，不出新题。难度调整优先于默认保持相近难度的规则。
- 作答上下文中的“尚未答对”只是上一题的记录，不能覆盖用户最新的继续出题请求；不根据未提供的作答记录编造正确率或夸奖成绩。`;
