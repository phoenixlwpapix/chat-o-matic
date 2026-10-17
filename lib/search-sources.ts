import type { UIMessage } from "ai";

export interface SearchSummary {
  sourceCount: number;
}

export function readSearchSummary(metadata: unknown): SearchSummary | undefined {
  if (typeof metadata !== "object" || metadata === null || !("search" in metadata)) return;
  const search = metadata.search;
  if (typeof search !== "object" || search === null) return;
  // Retain summaries saved before source-link counting was introduced.
  const count = "sourceCount" in search ? search.sourceCount
    : "websiteCount" in search ? search.websiteCount : undefined;
  if (typeof count === "number" && Number.isSafeInteger(count) && count >= 0) {
    return { sourceCount: count };
  }
}

/** Store only the visible summary, rather than full search tool payloads. */
export function getSearchSummary(
  parts: UIMessage["parts"],
  metadata?: unknown,
): SearchSummary | undefined {
  const sources = parts.filter((part) => part.type === "source-url");
  const usedSearch = sources.length > 0 || parts.some((part) =>
    part.type === "tool-google_search" ||
    (part.type === "dynamic-tool" && part.toolName === "google_search"),
  );
  if (!usedSearch) return readSearchSummary(metadata);

  const sourceCount = new Set(sources.map((source) => {
    try {
      const url = new URL(source.url);
      url.hash = "";
      return url.href;
    } catch {
      return source.url;
    }
  })).size;
  return { sourceCount };
}
