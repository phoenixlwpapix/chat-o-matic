import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { getSearchSummary, readSearchSummary } from "./search-sources";
import { normalizeSessions, toStoredMessages, upsertSession } from "./chat-history";

const parts: UIMessage["parts"] = [
  { type: "text", text: "联网查询后的回答" },
  { type: "source-url", sourceId: "1", url: "https://www.example.com/a" },
  { type: "source-url", sourceId: "2", url: "https://example.com/b" },
  { type: "source-url", sourceId: "3", url: "https://other.example.org/a" },
];

describe("persisted search summary", () => {
  it("counts distinct redirect URLs on the same search host without counting duplicates", () => {
    const sources: UIMessage["parts"] = [
      { type: "source-url", sourceId: "1", url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/first" },
      { type: "source-url", sourceId: "2", url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/second" },
      { type: "source-url", sourceId: "3", url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/first#section" },
    ];
    expect(getSearchSummary(sources)).toEqual({ sourceCount: 2 });
  });

  it("counts different pages on the same site as separate sources", () => {
    expect(getSearchSummary([
      { type: "source-url", sourceId: "1", url: "https://example.com/a" },
      { type: "source-url", sourceId: "2", url: "https://example.com/b" },
      { type: "source-url", sourceId: "3", url: "https://example.com/a#other-section" },
    ])).toEqual({ sourceCount: 2 });
  });

  it("keeps legacy saved counts when the original source URLs are unavailable", () => {
    expect(readSearchSummary({ search: { websiteCount: 1 } })).toEqual({ sourceCount: 1 });
  });

  it("keeps source counts after serialization, normalization and another save", () => {
    const stored = toStoredMessages([{ id: "answer", role: "assistant", parts }]);
    const sessions = upsertSession([], "chat", stored, { personaId: "default", searchMode: "auto" }, 1);
    const restored = normalizeSessions(JSON.parse(JSON.stringify(sessions)));
    const message = restored[0].messages[0];
    expect(message.parts).toEqual([{ type: "text", text: "联网查询后的回答" }]);
    expect(getSearchSummary(message.parts, message.metadata)).toEqual({ sourceCount: 3 });
    expect(toStoredMessages([message])).toEqual(stored);
    expect(upsertSession(restored, "chat", toStoredMessages([message]), { personaId: "default", searchMode: "auto" }, 2)).toBe(restored);
  });

  it("persists search use even when the provider supplies no source URLs", () => {
    const stored = toStoredMessages([{
      id: "answer", role: "assistant", parts: [
        { type: "dynamic-tool", toolName: "google_search", toolCallId: "call", state: "output-available", input: {}, output: {} },
      ],
    }]);
    expect(getSearchSummary(stored[0].parts, stored[0].metadata)).toEqual({ sourceCount: 0 });
  });

  it("does not invent search use for legacy messages or unrelated tools", () => {
    expect(getSearchSummary([{ type: "text", text: "原来的回答" }])).toBeUndefined();
    expect(getSearchSummary([
      { type: "dynamic-tool", toolName: "calculator", toolCallId: "call", state: "output-available", input: {}, output: {} },
    ])).toBeUndefined();
  });

  it.each([null, {}, { search: { sourceCount: -1 } }, { search: { sourceCount: "2" } }, { search: { sourceCount: 1.5 } }])("rejects invalid metadata", (metadata) => {
    expect(readSearchSummary(metadata)).toBeUndefined();
  });
});
