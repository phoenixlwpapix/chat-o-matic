import { google } from "@ai-sdk/google";
import { streamText, convertToModelMessages } from "ai";
import { checkRateLimit } from "@/lib/rate-limit";
import { ChatRequestError, parseChatRequest } from "@/lib/chat-request";
import { getPersonaById } from "@/lib/personas";
import { getPublicChatErrorMessage } from "@/lib/chat-errors";
import {
  buildChatSystemPrompt,
  buildSearchPrompt,
  isSearchEnabled,
} from "@/lib/search-modes";

// 允许流式响应持续更长时间（防止超时）
export const maxDuration = 30;

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
  const { messages, personaId, searchMode, userName } = chatRequest;
  const persona = getPersonaById(personaId);
  const system = buildChatSystemPrompt(
    persona.systemPrompt,
    buildSearchPrompt(searchMode),
    userName,
  );

  // 2. 调用 Gemini 模型（含 Google Search 联网搜索）
  try {
    const result = streamText({
      model: google("gemini-3.5-flash-lite"),
      tools:
        isSearchEnabled(searchMode)
          ? { google_search: google.tools.googleSearch({}) }
          : undefined,
      system,
      // 3. 将 UI 消息格式转换为模型能理解的格式
      messages: await convertToModelMessages(messages),
    });

    // 4. 把流中途发生的供应商错误转换为安全、可读的消息。
    return result.toUIMessageStreamResponse({
      sendSources: true,
      onError: (error) => {
        console.error(
          "Chat provider stream failed",
          error instanceof Error ? error.message : "Unknown provider error",
        );
        return getPublicChatErrorMessage(error);
      },
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
