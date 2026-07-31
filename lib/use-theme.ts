"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

export const THEMES = ["sunflower", "ocean", "peach"] as const;
export type Theme = (typeof THEMES)[number];

const THEME_KEY = "chat-o-matic-theme";
const THEME_CHANGE_EVENT = "chat-o-matic-theme-change";

function getThemeSnapshot(): Theme {
    const stored = localStorage.getItem(THEME_KEY);
    return stored && THEMES.includes(stored as Theme)
        ? (stored as Theme)
        : "sunflower";
}

function getServerThemeSnapshot(): Theme {
    return "sunflower";
}

function subscribeToTheme(onStoreChange: () => void) {
    window.addEventListener("storage", onStoreChange);
    window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
    return () => {
        window.removeEventListener("storage", onStoreChange);
        window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
    };
}

export function useTheme() {
    const theme = useSyncExternalStore(
        subscribeToTheme,
        getThemeSnapshot,
        getServerThemeSnapshot,
    );

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
    }, [theme]);

    const setTheme = useCallback((t: Theme) => {
        localStorage.setItem(THEME_KEY, t);
        document.documentElement.setAttribute("data-theme", t);
        window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    }, []);

    return { theme, setTheme } as const;
}
