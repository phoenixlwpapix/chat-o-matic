import { disableAdvancedModel, enableAdvancedModel, getAdvancedModelAccess } from "@/lib/advanced-model-access";
import { checkRateLimit } from "@/lib/rate-limit";

const noStore = { "Cache-Control": "no-store" };

function isSecure(request: Request) {
  return process.env.VERCEL === "1" || new URL(request.url).protocol === "https:";
}

export async function GET() {
  return Response.json(await getAdvancedModelAccess(), { headers: noStore });
}

export async function POST(request: Request) {
  const limit = checkRateLimit(request, "advanced-model", 10);
  if (!limit.allowed) {
    return Response.json({ error: "尝试次数过多，请稍后再试。" }, {
      status: 429,
      headers: { ...noStore, "Retry-After": String(Math.ceil((limit.retryAfterMs ?? 0) / 1000)) },
    });
  }

  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return Response.json({ error: "请求格式错误。" }, { status: 415, headers: noStore });
  }

  let body: { password?: unknown } | null;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求格式错误。" }, { status: 400, headers: noStore });
  }

  const result = await enableAdvancedModel(body?.password, isSecure(request));
  if (result === "enabled") return Response.json({ enabled: true }, { headers: noStore });
  if (result === "unavailable") {
    return Response.json({ error: "高级模型暂不可用。" }, { status: 503, headers: noStore });
  }
  return Response.json({ error: "密码不正确，请检查大小写后重试。" }, { status: 401, headers: noStore });
}

export async function DELETE(request: Request) {
  await disableAdvancedModel(isSecure(request));
  return Response.json({ enabled: false }, { headers: noStore });
}
