"use client";

import {
  BookOpenCheck,
  Check,
  Copy,
  ListChecks,
  RefreshCw,
  ScanSearch,
  Sparkles,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const RESPONSE_ACTION_IDS = [
  "simplify",
  "example",
  "summary",
  "quiz",
  "verify",
] as const;

export type ResponseAction = (typeof RESPONSE_ACTION_IDS)[number];

interface ResponseActionDefinition {
  id: ResponseAction;
  label: string;
  prompt: string;
  icon: LucideIcon;
}

export const RESPONSE_ACTIONS: ResponseActionDefinition[] = [
  {
    id: "simplify",
    label: "更简单",
    prompt: "请把刚才的回答讲得更简单一些，一次只讲一个重点。",
    icon: Sparkles,
  },
  {
    id: "example",
    label: "举个例子",
    prompt: "请针对刚才的回答，举一个贴近日常生活的具体例子。",
    icon: Waypoints,
  },
  {
    id: "summary",
    label: "总结",
    prompt: "请把刚才的回答总结成不超过 3 个要点。",
    icon: ListChecks,
  },
  {
    id: "quiz",
    label: "出道题",
    prompt: "请根据刚才讲解的知识出一道题，先不要公布答案，等我回答后再讲解。",
    icon: BookOpenCheck,
  },
  {
    id: "verify",
    label: "检查事实",
    prompt: "请联网核查刚才回答中的关键事实，指出哪些得到来源支持，哪些仍不确定。",
    icon: ScanSearch,
  },
];

interface ResponseActionsProps {
  disabled: boolean;
  showLearningActions: boolean;
  isCopied: boolean;
  isRegenerating: boolean;
  onAction: (action: ResponseAction) => void;
  onCopy: () => void;
  onRegenerate: () => void;
}

export function ResponseActions({
  disabled,
  showLearningActions,
  isCopied,
  isRegenerating,
  onAction,
  onCopy,
  onRegenerate,
}: ResponseActionsProps) {
  return (
    <div
      className="mt-2 flex flex-wrap items-center justify-between gap-2"
      aria-label="回复操作"
    >
      <div className="flex flex-wrap gap-1.5">
        {showLearningActions
          ? RESPONSE_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => onAction(action.id)}
                  disabled={disabled}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold transition-all",
                    "hover:-translate-y-0.5 hover:brightness-95 active:translate-x-0.5 active:translate-y-0.5",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                  style={{
                    borderColor: "var(--fb-inactive-border)",
                    backgroundColor: "var(--fb-inactive-bg)",
                    color: "var(--fb-inactive-text)",
                  }}
                >
                  <Icon className="h-3 w-3" />
                  {action.label}
                </button>
              );
            })
          : null}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {showLearningActions ? (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={disabled}
            className={cn(
              "rounded-lg border-2 p-1.5 transition-all hover:-translate-y-0.5",
              "active:translate-x-0.5 active:translate-y-0.5",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
            style={{
              borderColor: "var(--border-color)",
              backgroundColor: "var(--fb-inactive-bg)",
              boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
            }}
            aria-label="重新生成"
            title="重新生成"
          >
            <RefreshCw
              className={cn("h-4 w-4", isRegenerating && "animate-spin")}
              style={{ color: "var(--fb-inactive-text)" }}
            />
          </button>
        ) : null}

        <button
          type="button"
          onClick={onCopy}
          className={cn(
            "rounded-lg border-2 p-1.5 transition-all hover:-translate-y-0.5",
            "active:translate-x-0.5 active:translate-y-0.5",
          )}
          style={{
            borderColor: "var(--border-color)",
            backgroundColor: "var(--fb-inactive-bg)",
            boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
          }}
          aria-label={isCopied ? "回复已复制" : "复制回复"}
          title={isCopied ? "回复已复制" : "复制回复"}
        >
          {isCopied ? (
            <Check
              className="h-4 w-4"
              style={{ color: "var(--fb-helpful-bg)" }}
            />
          ) : (
            <Copy
              className="h-4 w-4"
              style={{ color: "var(--fb-inactive-text)" }}
            />
          )}
        </button>
      </div>
    </div>
  );
}
