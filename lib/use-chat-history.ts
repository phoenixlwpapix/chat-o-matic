"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "chat-o-matic-history";
const MAX_SESSIONS = 10;

/** Serialisable subset of a message part (we drop file/image data) */
interface StoredTextPart {
    type: "text";
    text: string;
}

export interface StoredMessage {
    id: string;
    role: "user" | "assistant";
    parts: StoredTextPart[];
}

export interface ChatSession {
    id: string;
    title: string;
    messages: StoredMessage[];
    createdAt: number;
    updatedAt: number;
}

// ── helpers ──────────────────────────────────────────────

function readSessions(): ChatSession[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as ChatSession[];
    } catch {
        return [];
    }
}

function writeSessions(sessions: ChatSession[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

/**
 * Extract a short title from the first user message.
 * Falls back to "新对话" if nothing meaningful is found.
 */
function deriveTitle(messages: StoredMessage[]): string {
    const first = messages.find((m) => m.role === "user");
    if (!first) return "新对话";
    const text = first.parts
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("");
    if (!text.trim()) return "图片对话";
    return text.slice(0, 30).trim();
}

/**
 * Convert runtime messages (which may contain file parts with huge base64)
 * into a lightweight storable format, keeping only text parts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toStoredMessages(messages: any[]): StoredMessage[] {
    return messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        parts: (m.parts ?? [])
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((p: any) => p.type === "text")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((p: any) => ({ type: "text" as const, text: p.text })),
    }));
}

// ── hook ─────────────────────────────────────────────────

export function useChatHistory() {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

    // Load from localStorage on mount
    useEffect(() => {
        setSessions(readSessions());
    }, []);

    /** Persist the current list back to localStorage */
    const persist = useCallback((next: ChatSession[]) => {
        setSessions(next);
        writeSessions(next);
    }, []);

    /** Save or update a session. If the session has no meaningful messages, skip. */
    const saveSession = useCallback(
        (id: string, messages: StoredMessage[]) => {
            // Don't save empty conversations
            if (messages.length === 0) return;

            const now = Date.now();
            const existing = readSessions();
            const idx = existing.findIndex((s) => s.id === id);

            if (idx !== -1) {
                // update in-place
                existing[idx] = {
                    ...existing[idx],
                    messages,
                    title: deriveTitle(messages),
                    updatedAt: now,
                };
            } else {
                // insert new
                existing.unshift({
                    id,
                    title: deriveTitle(messages),
                    messages,
                    createdAt: now,
                    updatedAt: now,
                });
            }

            // sort by updatedAt desc, trim
            existing.sort((a, b) => b.updatedAt - a.updatedAt);
            persist(existing.slice(0, MAX_SESSIONS));
        },
        [persist],
    );

    /** Load a session by id */
    const loadSession = useCallback((id: string): StoredMessage[] | null => {
        const all = readSessions();
        const session = all.find((s) => s.id === id);
        return session?.messages ?? null;
    }, []);

    /** Delete a session */
    const deleteSession = useCallback(
        (id: string) => {
            const next = readSessions().filter((s) => s.id !== id);
            persist(next);
            if (currentSessionId === id) {
                setCurrentSessionId(null);
            }
        },
        [persist, currentSessionId],
    );

    return {
        sessions,
        currentSessionId,
        setCurrentSessionId,
        saveSession,
        loadSession,
        deleteSession,
    };
}
