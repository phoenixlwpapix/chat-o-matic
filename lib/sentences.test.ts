import { describe, expect, it, vi } from "vitest";
import { simulateReadableStream, type UIMessageChunk } from "ai";
import { extractDraftSentenceText, parseSentence } from "./sentences";
import { createSentenceTransform } from "./sentence-stream";
import { buildChatSystemPrompt } from "./search-modes";
import { normalizeSessions, toStoredMessages } from "./chat-history";

const example = {
  sentence: "The book that I bought yesterday is interesting.", translation: "我昨天买的那本书很有趣。", backbone: "The book is interesting.",
  chunks: [{ text: "The book", role: "subject", explanation: "主语，指出谈论对象。" }, { text: "that I bought yesterday", role: "clause", explanation: "定语从句，修饰 book。" }, { text: "is", role: "predicate", explanation: "系动词。" }, { text: "interesting.", role: "complement", explanation: "表语，说明书的特点。" }],
};

async function runSentenceStream(
  text: string,
  recover?: Parameters<typeof createSentenceTransform>[0],
) {
  const chunks: UIMessageChunk[] = [
    { type: "text-start", id: "t" },
    ...Array.from(text, (delta): UIMessageChunk => ({ type: "text-delta", id: "t", delta })),
    { type: "text-end", id: "t" },
    { type: "finish" },
  ];
  const stream = simulateReadableStream({ chunks, initialDelayInMs: null, chunkDelayInMs: null })
    .pipeThrough(createSentenceTransform(recover));
  const result: UIMessageChunk[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    result.push(value);
  }
  return result.filter((chunk) => chunk.type === "text-delta").map((chunk) => chunk.delta).join("");
}

describe("sentence breakdown cards", () => {
  it("preserves sentence order and supports phrase boundaries without requiring character offsets", () => {
    const parsed = parseSentence(JSON.stringify(example));
    expect(parsed?.chunks).toHaveLength(4);
    expect(parsed?.sentence).toBe(example.sentence);
    expect(parsed?.vocabulary).toEqual([]);
    expect(parseSentence(JSON.stringify({ ...example, chunks: [{ text: example.sentence, role: "other", explanation: "整句说明" }] }))).not.toBeNull();
  });

  it("tolerates missing boundary punctuation and minor user-typo autocorrection on long sentences", () => {
    const longSentence = {
      label: "完整长句",
      sentence: "Theses legends are useful because they can tell us something about migrations of people who lived long ago, but non could write down what they did.",
      translation: "这些传说很有用，因为它们能告诉我们关于很久以前人们迁徙的一些情况，但当时没有人能把他们的事迹写下来。",
      backbone: "These legends are useful, but none could write down what they did.",
      chunks: [
        { text: "These legends", role: "subject", explanation: "主语（原句 Theses 为 These 的笔误）。" },
        { text: "are useful", role: "predicate", explanation: "系表结构，说明这些传说很有用。" },
        { text: "because they can tell us something about migrations of people who lived long ago", role: "clause", explanation: "原因状语从句，内部包含定语从句 who lived long ago。" },
        { text: "but", role: "connector", explanation: "转折连词，引出后半句。" },
        { text: "none could write down what they did", role: "clause", explanation: "转折分句（原句 non 为 none 的笔误），包含宾语从句 what they did。" },
      ],
    };
    const parsed = parseSentence(JSON.stringify(longSentence));
    expect(parsed).not.toBeNull();
    expect(parsed?.label).toBe("完整长句");
    expect(parsed?.chunks).toHaveLength(5);
  });

  it("rejects invented words, missing or repeated chunks, invalid roles and incomplete cards", () => {
    for (const changes of [{ chunks: example.chunks.slice(1) }, { chunks: [...example.chunks, example.chunks[0]] }, { chunks: [...example.chunks].reverse() }, { chunks: example.chunks.map((chunk) => ({ ...chunk, role: "unknown" })) }, { sentence: example.sentence.replace("book", "story") }, { translation: "" }, { chunks: [] }, { vocabulary: [{ word: "", meaning: "test" }] }, { script: "alert(1)" }]) {
      expect(parseSentence(JSON.stringify({ ...example, ...changes }))).toBeNull();
    }
    expect(parseSentence('{"sentence":')).toBeNull();
    expect(parseSentence("x".repeat(10_001))).toBeNull();
    expect(extractDraftSentenceText(JSON.stringify({ sentence: "Hello world.", chunks: [] }))).toBe("Hello world.");
  });

  it("passes valid sentence blocks through without recovery and repairs invalid long drafts into clause cards", async () => {
    const recover = vi.fn(async () => [
      {
        label: "前半句 · 原因",
        sentence: "These legends are useful because they can tell us something.",
        translation: "这些传说很有用，因为它们能告诉我们一些事情。",
        backbone: "These legends are useful.",
        chunks: [
          { text: "These legends", role: "subject" as const, explanation: "主语。" },
          { text: "are useful", role: "predicate" as const, explanation: "系表结构。" },
          { text: "because they can tell us something.", role: "clause" as const, explanation: "原因状语从句。" },
        ],
        vocabulary: [],
      },
      {
        label: "后半句 · 转折",
        sentence: "But none could write down what they did.",
        translation: "但没有人能把他们做的事写下来。",
        backbone: "None could write down what they did.",
        chunks: [
          { text: "But", role: "connector" as const, explanation: "转折连词。" },
          { text: "none", role: "subject" as const, explanation: "主语。" },
          { text: "could write down", role: "predicate" as const, explanation: "谓语。" },
          { text: "what they did.", role: "clause" as const, explanation: "宾语从句。" },
        ],
        vocabulary: [],
      },
    ]);

    const validStream = await runSentenceStream(`先看拆解：\n\`\`\`sentence\n${JSON.stringify(example)}\n\`\`\``, recover);
    expect(recover).not.toHaveBeenCalled();
    expect(validStream).toContain("先看拆解：");
    expect(validStream).toContain(example.sentence);

    const brokenDraft = JSON.stringify({ ...example, chunks: example.chunks.slice(1) });
    const repairedStream = await runSentenceStream(`长句分两步看：\n\`\`\`sentence\n${brokenDraft}\n\`\`\``, recover);
    expect(recover).toHaveBeenCalledTimes(1);
    expect(repairedStream).toContain("前半句 · 原因");
    expect(repairedStream).toContain("后半句 · 转折");
    expect(repairedStream.match(/```sentence/g)).toHaveLength(2);
  });

  it("restores sentence cards from chat history and includes generation instructions", () => {
    const text = `\`\`\`sentence\n${JSON.stringify(example)}\n\`\`\``;
    const messages = toStoredMessages([{ id: "sentence", role: "assistant", parts: [{ type: "text", text }] }]);
    const restored = normalizeSessions([{ id: "s", title: "句子", createdAt: 1, updatedAt: 1, messages }]);
    expect(restored[0].messages[0].parts[0]).toEqual({ type: "text", text });
    const prompt = buildChatSystemPrompt("人设", "联网");
    expect(prompt).toContain("【句子拆解卡】");
    expect(prompt).toContain("长难句分步拆解");
    expect(prompt).toContain("使用当前回复语言解释");
    expect(prompt).not.toContain("用中文解释成分");
    expect(prompt).toContain("不填写完形空位");
  });
});
