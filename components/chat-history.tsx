"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { History, Trash2, MessageSquare, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatSession } from "@/lib/use-chat-history";
import { getPersonaById } from "@/lib/personas";
import { MAX_FAVORITE_SESSIONS } from "@/lib/chat-history";

interface ChatHistoryProps {
    sessions: ChatSession[];
    currentSessionId: string | null;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onToggleFavorite: (id: string) => void;
    variant?: "dropdown" | "sidebar";
}

/** Format a timestamp to a short relative string */
function relativeTime(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "刚刚";
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}天前`;
    return new Date(ts).toLocaleDateString("zh-CN");
}

function sessionContext(session: ChatSession): string {
    return getPersonaById(session.personaId).name;
}

export function ChatHistory({
    sessions,
    currentSessionId,
    onSelect,
    onDelete,
    onToggleFavorite,
    variant = "dropdown",
}: ChatHistoryProps) {
    const [open, setOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [filter, setFilter] = useState<"all" | "favorites">("all");
    const favoriteCount = sessions.filter((session) => session.isFavorite).length;
    const visibleSessions = filter === "favorites"
        ? sessions.filter((session) => session.isFavorite)
        : sessions;

    // 点击外部关闭
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (
                panelRef.current &&
                !panelRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
                setConfirmDeleteId(null);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const handleSelect = useCallback(
        (id: string) => {
            onSelect(id);
            setOpen(false);
            setConfirmDeleteId(null);
        },
        [onSelect],
    );

    const handleDelete = useCallback(
        (e: React.MouseEvent, id: string) => {
            e.stopPropagation();
            if (confirmDeleteId === id) {
                onDelete(id);
                setConfirmDeleteId(null);
            } else {
                setConfirmDeleteId(id);
            }
        },
        [onDelete, confirmDeleteId],
    );

    const handleFavorite = useCallback(
        (event: React.MouseEvent, id: string) => {
            event.stopPropagation();
            onToggleFavorite(id);
        },
        [onToggleFavorite],
    );

    // ── Sidebar variant ──
    if (variant === "sidebar") {
        return (
            <div className="flex-1 min-h-0 flex flex-col">
                <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
                    <p
                        className="text-[10px] font-black uppercase tracking-wider"
                        style={{ color: "var(--header-subtitle)" }}
                    >
                        历史记录
                    </p>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setFilter("all")}
                            aria-pressed={filter === "all"}
                            className="rounded px-1.5 py-0.5 text-[9px] font-black"
                            style={{
                                backgroundColor: filter === "all" ? "var(--header-bg)" : "transparent",
                                color: filter === "all" ? "var(--header-text)" : "var(--header-subtitle)",
                            }}
                        >
                            全部
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilter("favorites")}
                            aria-pressed={filter === "favorites"}
                            className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-black"
                            style={{
                                backgroundColor: filter === "favorites" ? "var(--qp-2)" : "transparent",
                                color: filter === "favorites" ? "var(--prompt-card-text)" : "var(--header-subtitle)",
                            }}
                            title="收藏夹"
                        >
                            <Star className="h-2.5 w-2.5" fill={filter === "favorites" ? "currentColor" : "none"} />
                            {favoriteCount}
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto min-h-0 space-y-1">
                    {visibleSessions.length === 0 ? (
                        <p
                            className="text-xs font-bold px-1 py-2 opacity-40"
                            style={{ color: "var(--foreground)" }}
                        >
                            {filter === "favorites" ? "暂无收藏" : "暂无历史记录"}
                        </p>
                    ) : (
                        visibleSessions.map((session) => {
                            const isActive = session.id === currentSessionId;
                            return (
                                <div
                                    key={session.id}
                                    className={cn(
                                        "group/item relative flex items-center rounded-lg text-left transition-colors",
                                        "hover:brightness-95",
                                    )}
                                    style={{
                                        backgroundColor: isActive ? "var(--header-bg)" : "transparent",
                                        color: isActive ? "var(--header-text)" : "var(--foreground)",
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => onSelect(session.id)}
                                        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                                    >
                                        <MessageSquare className="w-3 h-3 shrink-0 opacity-50" />
                                        <span className="flex-1 min-w-0">
                                            <span className="block text-xs font-bold truncate">{session.title}</span>
                                            <span className="block text-[10px] opacity-50 truncate">
                                                {sessionContext(session)} · {relativeTime(session.updatedAt)}
                                            </span>
                                        </span>
                                    </button>
                                    <div
                                        className={cn(
                                            "absolute right-1 top-1/2 flex -translate-y-1/2 items-center rounded-md pl-1 transition-opacity",
                                            confirmDeleteId === session.id
                                                ? "opacity-100"
                                                : "opacity-0 group-hover/item:opacity-100 group-focus-within/item:opacity-100",
                                        )}
                                        style={{
                                            backgroundColor: isActive ? "var(--header-bg)" : "var(--card-bg)",
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={(event) => handleFavorite(event, session.id)}
                                            disabled={!session.isFavorite && favoriteCount >= MAX_FAVORITE_SESSIONS}
                                            className="shrink-0 rounded p-1 transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-25"
                                            aria-label={session.isFavorite ? `取消收藏${session.title}` : `收藏${session.title}`}
                                            title={
                                                !session.isFavorite && favoriteCount >= MAX_FAVORITE_SESSIONS
                                                    ? `收藏夹最多 ${MAX_FAVORITE_SESSIONS} 条`
                                                    : session.isFavorite ? "取消收藏" : "收藏"
                                            }
                                        >
                                            <Star
                                                className="h-3.5 w-3.5"
                                                fill={session.isFavorite ? "var(--qp-2)" : "none"}
                                                style={{ color: session.isFavorite ? "var(--qp-2)" : "var(--fb-inactive-text)" }}
                                            />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(event) => handleDelete(event, session.id)}
                                            className="m-1 shrink-0 rounded p-1 transition-all hover:-translate-y-0.5 hover:brightness-90"
                                            style={{
                                                backgroundColor: confirmDeleteId === session.id ? "var(--hot-badge-bg)" : "transparent",
                                            }}
                                            aria-label={confirmDeleteId === session.id ? `确认删除${session.title}` : `删除${session.title}`}
                                            title={confirmDeleteId === session.id ? "再次点击确认删除" : "删除"}
                                        >
                                            <Trash2
                                                className="w-3 h-3"
                                                style={{
                                                    color: confirmDeleteId === session.id ? "#fff" : "var(--fb-inactive-text)",
                                                }}
                                            />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        );
    }

    return (
        <div ref={panelRef} className="relative">
            {/* Trigger button */}
            <button
                onClick={() => {
                    setOpen((v) => !v);
                    setConfirmDeleteId(null);
                }}
                className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-lg border-2 transition-all",
                    "shadow-[4px_4px_0px_0px_rgba(var(--shadow-color),1)]",
                    "active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0px_0px_rgba(var(--shadow-color),1)]",
                )}
                style={{
                    borderColor: "var(--border-color)",
                    backgroundColor: "var(--btn-new-bg)",
                    color: "var(--btn-new-text)",
                }}
                title="历史记录"
            >
                <History className="w-5 h-5" />
            </button>

            {/* Dropdown panel */}
            {open && (
                <div
                    className="absolute right-0 top-12 z-50 w-72 rounded-lg border-2 overflow-hidden"
                    style={{
                        borderColor: "var(--border-color)",
                        backgroundColor: "var(--card-bg, var(--ai-bubble-bg))",
                        boxShadow: "6px 6px 0px 0px rgba(var(--shadow-color), 1)",
                    }}
                >
                    {/* Header */}
                    <div
                        className="flex items-center justify-between gap-3 px-3 py-2 border-b-2"
                        style={{
                            borderColor: "var(--border-color)",
                            backgroundColor: "var(--header-bg)",
                        }}
                    >
                        <p
                            className="text-xs font-bold uppercase tracking-wider"
                            style={{ color: "var(--header-text)" }}
                        >
                            历史记录
                        </p>
                        <div className="flex gap-1 text-[10px] font-black">
                            <button type="button" onClick={() => setFilter("all")} aria-pressed={filter === "all"}>全部</button>
                            <button type="button" onClick={() => setFilter("favorites")} aria-pressed={filter === "favorites"} className="flex items-center gap-0.5">
                                <Star className="h-3 w-3" fill={filter === "favorites" ? "currentColor" : "none"} />
                                {favoriteCount}
                            </button>
                        </div>
                    </div>

                    {/* Session list */}
                    <div className="max-h-80 overflow-y-auto">
                        {visibleSessions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-2 py-8 px-4">
                                <MessageSquare
                                    className="w-8 h-8 opacity-40"
                                    style={{ color: "var(--foreground)" }}
                                />
                                <p
                                    className="text-sm font-bold opacity-50"
                                    style={{ color: "var(--foreground)" }}
                                >
                                    {filter === "favorites" ? "暂无收藏" : "暂无历史记录"}
                                </p>
                            </div>
                        ) : (
                            visibleSessions.map((session) => {
                                const isActive = session.id === currentSessionId;
                                return (
                                    <div
                                        key={session.id}
                                        className={cn(
                                            "group/item relative flex w-full items-center border-b text-left transition-colors last:border-b-0",
                                            "hover:brightness-95",
                                        )}
                                        style={{
                                            borderColor: "var(--fb-inactive-border)",
                                            backgroundColor: isActive
                                                ? "var(--header-bg)"
                                                : "transparent",
                                            color: isActive
                                                ? "var(--header-text)"
                                                : "var(--foreground)",
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleSelect(session.id)}
                                            className="flex-1 min-w-0 px-3 py-2.5 text-left"
                                        >
                                            <p className="text-sm font-bold truncate">
                                                {session.title}
                                            </p>
                                            <p className="text-xs opacity-60 mt-0.5">
                                                {sessionContext(session)} ·{" "}
                                                {relativeTime(session.updatedAt)} ·{" "}
                                                {session.messages.length} 条消息
                                            </p>
                                        </button>

                                        <div
                                            className={cn(
                                                "absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-md p-1 transition-opacity",
                                                confirmDeleteId === session.id
                                                    ? "opacity-100"
                                                    : "opacity-0 group-hover/item:opacity-100 group-focus-within/item:opacity-100",
                                            )}
                                            style={{
                                                backgroundColor: isActive
                                                    ? "var(--header-bg)"
                                                    : "var(--card-bg, var(--ai-bubble-bg))",
                                            }}
                                        >
                                            <button
                                                type="button"
                                                onClick={(event) => handleFavorite(event, session.id)}
                                                disabled={!session.isFavorite && favoriteCount >= MAX_FAVORITE_SESSIONS}
                                                className="shrink-0 rounded-md p-1.5 transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-25"
                                                aria-label={session.isFavorite ? `取消收藏${session.title}` : `收藏${session.title}`}
                                                title={!session.isFavorite && favoriteCount >= MAX_FAVORITE_SESSIONS ? `收藏夹最多 ${MAX_FAVORITE_SESSIONS} 条` : undefined}
                                            >
                                                <Star className="h-3.5 w-3.5" fill={session.isFavorite ? "var(--qp-2)" : "none"} />
                                            </button>

                                            {/* Delete button */}
                                            <button
                                                type="button"
                                                onClick={(event) => handleDelete(event, session.id)}
                                                className="shrink-0 rounded-md border-2 p-1.5 transition-all hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
                                                style={{
                                                    borderColor: "var(--border-color)",
                                                    backgroundColor:
                                                        confirmDeleteId === session.id
                                                            ? "var(--hot-badge-bg)"
                                                            : "var(--fb-inactive-bg)",
                                                    boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
                                                }}
                                                aria-label={confirmDeleteId === session.id ? `确认删除${session.title}` : `删除${session.title}`}
                                                title={confirmDeleteId === session.id ? "再次点击确认删除" : "删除此对话"}
                                            >
                                                <Trash2
                                                    className="w-3.5 h-3.5"
                                                    style={{
                                                        color:
                                                            confirmDeleteId === session.id
                                                                ? "#fff"
                                                                : "var(--fb-inactive-text)",
                                                    }}
                                                />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
