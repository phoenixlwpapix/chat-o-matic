"use client";

import { useId, useState } from "react";
import { Languages } from "lucide-react";
import { parseSentence, SENTENCE_ROLES, type SentenceSpec } from "@/lib/sentences";
import { ParagraphFollowUp } from "@/components/paragraph-follow-up";

export function ChatSentence({ raw, pending, onFollowUp }: { raw: string; pending: boolean; onFollowUp?: (prompt: string) => void }) {
  const sentence = pending ? null : parseSentence(raw);
  if (!sentence) return <div role="status" className="not-prose my-4 rounded-xl border-2 border-dashed p-4 text-sm" style={{ borderColor: "var(--fb-inactive-border)" }}>{pending ? "句子拆解中…" : "这张句子拆解卡的数据不完整或片段与原句不符，请让助手重新拆解。"}</div>;
  return <SentenceCard key={raw} sentence={sentence} onFollowUp={onFollowUp} />;
}

function SentenceCard({ sentence, onFollowUp }: { sentence: SentenceSpec; onFollowUp?: (prompt: string) => void }) {
  const [active, setActive] = useState(0);
  const titleId = useId();
  const detailId = useId();
  const selected = sentence.chunks[active];
  return <section aria-labelledby={titleId} className="not-prose my-4 min-w-0 overflow-hidden rounded-xl border-2" style={{ borderColor: "var(--border-color)", background: "var(--card-bg)", color: "var(--ai-bubble-text)", boxShadow: "3px 3px 0 rgba(var(--shadow-color), 1)" }}>
    <header className="flex items-center gap-2 border-b-2 px-3 py-3" style={{ borderColor: "var(--border-color)", background: "var(--card-footer-bg)" }}><Languages aria-hidden="true" className="h-4 w-4" /><span id={titleId} className="text-sm font-black">句子拆解</span></header>
    <div className="space-y-4 p-3">
      <div className="max-w-[780px] break-words text-base font-bold leading-relaxed"><ParagraphFollowUp quote={sentence.sentence} onFollowUp={onFollowUp}><span lang="en">{sentence.sentence}</span></ParagraphFollowUp></div>
      <p className="m-0 max-w-[780px] text-sm leading-relaxed">{sentence.translation}</p>
      <div className="rounded-lg border-2 border-dashed p-3" style={{ borderColor: "var(--fb-inactive-border)" }}><p className="m-0 mb-1 text-xs font-black">先看主干</p><p lang="en" className="m-0 max-w-[780px] break-words font-bold">{sentence.backbone}</p></div>
      <div><p className="m-0 mb-2 text-xs opacity-75">点击句子片段，查看它在句中的作用</p>
        <div role="group" aria-label="句子成分" className="flex flex-wrap gap-2">
          {sentence.chunks.map((chunk, index) => <button key={index} type="button" aria-pressed={active === index} aria-controls={detailId} onClick={() => setActive(index)} className="max-w-full space-y-1 rounded-lg border-2 px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2" style={{ borderColor: active === index ? "var(--border-color)" : "var(--fb-inactive-border)", background: active === index ? "var(--settings-selected-bg)" : "var(--card-bg)", boxShadow: active === index ? "2px 2px 0 rgba(var(--shadow-color), 1)" : "none" }}><span className="block text-[10px] font-bold opacity-75">{SENTENCE_ROLES[chunk.role]}</span><span lang="en" className="block break-words text-sm font-bold">{chunk.text}</span></button>)}
        </div>
      </div>
      <div id={detailId} aria-live="polite" className="rounded-lg border p-3 text-sm leading-relaxed" style={{ borderColor: "var(--fb-inactive-border)", background: "var(--card-footer-bg)" }}>
        <p className="m-0 font-black">{SENTENCE_ROLES[selected.role]} · <span lang="en">{selected.text}</span></p>
        <div className="max-w-[780px]"><ParagraphFollowUp key={active} quote={`原句：${sentence.sentence}\n片段：${selected.text}\n解释：${selected.explanation}`} onFollowUp={onFollowUp}>{selected.explanation}</ParagraphFollowUp></div>
      </div>
      {sentence.vocabulary.length ? <dl className="m-0 space-y-2 border-t pt-3 text-sm" style={{ borderColor: "var(--fb-inactive-border)" }}>{sentence.vocabulary.map((item, index) => <div key={index}><dt lang="en" className="font-black">{item.word}</dt><dd className="m-0 mt-0.5 max-w-[780px] leading-relaxed">{item.meaning}</dd></div>)}</dl> : null}
    </div>
  </section>;
}
