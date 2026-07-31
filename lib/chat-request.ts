import { safeValidateUIMessages, type UIMessage } from "ai";
import { z } from "zod";
import {
  MAX_ASSISTANT_MESSAGE_LENGTH,
  MAX_CHAT_MESSAGES,
  MAX_CHAT_REQUEST_BYTES,
  MAX_CHAT_TOTAL_TEXT_LENGTH,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_MESSAGE,
  MAX_INPUT_LENGTH,
} from "./constants";
import { PERSONAS } from "./personas";

const requestEnvelopeSchema = z
  .object({
    // DefaultChatTransport includes these AI SDK protocol fields in every request.
    id: z.string().max(200),
    messages: z.unknown(),
    trigger: z.enum(["submit-message", "regenerate-message"]),
    messageId: z.string().max(200).optional(),
    personaId: z.string().max(50).optional(),
  })
  .strict();

const ALLOWED_ASSISTANT_PARTS = new Set([
  "text",
  "reasoning",
  "source-url",
  "step-start",
  "tool-google_search",
]);

const IMAGE_DATA_URL_PATTERN =
  /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/;

export interface ValidatedChatRequest {
  messages: UIMessage[];
  personaId: string;
}

export class ChatRequestError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 = 400,
  ) {
    super(message);
    this.name = "ChatRequestError";
  }
}

function decodedBase64Size(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function validateMessageContent(messages: UIMessage[]) {
  if (messages.length > MAX_CHAT_MESSAGES) {
    throw new ChatRequestError(`对话太长了，请新建对话后继续（最多 ${MAX_CHAT_MESSAGES} 条消息）`);
  }

  if (messages.at(-1)?.role !== "user") {
    throw new ChatRequestError("最后一条消息必须来自用户");
  }

  let totalTextLength = 0;

  for (const message of messages) {
    if (message.role !== "user" && message.role !== "assistant") {
      throw new ChatRequestError("消息角色不合法");
    }

    if (message.id.length > 200) {
      throw new ChatRequestError("消息 ID 不合法");
    }

    let messageTextLength = 0;
    let imageCount = 0;

    for (const part of message.parts) {
      if (part.type === "text") {
        messageTextLength += part.text.length;
        totalTextLength += part.text.length;
        continue;
      }

      if (message.role === "user" && part.type === "file") {
        const match = IMAGE_DATA_URL_PATTERN.exec(part.url);
        if (!match || part.mediaType !== match[1]) {
          throw new ChatRequestError("仅支持 JPEG、PNG、WebP 或 GIF 图片");
        }

        imageCount += 1;
        if (decodedBase64Size(match[2]) > MAX_IMAGE_BYTES) {
          throw new ChatRequestError("单张图片不能超过 1MB", 413);
        }
        continue;
      }

      if (message.role === "assistant" && ALLOWED_ASSISTANT_PARTS.has(part.type)) {
        continue;
      }

      throw new ChatRequestError("消息包含不支持的内容");
    }

    const textLimit =
      message.role === "user" ? MAX_INPUT_LENGTH : MAX_ASSISTANT_MESSAGE_LENGTH;
    if (messageTextLength > textLimit) {
      throw new ChatRequestError(
        message.role === "user"
          ? `单条消息最多 ${MAX_INPUT_LENGTH} 个字符`
          : "历史回复过长，请新建对话后继续",
      );
    }

    if (imageCount > MAX_IMAGES_PER_MESSAGE) {
      throw new ChatRequestError(`每条消息最多上传 ${MAX_IMAGES_PER_MESSAGE} 张图片`);
    }
  }

  if (totalTextLength > MAX_CHAT_TOTAL_TEXT_LENGTH) {
    throw new ChatRequestError("对话内容过长，请新建对话后继续", 413);
  }
}

export async function parseChatRequest(req: Request): Promise<ValidatedChatRequest> {
  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new ChatRequestError("请求格式必须是 JSON");
  }

  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_CHAT_REQUEST_BYTES) {
    throw new ChatRequestError("请求内容过大", 413);
  }

  const body = await req.text();
  if (new TextEncoder().encode(body).byteLength > MAX_CHAT_REQUEST_BYTES) {
    throw new ChatRequestError("请求内容过大", 413);
  }

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new ChatRequestError("JSON 格式不正确");
  }

  const envelopeResult = requestEnvelopeSchema.safeParse(json);
  if (!envelopeResult.success) {
    throw new ChatRequestError("请求参数不正确");
  }

  const messageResult = await safeValidateUIMessages({
    messages: envelopeResult.data.messages,
  });
  if (!messageResult.success) {
    throw new ChatRequestError("消息格式不正确");
  }

  validateMessageContent(messageResult.data);

  const personaId = envelopeResult.data.personaId ?? "default";
  if (!PERSONAS.some((persona) => persona.id === personaId)) {
    throw new ChatRequestError("人设不存在");
  }

  return {
    messages: messageResult.data,
    personaId,
  };
}
