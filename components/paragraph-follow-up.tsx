"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { buildParagraphFollowUp } from "@/lib/paragraph-follow-up";
import { useReplyFollowUp } from "@/components/reply-follow-up";

export function ParagraphFollowUp({ quote, onFollowUp, children }: { quote: string; onFollowUp?: (prompt: string) => void; children: ReactNode }) {
  const [custom, setCustom] = useState(false);
  const [question, setQuestion] = useState("");
  const panelId = useId();
  const questionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const scope = useReplyFollowUp();
  const register = scope?.register;
  const enabled = Boolean(scope && onFollowUp && quote.trim());
  useEffect(() => enabled ? register?.(panelId) : undefined, [enabled, register, panelId]);
  const open = Boolean(scope && scope.activeId === panelId);
  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }, [open]);
  if (!scope || !onFollowUp || !quote.trim()) return <p>{children}</p>;
  const close = (restoreFocus = false) => scope.close(restoreFocus);
  const select = () => scope.select(panelId);
  const buttonClass = "min-h-8 rounded-md border px-2 py-1 text-xs font-bold transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40";
  const buttonStyle = { background: "var(--fb-inactive-bg)", borderColor: "var(--fb-inactive-border)", color: "var(--ai-bubble-text)" };
  return <div className="paragraph-follow-up relative my-3 rounded-md" data-follow-up-selected={open || undefined}>
    <div
      className={open ? "relative rounded-md" : scope.selecting ? "relative rounded-md transition-colors hover:bg-[var(--settings-selected-bg)] focus-within:bg-[var(--settings-selected-bg)]" : "relative"}
      style={open ? { background: "var(--settings-selected-bg)", color: "var(--settings-selected-text)", outline: "2px solid var(--settings-selected-border)", outlineOffset: 4 } : scope.selecting ? { outline: "1.5px dashed var(--settings-selected-border)", outlineOffset: 3 } : undefined}
    >
      <p className="!my-0">{children}</p>
      {scope.selecting && !open ? <button type="button" aria-label={`选择段落：${quote.slice(0, 60)}`} onClick={select} className="absolute -inset-1 z-10 cursor-pointer rounded-md bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2" /> : null}
    </div>
    {open ? <div ref={panelRef} id={panelId} className="not-prose mt-3 space-y-3 rounded-lg border-2 p-3" style={{ borderColor: "var(--border-color)", background: "var(--card-footer-bg)" }} onKeyDown={(event) => {
      if (event.key === "Escape") { event.stopPropagation(); close(true); }
    }}>
      <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold">针对这段追问</span><button type="button" aria-label="关闭段落追问" onClick={() => close(true)} className="inline-flex h-8 w-8 items-center justify-center rounded focus-visible:outline-2"><X aria-hidden="true" className="h-4 w-4" /></button></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} style={buttonStyle} onClick={() => { close(); onFollowUp(buildParagraphFollowUp(quote, "simplify")); }}>没看懂</button>
        <button type="button" className={buttonClass} style={buttonStyle} onClick={() => { close(); onFollowUp(buildParagraphFollowUp(quote, "example")); }}>举个例子</button>
        {/[a-zA-Z]{2,}\s+[a-zA-Z]{2,}/.test(quote) ? <button type="button" className={buttonClass} style={buttonStyle} onClick={() => { close(); onFollowUp(buildParagraphFollowUp(quote, "sentence")); }}>拆解句子</button> : null}
        <button type="button" className={buttonClass} style={buttonStyle} onClick={() => setCustom(true)}>我有疑问</button>
      </div>
      {custom ? <form className="space-y-2" onSubmit={(event) => {
        event.preventDefault();
        if (!question.trim()) return;
        onFollowUp(buildParagraphFollowUp(quote, "question", question));
        close(); setQuestion(""); setCustom(false);
      }}>
        <label htmlFor={questionId} className="block text-xs font-bold">这段哪里有疑问？</label>
        <textarea id={questionId} value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={600} rows={2} className="block w-full resize-y rounded-md border-2 p-2 text-base outline-offset-2" style={{ background: "var(--card-bg)", color: "var(--ai-bubble-text)", borderColor: "var(--fb-inactive-border)" }} />
        <button type="submit" disabled={!question.trim()} className={buttonClass} style={{ ...buttonStyle, background: "var(--btn-send-bg)", color: "var(--btn-action-text)" }}>带上原文提问</button>
      </form> : null}
    </div> : null}
  </div>;
}
