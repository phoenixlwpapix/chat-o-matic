import { describe, expect, it, vi } from "vitest";
import { normalizeSessions, toStoredMessages } from "./chat-history";
import { parseChatRequest } from "./chat-request";
import { createPendulumUpdate, isPendulumRequest, pendulumAngle, pendulumExplanationPrompt, pendulumPeriod, PENDULUM_PART_TYPE, PENDULUM_PATH, SCIENTIST_PERSONA_ID } from "./pendulum";
import { createPendulumSurface } from "./pendulum-surface";

describe("pendulum experiment", () => {
  it("uses a fixed time axis and doubles the period when the length quadruples", () => {
    const period = pendulumPeriod(100);
    expect(period).toBeCloseTo(2.006, 3);
    expect(pendulumPeriod(400)).toBeCloseTo(2 * period);
    expect(pendulumAngle(0, period)).toBe(10);
    expect(pendulumAngle(period / 4, period)).toBeCloseTo(0);
    expect(pendulumAngle(period / 2, period)).toBeCloseTo(-10);
    expect(pendulumAngle(period, period)).toBeCloseTo(10);
    expect(isPendulumRequest("讲讲单摆。")).toBe(true);
    expect(isPendulumRequest(pendulumExplanationPrompt(400))).toBe(false);
  });

  it("uses the current A2UI length for the explanation action", async () => {
    const bridge = createPendulumSurface(createPendulumUpdate(100));
    const onAction = vi.fn();
    const subscription = bridge.surface.onAction.subscribe(onAction);
    bridge.processor.processMessages(createPendulumUpdate(400));
    await bridge.explain(bridge.surface.dataModel.get<number>(PENDULUM_PATH));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ name: "explain", context: { lengthCm: 400 } }));
    expect(pendulumExplanationPrompt(400)).toContain("摆长 4.00 米，周期约 4.01 秒");
    subscription.unsubscribe();
    bridge.processor.dispose();
  });

  it("restores saved lengths and validates them when resuming chat", async () => {
    const part = { type: PENDULUM_PART_TYPE, data: createPendulumUpdate(240) } as const;
    const messages = toStoredMessages([
      { id: "a", role: "assistant", parts: [part] },
      { id: "u", role: "user", parts: [{ type: "text", text: pendulumExplanationPrompt(240) }] },
    ]);
    const [session] = normalizeSessions([{ id: "p", title: "单摆实验", personaId: SCIENTIST_PERSONA_ID, createdAt: 1, updatedAt: 1, messages }]);
    expect(session.messages[0].parts).toEqual([part]);
    const request = (items: unknown) => new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "p", trigger: "submit-message", personaId: SCIENTIST_PERSONA_ID, messages: items }),
    });
    await expect(parseChatRequest(request(session.messages))).resolves.toMatchObject({ messages });
    const invalid = { ...part, data: { ...part.data, updateDataModel: { ...part.data.updateDataModel, value: 0 } } };
    await expect(parseChatRequest(request([{ ...messages[0], parts: [invalid] }, messages[1]]))).rejects.toThrow();
  });
});
