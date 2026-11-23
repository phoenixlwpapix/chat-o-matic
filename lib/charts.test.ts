import { describe, expect, it } from "vitest";
import { getChartLayout, parseChart } from "./charts";
import { normalizeSessions } from "./chat-history";
import { buildChatSystemPrompt } from "./search-modes";

const example = { type: "bar", title: "阅读时间", unit: "分钟", dataKind: "example", data: [{ label: "周一", value: 20 }, { label: "周二", value: 35 }] };
const parse = (changes: Record<string, unknown>) => parseChart(JSON.stringify({ ...example, ...changes }));
const points = (count: number) => Array.from({ length: count }, (_, index) => ({ label: `项${index + 1}`, value: index + 1 }));

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
    expect(sessions[0].messages[0].parts[0]).toEqual({ type: "text", text });
    expect(buildChatSystemPrompt("角色", "联网")).toContain("【图表】");
  });

  it("scales chart card and SVG bounds proportionally to data density", () => {
    const smallBar = getChartLayout({ type: "bar", data: points(3) });
    const mediumBar = getChartLayout({ type: "bar", data: points(8) });
    const wideLine = getChartLayout({ type: "line", data: points(14) });
    const denseBar = getChartLayout({ type: "bar", data: points(24) });
    const donut = getChartLayout({ type: "donut", data: points(4) });

    expect(smallBar.cardMaxWidth).toBe(460);
    expect(smallBar.svgMaxWidth).toBe(smallBar.svgWidth);
    expect(smallBar.svgMinWidth).toBeLessThanOrEqual(300);
    expect(smallBar.needsWideLayout).toBe(false);

    expect(mediumBar.cardMaxWidth).toBeGreaterThan(smallBar.cardMaxWidth!);
    expect(mediumBar.needsWideLayout).toBe(false);

    expect(wideLine.needsWideLayout).toBe(true);
    expect(wideLine.cardMaxWidth).toBeGreaterThan(752);

    expect(denseBar.needsWideLayout).toBe(true);
    expect(denseBar.cardMaxWidth).toBeUndefined();
    expect(denseBar.svgMinWidth).toBe(denseBar.svgWidth);

    expect(donut.needsWideLayout).toBe(false);
    expect(donut.cardMaxWidth).toBeGreaterThanOrEqual(480);
    expect(donut.cardMaxWidth).toBeLessThanOrEqual(680);
  });
});
