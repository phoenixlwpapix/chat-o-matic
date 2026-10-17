import { describe, expect, it } from "vitest";
import { parseChart } from "./charts";
import { normalizeSessions } from "./chat-history";
import { buildChatSystemPrompt } from "./search-modes";

const example = { type: "bar", title: "阅读时间", unit: "分钟", dataKind: "example", data: [{ label: "周一", value: 20 }, { label: "周二", value: 35 }] };
const parse = (changes: Record<string, unknown>) => parseChart(JSON.stringify({ ...example, ...changes }));

describe("chat charts", () => {
  it("accepts all supported types and preserves negative and zero Cartesian values", () => {
    for (const type of ["bar", "line", "donut"]) expect(parse({ type })?.type).toBe(type);
    expect(parse({ data: [{ label: "低温", value: -10 }, { label: "零度", value: 0 }] })).not.toBeNull();
  });

  it("rejects malformed, unsupported, excessive and nonfinite data", () => {
    expect(parseChart("{\"type\":" )).toBeNull();
    expect(parseChart("x".repeat(12_001))).toBeNull();
    expect(parse({ type: "script" })).toBeNull();
    expect(parse({ data: [] })).toBeNull();
    expect(parse({ data: Array.from({ length: 25 }, (_, index) => ({ label: String(index), value: index })) })).toBeNull();
    expect(parse({ data: [{ label: "a", value: 1e13 }] })).toBeNull();
    expect(parseChart(JSON.stringify(example).replace("20", "1e999"))).toBeNull();
    expect(parse({ data: [{ label: "a", value: 1 }, { label: "a", value: 2 }] })).toBeNull();
    expect(parse({ dataKind: undefined })).toBeNull();
  });

  it("requires nonnegative parts with a positive total for donut charts", () => {
    expect(parse({ type: "donut", data: [{ label: "a", value: 0 }] })).toBeNull();
    expect(parse({ type: "donut", data: [{ label: "a", value: -1 }, { label: "b", value: 2 }] })).toBeNull();
    expect(parse({ type: "donut", data: [{ label: "a", value: 0 }, { label: "b", value: 2 }] })).not.toBeNull();
  });

  it("requires a safe source URL for reference data", () => {
    expect(parse({ dataKind: "reference" })).toBeNull();
    for (const url of ["javascript:alert(1)", "data:text/html,test", "file:///test"]) {
      expect(parse({ dataKind: "reference", source: { title: "来源", url } })).toBeNull();
    }
    expect(parse({ dataKind: "reference", source: { title: "来源", url: "https://example.com/data" } })).not.toBeNull();
  });

  it("keeps chart blocks when restoring stored history", () => {
    const text = `\`\`\`chart\n${JSON.stringify(example)}\n\`\`\``;
    const sessions = normalizeSessions([{ id: "s", title: "图表", createdAt: 1, updatedAt: 1, messages: [{ id: "m", role: "assistant", parts: [{ type: "text", text }] }] }]);
    expect(sessions[0].messages[0].parts[0].text).toBe(text);
    expect(buildChatSystemPrompt("角色", "联网")).toContain("【图表】");
  });
});
