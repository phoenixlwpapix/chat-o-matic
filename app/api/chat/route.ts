import { google } from "@ai-sdk/google";
import { streamText, UIMessage, convertToModelMessages } from "ai";
import { headers } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import { MAX_INPUT_LENGTH } from "@/lib/constants";
import { getPersonaById } from "@/lib/personas";

// 允许流式响应持续更长时间（防止超时）
export const maxDuration = 30;

export async function POST(req: Request) {
  // 0. IP 限流检查
  const headersList = await headers();
  const forwardedFor = headersList.get("x-forwarded-for");
  const realIp = headersList.get("x-real-ip");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? realIp ?? "unknown";

  const rateLimitResult = checkRateLimit(ip);
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

  // 1. 从请求体中获取消息历史和人设选择
  const { messages, personaId }: { messages: UIMessage[]; personaId?: string } = await req.json();
  const persona = getPersonaById(personaId ?? "default");

  // 1.5 验证最后一条用户消息长度
  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");
  if (lastUserMessage) {
    const textLength = lastUserMessage.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .reduce((sum, p) => sum + p.text.length, 0);

    if (textLength > MAX_INPUT_LENGTH) {
      return Response.json(
        { error: `消息太长了！最多 ${MAX_INPUT_LENGTH} 个字符 ✂️` },
        { status: 400 },
      );
    }
  }

  // 2. 调用 Gemini 模型（含 Google Search 联网搜索）
  const result = streamText({
    model: google("gemini-3.1-flash-lite-preview"),
    tools: {
      google_search: google.tools.googleSearch({}),
    },
    system: persona.systemPrompt,
    // 3. 将 UI 消息格式转换为模型能理解的格式
    messages: await convertToModelMessages(messages),
  });

  // 4. 返回流式响应（含搜索来源）
  return result.toUIMessageStreamResponse({
    sendSources: true,
  });
}
