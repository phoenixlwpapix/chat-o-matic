import type { UIMessage, UIMessageChunk } from "ai";
import { describe, expect, it, vi } from "vitest";
import { ADVENTURE_PART_TYPE, ADVENTURE_PERSONA_ID, ADVENTURE_SCENE_PATH, ADVENTURE_SURFACE_ID, getLatestAdventure, getSelectedAdventureAction, withAdventureContext, type AdventureUpdate } from "./adventure";
import { createAdventureTransform } from "./adventure-stream";
import { createAdventureSurface } from "./adventure-surface";
import { normalizeSessions, toStoredMessages } from "./chat-history";
import { parseChatRequest } from "./chat-request";

const value = { location: "气闸室", inventory: ["手电筒"], clues: [], actions: ["检查控制台", "查看观察窗"], ended: false };
const update: AdventureUpdate = { version: "1.0", updateDataModel: { surfaceId: ADVENTURE_SURFACE_ID, path: ADVENTURE_SCENE_PATH, value } };
const part = { type: ADVENTURE_PART_TYPE, data: update } as const;
const fence = (raw: string) => `\n\n\`\`\`adventure\n${raw}\n\`\`\``;
const assistant: UIMessage = { id: "scene", role: "assistant", parts: [{ type: "text", text: "应急灯闪烁。" }, part] };
const user: UIMessage = { id: "turn", role: "user", parts: [{ type: "text", text: "我把手电筒留给队友" }] };
const inlineDraft = `\`\`\`adventure ${JSON.stringify(value)}\n\`\`\``;

async function readStream(text: string, finishReason: "stop" | "length" = "stop", recover?: Parameters<typeof createAdventureTransform>[0]) {
  const chunks: UIMessageChunk[] = [
    { type: "text-start", id: "t" },
    ...Array.from(text, (delta): UIMessageChunk => ({ type: "text-delta", id: "t", delta })),
    { type: "text-end", id: "t" },
    { type: "finish", finishReason },
  ];
  const stream = new ReadableStream<UIMessageChunk>({ start(controller) {
    chunks.forEach((chunk) => controller.enqueue(chunk));
    controller.close();
  } }).pipeThrough(createAdventureTransform(recover));
  const result: UIMessageChunk[] = [];
  const reader = stream.getReader();
  for (;;) {
    const next = await reader.read();
    if (next.done) return result;
    result.push(next.value);
  }
}

describe("adventure surface", () => {
  it("streams prose, hides the split draft, and emits one validated A2UI update", async () => {
    const example = "````md\n```adventure\nexample\n```\n````\n";
    const chunks = await readStream(example + "应急灯闪烁。" + fence(JSON.stringify(value)));
    expect(chunks.filter((chunk) => chunk.type === "text-delta").map((chunk) => chunk.delta).join("")).toBe(example + "应急灯闪烁。\n\n");
    expect(chunks.at(-2)).toEqual(part);
  });

  it("discards malformed, unclosed, and truncated drafts", async () => {
    for (const [draft, reason] of [[fence("{}"), "stop"], [fence(JSON.stringify(value)).slice(0, -3), "stop"], [fence(JSON.stringify(value)), "length"]] as const) {
      const chunks = await readStream("继续探索" + draft, reason);
      expect(chunks.filter((chunk) => chunk.type === "text-delta").map((chunk) => chunk.delta).join("")).toBe("继续探索\n\n");
      expect(chunks.some((chunk) => chunk.type === ADVENTURE_PART_TYPE)).toBe(false);
    }
  });

  it("recovers missing or invalid panel updates without rewriting the streamed story", async () => {
    const story = "你走进反应堆大厅，发现了一本工程师日志。";
    const next = { ...value, location: "反应堆大厅", clues: ["工程师日志"], actions: ["翻看日志", "检查冷却塔"] };
    const recover = vi.fn(async () => next);
    for (const draft of ["", fence("{}")]) {
      const chunks = await readStream(story + draft, "stop", recover);
      expect(recover).toHaveBeenLastCalledWith(draft ? `${story}\n\n` : story);
      expect(chunks.at(-2)).toEqual({ ...part, data: { ...update, updateDataModel: { ...update.updateDataModel, value: next } } });
    }
    expect(await readStream(story + fence(JSON.stringify(value)), "stop", recover)).toContainEqual(part);
    expect(await readStream(story, "length", recover)).not.toContainEqual(part);
    expect(recover).toHaveBeenCalledTimes(2);
  });

  it("identifies a submitted action from the previous panel", () => {
    const choice: UIMessage = { ...user, parts: [{ type: "text", text: "我选择：检查控制台" }] };
    expect(getSelectedAdventureAction(choice, value)).toBe("检查控制台");
    expect(getSelectedAdventureAction(user, value)).toBeUndefined();
    expect(getSelectedAdventureAction(choice, { ...value, actions: ["打开门", "返回"] })).toBeUndefined();
  });

  it.each([
    inlineDraft,
    `\`\`\`adventure${JSON.stringify(value)}\`\`\``,
    `~~~~ADVENTURE ${JSON.stringify(value)}\r\n~~~~`,
  ])("handles compact adventure fences split across stream chunks (%s)", async (draft) => {
    const prose = "现在，你扮演的角色是谁？\n";
    const chunks = await readStream(prose + draft);
    expect(chunks.filter((chunk) => chunk.type === "text-delta").map((chunk) => chunk.delta).join("")).toBe(prose);
    expect(chunks.at(-2)).toEqual(part);
  });

  it("repairs a leaked draft in stored storyteller history only", () => {
    const prose = "新巴比伦向你敞开了大门。\n";
    const reply = { ...assistant, parts: [{ type: "text", text: prose + inlineDraft }] };
    const session = { id: "s", title: "新巴比伦", createdAt: 1, updatedAt: 1, messages: [reply] };
    const [restored, other] = normalizeSessions([{ ...session, personaId: ADVENTURE_PERSONA_ID }, session]);
    expect(restored.messages[0].parts).toEqual([{ type: "text", text: prose }, part]);
    expect(getLatestAdventure(restored.messages)?.update).toEqual(update);
    expect(other.messages[0].parts).toEqual(reply.parts);
  });

  it("applies updates and emits actions on the same official A2UI surface", async () => {
    const bridge = createAdventureSurface();
    const listener = vi.fn();
    const action = bridge.surface.onAction.subscribe(listener);
    bridge.processor.processMessages(update);
    expect(bridge.surface.dataModel.get(ADVENTURE_SCENE_PATH)).toEqual(value);
    await bridge.dispatchAction(value.actions[0]);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ name: "chooseAction", surfaceId: ADVENTURE_SURFACE_ID, context: { action: "检查控制台" } }));
    const next = { ...value, inventory: [], clues: ["电力日志"], ended: true, actions: [] };
    bridge.processor.processMessages({ ...update, updateDataModel: { ...update.updateDataModel, value: next } });
    expect(bridge.processor.getSurface(ADVENTURE_SURFACE_ID)).toBe(bridge.surface);
    expect(bridge.surface.dataModel.get(ADVENTURE_SCENE_PATH)).toEqual(next);
    action.unsubscribe();
    bridge.processor.dispose();
  });

  it("preserves the update in history and in model context for a free-text turn", async () => {
    const messages = toStoredMessages([assistant, user]);
    const [restored] = normalizeSessions(JSON.parse(JSON.stringify([{ id: "s", title: "气闸室", createdAt: 1, updatedAt: 1, messages }])));
    const context = withAdventureContext(restored.messages, ADVENTURE_PERSONA_ID);
    expect(getLatestAdventure(restored.messages)).toEqual({ messageId: assistant.id, update });
    expect(context[0].parts.at(-1)).toEqual({ type: "text", text: expect.stringContaining("手电筒") });
    expect(context.at(-1)).toEqual(user);

    const request = (items: UIMessage[]) => new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "test", trigger: "submit-message", personaId: ADVENTURE_PERSONA_ID, messages: items }),
    });
    await expect(parseChatRequest(request(restored.messages))).resolves.toMatchObject({ messages });
    const badPart = { ...part, data: { ...update, updateDataModel: { ...update.updateDataModel, path: "/other" } } };
    await expect(parseChatRequest(request([{ ...assistant, parts: [badPart] }, user]))).rejects.toThrow("消息格式不正确");
    await expect(parseChatRequest(request([{ ...assistant, parts: [part, part] }, user]))).rejects.toThrow("消息包含不支持的内容");
  });
});
