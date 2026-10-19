import { generateText, Output, streamText, convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, type LanguageModel, type UIMessage } from "ai";
import { z } from "zod";
import { buildReplyLanguagePrompt, type ReplyLanguage } from "./reply-languages";
import { getPublicChatErrorMessage } from "./chat-errors";
import { withQuizAnswerContext } from "./quizzes";
import { collectQuizResults, isQuizSummaryRequest, canFinishQuizPractice, buildQuizSummaryMarkdown, buildQuizSummaryAnalysisPrompt, QUIZ_COMPLETION_PROMPT } from "./quiz-summary";

/** Classify completion separately so ordinary replies retain their search tools and streaming. */
export async function createQuizPracticeResponse({ model, messages, personaPrompt, replyLanguage = "auto" }: {
  model: LanguageModel;
  messages: UIMessage[];
  personaPrompt: string;
  replyLanguage?: ReplyLanguage;
}): Promise<Response | null> {
  const summary = collectQuizResults(messages);
  if (!isQuizSummaryRequest(messages)) {
    if (!summary.results.length || summary.unanswered > 0 || !canFinishQuizPractice(messages)) return null;
    // The installed Google provider cannot mix function tools with Google Search.
    // A small structured decision keeps completion independent of the search mode.
    const decision = await generateText({
      model,
      system: QUIZ_COMPLETION_PROMPT,
      output: Output.object({ schema: z.object({ finishPractice: z.boolean() }) }),
      messages: await convertToModelMessages(withQuizAnswerContext(messages)),
      temperature: 0,
      maxOutputTokens: 128,
    });
    if (!decision.output.finishPractice) return null;
  }

  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: "start" });
      writer.write({ type: "text-start", id: "quiz-summary-overview" });
      writer.write({ type: "text-delta", id: "quiz-summary-overview", delta: buildQuizSummaryMarkdown(summary, replyLanguage) });
      writer.write({ type: "text-end", id: "quiz-summary-overview" });
      if (!summary.results.length) {
        writer.write({ type: "finish" });
        return;
      }
      const analysis = streamText({
        model,
        system: `${personaPrompt}\n\n${buildQuizSummaryAnalysisPrompt(summary)}\n\n${buildReplyLanguagePrompt(replyLanguage)}`,
        prompt: "请基于给出的本次作答数据，分析待加强的知识点并提出具体建议。",
      });
      writer.merge(analysis.toUIMessageStream({ sendStart: false, onError: getPublicChatErrorMessage }));
    },
    onError: (error) => {
      console.error("Quiz practice response failed", error instanceof Error ? error.message : "Unknown error");
      return getPublicChatErrorMessage(error);
    },
  });
  return createUIMessageStreamResponse({ stream });
}
