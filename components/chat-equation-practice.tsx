"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { ArrowRight, Check, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createEquationSurface } from "@/lib/equation-surface";
import { EQUATION_PATH, MAX_EQUATION_ANSWER, equationDisplay, equationSolution, isolatedRight, type EquationPractice, type EquationUpdate } from "@/lib/equation-practice";

export function ChatEquationPractice({ update, disabled, onAnswer, onNext }: {
  update: EquationUpdate;
  disabled: boolean;
  onAnswer: (answer: string, stage: "isolate" | "solve") => void;
  onNext?: () => void;
}) {
  const titleId = useId();
  const inputId = useId();
  const feedbackId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const solvedRef = useRef<HTMLParagraphElement>(null);
  const submittedStage = useRef<string | null>(null);
  const [bridge] = useState(() => createEquationSurface(update));
  const subscribe = useCallback((onChange: () => void) => {
    const subscription = bridge.surface.dataModel.subscribe(EQUATION_PATH, onChange);
    return () => subscription.unsubscribe();
  }, [bridge]);
  const readPractice = useCallback(() => bridge.surface.dataModel.get<EquationPractice>(EQUATION_PATH), [bridge]);
  const practice = useSyncExternalStore(subscribe, readPractice);
  const { question, stage, feedback } = practice;

  useEffect(() => { bridge.processor.processMessages(update); }, [bridge, update]);
  useEffect(() => {
    const subscription = bridge.surface.onAction.subscribe(({ name, context }) => {
      if (name === "checkAnswer" && typeof context.answer === "string" && (context.stage === "isolate" || context.stage === "solve")) onAnswer(context.answer, context.stage);
    });
    return () => subscription.unsubscribe();
  }, [bridge, onAnswer]);
  useEffect(() => {
    if (!submittedStage.current || submittedStage.current === stage) return;
    submittedStage.current = null;
    if (stage === "done") solvedRef.current?.focus({ preventScroll: true });
    else inputRef.current?.focus({ preventScroll: true });
  }, [stage]);

  const hints = {
    format: `请输入整数，或写成 ${stage === "isolate" ? `${question.coefficient}x = …` : "x = …"} 的形式。`,
    subtract: `等式右边也要减 ${question.constant}，两边才保持相等。`,
    isolate: `要消去左边的 +${question.constant}，两边同时减 ${question.constant}。再算算右边。`,
    divide: `把等式两边同时除以 ${question.coefficient}，再算一次。`,
  };

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || stage === "done" || stage !== update.updateDataModel.value.stage || !inputRef.current) return;
    submittedStage.current = stage;
    const answer = inputRef.current.value;
    inputRef.current.focus({ preventScroll: true });
    inputRef.current.select();
    void bridge.submit(answer, stage);
  }

  return (
    <section aria-labelledby={titleId} className="w-full max-w-[780px] rounded-xl border-2 border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--ai-bubble-text)] shadow-[3px_3px_0_rgba(var(--shadow-color),1)]">
      <header className="flex items-center justify-between gap-3 rounded-t-[10px] border-b-2 border-[var(--border-color)] bg-[var(--settings-selected-bg)] px-4 py-2.5">
        <h2 id={titleId} className="flex items-center gap-2 text-sm font-black"><PencilLine aria-hidden="true" className="size-4" />分步解题</h2>
        <span className="text-xs font-bold tabular-nums">{stage === "done" ? "2 / 2 完成" : `第 ${stage === "isolate" ? 1 : 2} 步 / 共 2 步`}</span>
      </header>
      <div className="space-y-4 p-4">
        <p className="rounded-lg border border-[var(--fb-inactive-border)] bg-[var(--card-footer-bg)] p-3 text-center font-mono text-xl font-bold">{equationDisplay(question)}</p>
        {stage !== "isolate" && (
          <p className="flex items-center gap-2 text-sm"><Check aria-hidden="true" className="size-4 shrink-0" />两边减 {question.constant}，得到 {question.coefficient}x = {isolatedRight(question)}。</p>
        )}
        {stage === "done" ? (
          <div className="space-y-3">
            <p ref={solvedRef} tabIndex={-1} className="font-bold">答对了，x = {equationSolution(question)}。</p>
            <p className="text-sm">代回原式，{question.coefficient} × ({equationSolution(question)}) + {question.constant} = {question.total}。</p>
            {onNext && <Button type="button" variant="outline" disabled={disabled} onClick={onNext} className="min-h-11 gap-2 bg-[var(--settings-selected-bg)] text-[var(--ai-bubble-text)] hover:bg-[var(--card-footer-bg)]">再练一道<ArrowRight aria-hidden="true" className="size-4" /></Button>}
          </div>
        ) : (
          <form key={stage} onSubmit={handleSubmit} className="space-y-2">
            <label htmlFor={inputId} className="block text-sm font-bold">{stage === "isolate" ? `两边同时减 ${question.constant}，右边等于多少？` : `两边同时除以 ${question.coefficient}，x 等于多少？`}</label>
            <div className="flex items-center gap-2">
              <span className="shrink-0 font-mono font-bold" aria-hidden="true">{stage === "isolate" ? `${question.coefficient}x =` : "x ="}</span>
              <input ref={inputRef} id={inputId} type="text" required maxLength={MAX_EQUATION_ANSWER} autoComplete="off" autoCapitalize="none" spellCheck={false} enterKeyHint="done" disabled={disabled} aria-invalid={Boolean(feedback)} aria-describedby={feedback ? feedbackId : undefined} className="min-h-11 w-full min-w-0 flex-1 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-base text-[var(--input-text)] focus-visible:outline-2 focus-visible:outline-offset-2 sm:max-w-56" />
              <Button type="submit" variant="outline" disabled={disabled} className="min-h-11 bg-[var(--settings-selected-bg)] text-[var(--ai-bubble-text)] hover:bg-[var(--card-footer-bg)]">检查</Button>
            </div>
            <p id={feedbackId} role="status" className="text-sm font-medium leading-relaxed">{feedback ? hints[feedback] : ""}</p>
          </form>
        )}
      </div>
    </section>
  );
}
