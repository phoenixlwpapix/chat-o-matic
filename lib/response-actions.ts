import type { UIMessage } from "ai";
import { getMessageQuizCards, isQuizExplanationReply, QUIZ_FOLLOW_UP_PROMPTS, readQuizAnswers } from "./quizzes";
import { isQuizSummaryRequest, isQuizSummaryReply, QUIZ_SUMMARY_REQUEST } from "./quiz-summary";

export type ResponseAction = "simplify" | "example" | "principle" | "perspective" | "quiz" | "verify" | "next-quiz" | "easier-quiz" | "harder-quiz" | "explain-quiz" | "quiz-summary";
export type ResponseActionContext = "answer" | "quiz-unanswered" | "quiz-answered" | "quiz-explanation" | "quiz-summary";
export interface ResponseActionDefinition {
  id: ResponseAction;
  label: string;
  prompt: string;
}

export const RESPONSE_ACTIONS: ResponseActionDefinition[] = [
  { id: "principle", label: "讲讲原理", prompt: "请解释刚才现象背后的科学原理，区分实际机制和类比；不要重复实验操作。" },
  { id: "perspective", label: "换个角度", prompt: "请针对刚才讨论的问题，提供一个不同但合理的思考角度，说明它的理由，不替我做决定。" },
  { id: "simplify", label: "讲简单些", prompt: "请把刚才的回答讲得更简单一些，一次只讲一个重点；如果刚才是题目解析，只简化讲解，不出新题。" },
  { id: "example", label: "举个例子", prompt: "请针对刚才的回答，举一个贴近日常生活的具体例子。" },
  { id: "quiz", label: "出道题", prompt: "请根据刚才讲解的知识，优先用 quiz 互动答题卡出练习。普通练习一道题；阅读理解或完形填空一篇材料配默认3道小题，整组提交。提交前不要在正文泄露答案和解析；不适合客观选择题时再用文字作答。" },
  { id: "verify", label: "检查事实", prompt: "请联网核查刚才回答中的关键事实，指出哪些得到来源支持，哪些仍不确定。" },
  { id: "next-quiz", label: "再来一题", prompt: QUIZ_FOLLOW_UP_PROMPTS.next },
  { id: "easier-quiz", label: "简单一点的题", prompt: QUIZ_FOLLOW_UP_PROMPTS.easier },
  { id: "harder-quiz", label: "难一点的题", prompt: QUIZ_FOLLOW_UP_PROMPTS.harder },
  { id: "explain-quiz", label: "讲解这题", prompt: QUIZ_FOLLOW_UP_PROMPTS.explain },
  { id: "quiz-summary", label: "练习总结", prompt: QUIZ_SUMMARY_REQUEST },
];

export function getResponseActionContext(messages: UIMessage[], replyId: string): ResponseActionContext {
  const message = messages.find((item) => item.id === replyId);
  if (!message || message.role !== "assistant") return "answer";
  const quizzes = getMessageQuizCards(message);
  if (quizzes.length) {
    const answers = readQuizAnswers(message.metadata);
    return quizzes.every(({ raw }) => answers.some((answer) => answer.raw === raw)) ? "quiz-answered" : "quiz-unanswered";
  }
  const index = messages.indexOf(message);
  if (isQuizSummaryRequest(messages.slice(0, index)) || isQuizSummaryReply(message)) return "quiz-summary";
  return isQuizExplanationReply(messages, replyId) ? "quiz-explanation" : "answer";
}

const CONTEXT_ACTIONS: Record<ResponseActionContext, ResponseAction[]> = {
  answer: ["simplify", "example"],
  "quiz-unanswered": ["easier-quiz", "harder-quiz", "next-quiz"],
  "quiz-answered": ["next-quiz", "explain-quiz", "easier-quiz", "harder-quiz", "quiz-summary"],
  "quiz-explanation": ["next-quiz", "easier-quiz", "harder-quiz", "simplify", "quiz-summary"],
  "quiz-summary": ["next-quiz", "easier-quiz", "harder-quiz"],
};

export function isQuizGroupContext(messages: UIMessage[], replyId: string): boolean {
  const index = messages.findIndex((message) => message.id === replyId);
  if (index < 0) return false;
  const card = messages.slice(0, index + 1).flatMap(getMessageQuizCards).at(-1)?.quiz;
  return Boolean(card && "questions" in card);
}

export function isSubstantiveReply(message: UIMessage | undefined): boolean {
  const text = message?.parts.filter((part) => part.type === "text").map((part) => part.text).join("\n") ?? "";
  return text.trim().length >= 180 && text.trim().split(/\n\s*\n/).length >= 2 && !/[？?][”"’']?$/.test(text.trim());
}

export function getMoreResponseActions(context: ResponseActionContext, personaId = "default"): ResponseActionDefinition[] {
  const ids: ResponseAction[] = context === "answer" && personaId === "default" ? ["quiz", "verify"] : ["verify"];
  return ids.map((id) => RESPONSE_ACTIONS.find((action) => action.id === id)!);
}

export function getResponseActions(context: ResponseActionContext, grouped = false, personaId = "default", substantive = false): ResponseActionDefinition[] {
  const personaActions: Record<string, ResponseAction[]> = {
    default: ["simplify", "example"], "mad-scientist": ["principle", "example"],
    "adventure-master": [], "roast-master": [], "philosophical-cat": substantive ? ["perspective"] : [],
  };
  const ids = context === "answer" ? personaActions[personaId] ?? personaActions.default : CONTEXT_ACTIONS[context];
  return ids.map((id) => {
    const action = RESPONSE_ACTIONS.find((item) => item.id === id)!;
    if (context === "answer" && personaId === "mad-scientist" && id === "example") return { ...action, label: "举个实例" };
    if (grouped) {
      if (id === "next-quiz") return { ...action, label: context === "quiz-unanswered" ? "换一组题" : "再练一组" };
      if (id === "easier-quiz") return { ...action, label: "简单一点的一组" };
      if (id === "harder-quiz") return { ...action, label: "难一点的一组" };
      if (id === "explain-quiz") return { ...action, label: "讲解错题", prompt: QUIZ_FOLLOW_UP_PROMPTS.explainGroup };
    }
    if (context === "quiz-unanswered" && id === "next-quiz") return { ...action, label: "换一道题" };
    if (context === "quiz-explanation" && id === "simplify") return { ...action, label: "讲解更简单", prompt: QUIZ_FOLLOW_UP_PROMPTS.simplifyExplanation };
    return action;
  });
}
