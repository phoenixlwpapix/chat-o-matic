"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Globe2,
  Lightbulb,
  ListTree,
  MessagesSquare,
  Radio,
  Settings2,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  getLearningMode,
  LEARNING_MODES,
  type LearningMode,
} from "@/lib/learning-modes";
import {
  getSearchMode,
  SEARCH_MODES,
  type SearchMode,
} from "@/lib/search-modes";
import { cn } from "@/lib/utils";

const LEARNING_MODE_ICONS: Record<LearningMode, LucideIcon> = {
  chat: MessagesSquare,
  hint: Lightbulb,
  "step-by-step": ListTree,
  "check-answer": CheckCircle2,
};

const SEARCH_MODE_ICONS: Record<SearchMode, LucideIcon> = {
  auto: Radio,
  always: Globe2,
  off: WifiOff,
};

interface ChatSettingsProps {
  showLearningModes: boolean;
  learningMode: LearningMode;
  searchMode: SearchMode;
  onLearningModeChange: (mode: LearningMode) => void;
  onSearchModeChange: (mode: SearchMode) => void;
  disabled?: boolean;
}

export function ChatSettings({
  showLearningModes,
  learningMode,
  searchMode,
  onLearningModeChange,
  onSearchModeChange,
  disabled = false,
}: ChatSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const learningModeLabel = getLearningMode(learningMode).label;
  const searchModeLabel = getSearchMode(searchMode).label;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-controls="chat-settings-panel"
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-lg border-2 px-2.5 text-xs font-black",
          "transition-all hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
        style={{
          borderColor: "var(--border-color)",
          backgroundColor: "var(--btn-new-bg)",
          color: "var(--btn-new-text)",
          boxShadow: "3px 3px 0px 0px rgba(var(--shadow-color), 1)",
        }}
        title={
          showLearningModes
            ? `对话设置：${learningModeLabel} · ${searchModeLabel}`
            : `对话设置：${searchModeLabel}`
        }
      >
        <Settings2 className="h-4 w-4" />
        <span className="hidden max-w-44 truncate sm:inline">
          {showLearningModes
            ? `${learningModeLabel} · ${searchModeLabel}`
            : searchModeLabel}
        </span>
        <span className="sm:hidden">设置</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {isOpen ? (
        <div
          id="chat-settings-panel"
          role="dialog"
          aria-label="对话设置"
          className="absolute right-0 top-[calc(100%+0.65rem)] z-50 w-[calc(100vw-2rem)] max-w-sm rounded-xl border-2 p-3 sm:w-96"
          style={{
            borderColor: "var(--border-color)",
            backgroundColor: "var(--settings-panel-bg)",
            color: "var(--settings-option-text)",
            boxShadow: "7px 7px 0px 0px rgba(var(--shadow-color), 1)",
          }}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black">对话设置</p>
              <p
                className="mt-0.5 text-[11px] font-semibold"
                style={{ color: "var(--settings-option-muted)" }}
              >
                {showLearningModes
                  ? "学习与联网设置会立即保存"
                  : "当前人设使用自由闲聊，可设置联网方式"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md border-2 p-1 transition-transform hover:-translate-y-0.5"
              style={{
                borderColor: "var(--border-color)",
                backgroundColor: "var(--settings-option-bg)",
                color: "var(--settings-option-text)",
              }}
              aria-label="关闭对话设置"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {showLearningModes ? (
            <fieldset disabled={disabled}>
              <legend
                className="mb-1.5 text-[11px] font-black uppercase tracking-wider"
                style={{ color: "var(--settings-option-muted)" }}
              >
                学习模式
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {LEARNING_MODES.map((mode) => {
                  const Icon = LEARNING_MODE_ICONS[mode.id];
                  const isActive = mode.id === learningMode;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => onLearningModeChange(mode.id)}
                      aria-pressed={isActive}
                      className={cn(
                        "relative min-h-17 rounded-lg border-2 p-2 text-left transition-all",
                        "hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50",
                      )}
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
                          ? "3px 3px 0px 0px var(--settings-selected-border)"
                          : "none",
                      }}
                    >
                      <span className="flex items-center gap-1.5 pr-4 text-xs font-black">
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        {mode.label}
                      </span>
                      <span
                        className="mt-1 block text-[10px] font-semibold leading-tight"
                        style={{
                          color: isActive
                            ? "var(--settings-selected-muted)"
                            : "var(--settings-option-muted)",
                        }}
                      >
                        {mode.description}
                      </span>
                      {isActive ? (
                        <span
                          className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full"
                          style={{
                            backgroundColor:
                              "var(--settings-selected-badge-bg)",
                            color: "var(--settings-selected-badge-text)",
                          }}
                          aria-hidden="true"
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          <fieldset
            className={showLearningModes ? "mt-3" : "mt-0"}
            disabled={disabled}
          >
            <legend
              className="mb-1.5 text-[11px] font-black uppercase tracking-wider"
              style={{ color: "var(--settings-option-muted)" }}
            >
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
                    className="relative min-h-16 rounded-lg border-2 p-2 text-left transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
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
                        ? "3px 3px 0px 0px var(--settings-selected-border)"
                        : "none",
                    }}
                  >
                    <span className="flex items-center gap-1 text-[11px] font-black">
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {mode.shortLabel}
                    </span>
                    <span
                      className="mt-1 block text-[9px] font-semibold leading-tight"
                      style={{
                        color: isActive
                          ? "var(--settings-selected-muted)"
                          : "var(--settings-option-muted)",
                      }}
                    >
                      {mode.description}
                    </span>
                    {isActive ? (
                      <span
                        className="absolute right-1 top-1 grid h-4.5 w-4.5 place-items-center rounded-full"
                        style={{
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
        </div>
      ) : null}
    </div>
  );
}
