export const CHAT_ERROR_MESSAGES = {
  quota:
    "当前 AI 服务额度已用完或请求过多，请稍后再试。你的对话仍保留在这里。",
  forbidden:
    "AI 服务暂时无法访问，请稍后再试。如果一直出现，请联系管理员检查服务配置。",
  unavailable: "AI 服务现在有点忙，请稍后再试。你的对话仍保留在这里。",
  generic: "出了点小问题，请稍后再试。你的对话仍保留在这里。",
} as const;

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      message?: unknown;
      responseBody?: unknown;
    };
    return [candidate.message, candidate.responseBody]
      .filter((value): value is string => typeof value === "string")
      .join(" ");
  }

  return "";
}

function statusCodeFrom(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === "number" ? statusCode : undefined;
}

export function getPublicChatErrorMessage(error: unknown): string {
  const statusCode = statusCodeFrom(error);
  const text = errorText(error).toLowerCase();

  if (
    statusCode === 429 ||
    /\b429\b|resource_exhausted|quota|rate.?limit|too many requests|额度|限额/.test(
      text,
    )
  ) {
    return CHAT_ERROR_MESSAGES.quota;
  }

  if (
    statusCode === 401 ||
    statusCode === 403 ||
    /\b40[13]\b|permission_denied|forbidden|unauthorized|access denied/.test(text)
  ) {
    return CHAT_ERROR_MESSAGES.forbidden;
  }

  if (
    (statusCode !== undefined && statusCode >= 500) ||
    /\b50[0-4]\b|overloaded|service unavailable|bad gateway|gateway timeout/.test(
      text,
    )
  ) {
    return CHAT_ERROR_MESSAGES.unavailable;
  }

  return CHAT_ERROR_MESSAGES.generic;
}

export function getClientChatErrorMessage(
  rawMessage: string,
  statusCode?: number,
): string {
  try {
    const parsed: unknown = JSON.parse(rawMessage);
    if (typeof parsed === "object" && parsed !== null) {
      const message = (parsed as { error?: unknown }).error;
      if (typeof message === "string" && message.trim()) return message;
    }
  } catch {
    // 流式错误和边缘防火墙页面不一定是 JSON，继续按状态码和文本归类。
  }

  const knownMessage = Object.values(CHAT_ERROR_MESSAGES).find(
    (message) => message === rawMessage,
  );
  if (knownMessage) return knownMessage;

  return getPublicChatErrorMessage({ message: rawMessage, statusCode });
}
