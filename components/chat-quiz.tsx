"use client";

import { createContext, useContext, useId, useState } from "react";
import { BookOpenCheck, Check } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkCjkFriendly from "remark-cjk-friendly/parseOnly";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { getQuizItems, isCorrectAnswer, parseQuizCard, type QuizAnswer, type QuizSpec } from "@/lib/quizzes";
import { ParagraphFollowUp } from "@/components/paragraph-follow-up";

const QuizTextContext = createContext<{ text: string; context: string; onFollowUp?: (prompt: string) => void }>({ text: "", context: "" });
const QuizParagraph: NonNullable<Components["p"]> = ({ children, node }) => {
  const { text, context, onFollowUp } = useContext(QuizTextContext);
  const start = node?.position?.start.offset;
  const end = node?.position?.end.offset;
  const quote = start !== undefined && end !== undefined ? text.slice(start, end) : text;
  return <ParagraphFollowUp quote={context ? `${context}\n${quote}` : quote} onFollowUp={onFollowUp}>{children}</ParagraphFollowUp>;
};
const QUIZ_TEXT_COMPONENTS: Components = { p: QuizParagraph };

function QuizText({ text, onFollowUp, context = "" }: { text: string; onFollowUp?: (prompt: string) => void; context?: string }) {
  return <div className="quiz-text markdown-content min-w-0 max-w-[780px] break-words">
    <QuizTextContext.Provider value={{ text, context, onFollowUp }}>
    <ReactMarkdown remarkPlugins={[remarkCjkFriendly, remarkMath]} rehypePlugins={[rehypeKatex]} disallowedElements={["img", "pre"]} unwrapDisallowed components={QUIZ_TEXT_COMPONENTS}>{text}</ReactMarkdown>
    </QuizTextContext.Provider>
  </div>;
}

export interface QuizControls {
  answers: QuizAnswer[];
  disabled: boolean;
  onSubmit?: (answer: QuizAnswer) => void;
  onFollowUp?: (text: string) => void;
}

function QuizQuestion({ quiz, selected, submitted, disabled, number, onChange, onFollowUp }: {
  quiz: QuizSpec; selected: number[]; submitted: boolean; disabled: boolean; number?: number; onChange: (index: number) => void; onFollowUp?: (prompt: string) => void;
}) {
  const titleId = useId();
  const correct = isCorrectAnswer(quiz, selected);
  return <div className="flex flex-col gap-3">
      {number !== undefined ? <p className="m-0 text-xs font-black">第 {number} 题 · {quiz.type === "multiple" ? "多选" : quiz.type === "boolean" ? "判断" : "单选"}</p> : null}
      <div id={titleId} className="font-bold"><QuizText text={quiz.question} /></div>
      <fieldset aria-labelledby={titleId} disabled={disabled || submitted} className="m-0 min-w-0 space-y-2 border-0 p-0">
        <legend className="mb-2 text-xs opacity-75">{number !== undefined ? quiz.type === "multiple" ? "为本题选择所有符合条件的选项" : "为本题选择一个答案" : quiz.type === "multiple" ? "选择所有符合条件的选项，再提交" : "选择一个答案，再提交"}</legend>
        {quiz.options.map((option, index) => {
          const checked = selected.includes(index);
          const right = submitted && quiz.answer.includes(index);
          return <label key={index} className="quiz-option relative flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2" style={{ borderColor: checked || right ? "var(--border-color)" : "var(--fb-inactive-border)", background: right ? "var(--fb-helpful-bg)" : checked ? "var(--settings-selected-bg)" : "var(--card-bg)", color: right ? "var(--prompt-card-text)" : "var(--ai-bubble-text)" }}>
            <input className="peer sr-only" type={quiz.type === "multiple" ? "checkbox" : "radio"} name={titleId} checked={checked} onChange={() => onChange(index)} />
            <span className="quiz-option-letter flex shrink-0 items-center justify-center rounded-md border-2 font-black" style={{ background: checked ? "var(--ai-bubble-text)" : "transparent", color: checked ? "var(--card-bg)" : "inherit", borderColor: checked ? "var(--ai-bubble-text)" : "var(--fb-inactive-border)" }}>{String.fromCharCode(65 + index)}</span>
            <div className="min-w-0 flex-1"><QuizText text={option} /></div>
            {submitted && (checked || right) && <span className="quiz-option-status inline-flex shrink-0 items-center gap-1 text-[10px] font-bold">{right && <Check aria-label="正确选项" className="h-4 w-4" />}{checked ? "已选" : ""}</span>}
          </label>;
        })}
      </fieldset>
      {submitted ? <div role="status" className="space-y-2 border-t-2 border-dashed pt-3" style={{ borderColor: "var(--fb-inactive-border)" }}>
        <p className="m-0 text-sm font-black">{correct ? "答对了！" : "这次还差一点，看看解析"}</p>
        <p className="m-0 text-xs font-bold">正确答案：{quiz.answer.map((index) => String.fromCharCode(65 + index)).join("、")}</p>
        <div className="text-sm leading-relaxed"><QuizText text={quiz.explanation} context={`对应题目：${quiz.question.slice(0, 400)}`} onFollowUp={onFollowUp} /></div>

      </div> : null}
  </div>;
}

export function ChatQuiz({ raw, pending, quizKey, answers, disabled, onSubmit, onFollowUp }: QuizControls & { raw: string; pending: boolean; quizKey: string }) {
  const [drafts, setDrafts] = useState<number[][]>([]);
  const titleId = useId();
  const card = pending ? null : parseQuizCard(raw);
  const stored = answers.find((answer) => answer.key === quizKey && answer.raw === raw);
  if (!card) return <div role="status" className="not-prose my-4 rounded-xl border-2 border-dashed p-4 text-sm" style={{ borderColor: "var(--fb-inactive-border)" }}>
    {pending ? "题目生成中…" : "这道题的数据不完整或答案格式有误，请让助手重新出题。"}
  </div>;
  const grouped = "questions" in card;
  const items = getQuizItems(card);
  const selections = stored ? stored.selections ?? [stored.selected] : drafts;
  const completed = items.filter((_, index) => selections[index]?.length).length;
  const submitted = Boolean(stored);
  const correctCount = submitted ? items.filter((item, index) => isCorrectAnswer(item, selections[index] ?? [])).length : 0;
  return <section className="not-prose my-4 min-w-0 overflow-hidden rounded-xl border-2" aria-labelledby={titleId} style={{ background: "var(--card-bg)", color: "var(--ai-bubble-text)", borderColor: "var(--border-color)", boxShadow: "3px 3px 0 rgba(var(--shadow-color), 1)" }}>
    <header className="flex items-center justify-between gap-2 border-b-2 px-3 py-2.5" style={{ background: "var(--card-footer-bg)", borderColor: "var(--border-color)" }}>
      <span id={titleId} className="inline-flex items-center gap-2 text-sm font-black"><BookOpenCheck aria-hidden="true" className="h-4 w-4" />{grouped ? card.type === "cloze" ? "完形填空" : "阅读理解" : "随堂一题"}</span>
      <span className="rounded border px-2 py-0.5 text-[10px] font-bold">{grouped ? `共 ${items.length} 题` : card.type === "multiple" ? "多选题" : card.type === "boolean" ? "判断题" : "单选题"}</span>
    </header>
    <div className="flex flex-col gap-5 p-3">
      {grouped ? <div className="space-y-3 rounded-lg border p-3" style={{ borderColor: "var(--fb-inactive-border)", background: "var(--card-footer-bg)" }}>
        <p className="m-0 text-xs font-bold">{card.type === "cloze" ? "阅读文章，为每个编号空位选择答案" : "阅读文章，完成下面的问题"}</p>
        <QuizText text={card.passage} onFollowUp={onFollowUp} />
      </div> : null}
      {grouped ? <p role="status" className="m-0 text-xs font-bold">{submitted ? `已提交 · 答对 ${correctCount}/${items.length} 题` : `已完成 ${completed}/${items.length} 题 · 整组提交后显示答案和解析`}</p> : null}
      {items.map((item, questionIndex) => <div key={questionIndex} className={questionIndex ? "border-t-2 border-dashed pt-5" : ""} style={{ borderColor: "var(--fb-inactive-border)" }}>
        <QuizQuestion quiz={item} number={grouped ? questionIndex + 1 : undefined} selected={selections[questionIndex] ?? []} submitted={submitted} disabled={disabled || !onSubmit} onFollowUp={onFollowUp} onChange={(optionIndex) => setDrafts((current) => {
          const updated = items.map((_, index) => current[index] ?? []);
          const selected = updated[questionIndex];
          updated[questionIndex] = item.type === "multiple" ? selected.includes(optionIndex) ? selected.filter((value) => value !== optionIndex) : [...selected, optionIndex] : [optionIndex];
          return updated;
        })} />
      </div>)}
      {!submitted ? <button type="button" disabled={disabled || !onSubmit || completed !== items.length} onClick={() => {
        const sorted = items.map((_, index) => [...selections[index]].sort((a, b) => a - b));
        onSubmit?.({ key: quizKey, raw, selected: grouped ? [] : sorted[0], ...(grouped ? { selections: sorted } : {}) });
      }} className="min-h-10 rounded-lg border-2 px-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-40" style={{ background: "var(--btn-send-bg)", color: "var(--btn-action-text)", borderColor: "var(--border-color)" }}>{grouped ? "提交整组答案" : "提交答案"}</button> : null}
    </div>
  </section>;
}
