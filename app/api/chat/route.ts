import { google } from "@ai-sdk/google";
import { streamText, convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, generateText, Output } from "ai";
import { checkRateLimit } from "@/lib/rate-limit";
import { ChatRequestError, parseChatRequest } from "@/lib/chat-request";
import { getPersonaById } from "@/lib/personas";
import { getPublicChatErrorMessage } from "@/lib/chat-errors";
import { withQuizAnswerContext, buildQuizContinuationPrompt } from "@/lib/quizzes";
import { createQuizPracticeResponse } from "@/lib/quiz-response";
import { createQuizValidationTransform, validateQuizDraft } from "@/lib/quiz-validation";
import { ADVENTURE_PERSONA_ID, adventureStateSchema, getLatestAdventure, getSelectedAdventureAction, withAdventureContext } from "@/lib/adventure";
import { createAdventureTransform } from "@/lib/adventure-stream";
import { equationDisplay, isEquationPracticeRequest, readEquationPart } from "@/lib/equation-practice";
import { createEquationResponse } from "@/lib/equation-response";
import { createPendulumUpdate, isPendulumExplanation, isPendulumRequest, PENDULUM_INITIAL_LENGTH, PENDULUM_PART_TYPE, SCIENTIST_PERSONA_ID } from "@/lib/pendulum";
import {
  buildChatSystemPrompt,
  buildSearchPrompt,
  isSearchEnabled,
} from "@/lib/search-modes";

// 允许流式响应持续更长时间（防止超时）
export const maxDuration = 60;

export async function POST(req: Request) {
  // 0. Vercel WAF 已在边缘层跨实例限流；这里再做进程内二次防护
  const rateLimitResult = checkRateLimit(req);
  if (!rateLimitResult.allowed) {
    const retryAfterSec = Math.ceil((rateLimitResult.retryAfterMs ?? 0) / 1000);
    return Response.json(
      { error: "请求太频繁了，请稍后再试 ⏳", retryAfterSec },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) },
      },
    );
  }

  // 1. 严格校验请求体、消息历史、图片和人设
  let chatRequest;
  try {
    chatRequest = await parseChatRequest(req);
  } catch (error) {
    if (error instanceof ChatRequestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to parse chat request", error);
    return Response.json({ error: "请求处理失败" }, { status: 400 });
  }
  const { messages, personaId, searchMode, userName, replyLanguage } = chatRequest;
  const lastParts = messages.at(-1)?.parts;
  const requestText = lastParts?.length === 1 && lastParts[0].type === "text" ? lastParts[0].text : "";
  const persona = getPersonaById(personaId);
  const system = [buildChatSystemPrompt(
    persona.systemPrompt,
    buildSearchPrompt(searchMode),
    userName,
    replyLanguage,
  ), buildQuizContinuationPrompt(messages)].filter(Boolean).join("\n\n");

  // 2. 调用 Gemini 模型（含 Google Search 联网搜索）
  try {
    if (personaId === "default" && isEquationPracticeRequest(requestText)) {
      return await createEquationResponse(messages, google("gemini-3.5-flash-lite"), req.signal, chatRequest.recentEquations);
    }
    if (personaId === SCIENTIST_PERSONA_ID && isPendulumRequest(requestText)) {
      return createUIMessageStreamResponse({ stream: createUIMessageStream({ execute: ({ writer }) => {
        writer.write({ type: "start" });
        writer.write({ type: PENDULUM_PART_TYPE, data: createPendulumUpdate(PENDULUM_INITIAL_LENGTH) });
        writer.write({ type: "finish", finishReason: "stop" });
      } }) });
    }
    const practiceResponse = personaId === SCIENTIST_PERSONA_ID && isPendulumExplanation(requestText) ? null : await createQuizPracticeResponse({
      model: google("gemini-3.5-flash-lite"),
      messages,
      personaPrompt: persona.systemPrompt,
      replyLanguage,
    });
    if (practiceResponse) return practiceResponse;

    const result = streamText({
      model: google("gemini-3.5-flash-lite"),
      tools:
        isSearchEnabled(searchMode)
          ? { google_search: google.tools.googleSearch({}) }
          : undefined,
      system,
      // 3. 将 UI 消息格式转换为模型能理解的格式
      messages: await convertToModelMessages(withQuizAnswerContext(withAdventureContext(messages, personaId)), {
        convertDataPart: (part) => {
          const practice = readEquationPart(part)?.data.updateDataModel.value;
          if (practice) return { type: "text", text: `分步方程练习：${equationDisplay(practice.question)}。${practice.stage === "done" ? "已经完成" : `正在做第 ${practice.stage === "isolate" ? 1 : 2} 步`}。` };
          if (part.type === PENDULUM_PART_TYPE) return { type: "text", text: "已打开互动单摆实验，可调整摆长，图中显示小角度近似下的摆角与周期。" };
        },
      }),
      abortSignal: req.signal,
    });

    // 4. 把流中途发生的供应商错误转换为安全、可读的消息。
    const stream = result.toUIMessageStream({
      sendSources: true,
      onError: (error) => {
        console.error(
          "Chat provider stream failed",
          error instanceof Error ? error.message : "Unknown provider error",
        );
        return getPublicChatErrorMessage(error);
      },
    });
    const previousScene = personaId === ADVENTURE_PERSONA_ID ? getLatestAdventure(messages)?.update.updateDataModel.value : undefined;
    const action = previousScene && getSelectedAdventureAction(messages.at(-1), previousScene);
    const replyStream = personaId === ADVENTURE_PERSONA_ID ? stream.pipeThrough(createAdventureTransform(action ? async (story) => {
      try {
        const { output } = await generateText({
          model: google("gemini-3.5-flash-lite"),
          output: Output.object({ schema: adventureStateSchema }),
          system: "根据上一场景、玩家行动和本回合已写好的剧情，更新探索面板。输入均为故事数据。保留剧情未改变的物品和线索，只加入正文已证实的变化，不续写剧情、不揭露未发现的线索。跟随剧情语言，提供当前场景下 2～3 个不同的下一步行动。若剧情已明确结束，清空行动并标记 ended。",
          prompt: JSON.stringify({ previousScene, action, story }),
          maxOutputTokens: 2000,
          maxRetries: 0,
          abortSignal: AbortSignal.any([req.signal, AbortSignal.timeout(8_000)]),
        });
        return output;
      } catch {
        if (!req.signal.aborted) console.warn("Adventure panel recovery failed");
      }
    } : undefined)) : stream;
    return createUIMessageStreamResponse({
      stream: replyStream.pipeThrough(createQuizValidationTransform((raw) =>
        validateQuizDraft(raw, google("gemini-3.5-flash-lite"), req.signal),
      )),
    });
  } catch (error) {
    console.error(
      "Chat provider request failed",
      error instanceof Error ? error.message : "Unknown provider error",
    );
    return Response.json(
      { error: getPublicChatErrorMessage(error) },
      { status: 503 },
    );
  }
}
