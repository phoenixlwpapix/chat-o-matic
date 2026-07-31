"use client";

import { Globe, WifiOff } from "lucide-react";
import type { UIMessage } from "ai";

interface SourceListProps {
  messageId: string;
  parts: UIMessage["parts"];
  isComplete: boolean;
}

export function SourceList({
  messageId,
  parts,
  isComplete,
}: SourceListProps) {
  const sources = parts.filter((part) => part.type === "source-url");
  const usedSearch =
    sources.length > 0 ||
    parts.some(
      (part) =>
        part.type === "tool-google_search" ||
        part.type === "dynamic-tool",
    );

  if (!isComplete && sources.length === 0) return null;

  return (
    <div
      className="mt-3 border-t-2 border-dashed pt-2"
      style={{ borderColor: "var(--fb-inactive-border)" }}
    >
      <div className="mb-2 flex items-center gap-1.5">
        {usedSearch ? (
          <Globe className="h-3.5 w-3.5" style={{ color: "var(--source-text)" }} />
        ) : (
          <WifiOff className="h-3.5 w-3.5" style={{ color: "var(--fb-inactive-text)" }} />
        )}
        <span
          className="text-[10px] font-black uppercase tracking-wide"
          style={{
            color: usedSearch
              ? "var(--source-text)"
              : "var(--fb-inactive-text)",
          }}
        >
          {usedSearch ? "已联网参考" : "未使用联网"}
        </span>
      </div>

      {sources.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {sources.map((part, index) => {
            let hostname = part.url;
            try {
              hostname = new URL(part.url).hostname.replace(/^www\./, "");
            } catch {
              // Keep the URL as the fallback label.
            }

            return (
              <a
                key={`${messageId}-source-${index}`}
                href={part.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:brightness-95"
                style={{
                  backgroundColor: "var(--source-bg)",
                  color: "var(--source-text)",
                  borderColor: "var(--source-border)",
                }}
                title={part.title ?? part.url}
              >
                <Globe className="h-3 w-3 shrink-0" />
                <span className="max-w-[150px] truncate">
                  {part.title ?? hostname}
                </span>
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
