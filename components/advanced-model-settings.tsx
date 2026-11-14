"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LockKeyhole } from "lucide-react";
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
    <section aria-labelledby="advanced-model-heading" className="space-y-2 border-t pt-3" style={{ borderColor: "var(--fb-inactive-border)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="advanced-model-heading" className="flex items-center gap-1.5 text-xs font-black tracking-[0.16em]">
          <LockKeyhole className="h-4 w-4" aria-hidden="true" />
          高级模型
        </h2>
        {access?.enabled ? (
          <Button type="button" size="sm" variant="outline" className="min-h-12" disabled={pending} onClick={() => void updateAccess()}>
            {pending ? "关闭中…" : "关闭高级模型"}
          </Button>
        ) : access ? (
          <Button
            type="button"
            size="sm"
            className="min-h-12"
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
      <p className="text-sm empty:hidden" role="status">
        {access?.enabled ? "当前浏览器已启用 Gemini 4 Hydrogen" : ""}
      </p>
      <div id="advanced-model-unlock" hidden={!showUnlock}>
        {showUnlock ? (
          <form method="post" action={endpoint} onSubmit={submitPassword} aria-labelledby="advanced-model-heading">
            <label htmlFor="advanced-model-password" className="mb-1 block text-xs font-bold">高级模型密码</label>
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
                className="h-12 min-w-32 flex-1 text-base sm:max-w-64"
              />
              <Button type="submit" size="sm" className="min-h-12" disabled={pending}>
                {pending ? "验证中…" : "解锁"}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
      <p id="advanced-model-error" role="alert" className="text-xs font-bold text-red-600 dark:text-red-400 empty:hidden">{error}</p>
    </section>
  );
}
