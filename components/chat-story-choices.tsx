"use client";

import { useId, useRef } from "react";
import { ArrowRight, Check, Compass } from "lucide-react";
import { buildStoryChoicePrompt, parseStoryChoices } from "@/lib/story-choices";

export interface StoryChoiceControls {
  disabled: boolean;
  reply?: string;
  onChoose?: (prompt: string) => void;
}

export function ChatStoryChoices({ raw, pending, ...controls }: StoryChoiceControls & { raw: string; pending: boolean }) {
  const choices = pending ? null : parseStoryChoices(raw);
  if (!choices) return <div role="status" className="not-prose my-4 w-full max-w-[780px] rounded-xl border-2 border-dashed p-4 text-sm" style={{ borderColor: "var(--fb-inactive-border)" }}>{pending ? "正在准备行动选项…" : "行动选项暂时无法显示，可以直接输入你想采取的行动。"}</div>;
  return <StoryChoiceCard key={raw} choices={choices} {...controls} />;
}

function StoryChoiceCard({ choices, disabled, reply, onChoose }: StoryChoiceControls & { choices: NonNullable<ReturnType<typeof parseStoryChoices>> }) {
  const titleId = useId();
  const sent = useRef(false);
  const selected = choices.options.find((option) => buildStoryChoicePrompt(option) === reply);
  return <section aria-labelledby={titleId} className="not-prose my-4 w-full min-w-0 max-w-[780px] overflow-hidden rounded-xl border-2" style={{ borderColor: "var(--border-color)", background: "var(--card-bg)", boxShadow: "3px 3px 0 rgba(var(--shadow-color), 1)" }}>
    <header className="flex items-center gap-2 border-b-2 px-3 py-3" style={{ borderColor: "var(--border-color)", background: "var(--card-footer-bg)" }}><Compass aria-hidden="true" className="h-4 w-4" /><span className="text-sm font-black">下一步行动</span></header>
    <div className="space-y-3 p-3">
      <p id={titleId} className="m-0 font-bold leading-relaxed">{choices.prompt}</p>
      <div className="grid gap-2">{choices.options.map((option, index) => <button key={option} type="button" disabled={disabled || Boolean(selected) || !onChoose} aria-pressed={selected === option} onClick={() => {
        if (sent.current || disabled || !onChoose) return;
        sent.current = true;
        onChoose(buildStoryChoicePrompt(option));
      }} className="flex min-h-12 items-center gap-3 rounded-lg border-2 px-3 py-3 text-left text-sm font-bold transition-colors enabled:hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default" style={{ borderColor: selected === option ? "var(--border-color)" : "var(--fb-inactive-border)", background: selected === option ? "var(--settings-selected-bg)" : "var(--card-bg)", opacity: disabled && selected !== option ? 0.65 : 1 }}><span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded border text-xs">{selected === option ? <Check className="h-4 w-4" /> : index + 1}</span><span className="min-w-0 flex-1 break-words">{option}</span>{selected !== option ? <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" /> : <span className="shrink-0 text-xs">已选择</span>}</button>)}</div>
      <p className="m-0 text-xs opacity-70">{disabled ? selected ? "这一步的选择已保留。" : "这是之前回合的选项。" : "点击一个选项继续，也可以在输入框写下自己的行动。"}</p>
    </div>
  </section>;
}
