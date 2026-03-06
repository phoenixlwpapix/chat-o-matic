"use client";

import { useEffect, useState, useCallback } from "react";

export const THEMES = ["sunflower", "ocean", "peach"] as const;
export type Theme = (typeof THEMES)[number];

const THEME_KEY = "chat-o-matic-theme";

export function useTheme() {
    const [theme, setThemeState] = useState<Theme>("sunflower");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem(THEME_KEY) as Theme | null;
        const initial = stored && THEMES.includes(stored) ? stored : "sunflower";
        setThemeState(initial);
        document.documentElement.setAttribute("data-theme", initial);
        setMounted(true);
    }, []);

    const setTheme = useCallback((t: Theme) => {
        setThemeState(t);
        localStorage.setItem(THEME_KEY, t);
        document.documentElement.setAttribute("data-theme", t);
    }, []);

    return { theme, setTheme, mounted } as const;
}
