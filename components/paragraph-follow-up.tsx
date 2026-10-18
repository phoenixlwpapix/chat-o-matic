"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { MessageCircleQuestion, X } from "lucide-react";
import { buildParagraphFollowUp } from "@/lib/paragraph-follow-up";
import { useReplyFollowUp } from "@/components/reply-follow-up";

export function ParagraphFollowUp({ quote, onFollowUp, children }: { quote: string; onFollowUp?: (prompt: string) => void; children: ReactNode }) {
  const [localOpen, setLocalOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [question, setQuestion] = useState("");
  const panelId = useId();
  const questionId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scope = useReplyFollowUp();
  const register = scope?.register;
  const enabled = Boolean(onFollowUp && quote.trim());
  useEffect(() => enabled ? register?.(panelId) : undefined, [enabled, register, panelId]);
  const open = scope ? scope.activeId === panelId : localOpen;
  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }, [open]);
  const close = (restoreFocus = false) => {
    if (scope) { scope.close(restoreFocus && scope.selecting); if (restoreFocus && !scope.selecting) triggerRef.current?.focus(); }
    else { setLocalOpen(false); if (restoreFocus) triggerRef.current?.focus(); }
  };
  const select = () => { if (scope) scope.select(panelId); else setLocalOpen(true); };
  if (!onFollowUp || !quote.trim()) return <p>{children}</p>;
  const buttonClass = "min-h-8 rounded-md border px-2 py-1 text-xs font-bold transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40";
  const buttonStyle = { background: "var(--fb-inactive-bg)", borderColor: "var(--fb-inactive-border)", color: "var(--ai-bubble-text)" };
  return <div className="paragraph-follow-up group/paragraph relative my-3 rounded-md" data-follow-up-selected={open || undefined}>
    <p className="!my-0 [@media(hover:hover)]:pr-9" style={open ? { background: "var(--settings-selected-bg)", outline: "2px solid var(--border-color)", outlineOffset: 4, borderRadius: 4 } : undefined}>{children}</p>
    {scope?.selecting && !open ? <button type="button" aria-label={`选择段落：${quote.slice(0, 60)}`} onClick={select} className="absolute inset-0 z-10 rounded-md hover:bg-[var(--settings-selected-bg)] focus-visible:outline-2 focus-visible:outline-offset-2" /> : null}
    {!scope?.selecting ? <button ref={triggerRef} type="button" aria-label="追问这段" title="追问这段" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => open ? close() : select()} className="not-prose absolute right-0 top-0 hidden h-8 w-8 items-center justify-center rounded-md opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-2 [@media(hover:hover)]:inline-flex group-hover/paragraph:opacity-65 group-focus-within/paragraph:opacity-100" style={{ color: "var(--ai-bubble-text)" }}><MessageCircleQuestion aria-hidden="true" className="h-4 w-4" /></button> : null}
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
