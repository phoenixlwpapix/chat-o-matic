"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LockKeyhole, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const endpoint = "/api/chat/advanced-model";
const requestError = "暂时无法连接，请稍后重试。";

interface AccessStatus {
  available: boolean;
  enabled: boolean;
}

export function AdvancedModelSettings() {
  const [access, setAccess] = useState<AccessStatus | null>(null);
  const [showUnlock, setShowUnlock] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadAccess() {
      try {
        const response = await fetch(endpoint, { signal: controller.signal });
        if (!response.ok) throw new Error(requestError);
        setAccess(await response.json());
      } catch {
        if (!controller.signal.aborted) setError(requestError);
      }
    }
    void loadAccess();
    return () => controller.abort();
  }, []);

  async function updateAccess(password?: FormDataEntryValue | null) {
    const method = password === undefined ? "DELETE" : "POST";
    setPending(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method,
        ...(method === "POST" && {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        }),
      });
      if (response.status === 429) {
        setError("尝试次数过多，请稍后再试。");
        return;
      }
      const data: { enabled?: boolean; error?: string } = await response.json();
      if (!response.ok) {
        setError(data.error ?? requestError);
        return;
      }
      setAccess({ available: true, enabled: data.enabled === true });
      setShowUnlock(false);
    } catch {
      setError(requestError);
    } finally {
      setPending(false);
    }
  }

  function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const password = new FormData(form).get("password");
    form.reset();
    void updateAccess(password);
  }

  if (access?.available === false) return null;
  if (!access && !error) return null;

  return (
    <section
      aria-labelledby="advanced-model-heading"
      className="space-y-3 rounded-xl border-2 p-4"
      style={{
        borderColor: "var(--border-color)",
        backgroundColor: "var(--card-bg)",
        boxShadow: "3px 3px 0px 0px rgba(var(--shadow-color), 1)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="advanced-model-heading" className="flex items-center gap-2 text-sm font-black">
              <LockKeyhole className="h-4 w-4 shrink-0" aria-hidden="true" />
              高级模型
            </h3>
            {access?.enabled ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-black"
                style={{
                  borderColor: "var(--settings-selected-border)",
                  backgroundColor: "var(--settings-selected-bg)",
                  color: "var(--settings-selected-text)",
                }}
              >
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                已启用
              </span>
            ) : null}
          </div>
          <p className="text-xs" role="status" style={{ color: "var(--settings-option-muted)" }}>
            {access?.enabled
              ? "当前浏览器已启用，从下一次回复生效。"
              : "输入密码可在本浏览器解锁。"}
          </p>
        </div>
        {access?.enabled ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-10 shrink-0 rounded-lg border-2 px-3 text-xs font-black"
            style={{
              borderColor: "var(--border-color)",
              backgroundColor: "var(--settings-option-bg)",
              color: "var(--settings-option-text)",
            }}
            disabled={pending}
            onClick={() => void updateAccess()}
          >
            {pending ? "关闭中…" : "关闭高级模型"}
          </Button>
        ) : access ? (
          <Button
            type="button"
            size="sm"
            className="h-10 shrink-0 rounded-lg border-2 px-3 text-xs font-black transition-transform hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
            style={{
              borderColor: "var(--border-color)",
              backgroundColor: showUnlock ? "var(--settings-option-bg)" : "var(--btn-new-bg)",
              color: showUnlock ? "var(--settings-option-text)" : "var(--btn-new-text)",
              boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
            }}
            aria-expanded={showUnlock}
            aria-controls="advanced-model-unlock"
            disabled={pending}
            onClick={() => {
              setShowUnlock(!showUnlock);
              setError("");
            }}
          >
            {showUnlock ? "取消" : "开启高级模型"}
          </Button>
        ) : null}
      </div>

      <div id="advanced-model-unlock" hidden={!showUnlock}>
        {showUnlock ? (
          <form
            method="post"
            action={endpoint}
            onSubmit={submitPassword}
            aria-labelledby="advanced-model-heading"
            className="border-t pt-3"
            style={{ borderColor: "var(--fb-inactive-border)" }}
          >
            <label htmlFor="advanced-model-password" className="mb-1.5 block text-xs font-bold" style={{ color: "var(--settings-option-muted)" }}>
              输入解锁密码
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="advanced-model-password"
                name="password"
                type="password"
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                aria-describedby="advanced-model-error"
                className="h-10 min-w-36 flex-1 rounded-lg border-2 text-base sm:max-w-xs"
                style={{
                  borderColor: "var(--border-color)",
                  backgroundColor: "var(--settings-option-bg)",
                  color: "var(--settings-option-text)",
                }}
              />
              <Button
                type="submit"
                size="sm"
                className="h-10 shrink-0 rounded-lg border-2 px-4 text-xs font-black transition-transform hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
                style={{
                  borderColor: "var(--border-color)",
                  backgroundColor: "var(--btn-send-bg)",
                  color: "var(--btn-action-text)",
                  boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
                }}
                disabled={pending}
              >
                {pending ? "验证中…" : "解锁"}
              </Button>
            </div>
          </form>
        ) : null}
      </div>

      <p id="advanced-model-error" role="alert" className="text-xs font-bold text-red-600 empty:hidden dark:text-red-400">
        {error}
      </p>
    </section>
  );
}
