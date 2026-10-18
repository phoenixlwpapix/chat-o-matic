"use client";

import { createContext, useCallback, useContext, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { MessageCircleQuestion } from "lucide-react";

interface ReplyFollowUpScope {
  selecting: boolean;
  activeId: string | null;
  available: number;
  allowEntry: boolean;
  setTrigger: (node: HTMLButtonElement | null) => void;
  register: (id: string) => () => void;
  select: (id: string) => void;
  toggle: () => void;
  close: (restoreFocus?: boolean) => void;
}
const ReplyFollowUpContext = createContext<ReplyFollowUpScope | null>(null);
export const useReplyFollowUp = () => useContext(ReplyFollowUpContext);

export function ReplyFollowUpProvider({ disabled, allowEntry = true, children }: { disabled: boolean; allowEntry?: boolean; children: ReactNode }) {
  const [selection, setSelection] = useState<{ selecting: boolean; activeId: string | null }>({ selecting: false, activeId: null });
  const [available, setAvailable] = useState(0);
  const targets = useRef(new Set<string>());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const setTrigger = useCallback((node: HTMLButtonElement | null) => { triggerRef.current = node; }, []);
  const register = useCallback((id: string) => {
    targets.current.add(id);
    setAvailable(targets.current.size);
    return () => { targets.current.delete(id); setAvailable(targets.current.size); };
  }, []);
  // Reset transient interaction without remounting the reply or losing quiz drafts.
  if (disabled && (selection.selecting || selection.activeId !== null)) setSelection({ selecting: false, activeId: null });
  const close = (restoreFocus = false) => {
    setSelection({ selecting: false, activeId: null });
    if (restoreFocus) triggerRef.current?.focus();
  };
  return <ReplyFollowUpContext.Provider value={{
    selecting: selection.selecting && !disabled, activeId: disabled ? null : selection.activeId, available, allowEntry, setTrigger, register,
    select: (id) => setSelection((current) => ({ ...current, activeId: id })),
    toggle: () => setSelection((current) => ({ selecting: !current.selecting, activeId: null })),
    close,
  }}><div className="contents" onKeyDown={(event) => {
    if (event.key === "Escape" && (selection.selecting || selection.activeId)) { event.stopPropagation(); close(true); }
  }}>{children}</div></ReplyFollowUpContext.Provider>;
}

export function ReplyFollowUpButton({ disabled, className, style }: { disabled: boolean; className: string; style: CSSProperties }) {
  const scope = useReplyFollowUp();
  if (!scope || !scope.available || (!scope.allowEntry && scope.available < 2)) return null;
  return <>
    <button ref={(node) => scope.setTrigger(node)} type="button" disabled={disabled} aria-pressed={scope.selecting} onClick={scope.toggle} className={className} style={scope.selecting ? { ...style, backgroundColor: "var(--settings-selected-bg)", borderColor: "var(--border-color)" } : style}><MessageCircleQuestion aria-hidden="true" className="h-3 w-3" />{scope.selecting ? "取消选择" : "追问某段"}</button>
    {scope.selecting ? <span role="status" className="text-xs opacity-75">轻点想追问的段落</span> : null}
  </>;
}
