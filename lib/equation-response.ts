import { randomInt } from "node:crypto";
import { createUIMessageStream, createUIMessageStreamResponse, generateText, NoObjectGeneratedError, Output, type LanguageModel, type UIMessage } from "ai";
import { z } from "zod";
import { createEquationPart, equationDisplay, equationQuestionSchema, equationSolution, readEquationPart, type EquationQuestion } from "./equation-practice";
import { calculateQuizExpression } from "./quiz-calculator";

const equationDraftSchema = z.object({
  coefficient: z.number().int().min(2).max(9),
  constant: z.number().int().min(1).max(9),
  solution: z.number().int().min(-9).max(9),
}).strict();

export async function createEquationResponse(messages: UIMessage[], model: LanguageModel, signal: AbortSignal, recent: EquationQuestion[] = []) {
  const previous = new Set(recent.map(equationDisplay));
  for (const part of messages.flatMap(({ parts }) => parts)) {
    const card = readEquationPart(part);
    if (card) previous.add(equationDisplay(card.data.updateDataModel.value.question));
  }
  const generationSignal = AbortSignal.any([signal, AbortSignal.timeout(15_000)]);
  let feedback = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { output: draft } = await generateText({
        model,
        output: Output.object({ schema: equationDraftSchema }),
        system: "为初学者设计一道两步整数方程 ax + b = c。返回你设计的 coefficient（a）、constant（b）和 solution（整数解 x）。程序会计算右侧 c。参考本次的建议系数和解增加变化，避免列出的旧题。",
        prompt: JSON.stringify({ suggestedCoefficient: randomInt(2, 10), suggestedSolution: randomInt(2, 10) * (randomInt(2) ? 1 : -1), previous: [...previous], feedback }),
        temperature: 0.8,
        maxOutputTokens: 768,
        maxRetries: 0,
        abortSignal: generationSignal,
      });
      const { coefficient, constant, solution } = draft;
      const total = calculateQuizExpression(`${coefficient} * (${solution}) + ${constant}`);
      const checked = equationQuestionSchema.safeParse({ coefficient, constant, total });
      if (!checked.success || equationSolution(checked.data) !== solution) {
        feedback = "上次的方程验算失败，重新出一道整数解的题。";
        continue;
      }
      const question = checked.data;
      if (previous.has(equationDisplay(question))) {
        feedback = `上次重复了 ${equationDisplay(question)}，请出一道不同的题。`;
        continue;
      }
      return streamEquation(createEquationPart({ question, stage: "isolate" }));
    } catch (error) {
      if (!NoObjectGeneratedError.isInstance(error)) throw error;
      feedback = "上次的数据未通过校验，请重新出题并检查整数解。";
    }
  }
  return Response.json({ error: "这次没能生成通过验算的新题，请再试一次。" }, { status: 503 });
}

function streamEquation(part: ReturnType<typeof createEquationPart>) {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: "start" });
      writer.write(part);
      writer.write({ type: "finish", finishReason: "stop" });
    },
  });
  return createUIMessageStreamResponse({ stream });
}
