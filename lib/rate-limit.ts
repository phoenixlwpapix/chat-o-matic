import { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS } from "./constants";

interface RateLimitEntry {
    /** 请求时间戳队列 */
    timestamps: number[];
}

/** 内存存储：IP → 请求记录 */
const store = new Map<string, RateLimitEntry>();

/** 定期清理过期记录（每 5 分钟） */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
    if (cleanupTimer) return;
    cleanupTimer = setInterval(() => {
        const now = Date.now();
        for (const [ip, entry] of store) {
            // 过滤掉窗口外的时间戳
            entry.timestamps = entry.timestamps.filter(
                (ts) => now - ts < RATE_LIMIT_WINDOW_MS
            );
            // 如果没有记录了，删除该 IP
            if (entry.timestamps.length === 0) {
                store.delete(ip);
            }
        }
    }, CLEANUP_INTERVAL_MS);
    // 允许 Node.js 进程正常退出
    if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
        cleanupTimer.unref();
    }
}

/**
 * 检查给定 IP 是否超出速率限制。
 * @returns `{ allowed: true, remaining }` 或 `{ allowed: false, retryAfterMs }`
 */
export function checkRateLimit(ip: string): {
    allowed: boolean;
    remaining: number;
    retryAfterMs?: number;
} {
    startCleanup();

    const now = Date.now();
    const entry = store.get(ip) ?? { timestamps: [] };

    // 滑动窗口：只保留窗口内的时间戳
    entry.timestamps = entry.timestamps.filter(
        (ts) => now - ts < RATE_LIMIT_WINDOW_MS
    );

    if (entry.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
        // 计算最早记录到期时间
        const oldest = entry.timestamps[0];
        const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - oldest);
        store.set(ip, entry);
        return { allowed: false, remaining: 0, retryAfterMs };
    }

    // 记录本次请求
    entry.timestamps.push(now);
    store.set(ip, entry);

    return {
        allowed: true,
        remaining: RATE_LIMIT_MAX_REQUESTS - entry.timestamps.length,
    };
}
