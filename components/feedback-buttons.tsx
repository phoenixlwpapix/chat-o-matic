"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type MessageFeedback = "helpful" | "unclear";

interface FeedbackButtonsProps {
  messageId: string;
  currentFeedback: MessageFeedback | null;
  onFeedbackClick: (messageId: string, feedback: MessageFeedback) => void;
  isDisabled: boolean;
}

export function FeedbackButtons({
  messageId,
  currentFeedback,
  onFeedbackClick,
  isDisabled,
}: FeedbackButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onFeedbackClick(messageId, "helpful")}
        disabled={isDisabled}
        className={cn(
          "px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all",
          "hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
        style={{
          backgroundColor:
            currentFeedback === "helpful"
              ? "var(--fb-helpful-bg)"
              : "var(--fb-inactive-bg)",
          borderColor:
            currentFeedback === "helpful"
              ? "var(--border-color)"
              : "var(--fb-inactive-border)",
          color:
            currentFeedback === "helpful"
              ? "#fff"
              : "var(--fb-inactive-text)",
          boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
        }}
      >
        <span className="flex items-center gap-1.5">
          <ThumbsUp className="w-4 h-4" />
          <span>有帮助</span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => onFeedbackClick(messageId, "unclear")}
        disabled={isDisabled}
        className={cn(
          "px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all",
          "hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
        style={{
          backgroundColor:
            currentFeedback === "unclear"
              ? "var(--fb-unclear-bg)"
              : "var(--fb-inactive-bg)",
          borderColor:
            currentFeedback === "unclear"
              ? "var(--border-color)"
              : "var(--fb-inactive-border)",
          color:
            currentFeedback === "unclear"
              ? "#fff"
              : "var(--fb-inactive-text)",
          boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
        }}
      >
        <span className="flex items-center gap-1.5">
          <ThumbsDown className="w-4 h-4" />
          <span>没太懂</span>
        </span>
      </button>
    </div>
  );
}
