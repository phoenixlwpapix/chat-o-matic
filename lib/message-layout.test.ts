import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { getMessageLayout } from "./message-layout";

const compactChart = { type: "line", title: "变化", dataKind: "example", data: [{ label: "2024", value: 1 }, { label: "2025", value: 2 }, { label: "2026", value: 3 }] };
const wideChart = {
  type: "bar",
  title: "月度变化",
  dataKind: "example",
  data: Array.from({ length: 12 }, (_, index) => ({ label: `${index + 1}月`, value: index + 1 })),
};
const question = { type: "single", question: "1+1？", options: ["2", "3"], answer: [0], explanation: "1+1=2。" };
const sentence = { sentence: "I read.", translation: "我阅读。", backbone: "I read.", chunks: [{ text: "I", role: "subject", explanation: "主语。" }, { text: "read.", role: "predicate", explanation: "谓语。" }] };
const block = (type: string, value: unknown) => `\`\`\`${type}\n${JSON.stringify(value)}\n\`\`\``;
const message = (text: string): UIMessage => ({ id: "m", role: "assistant", parts: [{ type: "text", text }] });

describe("responsive reply layouts", () => {
  it("keeps story actions and compact charts at prose width while allowing dense charts to stay wide", () => {
    const choice = block("choice", { prompt: "去哪里？", options: ["走进森林", "沿河前行"] });
    expect(getMessageLayout(message(choice))).toBe("compact-cards");
    expect(getMessageLayout(message(`故事正文\n\n${choice}`))).toBe("text");
    expect(getMessageLayout(message('故事正文\n\n```choice\n{"prompt":'), true)).toBe("text");
    expect(getMessageLayout(message(`${choice}\n\n${block("chart", compactChart)}`))).toBe("compact-cards");
    expect(getMessageLayout(message(`${choice}\n\n${block("chart", wideChart)}`))).toBe("cards");
  });

  it.each([["chart", wideChart], ["quiz", question], ["quiz", { type: "reading", passage: "An article.", questions: [question] }], ["sentence", sentence]])("uses the card itself as the container for a valid %s reply", (type, value) => {
    expect(getMessageLayout(message(block(String(type), value)))).toBe("cards");
  });

  it("uses compact card layout for sparse charts and prose width when mixed with text", () => {
    expect(getMessageLayout(message(block("chart", compactChart)))).toBe("compact-cards");
    expect(getMessageLayout(message(`说明\n\n${block("chart", compactChart)}\n\n结论`))).toBe("text");
  });

  it("gives mixed replies room for wide cards without losing surrounding text or separate parts", () => {
    expect(getMessageLayout(message(`说明\n\n${block("chart", wideChart)}\n\n结论`))).toBe("mixed");
    expect(getMessageLayout({ ...message("说明"), parts: [{ type: "text", text: "说明" }, { type: "text", text: block("sentence", sentence) }] })).toBe("mixed");
    expect(getMessageLayout(message(`${block("chart", compactChart)}\n\n${block("quiz", question)}`))).toBe("cards");
  });

  it("keeps ordinary text, source code, invalid cards and user questions in bubbles", () => {
    for (const text of ["普通文字", block("json", compactChart), block("chart", {}), block("sentence", { ...sentence, chunks: [] })]) expect(getMessageLayout(message(text))).toBe("text");
    expect(getMessageLayout({ ...message(block("chart", wideChart)), role: "user" })).toBe("text");
  });

  it("supports restored and alternate fences and gives streaming wide cards early width", () => {
    expect(getMessageLayout(message(`~~~~chart\r\n${JSON.stringify(compactChart)}\r\n~~~~~`))).toBe("compact-cards");
    expect(getMessageLayout(message(`~~~~chart\r\n${JSON.stringify(wideChart)}\r\n~~~~~`))).toBe("cards");
    const pending = message('```quiz\n{"type":');
    expect(getMessageLayout(pending, true)).toBe("mixed");
    expect(getMessageLayout(pending)).toBe("text");
    expect(getMessageLayout(message('```chart\n{"type":'), true)).toBe("text");
  });
});
