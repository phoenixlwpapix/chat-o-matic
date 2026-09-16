"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, RefreshCw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PERSONAS, getPersonaById, type Persona } from "@/lib/personas";
import { cn } from "@/lib/utils";

interface PersonaSwitcherProps {
  open: boolean;
  personaId: string;
  hasActiveConversation: boolean;
  onOpenChange: (open: boolean) => void;
  onPersonaChange: (persona: Persona) => void;
}

export function PersonaSwitcher({
  open,
  personaId,
  hasActiveConversation,
  onOpenChange,
  onPersonaChange,
}: PersonaSwitcherProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [pendingPersonaId, setPendingPersonaId] = useState<string | null>(null);
  const pendingPersona = pendingPersonaId
    ? getPersonaById(pendingPersonaId)
    : null;

  const closeDialog = useCallback(() => {
    setPendingPersonaId(null);
    onOpenChange(false);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusFrame = requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDialog();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [closeDialog, open]);

  if (!open) return null;

  const selectPersona = (persona: Persona) => {
    if (persona.id === personaId) {
      setPendingPersonaId(null);
      return;
    }
    if (hasActiveConversation) {
      setPendingPersonaId(persona.id);
      return;
    }
    onPersonaChange(persona);
    closeDialog();
  };

  const confirmPersonaChange = () => {
    if (!pendingPersona) return;
    onPersonaChange(pendingPersona);
    closeDialog();
  };

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="persona-switcher-title"
        className="w-full max-w-[430px] overflow-hidden rounded-2xl border-[3px]"
        style={{
          borderColor: "var(--border-color)",
          backgroundColor: "var(--settings-panel-bg)",
          color: "var(--settings-option-text)",
          boxShadow: "7px 7px 0px 0px rgba(var(--shadow-color), 1)",
        }}
      >
        <header
          className="flex items-center justify-between border-b-2 px-4 py-3"
          style={{
            borderColor: "var(--border-color)",
            backgroundColor: "var(--header-bg)",
            color: "var(--header-text)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="grid h-8 w-8 place-items-center rounded-lg border-2"
              style={{
                borderColor: "var(--border-color)",
                backgroundColor: "var(--btn-new-bg)",
                color: "var(--btn-new-text)",
              }}
            >
              <RefreshCw className="h-4 w-4" />
            </span>
            <div>
              <h2 id="persona-switcher-title" className="text-sm font-black">
                快速切换人设
              </h2>
              <p className="text-[9px] font-bold opacity-60">选择新的聊天伙伴</p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeDialog}
            className="grid h-8 w-8 place-items-center rounded-lg border-2"
            style={{
              borderColor: "var(--border-color)",
              backgroundColor: "var(--btn-new-bg)",
              color: "var(--btn-new-text)",
            }}
            aria-label="关闭人设切换"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid grid-cols-2 gap-2.5 p-4">
          {PERSONAS.map((persona) => {
            const Icon = persona.icon;
            const isCurrent = persona.id === personaId;
            const isPending = persona.id === pendingPersonaId;
            const isSelected = isPending || (!pendingPersonaId && isCurrent);
            return (
              <button
                key={persona.id}
                type="button"
                onClick={() => selectPersona(persona)}
                aria-pressed={isSelected}
                className={cn(
                  "relative flex min-h-16 items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left transition-all",
                  "hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5",
                )}
                style={{
                  borderColor: "var(--border-color)",
                  backgroundColor: isPending
                    ? `var(${persona.colorVar})`
                    : "var(--settings-option-bg)",
                  color: isPending
                    ? "var(--prompt-card-text)"
                    : "var(--settings-option-text)",
                  boxShadow: isPending
                    ? "3px 3px 0px 0px rgba(var(--shadow-color), 1)"
                    : "none",
                }}
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border-2"
                  style={{
                    borderColor: "var(--border-color)",
                    backgroundColor: isCurrent
                      ? `var(${persona.colorVar})`
                      : "var(--prompt-card-icon-bg)",
                    color: "var(--prompt-card-text)",
                  }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-black">{persona.name}</span>
                  <span className="block truncate text-[9px] font-semibold opacity-55">
                    {persona.subtitle}
                  </span>
                </span>
                {isCurrent ? (
                  <span className="ml-auto flex items-center gap-1 text-[9px] font-black opacity-60">
                    <Check className="h-3 w-3" />
                    当前
                  </span>
                ) : null}
              </button>
            );
          })}
          <div
            className="flex min-h-16 items-center gap-2.5 rounded-xl border-2 border-dashed px-3 py-2.5"
            style={{
              borderColor: "var(--border-color)",
              backgroundColor: "var(--qp-2)",
              color: "var(--prompt-card-text)",
            }}
            aria-label="更多人设，敬请期待"
          >
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border-2"
              style={{
                borderColor: "var(--border-color)",
                backgroundColor: "var(--prompt-card-icon-bg)",
              }}
            >
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-black">更多人设</span>
              <span className="block text-[9px] font-semibold opacity-65">
                敬请期待
              </span>
            </span>
          </div>
        </div>

        {pendingPersona ? (
          <footer
            className="flex items-center justify-between gap-3 border-t-2 px-4 py-3"
            style={{
              borderColor: "var(--border-color)",
              backgroundColor: "var(--card-footer-bg)",
            }}
          >
            <p className="text-[10px] font-bold">
              切换到 <span className="font-black">{pendingPersona.name}</span>
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPendingPersonaId(null)}
              >
                取消
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={confirmPersonaChange}
                style={{
                  backgroundColor: "var(--header-bg)",
                  color: "var(--header-text)",
                  borderColor: "var(--border-color)",
                }}
              >
                确认并新建对话
              </Button>
            </div>
          </footer>
        ) : null}
      </section>
    </div>
  );
}
