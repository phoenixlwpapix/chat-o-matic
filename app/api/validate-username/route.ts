import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { checkRateLimit } from "@/lib/rate-limit";
import { MAX_USER_NAME_LENGTH } from "@/lib/constants";

export const maxDuration = 15;

export async function POST(req: Request) {
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

  let username = "";
  try {
    const body = await req.json();
    if (typeof body?.username !== "string") {
      return Response.json({ error: "用户名格式错误" }, { status: 400 });
    }
    username = body.username.trim();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  // 允许清空/留空，无需调用模型审核
  if (!username) {
    return Response.json({ valid: true });
  }

  if (username.length > MAX_USER_NAME_LENGTH) {
    return Response.json(
      {
        valid: false,
        reason: `用户名不能超过 ${MAX_USER_NAME_LENGTH} 个字符`,
      },
      { status: 400 },
    );
  }

  try {
    const { text } = await generateText({
      model: google("gemini-3.5-flash-lite"),
      system: `你是一名严谨客观的用户名内容安全审查员。你的任务是审查用户设置的昵称/用户名是否适宜。
【审查标准】
必须拦截以下三类不当内容：
1. 色情低俗（涉黄、性暗示、性器官、低俗恶趣味等）
2. 暴力恐怖（恐怖主义、血腥残暴、暴力威胁、自残等）
3. 粗鄙语言（污言秽语、脏话脏字、人身攻击、极端恶毒侮辱等）

输出规则：
- 如果包含上述不当内容，第一行必须输出 "INVALID: [简要原因]"（原因不超过15个字，例如"包含粗鄙侮辱词汇"、"包含色情低俗内容"、"包含暴力恐怖倾向"等）。
- 如果用户名正常适宜（包含普通个性昵称、调侃等，未触犯上述底线），第一行必须输出严格的 "VALID"。
请勿输出其他任何多余的解释或格式。`,
      prompt: `待审查的用户名：\n"${username}"`,
    });

    const trimmed = text.trim();
    if (trimmed.startsWith("INVALID")) {
      const reason =
        trimmed.replace(/^INVALID[:：]?\s*/, "").trim() ||
        "用户名包含色情、恐怖或粗鄙等不当语言";
      return Response.json({ valid: false, reason });
    }

    return Response.json({ valid: true });
  } catch (error) {
    console.error("Username validation failed:", error);
    return Response.json(
      { error: "安全检查服务暂时不可用，请稍后重试" },
      { status: 500 },
    );
  }
}
