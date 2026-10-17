"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { History, Trash2, MessageSquare, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatSession } from "@/lib/use-chat-history";
import { getPersonaById } from "@/lib/personas";
import { MAX_FAVORITE_SESSIONS } from "@/lib/chat-history";

interface ChatHistoryProps {
    sessions: ChatSession[];
    searchQuery?: string;
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

function SessionTitle({ title, className }: { title: string; className: string }) {
    const titleRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const element = titleRef.current;
        if (!element) return;
        const desktopPointer = window.matchMedia("(hover: hover) and (pointer: fine)");
        const updateTooltip = () => {
            if (desktopPointer.matches && element.scrollWidth > element.clientWidth) {
                element.title = title;
            } else {
                element.removeAttribute("title");
            }
        };
        const observer = new ResizeObserver(updateTooltip);
        observer.observe(element);
        desktopPointer.addEventListener("change", updateTooltip);
        updateTooltip();
        return () => {
            observer.disconnect();
            desktopPointer.removeEventListener("change", updateTooltip);
        };
    }, [title]);

    return <span ref={titleRef} className={className}>{title}</span>;
}

interface SidebarSessionRowProps {
    session: ChatSession;
    isActive: boolean;
    favoriteCount: number;
    confirmDeleteId: string | null;
    onSelect: (id: string) => void;
    onFavorite: (event: React.MouseEvent, id: string) => void;
    onDelete: (event: React.MouseEvent, id: string) => void;
}

function SidebarSessionRow({
    session,
    isActive,
    favoriteCount,
    confirmDeleteId,
    onSelect,
    onFavorite,
    onDelete,
}: SidebarSessionRowProps) {
    return (
        <div
            className={cn(
                "history-row group/item relative flex items-center rounded-lg border text-left transition-all",
                "hover:-translate-y-px",
                confirmDeleteId !== session.id && "hover:brightness-95",
            )}
            data-active={isActive}
            data-confirm-delete={confirmDeleteId === session.id}
            style={{
                borderColor: session.isFavorite ? "var(--qp-2)" : "transparent",
                backgroundColor: isActive
                    ? "var(--header-bg)"
                    : session.isFavorite ? "var(--fb-inactive-bg)" : "transparent",
                color: isActive ? "var(--header-text)" : "var(--foreground)",
            }}
        >
            <button
                type="button"
                onClick={() => onSelect(session.id)}
                className={cn(
                    "history-select flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-2 text-left transition-all",
                    isActive || confirmDeleteId === session.id
                        ? "pr-16"
                        : "pr-2 group-hover/item:pr-16",
                )}
            >
                {session.isFavorite ? (
                    <Star
                        className="h-3 w-3 shrink-0"
                        fill="var(--qp-2)"
                        style={{ color: "var(--qp-2)" }}
                    />
                ) : null}
                <span className="min-w-0 flex-1">
                    <SessionTitle title={session.title} className="block truncate text-xs font-bold" />
                    <span className="block truncate text-[10px] opacity-50">
                        {sessionContext(session)} · {relativeTime(session.updatedAt)}
                    </span>
                </span>
            </button>
            <div
                className={cn(
                    "history-actions absolute right-1 top-1/2 flex h-8 w-16 -translate-y-1/2 items-center justify-end rounded-md pl-1 transition-opacity",
                    isActive || confirmDeleteId === session.id
                        ? "opacity-100"
                        : "opacity-0 group-hover/item:opacity-100 group-focus-within/item:opacity-100",
                )}
                style={{
                    backgroundColor: isActive ? "var(--header-bg)" : "var(--card-bg)",
                }}
            >
                <button
                    type="button"
                    onClick={(event) => onFavorite(event, session.id)}
                    disabled={!session.isFavorite && favoriteCount >= MAX_FAVORITE_SESSIONS}
                    className={cn(
                        "shrink-0 rounded p-1 transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-25",
                        confirmDeleteId === session.id && "invisible",
                    )}
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
                    onClick={(event) => onDelete(event, session.id)}
                    className={cn(
                        "shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                        confirmDeleteId === session.id
                            ? "absolute inset-0 flex items-center justify-center rounded-md text-xs font-black"
                            : "m-1 rounded p-1 hover:brightness-90",
                    )}
                    style={{
                        backgroundColor: confirmDeleteId === session.id ? "var(--hot-badge-bg)" : "transparent",
                        color: confirmDeleteId === session.id ? "var(--hot-badge-text)" : "var(--fb-inactive-text)",
                    }}
                    aria-label={confirmDeleteId === session.id ? `确认删除${session.title}` : `删除${session.title}`}
                    title={confirmDeleteId === session.id ? "再次点击确认删除" : "删除"}
                >
                    {confirmDeleteId === session.id ? "删除" : <Trash2 className="h-3 w-3" />}
                </button>
            </div>
        </div>
    );
}

export function ChatHistory({
    sessions,
    searchQuery = "",
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
    const query = searchQuery.trim().toLocaleLowerCase();
    const matchingSessions = query
        ? sessions.filter((session) => session.title.toLocaleLowerCase().includes(query))
        : sessions;
    const favoriteSessions = matchingSessions.filter((session) => session.isFavorite);
    const historySessions = matchingSessions.filter((session) => !session.isFavorite);
    const visibleSessions = filter === "favorites"
        ? favoriteSessions
        : matchingSessions;

    useEffect(() => {
        if (!confirmDeleteId) return;
        const cancelOutsideRow = (event: Event) => {
            const row = panelRef.current?.querySelector('[data-confirm-delete="true"]');
            if (!row || !(event.target instanceof Node) || !row.contains(event.target)) {
                setConfirmDeleteId(null);
            }
        };
        const cancel = () => setConfirmDeleteId(null);
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") cancel();
        };
        document.addEventListener("pointerdown", cancelOutsideRow);
        document.addEventListener("focusin", cancelOutsideRow);
        document.addEventListener("keydown", handleKeyDown);
        window.addEventListener("blur", cancel);
        return () => {
            document.removeEventListener("pointerdown", cancelOutsideRow);
            document.removeEventListener("focusin", cancelOutsideRow);
            document.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("blur", cancel);
        };
    }, [confirmDeleteId]);

    const handlePointerOut = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.pointerType !== "mouse" || !(event.target instanceof Element)) return;
        const row = event.target.closest('[data-confirm-delete="true"]');
        if (row && (!(event.relatedTarget instanceof Node) || !row.contains(event.relatedTarget))) {
            setConfirmDeleteId(null);
        }
    };

    const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
        const row = panelRef.current?.querySelector('[data-confirm-delete="true"]');
        if (row && (!(event.relatedTarget instanceof Node) || !row.contains(event.relatedTarget))) {
            setConfirmDeleteId(null);
        }
    };

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
            setConfirmDeleteId(null);
            onToggleFavorite(id);
        },
        [onToggleFavorite],
    );

    // ── Sidebar variant ──
    if (variant === "sidebar") {
        return (
            <div ref={panelRef} onPointerOut={handlePointerOut} onBlur={handleBlur} className="flex-1 min-h-0 flex flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    {favoriteSessions.length > 0 ? (
                        <section className="mb-3" aria-labelledby="favorite-sessions-heading">
                            <div className="mb-1.5 flex items-center px-1">
                                <p
                                    id="favorite-sessions-heading"
                                    className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider"
                                    style={{ color: "var(--header-subtitle)" }}
                                >
                                    <Star className="h-3 w-3" fill="currentColor" />
                                    收藏
                                </p>
                            </div>
                            <div className="space-y-1">
                                {favoriteSessions.map((session) => (
                                    <SidebarSessionRow
                                        key={session.id}
                                        session={session}
                                        isActive={session.id === currentSessionId}
                                        favoriteCount={favoriteCount}
                                        confirmDeleteId={confirmDeleteId}
                                        onSelect={handleSelect}
                                        onFavorite={handleFavorite}
                                        onDelete={handleDelete}
                                    />
                                ))}
                            </div>
                        </section>
                    ) : null}

                    <section aria-labelledby="history-sessions-heading">
                        <p
                            id="history-sessions-heading"
                            className="mb-1.5 px-1 text-[10px] font-black uppercase tracking-wider"
                            style={{ color: "var(--header-subtitle)" }}
                        >
                            历史记录
                        </p>
                        {historySessions.length === 0 ? (
                        <p
                            className="text-xs font-bold px-1 py-2 opacity-40"
                            style={{ color: "var(--foreground)" }}
                        >
                            {query
                                ? favoriteSessions.length > 0 ? "没有其他匹配的历史记录" : "没有匹配的历史标题"
                                : favoriteSessions.length > 0 ? "暂无其他历史记录" : "暂无历史记录"}
                        </p>
                    ) : (
                            <div className="space-y-1">
                                {historySessions.map((session) => (
                                    <SidebarSessionRow
                                        key={session.id}
                                        session={session}
                                        isActive={session.id === currentSessionId}
                                        favoriteCount={favoriteCount}
                                        confirmDeleteId={confirmDeleteId}
                                        onSelect={handleSelect}
                                        onFavorite={handleFavorite}
                                        onDelete={handleDelete}
                                    />
                                ))}
                            </div>
                    )}
                    </section>
                </div>
            </div>
        );
    }

    return (
        <div ref={panelRef} onPointerOut={handlePointerOut} onBlur={handleBlur} className="relative">
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
                                    {query ? "没有匹配的历史标题" : filter === "favorites" ? "暂无收藏" : "暂无历史记录"}
                                </p>
                            </div>
                        ) : (
                            visibleSessions.map((session) => {
                                const isActive = session.id === currentSessionId;
                                return (
                                    <div
                                        key={session.id}
                                        className={cn(
                                            "history-row history-row-dropdown group/item relative flex w-full items-center border-b text-left transition-colors last:border-b-0",
                                            "hover:brightness-95",
                                        )}
                                        data-active={isActive}
                                        data-confirm-delete={confirmDeleteId === session.id}
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
                                            className={cn(
                                                "history-select flex-1 min-w-0 py-2.5 pl-3 text-left transition-all",
                                                isActive || confirmDeleteId === session.id
                                                    ? "pr-18"
                                                    : "pr-3 group-hover/item:pr-18",
                                            )}
                                        >
                                            <SessionTitle title={session.title} className="block truncate text-sm font-bold" />
                                            <p className="text-xs opacity-60 mt-0.5">
                                                {sessionContext(session)} ·{" "}
                                                {relativeTime(session.updatedAt)} ·{" "}
                                                {session.messages.length} 条消息
                                            </p>
                                        </button>

                                        <div
                                            className={cn(
                                                "history-actions absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-md p-1 transition-opacity",
                                                isActive || confirmDeleteId === session.id
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
