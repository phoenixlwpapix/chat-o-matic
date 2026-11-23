"use client";

import { useState, useRef, useEffect } from "react";
import { Palette } from "lucide-react";
import { THEMES, type Theme } from "@/lib/use-theme";
import { cn } from "@/lib/utils";

const THEME_META: Record<Theme, { label: string; colors: string[] }> = {
    sunflower: {
        label: "向日葵",
        colors: ["#fde047", "#60a5fa", "#f87171"],
    },
    ocean: {
        label: "深海",
        colors: ["#22d3ee", "#232946", "#b8c1ec"],
    },
    peach: {
        label: "蜜桃",
        colors: ["#fec7d7", "#fffffe", "#a786df"],
    },
};

export function ThemeSwitcher({
    theme,
    setTheme,
    variant = "dropdown",
}: {
    theme: Theme;
    setTheme: (t: Theme) => void;
    variant?: "dropdown" | "inline";
}) {
    const [open, setOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    // 内联模式：直接展示所有主题选项
    if (variant === "inline") {
        return (
            <div className="grid grid-cols-3 gap-2">
                {THEMES.map((t) => {
                    const meta = THEME_META[t];
                    const isActive = t === theme;
                    return (
                        <button
                            key={t}
                            type="button"
                            aria-pressed={isActive}
                            onClick={() => setTheme(t)}
                            className="flex h-10 items-center justify-center gap-2 rounded-lg border-2 px-2.5 transition-all hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
                            style={{
                                borderColor: isActive ? "var(--settings-selected-border)" : "var(--fb-inactive-border)",
                                backgroundColor: isActive ? "var(--settings-selected-bg)" : "var(--settings-option-bg)",
                                color: isActive ? "var(--settings-selected-text)" : "var(--settings-option-text)",
                                boxShadow: isActive ? "2px 2px 0px 0px var(--settings-selected-border)" : "none",
                            }}
                            title={meta.label}
                        >
                            <span className="flex -space-x-1" aria-hidden="true">
                                {meta.colors.slice(0, 2).map((color, index) => (
                                    <span
                                        key={index}
                                        className="h-3.5 w-3.5 rounded-full border"
                                        style={{ backgroundColor: color, borderColor: "var(--border-color)" }}
                                    />
                                ))}
                            </span>
                            <span className="text-xs font-black">
                                {meta.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        );
    }

    return (
        <div ref={panelRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-lg border-2 transition-all",
                    "shadow-[4px_4px_0px_0px_rgba(var(--shadow-color),1)]",
                    "active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0px_0px_rgba(var(--shadow-color),1)]"
                )}
                style={{
                    borderColor: "var(--border-color)",
                    backgroundColor: "var(--btn-new-bg)",
                    color: "var(--btn-new-text)",
                }}
                title="切换主题"
            >
                <Palette className="w-5 h-5" />
            </button>

            {open && (
                <div
                    className="absolute right-0 top-12 z-50 p-3 rounded-lg border-2"
                    style={{
                        borderColor: "var(--border-color)",
                        backgroundColor: "var(--card-bg)",
                        boxShadow: `6px 6px 0px 0px rgba(var(--shadow-color), 1)`,
                    }}
                >
                    <p
                        className="text-xs font-bold uppercase tracking-wider mb-2"
                        style={{ color: "var(--foreground)" }}
                    >
                        选择主题
                    </p>
                    <div className="flex gap-2">
                        {THEMES.map((t) => {
                            const meta = THEME_META[t];
                            const isActive = t === theme;
                            return (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => {
                                        setTheme(t);
                                        setOpen(false);
                                    }}
                                    className={cn(
                                        "flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all",
                                        "hover:-translate-y-0.5",
                                        isActive
                                            ? "shadow-[3px_3px_0px_0px_rgba(var(--shadow-color),1)] -translate-y-0.5"
                                            : "shadow-[2px_2px_0px_0px_rgba(var(--shadow-color),0.3)]"
                                    )}
                                    style={{
                                        borderColor: isActive
                                            ? "var(--border-color)"
                                            : "var(--fb-inactive-border)",
                                        backgroundColor: isActive
                                            ? meta.colors[0] + "30"
                                            : "transparent",
                                    }}
                                    title={meta.label}
                                >
                                    {/* 三色预览 */}
                                    <div className="flex gap-1">
                                        {meta.colors.map((c, i) => (
                                            <div
                                                key={i}
                                                className="w-5 h-5 rounded-full border-2"
                                                style={{
                                                    backgroundColor: c,
                                                    borderColor: "var(--border-color)",
                                                }}
                                            />
                                        ))}
                                    </div>
                                    <span
                                        className="text-[11px] font-bold whitespace-nowrap"
                                        style={{ color: "var(--foreground)" }}
                                    >
                                        {meta.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
