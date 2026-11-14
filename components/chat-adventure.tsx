"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, Backpack, Compass, MapPin, Search } from "lucide-react";
import { ADVENTURE_SCENE_PATH, type AdventureState, type AdventureUpdate } from "@/lib/adventure";
import { createAdventureSurface } from "@/lib/adventure-surface";
import { buildStoryChoicePrompt } from "@/lib/story-choices";

export function ChatAdventure({ update, messageId, disabled, awaitingUpdate, onRetry, onChoose, onMount }: {
  update: AdventureUpdate;
  messageId: string;
  disabled: boolean;
  awaitingUpdate: boolean;
  onRetry?: () => void;
  onChoose: (prompt: string) => void;
  onMount: () => void;
}) {
  const titleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const submittedMessage = useRef<string | null>(null);
  const [bridge] = useState(() => createAdventureSurface());
  const [subscribe] = useState(() => (onChange: () => void) => {
    const subscription = bridge.surface.dataModel.subscribe(ADVENTURE_SCENE_PATH, onChange);
    return () => subscription.unsubscribe();
  });

  useEffect(() => {
    bridge.processor.processMessages(update);
  }, [bridge, update]);

  useEffect(() => { onMount(); }, [onMount]);

  useEffect(() => {
    const subscription = bridge.surface.onAction.subscribe(({ name, context }) => {
      if (name === "chooseAction" && typeof context.action === "string") onChoose(buildStoryChoicePrompt(context.action));
    });
    return () => subscription.unsubscribe();
  }, [bridge, onChoose]);

  const scene = useSyncExternalStore(subscribe, () => bridge.surface.dataModel.get<AdventureState | undefined>(ADVENTURE_SCENE_PATH));
  const current = scene ?? update.updateDataModel.value;

  return (
    <section aria-labelledby={titleId} className="w-full min-w-0 max-w-[780px] rounded-xl border-2 border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--ai-bubble-text)] shadow-[3px_3px_0_rgba(var(--shadow-color),1)]">
      <header className="flex items-center justify-between gap-3 rounded-t-[10px] border-b-2 border-[var(--border-color)] bg-[var(--settings-selected-bg)] px-4 py-2.5">
        <h2 id={titleId} ref={headingRef} tabIndex={-1} className="flex items-center gap-2 text-sm font-black focus-visible:outline-2 focus-visible:outline-offset-2">
          <Compass aria-hidden="true" className="size-4 shrink-0" />探索面板
        </h2>
        {current.ended && <span className="text-xs font-bold">冒险已结束</span>}
      </header>
      <div className="space-y-3 p-3 sm:p-4">
        <p className="flex items-start gap-2 font-bold [overflow-wrap:anywhere]">
          <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0" /><span className="sr-only">当前地点：</span>{current.location}
        </p>
        <p className="sr-only" role="status">{current.ended ? "冒险已结束。" : ""}当前地点：{current.location}。背包 {current.inventory.length} 件物品，已发现 {current.clues.length} 条线索。</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <AdventureNotes title="背包" empty="背包是空的" icon={Backpack} items={current.inventory} />
          <AdventureNotes title="线索" empty="还没有发现线索" icon={Search} items={current.clues} />
        </div>
        {awaitingUpdate ? <p className="text-sm">正在更新行动选项…</p> : null}
        {onRetry ? (
          <div className="space-y-2">
            <p role="status" className="text-sm">行动选项暂时未更新。可以重试这一回合，或直接输入下一步行动。</p>
            <button type="button" onClick={onRetry} className="min-h-11 rounded-lg border border-[var(--border-color)] px-3 text-sm font-bold hover:bg-[var(--settings-selected-bg)] focus-visible:outline-2 focus-visible:outline-offset-2">重试这一回合</button>
          </div>
        ) : null}
        {current.actions.length > 0 && !disabled && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold">下一步行动</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {current.actions.map((action) => (
                <button key={action} type="button" disabled={disabled || !scene?.actions.includes(action) || !update.updateDataModel.value.actions.includes(action)} onClick={() => {
                  if (submittedMessage.current === messageId) return;
                  submittedMessage.current = messageId;
                  headingRef.current?.focus({ preventScroll: true });
                  void bridge.dispatchAction(action);
                }} className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-[var(--border-color)] px-3 py-2 text-left text-sm font-bold [overflow-wrap:anywhere] enabled:hover:bg-[var(--settings-selected-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-55">
                  {action}<ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function AdventureNotes({ title, empty, icon: Icon, items }: {
  title: string;
  empty: string;
  icon: typeof Backpack;
  items: string[];
}) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--fb-inactive-border)] bg-[var(--card-footer-bg)] px-3 py-2 text-sm [overflow-wrap:anywhere]">
      <h3 className="flex items-center gap-1.5 font-bold"><Icon aria-hidden="true" className="size-4 shrink-0" />{title} <span className="text-xs tabular-nums">{items.length}</span></h3>
      {items.length ? (
        <ul className="ml-4 mt-1 list-disc space-y-0.5 leading-relaxed">{items.map((item) => <li key={item}>{item}</li>)}</ul>
      ) : <p className="mt-1 text-xs leading-relaxed text-[var(--fb-inactive-text)]">{empty}</p>}
    </div>
  );
}
