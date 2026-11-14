import { z } from "zod";

export const SCIENTIST_PERSONA_ID = "mad-scientist";
export const PENDULUM_PROMPT = "打开单摆实验。";
export const PENDULUM_PART_TYPE = "data-pendulum";
export const PENDULUM_SURFACE_ID = "pendulum";
export const PENDULUM_PATH = "/lengthCm";
export const PENDULUM_MIN_LENGTH = 25;
export const PENDULUM_MAX_LENGTH = 400;
export const PENDULUM_INITIAL_LENGTH = 100;
export const PENDULUM_GRAVITY = 9.81;
export const PENDULUM_AMPLITUDE = 10;
export const PENDULUM_DURATION = 8;

export const pendulumLengthSchema = z.number().int().min(PENDULUM_MIN_LENGTH).max(PENDULUM_MAX_LENGTH);
export const pendulumUpdateSchema = z.object({
  version: z.literal("1.0"),
  updateDataModel: z.object({
    surfaceId: z.literal(PENDULUM_SURFACE_ID),
    path: z.literal(PENDULUM_PATH),
    value: pendulumLengthSchema,
  }).strict(),
}).strict();

export type PendulumUpdate = z.infer<typeof pendulumUpdateSchema>;
export type PendulumPart = { type: typeof PENDULUM_PART_TYPE; data: PendulumUpdate };

export function createPendulumUpdate(lengthCm: number): PendulumUpdate {
  return { version: "1.0", updateDataModel: { surfaceId: PENDULUM_SURFACE_ID, path: PENDULUM_PATH, value: pendulumLengthSchema.parse(lengthCm) } };
}

export function readPendulumPart(part: unknown): PendulumPart | undefined {
  if (!part || typeof part !== "object" || !("type" in part) || part.type !== PENDULUM_PART_TYPE || !("data" in part)) return;
  const result = pendulumUpdateSchema.safeParse(part.data);
  if (result.success) return { type: PENDULUM_PART_TYPE, data: result.data };
}

export function pendulumPeriod(lengthCm: number) {
  return 2 * Math.PI * Math.sqrt(lengthCm / 100 / PENDULUM_GRAVITY);
}

export function pendulumAngle(time: number, period: number) {
  return PENDULUM_AMPLITUDE * Math.cos(2 * Math.PI * time / period);
}

export function formatPendulumLength(lengthCm: number) {
  return (lengthCm / 100).toFixed(2);
}

export function isPendulumRequest(text: string) {
  return /^(?:(?:请)?(?:打开|做|试试|看看|开始)?(?:一个)?(?:虚拟)?单摆(?:小)?实验|(?:请)?(?:讲讲|介绍一下|解释一下)(?:什么是)?单摆(?:的原理|的周期)?|(?:open (?:the )?)?pendulum (?:lab|experiment))[。！？.!?]?$/i.test(text.trim());
}

export function pendulumExplanationPrompt(lengthCm: number) {
  return `为什么单摆会这样摆动？请用实验当前的参数解释：摆长 ${formatPendulumLength(lengthCm)} 米，周期约 ${pendulumPeriod(lengthCm).toFixed(2)} 秒，初始摆角 ${PENDULUM_AMPLITUDE}°，重力加速度 ${PENDULUM_GRAVITY} 米/秒²。讲讲为什么摆长改变时，曲线上相邻两个波峰的间距会变。`;
}

export function isPendulumExplanation(text: string) {
  return text.startsWith("为什么单摆会这样摆动？请用实验当前的参数解释：");
}
