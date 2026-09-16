"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Globe2,
  Radio,
  Settings2,
  Trash2,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { PERSONAS, getPersonaById, type Persona } from "@/lib/personas";
import { SEARCH_MODES, getSearchMode, type SearchMode } from "@/lib/search-modes";
import { type Theme } from "@/lib/use-theme";
import { cn } from "@/lib/utils";

const SEARCH_MODE_ICONS: Record<SearchMode, LucideIcon> = {
  auto: Radio,
  always: Globe2,
  off: WifiOff,
};

interface AppSettingsProps {
  open: boolean;
  personaId: string;
  searchMode: SearchMode;
  theme: Theme;
  hasActiveConversation: boolean;
  historyCount: number;
  onOpenChange: (open: boolean) => void;
  onPersonaChange: (persona: Persona) => void;
  onSearchModeChange: (mode: SearchMode) => void;
  onThemeChange: (theme: Theme) => void;
  onClearHistory: () => void;
}

export function AppSettings({
  open,
  personaId,
  searchMode,
  theme,
  hasActiveConversation,
  historyCount,
  onOpenChange,
  onPersonaChange,
  onSearchModeChange,
  onThemeChange,
  onClearHistory,
}: AppSettingsProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [pendingPersonaId, setPendingPersonaId] = useState<string | null>(null);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const selectedPersonaId = pendingPersonaId ?? personaId;
  const pendingPersona = pendingPersonaId
    ? getPersonaById(pendingPersonaId)
    : null;

  const closeDialog = useCallback(() => {
    setPendingPersonaId(null);
    setConfirmClearHistory(false);
    onOpenChange(false);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusFrame = requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDialog();
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [closeDialog, open]);

  if (!open) return null;

  const selectPersona = (persona: Persona) => {
    setConfirmClearHistory(false);
    setPendingPersonaId(persona.id === personaId ? null : persona.id);
  };

  const confirmPersonaChange = () => {
    if (!pendingPersona) return;
    onPersonaChange(pendingPersona);
    closeDialog();
  };

  const clearHistory = () => {
    onClearHistory();
    closeDialog();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-3 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-settings-title"
        className="flex max-h-[86vh] w-full max-w-[620px] flex-col overflow-hidden rounded-2xl border-[3px]"
        style={{
          borderColor: "var(--border-color)",
          backgroundColor: "var(--settings-panel-bg)",
          color: "var(--settings-option-text)",
          boxShadow: "8px 8px 0px 0px rgba(var(--shadow-color), 1)",
        }}
      >
        <header
          className="flex items-center justify-between gap-4 border-b-2 px-5 py-4"
          style={{
            borderColor: "var(--border-color)",
            backgroundColor: "var(--header-bg)",
            color: "var(--header-text)",
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="grid h-9 w-9 place-items-center rounded-lg border-2"
              style={{
                borderColor: "var(--border-color)",
                backgroundColor: "var(--btn-new-bg)",
                color: "var(--btn-new-text)",
                boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
              }}
            >
              <Settings2 className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 id="app-settings-title" className="text-lg font-black leading-none">
                设置
              </h2>
              <p className="mt-1 text-[10px] font-bold opacity-65">
                人设、联网与外观
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeDialog}
            className="grid h-9 w-9 place-items-center rounded-lg border-2 transition-transform hover:-translate-y-0.5"
            style={{
              borderColor: "var(--border-color)",
              backgroundColor: "var(--btn-new-bg)",
              color: "var(--btn-new-text)",
              boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
            }}
            aria-label="关闭设置"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-6 sm:px-6">
          <fieldset>
            <div className="mb-3 flex items-end justify-between gap-3">
              <legend className="text-xs font-black uppercase tracking-[0.16em]">
                选择人设
              </legend>
              <span className="text-[10px] font-semibold opacity-55">
                选择后确认切换
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
              {PERSONAS.map((persona) => {
                const Icon = persona.icon;
                const isSelected = persona.id === selectedPersonaId;
                return (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => selectPersona(persona)}
                    aria-pressed={isSelected}
                    className={cn(
                      "relative flex min-h-22 flex-col items-center justify-center gap-2 rounded-xl border-2 px-2 py-3 text-center transition-all",
                      "hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5",
                    )}
                    style={{
                      borderColor: "var(--border-color)",
                      backgroundColor: isSelected
                        ? `var(${persona.colorVar})`
                        : "var(--settings-option-bg)",
                      color: isSelected
                        ? "var(--prompt-card-text)"
                        : "var(--settings-option-text)",
                      boxShadow: isSelected
                        ? "3px 3px 0px 0px rgba(var(--shadow-color), 1)"
                        : "none",
                    }}
                    title={persona.subtitle}
                  >
                    <span
                      className="grid h-9 w-9 place-items-center rounded-lg border-2"
                      style={{
                        borderColor: "var(--border-color)",
                        backgroundColor: "var(--prompt-card-icon-bg)",
                        color: "var(--prompt-card-text)",
                      }}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <span className="text-[11px] font-black leading-tight">
                      {persona.name}
                    </span>
                    {isSelected ? (
                      <span
                        className="absolute right-1.5 top-1.5 grid h-4.5 w-4.5 place-items-center rounded-full border"
                        style={{
                          borderColor: "var(--border-color)",
                          backgroundColor: "var(--settings-selected-badge-bg)",
                          color: "var(--settings-selected-badge-text)",
                        }}
                        aria-hidden="true"
                      >
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div
            className="mt-7 grid gap-7 border-t-2 pt-7 sm:grid-cols-2"
            style={{ borderColor: "var(--border-color)" }}
          >
            <fieldset>
              <legend className="mb-3 text-xs font-black uppercase tracking-[0.16em]">
                联网模式
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {SEARCH_MODES.map((mode) => {
                  const Icon = SEARCH_MODE_ICONS[mode.id];
                  const isActive = mode.id === searchMode;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => onSearchModeChange(mode.id)}
                      aria-pressed={isActive}
                      className="flex h-14 flex-col items-center justify-center gap-1 rounded-lg border-2 px-2 transition-all hover:-translate-y-0.5"
                      style={{
                        borderColor: isActive
                          ? "var(--settings-selected-border)"
                          : "var(--border-color)",
                        backgroundColor: isActive
                          ? "var(--settings-selected-bg)"
                          : "var(--settings-option-bg)",
                        color: isActive
                          ? "var(--settings-selected-text)"
                          : "var(--settings-option-text)",
                        boxShadow: isActive
                          ? "2px 2px 0px 0px var(--settings-selected-border)"
                          : "none",
                      }}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-[10px] font-black">{mode.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[10px] font-semibold leading-relaxed opacity-60">
                {getSearchMode(searchMode).description}
              </p>
            </fieldset>

            <fieldset>
              <legend className="mb-3 text-xs font-black uppercase tracking-[0.16em]">
                主题配色
              </legend>
              <ThemeSwitcher theme={theme} setTheme={onThemeChange} variant="inline" />
            </fieldset>
          </div>

          <div
            className="mt-7 border-t-2 pt-7"
            style={{ borderColor: "var(--border-color)" }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em]">
                  历史记录
                </p>
                <p className="mt-1 text-[10px] font-semibold opacity-55">
                  {confirmClearHistory
                    ? "清空后无法恢复，当前对话也会重置"
                    : historyCount > 0
                      ? `已保存 ${historyCount} 段对话`
                      : "暂无历史记录"}
                </p>
              </div>

              {confirmClearHistory ? (
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmClearHistory(false)}
                  >
                    取消
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={clearHistory}
                    style={{
                      backgroundColor: "var(--hot-badge-bg)",
                      color: "var(--hot-badge-text)",
                      borderColor: "var(--border-color)",
                    }}
                  >
                    确认清空
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setPendingPersonaId(null);
                    setConfirmClearHistory(true);
                  }}
                  disabled={historyCount === 0}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-[11px] font-black transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-30"
                  style={{
                    borderColor: "var(--border-color)",
                    backgroundColor: "var(--settings-option-bg)",
                    color: "var(--hot-badge-bg)",
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  清空记录
                </button>
              )}
            </div>
          </div>
        </div>

        {pendingPersona ? (
          <footer
            className="flex flex-col gap-3 border-t-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
            style={{
              borderColor: "var(--border-color)",
              backgroundColor: "var(--card-footer-bg)",
            }}
          >
            <p className="text-xs font-bold">
              切换为 <span className="font-black">{pendingPersona.name}</span>
              {hasActiveConversation ? "，当前对话会自动保存" : ""}
            </p>
            <div className="flex justify-end gap-2">
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
                {hasActiveConversation ? "确认并新建对话" : "确认切换"}
              </Button>
            </div>
          </footer>
        ) : null}
      </section>
    </div>
  );
}
