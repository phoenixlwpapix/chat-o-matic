import { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS } from "./constants";

interface RateLimitEntry {
  /** 请求时间戳队列 */
  timestamps: number[];
}

/** 进程内二次防护；生产环境的主要限流由 Vercel WAF 在边缘层完成。 */
const store = new Map<string, RateLimitEntry>();

/** 定期清理过期记录（每 5 分钟） */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of store) {
      entry.timestamps = entry.timestamps.filter(
        (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
      );
      if (entry.timestamps.length === 0) {
        store.delete(ip);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining?: number;
  retryAfterMs?: number;
}

function checkLocalRateLimit(ip: string): RateLimitResult {
  startCleanup();

  const now = Date.now();
  const entry = store.get(ip) ?? { timestamps: [] };
  entry.timestamps = entry.timestamps.filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
  );

  if (entry.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldest = entry.timestamps[0];
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - oldest);
    store.set(ip, entry);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  entry.timestamps.push(now);
  store.set(ip, entry);

  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - entry.timestamps.length,
  };
}

function getLocalClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

/**
 * 应用内的二次限流。生产环境还必须配置 Vercel WAF 的
 * `Chat API rate limit` 规则，以提供跨实例、不可绕过的边缘限流。
 */
export function checkRateLimit(request: Request): RateLimitResult {
  return checkLocalRateLimit(getLocalClientIp(request));
}
