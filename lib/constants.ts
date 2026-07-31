/** 用户单条消息最大字符数 */
export const MAX_INPUT_LENGTH = 3000;

/** 聊天接口请求体最大 4 MiB */
export const MAX_CHAT_REQUEST_BYTES = 4 * 1024 * 1024;

/** 单次请求最多携带的历史消息数 */
export const MAX_CHAT_MESSAGES = 40;

/** 单次请求全部文本的最大字符数 */
export const MAX_CHAT_TOTAL_TEXT_LENGTH = 50_000;

/** 单条 AI 历史消息允许的最大字符数 */
export const MAX_ASSISTANT_MESSAGE_LENGTH = 12_000;

/** 每条用户消息最多携带的图片数 */
export const MAX_IMAGES_PER_MESSAGE = 4;

/** 单张图片解码后的最大字节数 */
export const MAX_IMAGE_BYTES = 1024 * 1024;

/** Rate limit: 时间窗口（毫秒），默认 1 小时 */
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/** Rate limit: 窗口内最大请求数 */
export const RATE_LIMIT_MAX_REQUESTS = 30;
