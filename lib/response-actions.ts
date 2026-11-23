import type { UIMessage } from "ai";
import { getMessageQuizCards, isQuizExplanationReply, matchesQuizRaw, QUIZ_FOLLOW_UP_PROMPTS, readQuizAnswers } from "./quizzes";
import { isQuizSummaryRequest, isQuizSummaryReply, QUIZ_SUMMARY_REQUEST } from "./quiz-summary";

export type ResponseAction = "simplify" | "example" | "principle" | "perspective" | "quiz" | "verify" | "next-quiz" | "easier-quiz" | "harder-quiz" | "explain-quiz" | "quiz-summary";
export type ResponseActionContext = "answer" | "quiz-unanswered" | "quiz-answered" | "quiz-explanation" | "quiz-summary";
export interface ResponseActionDefinition {
  id: ResponseAction;
  label: string;
  prompt: string;
}

export const RESPONSE_ACTIONS: ResponseActionDefinition[] = [
  { id: "principle", label: "讲讲原理", prompt: "讲讲刚才现象背后的科学原理吧，帮我分清真实机制和类比，不用重复实验步骤。" },
  { id: "perspective", label: "换个角度", prompt: "换一个不同但合理的角度看看刚才的问题，说说它的理由，别替我做决定。" },
  { id: "simplify", label: "讲简单些", prompt: "把刚才的回答讲得更简单一些，一次先讲清一个重点；如果是题目解析，只简化讲解、不出新题。" },
  { id: "example", label: "举个例子", prompt: "针对刚才的回答，举一个贴近日常生活的具体例子吧。" },
  { id: "quiz", label: "出道题", prompt: "根据刚才讲的内容，出题考考我吧。" },
  { id: "verify", label: "检查事实", prompt: "帮我联网核查刚才回答里的关键事实，指出哪些有来源支持、哪些还不确定；如果上一轮有错误、过时或夸大，直接更正，不要为原回答辩护。" },
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
    return quizzes.every(({ raw }) => answers.some((answer) => matchesQuizRaw(raw, answer.raw))) ? "quiz-answered" : "quiz-unanswered";
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
