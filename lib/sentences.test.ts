import { describe, expect, it } from "vitest";
import { parseSentence } from "./sentences";
import { buildChatSystemPrompt } from "./search-modes";
import { normalizeSessions, toStoredMessages } from "./chat-history";

const example = {
  sentence: "The book that I bought yesterday is interesting.", translation: "我昨天买的那本书很有趣。", backbone: "The book is interesting.",
  chunks: [{ text: "The book", role: "subject", explanation: "主语，指出谈论对象。" }, { text: "that I bought yesterday", role: "clause", explanation: "定语从句，修饰 book。" }, { text: "is", role: "predicate", explanation: "系动词。" }, { text: "interesting.", role: "complement", explanation: "表语，说明书的特点。" }],
};

describe("sentence breakdown cards", () => {
  it("preserves sentence order and supports phrase boundaries without requiring character offsets", () => {
    const parsed = parseSentence(JSON.stringify(example));
    expect(parsed?.chunks).toHaveLength(4);
    expect(parsed?.sentence).toBe(example.sentence);
    expect(parsed?.vocabulary).toEqual([]);
    expect(parseSentence(JSON.stringify({ ...example, chunks: [{ text: example.sentence, role: "other", explanation: "整句说明" }] }))).not.toBeNull();
  });

  it("rejects invented words, missing or repeated chunks, invalid roles and incomplete cards", () => {
    for (const changes of [{ chunks: example.chunks.slice(1) }, { chunks: [...example.chunks, example.chunks[0]] }, { chunks: [...example.chunks].reverse() }, { chunks: example.chunks.map((chunk) => ({ ...chunk, role: "unknown" })) }, { sentence: example.sentence.replace("book", "story") }, { translation: "" }, { chunks: [] }, { vocabulary: [{ word: "", meaning: "test" }] }, { script: "alert(1)" }]) {
      expect(parseSentence(JSON.stringify({ ...example, ...changes }))).toBeNull();
    }
    expect(parseSentence('{"sentence":')).toBeNull();
    expect(parseSentence("x".repeat(10_001))).toBeNull();
  });

  it("restores sentence cards from chat history and includes generation instructions", () => {
    const text = `\`\`\`sentence\n${JSON.stringify(example)}\n\`\`\``;
    const messages = toStoredMessages([{ id: "sentence", role: "assistant", parts: [{ type: "text", text }] }]);
    const restored = normalizeSessions([{ id: "s", title: "句子", createdAt: 1, updatedAt: 1, messages }]);
    expect(restored[0].messages[0].parts[0].text).toBe(text);
    const prompt = buildChatSystemPrompt("人设", "联网");
    expect(prompt).toContain("【句子拆解卡】");
    expect(prompt).toContain("不填写完形空位");
  });
});
