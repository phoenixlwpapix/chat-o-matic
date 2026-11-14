import { z } from "zod";
import { calculateQuizExpression } from "./quiz-calculator";

export const EQUATION_PRACTICE_PROMPT = "我想做一道两步方程分步练习。";
export const EQUATION_PART_TYPE = "data-equation-practice";
export const EQUATION_SURFACE_ID = "equation-practice";
export const EQUATION_PATH = "/practice";
export const MAX_EQUATION_ANSWER = 48;
export const MAX_RECENT_EQUATIONS = 20;

export const equationQuestionSchema = z.object({
  coefficient: z.number().int().min(2).max(9),
  constant: z.number().int().min(1).max(9),
  total: z.number().int().min(-89).max(99),
}).strict().refine(({ coefficient, constant, total }) => (total - constant) % coefficient === 0);

const practiceSchema = z.object({
  question: equationQuestionSchema,
  stage: z.enum(["isolate", "solve", "done"]),
  feedback: z.enum(["format", "subtract", "isolate", "divide"]).optional(),
}).strict().refine(({ stage, feedback }) => !feedback || (stage === "isolate" ? feedback !== "divide" : stage === "solve" && ["format", "divide"].includes(feedback)));

export const equationUpdateSchema = z.object({
  version: z.literal("1.0"),
  updateDataModel: z.object({
    surfaceId: z.literal(EQUATION_SURFACE_ID),
    path: z.literal(EQUATION_PATH),
    value: practiceSchema,
  }).strict(),
}).strict();

export type EquationPractice = z.infer<typeof practiceSchema>;
export type EquationQuestion = EquationPractice["question"];
export type EquationUpdate = z.infer<typeof equationUpdateSchema>;
export type EquationPart = { type: typeof EQUATION_PART_TYPE; data: EquationUpdate };

export function readEquationPart(part: unknown): EquationPart | undefined {
  if (!part || typeof part !== "object" || !("type" in part) || part.type !== EQUATION_PART_TYPE || !("data" in part)) return;
  const result = equationUpdateSchema.safeParse(part.data);
  if (result.success) return { type: EQUATION_PART_TYPE, data: result.data };
}

export function createEquationPart(value: EquationPractice): EquationPart {
  return { type: EQUATION_PART_TYPE, data: { version: "1.0", updateDataModel: { surfaceId: EQUATION_SURFACE_ID, path: EQUATION_PATH, value } } };
}

export function equationDisplay({ coefficient, constant, total }: EquationQuestion) {
  return `${coefficient}x + ${constant} = ${total}`;
}

export function isolatedRight({ total, constant }: EquationQuestion) {
  return calculateQuizExpression(`${total} - ${constant}`);
}

export function equationSolution(question: EquationQuestion) {
  return calculateQuizExpression(`${isolatedRight(question)} / ${question.coefficient}`);
}

export function checkEquationAnswer(practice: EquationPractice, answer: string): EquationPractice {
  if (practice.stage === "done") return practice;
  const normalized = answer.normalize("NFKC").toLowerCase().trim().replace(/\s*([x=])\s*/g, "$1").replace(/−/g, "-");
  const prefix = practice.stage === "isolate" ? `${practice.question.coefficient}x=` : "x=";
  const value = normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
  if (answer.length > MAX_EQUATION_ANSWER || !/^[+-]?\d+$/.test(value)) return { ...practice, feedback: "format" };

  const number = Number(value);
  if (practice.stage === "isolate") {
    if (number === isolatedRight(practice.question)) return { question: practice.question, stage: "solve" };
    return { ...practice, feedback: number === practice.question.total ? "subtract" : "isolate" };
  }
  if (number === equationSolution(practice.question)) return { question: practice.question, stage: "done" };
  return { ...practice, feedback: "divide" };
}

export function isEquationPracticeRequest(text: string) {
  const request = text.trim();
  return /^(?:(?:我想|请|给我)?(?:做|来|出)?(?:一[道题个])?(?:两步方程|一元一次方程)?分步(?:解题|练习|方程练习)|(?:分步练习|分步解题)[：:]?\s*(?:两步方程|一元一次方程)|(?:start |give me )?(?:a )?step[- ]by[- ]step (?:equation|algebra) practice)[。.!！]?$/i.test(request);
}
