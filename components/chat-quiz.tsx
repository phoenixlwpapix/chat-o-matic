"use client";

import { useId, useState } from "react";
import { BookOpenCheck, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { isCorrectAnswer, parseQuiz, type QuizAnswer } from "@/lib/quizzes";

function QuizText({ text }: { text: string }) {
  return <div className="quiz-text markdown-content min-w-0 break-words">
    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} disallowedElements={["img", "pre"]} unwrapDisallowed>{text}</ReactMarkdown>
  </div>;
}

export interface QuizControls {
  answers: QuizAnswer[];
  disabled: boolean;
  onSubmit?: (answer: QuizAnswer) => void;
  onFollowUp?: (text: string) => void;
}

export function ChatQuiz({ raw, pending, quizKey, answers, disabled, onSubmit }: QuizControls & { raw: string; pending: boolean; quizKey: string }) {
  const [draft, setDraft] = useState<number[]>([]);
  const titleId = useId();
  const quiz = pending ? null : parseQuiz(raw);
  const stored = answers.find((answer) => answer.key === quizKey && answer.raw === raw);
  const selected = stored?.selected ?? draft;
  if (!quiz) return <div role="status" className="not-prose my-4 rounded-xl border-2 border-dashed p-4 text-sm" style={{ borderColor: "var(--fb-inactive-border)" }}>
    {pending ? "题目生成中…" : "这道题的数据不完整或答案格式有误，请让助手重新出题。"}
  </div>;
  const submitted = Boolean(stored);
  const correct = isCorrectAnswer(quiz, selected);

  return <section className="not-prose my-4 min-w-0 overflow-hidden rounded-xl border-2" aria-labelledby={titleId} style={{ background: "var(--card-bg)", color: "var(--ai-bubble-text)", borderColor: "var(--border-color)", boxShadow: "3px 3px 0 rgba(var(--shadow-color), 1)" }}>
    <header className="flex items-center justify-between gap-2 border-b-2 px-3 py-2.5" style={{ background: "var(--card-footer-bg)", borderColor: "var(--border-color)" }}>
      <span className="inline-flex items-center gap-2 text-sm font-black"><BookOpenCheck aria-hidden="true" className="h-4 w-4" />随堂一题</span>
      <span className="rounded border px-2 py-0.5 text-[10px] font-bold">{quiz.type === "multiple" ? "多选题" : quiz.type === "boolean" ? "判断题" : "单选题"}</span>
    </header>
    <div className="flex flex-col gap-3 p-3">
      <div id={titleId} className="font-bold"><QuizText text={quiz.question} /></div>
      <fieldset disabled={disabled || submitted || !onSubmit} className="m-0 min-w-0 space-y-2 border-0 p-0">
        <legend className="mb-2 text-xs opacity-75">{quiz.type === "multiple" ? "选择所有符合条件的选项，再提交" : "选择一个答案，再提交"}</legend>
        {quiz.options.map((option, index) => {
          const checked = selected.includes(index);
          const right = submitted && quiz.answer.includes(index);
          return <label key={index} className="quiz-option relative flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2" style={{ borderColor: checked || right ? "var(--border-color)" : "var(--fb-inactive-border)", background: right ? "var(--fb-helpful-bg)" : checked ? "var(--settings-selected-bg)" : "var(--card-bg)", color: right ? "var(--prompt-card-text)" : "var(--ai-bubble-text)" }}>
            <input className="peer sr-only" type={quiz.type === "multiple" ? "checkbox" : "radio"} name={titleId} checked={checked} onChange={() => setDraft((current) => quiz.type === "multiple" ? current.includes(index) ? current.filter((value) => value !== index) : [...current, index] : [index])} />
            <span className="quiz-option-letter flex shrink-0 items-center justify-center rounded-md border-2 font-black" style={{ background: checked ? "var(--ai-bubble-text)" : "transparent", color: checked ? "var(--card-bg)" : "inherit", borderColor: checked ? "var(--ai-bubble-text)" : "var(--fb-inactive-border)" }}>{String.fromCharCode(65 + index)}</span>
            <div className="min-w-0 flex-1"><QuizText text={option} /></div>
            {submitted && (checked || right) && <span className="quiz-option-status inline-flex shrink-0 items-center gap-1 text-[10px] font-bold">{right && <Check aria-label="正确选项" className="h-4 w-4" />}{checked ? "已选" : ""}</span>}
          </label>;
        })}
      </fieldset>
      {!submitted ? <button type="button" disabled={disabled || !onSubmit || selected.length === 0} onClick={() => onSubmit?.({ key: quizKey, raw, selected: [...selected].sort((a, b) => a - b) })} className="min-h-10 rounded-lg border-2 px-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-40" style={{ background: "var(--btn-send-bg)", color: "var(--btn-action-text)", borderColor: "var(--border-color)" }}>提交答案</button> : <div role="status" className="space-y-2 border-t-2 border-dashed pt-3" style={{ borderColor: "var(--fb-inactive-border)" }}>
        <p className="m-0 text-sm font-black">{correct ? "答对了！" : "这次还差一点，看看解析"}</p>
        <p className="m-0 text-xs font-bold">正确答案：{quiz.answer.map((index) => String.fromCharCode(65 + index)).join("、")}</p>
        <div className="text-sm leading-relaxed"><QuizText text={quiz.explanation} /></div>

      </div>}
    </div>
  </section>;
}
