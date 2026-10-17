"use client";

import {
  BookOpenCheck,
  Check,
  Copy,
  RefreshCw,
  ScanSearch,
  Sparkles,
  Waypoints,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  CircleHelp,
  ChartPie,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { getResponseActions, type ResponseAction, type ResponseActionContext } from "@/lib/response-actions";
export { RESPONSE_ACTIONS, type ResponseAction } from "@/lib/response-actions";

const ACTION_ICONS: Record<ResponseAction, LucideIcon> = {
  simplify: Sparkles, example: Waypoints, quiz: BookOpenCheck, verify: ScanSearch,
  "next-quiz": ArrowRight, "easier-quiz": ArrowDown, "harder-quiz": ArrowUp, "explain-quiz": CircleHelp,
  "quiz-summary": ChartPie,
};
interface ResponseActionsProps {
  disabled: boolean;
  showLearningActions: boolean;
  isCopied: boolean;
  isRegenerating: boolean;
  onAction: (action: ResponseAction) => void;
  onCopy: () => void;
  context?: ResponseActionContext;
  grouped?: boolean;
  onRegenerate: () => void;
}

export function ResponseActions({
  disabled,
  showLearningActions,
  isCopied,
  isRegenerating,
  onAction,
  onCopy,
  context = "answer",
  grouped = false,
  onRegenerate,
}: ResponseActionsProps) {
  const chipClassName = cn(
    "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold transition-all",
    "hover:-translate-y-0.5 hover:brightness-95 active:translate-x-0.5 active:translate-y-0.5",
    "disabled:cursor-not-allowed disabled:opacity-50",
  );

  const chipStyle = {
    borderColor: "var(--fb-inactive-border)",
    backgroundColor: "var(--fb-inactive-bg)",
    color: "var(--fb-inactive-text)",
  };

  const iconButtonClassName = cn(
    chipClassName,
    "h-7 w-7 justify-center gap-0 p-0",
  );

  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-1.5"
      aria-label="回复操作"
    >
      {showLearningActions
        ? getResponseActions(context, grouped).map((action) => {
            const Icon = ACTION_ICONS[action.id];
            const primary = action.id === "next-quiz" && context !== "quiz-unanswered";
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => onAction(action.id)}
                disabled={disabled}
                className={cn(chipClassName, primary && "border-2 px-3 py-1.5 text-xs font-black")}
                style={primary ? { ...chipStyle, backgroundColor: "var(--header-bg)", color: "var(--header-text)", borderColor: "var(--border-color)", boxShadow: "2px 2px 0 rgba(var(--shadow-color), 1)" } : chipStyle}
              >
                <Icon aria-hidden="true" className="h-3 w-3" />
                {action.label}
              </button>
            );
          })
        : null}

      {showLearningActions && context !== "quiz-unanswered" && context !== "quiz-answered" ? (
        <button
          type="button"
          onClick={onRegenerate}
          disabled={disabled}
          className={iconButtonClassName}
          style={chipStyle}
          aria-label="重新生成回复"
          title="重新生成"
        >
          <RefreshCw
            aria-hidden="true"
            className={cn(
              "h-3.5 w-3.5",
              isRegenerating && "animate-spin motion-reduce:animate-none",
            )}
          />
        </button>
      ) : null}

      <button
        type="button"
        onClick={onCopy}
        className={iconButtonClassName}
        style={chipStyle}
        aria-label={isCopied ? "回复已复制" : "复制回复"}
        title={isCopied ? "已复制" : "复制"}
      >
        {isCopied ? (
          <Check
            aria-hidden="true"
            className="h-3.5 w-3.5"
            style={{ color: "var(--fb-helpful-bg)" }}
          />
        ) : (
          <Copy aria-hidden="true" className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
