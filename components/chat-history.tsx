"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { History, Trash2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatSession } from "@/lib/use-chat-history";
import { getPersonaById } from "@/lib/personas";
import { getLearningMode } from "@/lib/learning-modes";

interface ChatHistoryProps {
    sessions: ChatSession[];
    currentSessionId: string | null;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
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

export function ChatHistory({
    sessions,
    currentSessionId,
    onSelect,
    onDelete,
    variant = "dropdown",
}: ChatHistoryProps) {
    const [open, setOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

    // ── Sidebar variant ──
    if (variant === "sidebar") {
        return (
            <div className="flex-1 min-h-0 flex flex-col">
                <p
                    className="text-[10px] font-black uppercase tracking-wider px-1 mb-1.5"
                    style={{ color: "var(--header-subtitle)" }}
                >
                    历史记录
                </p>
                <div className="flex-1 overflow-y-auto min-h-0 space-y-1">
                    {sessions.length === 0 ? (
                        <p
                            className="text-xs font-bold px-1 py-2 opacity-40"
                            style={{ color: "var(--foreground)" }}
                        >
                            暂无历史记录
                        </p>
                    ) : (
                        sessions.map((session) => {
                            const isActive = session.id === currentSessionId;
                            return (
                                <div
                                    key={session.id}
                                    className={cn(
                                        "flex items-center rounded-lg text-left transition-colors group/item",
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
                                                {getPersonaById(session.personaId).name} · {getLearningMode(session.learningMode).shortLabel} · {relativeTime(session.updatedAt)}
                                            </span>
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(event) => handleDelete(event, session.id)}
                                        className={cn(
                                            "m-1 shrink-0 rounded p-1 transition-opacity hover:brightness-90 focus-visible:opacity-100",
                                            confirmDeleteId === session.id ? "opacity-100" : "opacity-0 group-hover/item:opacity-100",
                                        )}
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
                        className="px-3 py-2 border-b-2"
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
                    </div>

                    {/* Session list */}
                    <div className="max-h-80 overflow-y-auto">
                        {sessions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-2 py-8 px-4">
                                <MessageSquare
                                    className="w-8 h-8 opacity-40"
                                    style={{ color: "var(--foreground)" }}
                                />
                                <p
                                    className="text-sm font-bold opacity-50"
                                    style={{ color: "var(--foreground)" }}
                                >
                                    暂无历史记录
                                </p>
                            </div>
                        ) : (
                            sessions.map((session) => {
                                const isActive = session.id === currentSessionId;
                                return (
                                    <div
                                        key={session.id}
                                        className={cn(
                                            "w-full flex items-center text-left transition-colors group/item border-b last:border-b-0",
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
                                                {getPersonaById(session.personaId).name} ·{" "}
                                                {getLearningMode(session.learningMode).shortLabel} ·{" "}
                                                {relativeTime(session.updatedAt)} ·{" "}
                                                {session.messages.length} 条消息
                                            </p>
                                        </button>

                                        {/* Delete button */}
                                        <button
                                            type="button"
                                            onClick={(event) => handleDelete(event, session.id)}
                                            className={cn(
                                                "mr-3 shrink-0 rounded-md border-2 p-1.5 transition-all hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 focus-visible:opacity-100",
                                                confirmDeleteId === session.id
                                                    ? "opacity-100"
                                                    : "opacity-0 group-hover/item:opacity-100",
                                            )}
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
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
