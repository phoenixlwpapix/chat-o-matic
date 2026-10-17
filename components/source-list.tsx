"use client";

import { Globe } from "lucide-react";
import type { UIMessage } from "ai";
import { getSearchSummary } from "@/lib/search-sources";

interface SourceListProps {
  parts: UIMessage["parts"];
  metadata?: unknown;
  isComplete: boolean;
}

export function SourceList({
  parts,
  metadata,
  isComplete,
}: SourceListProps) {
  const summary = getSearchSummary(parts, metadata);
  if (!summary || (!isComplete && summary.sourceCount === 0)) return null;
  const { sourceCount } = summary;

  return (
    <div
      className="mt-3 border-t-2 border-dashed pt-2"
      style={{ borderColor: "var(--fb-inactive-border)" }}
    >
      <div className="flex items-center gap-1.5">
        <Globe
          aria-hidden="true"
          className="h-3.5 w-3.5"
          style={{ color: "var(--source-text)" }}
        />
        <span
          className="text-[10px] font-black uppercase tracking-wide"
          style={{ color: "var(--source-text)" }}
        >
          {sourceCount > 0 ? `已联网 · 参考 ${sourceCount} 个来源` : "已联网"}
        </span>
      </div>

    </div>
  );
}
