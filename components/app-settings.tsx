"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  Globe2,
  Languages,
  Loader2,
  Palette,
  Pencil,
  Radio,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  UserRound,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { AvatarCropper } from "@/components/avatar-cropper";
import { AdvancedModelSettings } from "@/components/advanced-model-settings";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { MAX_USER_NAME_LENGTH } from "@/lib/constants";
import { getSearchMode, SEARCH_MODES, type SearchMode } from "@/lib/search-modes";
import { type Theme } from "@/lib/use-theme";
import { CHAT_FONTS, CHAT_FONT_SIZES, type ChatFont, type ChatFontSize } from "@/lib/chat-typography";
import { cn } from "@/lib/utils";
import { REPLY_LANGUAGES, normalizeReplyLanguage, type ReplyLanguage } from "@/lib/reply-languages";

const SEARCH_MODE_ICONS: Record<SearchMode, LucideIcon> = {
  auto: Radio,
  always: Globe2,
  off: WifiOff,
};

interface AppSettingsProps {
  open: boolean;
  searchMode: SearchMode;
  replyLanguage: ReplyLanguage;
  onReplyLanguageChange: (language: ReplyLanguage) => void;
  theme: Theme;
  userAvatar: string | null;
  userName: string;
  chatFont: ChatFont;
  chatFontSize: ChatFontSize;
  onChatFontChange: (font: ChatFont) => void;
  onChatFontSizeChange: (size: ChatFontSize) => void;
  onOpenChange: (open: boolean) => void;
  onSearchModeChange: (mode: SearchMode) => void;
  onThemeChange: (theme: Theme) => void;
  onUserAvatarChange: (avatar: string | null) => void;
  onUserNameChange: (userName: string) => void;
}

const SECTION_CARD_STYLE = {
  borderColor: "var(--border-color)",
  backgroundColor: "var(--card-bg)",
  boxShadow: "3px 3px 0px 0px rgba(var(--shadow-color), 1)",
} as const;

function getSegmentedStyle(isActive: boolean) {
  return {
    borderColor: isActive ? "var(--settings-selected-border)" : "var(--fb-inactive-border)",
    backgroundColor: isActive ? "var(--settings-selected-bg)" : "var(--settings-option-bg)",
    color: isActive ? "var(--settings-selected-text)" : "var(--settings-option-text)",
    boxShadow: isActive ? "2px 2px 0px 0px var(--settings-selected-border)" : "none",
  };
}

export function AppSettings({
  open,
  searchMode,
  replyLanguage,
  onReplyLanguageChange,
  theme,
  userAvatar,
  userName,
  chatFont,
  chatFontSize,
  onChatFontChange,
  onChatFontSizeChange,
  onOpenChange,
  onSearchModeChange,
  onThemeChange,
  onUserAvatarChange,
  onUserNameChange,
}: AppSettingsProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarCropUrlRef = useRef<string | null>(null);

  const [inputUserName, setInputUserName] = useState(userName);
  const [isEditingUserName, setIsEditingUserName] = useState(false);
  const [isValidatingUserName, setIsValidatingUserName] = useState(false);
  const [userNameError, setUserNameError] = useState<string | null>(null);
  const [userNameSuccess, setUserNameSuccess] = useState<string | null>(null);
  const [lengthWarning, setLengthWarning] = useState(false);

  const [avatarCropUrl, setAvatarCropUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const closeDialog = useCallback(() => {
    if (avatarCropUrlRef.current) URL.revokeObjectURL(avatarCropUrlRef.current);
    avatarCropUrlRef.current = null;
    setAvatarCropUrl(null);
    setAvatarError(null);
    setUserNameError(null);
    setUserNameSuccess(null);
    setLengthWarning(false);
    setIsEditingUserName(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const closeCropper = useCallback(() => {
    if (avatarCropUrlRef.current) URL.revokeObjectURL(avatarCropUrlRef.current);
    avatarCropUrlRef.current = null;
    setAvatarCropUrl(null);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const focusFrame = requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !avatarCropUrlRef.current) closeDialog();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [closeDialog, open]);

  if (!open) return null;

  const currentSearchMode = getSearchMode(searchMode);

  const handleUserNameInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUserNameError(null);
    setUserNameSuccess(null);

    if (val.length > MAX_USER_NAME_LENGTH) {
      setLengthWarning(true);
      setInputUserName(val.slice(0, MAX_USER_NAME_LENGTH));
    } else {
      setLengthWarning(val.length === MAX_USER_NAME_LENGTH);
      setInputUserName(val);
    }
  };

  const handleSaveUserName = async () => {
    const trimmed = inputUserName.trim();
    setUserNameError(null);
    setUserNameSuccess(null);

    if (!trimmed) {
      onUserNameChange("");
      setInputUserName("");
      setIsEditingUserName(false);
      setUserNameSuccess("称呼已清除");
      setTimeout(() => setUserNameSuccess(null), 2500);
      return;
    }

    if (trimmed === userName) {
      setIsEditingUserName(false);
      return;
    }

    setIsValidatingUserName(true);
    try {
      const res = await fetch("/api/validate-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setUserNameError(data.error || "安全检查服务暂时不可用，请稍后重试");
        return;
      }

      if (data.valid === false) {
        setUserNameError(data.reason || "用户名包含不当内容，未通过审核");
        return;
      }

      onUserNameChange(trimmed);
      setIsEditingUserName(false);
      setUserNameSuccess("称呼已保存生效");
      setTimeout(() => setUserNameSuccess(null), 2500);
    } catch {
      setUserNameError("网络异常，无法验证用户名");
    } finally {
      setIsValidatingUserName(false);
    }
  };

  const selectAvatarFile = (file: File | undefined) => {
    setAvatarError(null);
    if (!file) return;
    if (!/^image\/(?:jpeg|png|webp)$/.test(file.type)) {
      setAvatarError("请选择 JPG、PNG 或 WebP 图片");
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setAvatarError("图片不能超过 10 MB");
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      return;
    }
    if (avatarCropUrlRef.current) URL.revokeObjectURL(avatarCropUrlRef.current);
    const nextCropUrl = URL.createObjectURL(file);
    avatarCropUrlRef.current = nextCropUrl;
    setAvatarCropUrl(nextCropUrl);
  };

  const saveAvatar = (avatar: string) => {
    onUserAvatarChange(avatar);
    closeCropper();
  };

  return (
    <>
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <section
          aria-labelledby="app-settings-title"
          className="chat-shell flex h-full min-h-0 w-full flex-col overflow-hidden border-0 md:rounded-lg md:border-4"
          style={{
            borderColor: "var(--border-color)",
            backgroundColor: "var(--settings-panel-bg)",
            color: "var(--settings-option-text)",
            boxShadow: "var(--chat-shell-shadow)",
          }}
        >
          <header
            className="flex items-center justify-between gap-3 border-b-2 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-6 md:py-3"
            style={{
              borderColor: "var(--border-color)",
              backgroundColor: "var(--header-bg)",
              color: "var(--header-text)",
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="grid h-9 w-9 place-items-center rounded-lg border-2"
                style={{
                  borderColor: "var(--border-color)",
                  backgroundColor: "var(--btn-new-bg)",
                  color: "var(--btn-new-text)",
                  boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
                }}
              >
                <Settings2 className="h-4.5 w-4.5" aria-hidden="true" />
              </span>
              <div>
                <h2 id="app-settings-title" className="text-lg font-black leading-none">
                  设置
                </h2>
                <p className="mt-0.5 text-[11px] font-bold" style={{ color: "var(--header-subtitle)" }}>
                  所有更改自动保存在当前浏览器
                </p>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeDialog}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border-2 px-3 text-xs font-black transition-transform hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
              style={{
                borderColor: "var(--border-color)",
                backgroundColor: "var(--btn-new-bg)",
                color: "var(--btn-new-text)",
                boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
              }}
              aria-label="返回聊天"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              返回聊天
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
              {/* ── 1. 个人资料 ── */}
              <section
                aria-labelledby="settings-profile-heading"
                className="rounded-xl border-2 p-4"
                style={SECTION_CARD_STYLE}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 id="settings-profile-heading" className="flex items-center gap-2 text-sm font-black">
                    <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
                    个人资料
                  </h3>
                  {userAvatar ? (
                    <button
                      type="button"
                      onClick={() => onUserAvatarChange(null)}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold transition-colors hover:brightness-95"
                      style={{
                        borderColor: "var(--fb-inactive-border)",
                        backgroundColor: "var(--settings-option-bg)",
                        color: "var(--settings-option-muted)",
                      }}
                    >
                      <RotateCcw className="h-3 w-3" aria-hidden="true" />
                      恢复默认头像
                    </button>
                  ) : null}
                </div>

                <div className="flex items-center gap-3.5">
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="group relative grid h-14 w-14 place-items-center overflow-hidden rounded-full border-2 transition-transform hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{
                        borderColor: "var(--border-color)",
                        backgroundColor: "var(--user-avatar-bg)",
                        backgroundImage: userAvatar ? `url(${userAvatar})` : undefined,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
                      }}
                      title="点击更换本地头像"
                      aria-label="点击更换本地头像"
                    >
                      {userAvatar ? null : <UserRound className="h-6 w-6 text-white" aria-hidden="true" />}
                    </button>
                    <span
                      className="pointer-events-none absolute -bottom-0.5 -right-0.5 grid h-5.5 w-5.5 place-items-center rounded-full border-2"
                      style={{
                        borderColor: "var(--border-color)",
                        backgroundColor: "var(--header-bg)",
                        color: "var(--header-text)",
                      }}
                      aria-hidden="true"
                    >
                      <Camera className="h-3 w-3" />
                    </span>

                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      tabIndex={-1}
                      onChange={(event) => selectAvatarFile(event.target.files?.[0])}
                    />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      {isEditingUserName ? (
                        <>
                          <div className="relative min-w-0 flex-1">
                            <label htmlFor="app-username-input" className="sr-only">
                              用户称呼
                            </label>
                            <input
                              id="app-username-input"
                              type="text"
                              autoFocus
                              value={inputUserName}
                              maxLength={MAX_USER_NAME_LENGTH}
                              onChange={handleUserNameInput}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !isValidatingUserName) {
                                  e.preventDefault();
                                  handleSaveUserName();
                                } else if (e.key === "Escape" && !isValidatingUserName) {
                                  e.preventDefault();
                                  setIsEditingUserName(false);
                                  setUserNameError(null);
                                  setLengthWarning(false);
                                }
                              }}
                              placeholder={`最多 ${MAX_USER_NAME_LENGTH} 字，留空即清除`}
                              className="h-10 w-full rounded-lg border-2 pl-3 pr-11 text-sm font-bold transition-all placeholder:text-xs placeholder:font-normal focus:outline-none"
                              style={{
                                borderColor: "var(--border-color)",
                                backgroundColor: "var(--settings-option-bg)",
                                color: "var(--settings-option-text)",
                              }}
                            />
                            <span
                              className={cn(
                                "pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] font-bold transition-colors",
                                inputUserName.length >= MAX_USER_NAME_LENGTH
                                  ? "font-black text-red-500"
                                  : inputUserName.length >= MAX_USER_NAME_LENGTH * 0.8
                                    ? "text-amber-500"
                                    : "opacity-45",
                              )}
                            >
                              {inputUserName.length}/{MAX_USER_NAME_LENGTH}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsEditingUserName(false);
                              setUserNameError(null);
                              setLengthWarning(false);
                            }}
                            disabled={isValidatingUserName}
                            className="h-10 shrink-0 rounded-lg border-2 px-2.5 text-xs font-bold"
                            style={{
                              borderColor: "var(--border-color)",
                              backgroundColor: "var(--settings-option-bg)",
                              color: "var(--settings-option-text)",
                            }}
                          >
                            取消
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleSaveUserName}
                            disabled={isValidatingUserName}
                            className="h-10 shrink-0 gap-1.5 rounded-lg border-2 px-3 text-xs font-black transition-transform hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
                            style={{
                              borderColor: "var(--border-color)",
                              backgroundColor: "var(--btn-send-bg)",
                              color: "var(--btn-action-text)",
                              boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
                            }}
                          >
                            {isValidatingUserName ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>检测中</span>
                              </>
                            ) : (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                <span>保存</span>
                              </>
                            )}
                          </Button>
                        </>
                      ) : (
                        <>
                          <div
                            className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border-2 px-3"
                            style={{
                              borderColor: "var(--fb-inactive-border)",
                              backgroundColor: "var(--settings-option-bg)",
                              color: "var(--settings-option-text)",
                            }}
                          >
                            <span className="shrink-0 text-xs font-bold" style={{ color: "var(--settings-option-muted)" }}>
                              称呼
                            </span>
                            <span className="truncate text-sm font-black">
                              {userName ? (
                                userName
                              ) : (
                                <span className="font-normal opacity-50">未设置</span>
                              )}
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setInputUserName(userName);
                              setUserNameError(null);
                              setUserNameSuccess(null);
                              setLengthWarning(false);
                              setIsEditingUserName(true);
                            }}
                            className="h-10 shrink-0 gap-1.5 rounded-lg border-2 px-3 text-xs font-black transition-transform hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
                            style={{
                              borderColor: "var(--border-color)",
                              backgroundColor: "var(--btn-new-bg)",
                              color: "var(--btn-new-text)",
                              boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>修改</span>
                          </Button>
                        </>
                      )}
                    </div>

                    {avatarError || userNameError || userNameSuccess || lengthWarning ? (
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        {avatarError ? (
                          <span className="flex items-center gap-1 text-red-500">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            {avatarError}
                          </span>
                        ) : userNameError ? (
                          <span className="flex items-center gap-1 text-red-500">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            {userNameError}
                          </span>
                        ) : userNameSuccess ? (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            {userNameSuccess}
                          </span>
                        ) : lengthWarning ? (
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            已达到最大 {MAX_USER_NAME_LENGTH} 个字符限制
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-xs" style={{ color: "var(--settings-option-muted)" }}>
                        点击头像可裁剪本地图片；AI 会在交流中自然使用你的称呼。
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* ── 2. 对话偏好（联网模式 + 回复语言） ── */}
              <section
                aria-labelledby="settings-chat-heading"
                className="rounded-xl border-2 p-4"
                style={SECTION_CARD_STYLE}
              >
                <h3 id="settings-chat-heading" className="mb-3 flex items-center gap-2 text-sm font-black">
                  <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
                  对话偏好
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <fieldset className="min-w-0">
                    <legend className="mb-2 flex items-center gap-1.5 text-xs font-bold" style={{ color: "var(--settings-option-muted)" }}>
                      <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
                      联网模式
                    </legend>
                    <div className="grid grid-cols-3 gap-2">
                      {SEARCH_MODES.map((mode) => {
                        const Icon = SEARCH_MODE_ICONS[mode.id];
                        const isActive = mode.id === searchMode;
                        return (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => onSearchModeChange(mode.id)}
                            aria-pressed={isActive}
                            className="flex h-10 items-center justify-center gap-1.5 rounded-lg border-2 px-2 transition-all hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
                            style={getSegmentedStyle(isActive)}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span className="text-xs font-black">{mode.shortLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1.5 text-xs" style={{ color: "var(--settings-option-muted)" }}>
                      {currentSearchMode.description}
                    </p>
                  </fieldset>

                  <div className="min-w-0">
                    <label
                      htmlFor="reply-language"
                      className="mb-2 flex items-center gap-1.5 text-xs font-bold"
                      style={{ color: "var(--settings-option-muted)" }}
                    >
                      <Languages className="h-3.5 w-3.5" aria-hidden="true" />
                      回复语言
                    </label>
                    <select
                      id="reply-language"
                      value={replyLanguage}
                      onChange={(event) => onReplyLanguageChange(normalizeReplyLanguage(event.target.value))}
                      aria-describedby="reply-language-description"
                      className="h-10 w-full rounded-lg border-2 px-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{
                        borderColor: "var(--border-color)",
                        backgroundColor: "var(--settings-option-bg)",
                        color: "var(--settings-option-text)",
                      }}
                    >
                      {REPLY_LANGUAGES.map((language) => (
                        <option key={language.id} value={language.id}>
                          {language.label}
                        </option>
                      ))}
                    </select>
                    <p id="reply-language-description" className="mt-1.5 text-xs" style={{ color: "var(--settings-option-muted)" }}>
                      从下一次回复生效；翻译与语言练习按任务要求处理。
                    </p>
                  </div>
                </div>
              </section>

              {/* ── 3. 外观与阅读 ── */}
              <section
                aria-labelledby="settings-appearance-heading"
                className="rounded-xl border-2 p-4"
                style={SECTION_CARD_STYLE}
              >
                <h3 id="settings-appearance-heading" className="mb-3 flex items-center gap-2 text-sm font-black">
                  <Palette className="h-4 w-4 shrink-0" aria-hidden="true" />
                  外观与阅读
                </h3>

                <div className="space-y-4">
                  <fieldset>
                    <legend className="mb-2 text-xs font-bold" style={{ color: "var(--settings-option-muted)" }}>
                      主题配色
                    </legend>
                    <ThemeSwitcher theme={theme} setTheme={onThemeChange} variant="inline" />
                  </fieldset>

                  <div
                    className="grid gap-4 border-t pt-4 sm:grid-cols-2"
                    style={{ borderColor: "var(--fb-inactive-border)" }}
                  >
                    <div className="min-w-0">
                      <p id="chat-font-label" className="mb-2 text-xs font-bold" style={{ color: "var(--settings-option-muted)" }}>
                        字体
                      </p>
                      <div role="group" aria-labelledby="chat-font-label" className="grid grid-cols-3 gap-2">
                        {(Object.keys(CHAT_FONTS) as ChatFont[]).map((font) => {
                          const isActive = chatFont === font;
                          return (
                            <button
                              key={font}
                              type="button"
                              aria-pressed={isActive}
                              onClick={() => onChatFontChange(font)}
                              className="h-10 rounded-lg border-2 px-1.5 text-xs font-bold transition-all hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
                              style={{
                                fontFamily: CHAT_FONTS[font].family,
                                ...getSegmentedStyle(isActive),
                              }}
                            >
                              {CHAT_FONTS[font].label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p id="chat-font-size-label" className="mb-2 text-xs font-bold" style={{ color: "var(--settings-option-muted)" }}>
                        字号（默认 16）
                      </p>
                      <div role="group" aria-labelledby="chat-font-size-label" className="grid grid-cols-4 gap-2">
                        {CHAT_FONT_SIZES.map((size) => {
                          const isActive = chatFontSize === size;
                          return (
                            <button
                              key={size}
                              type="button"
                              aria-pressed={isActive}
                              onClick={() => onChatFontSizeChange(size)}
                              className="h-10 rounded-lg border-2 px-1.5 text-xs font-black transition-all hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
                              style={getSegmentedStyle(isActive)}
                            >
                              {size}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div
                    className="rounded-lg border-2 px-3.5 py-2.5"
                    style={{
                      borderColor: "var(--fb-inactive-border)",
                      backgroundColor: "var(--ai-bubble-bg)",
                      color: "var(--ai-bubble-text)",
                    }}
                  >
                    <p className="mb-1 text-[11px] font-bold" style={{ color: "var(--settings-option-muted)" }}>
                      阅读预览
                    </p>
                    <p
                      className="truncate"
                      style={{
                        fontFamily: CHAT_FONTS[chatFont].family,
                        fontSize: chatFontSize,
                        lineHeight: 1.6,
                      }}
                    >
                      把复杂问题讲清楚，好奇心是探索世界的起点。
                    </p>
                  </div>
                </div>
              </section>

              {/* ── 4. 高级模型（按服务端配置条件展示） ── */}
              <AdvancedModelSettings />
            </div>
          </div>
        </section>
      </div>
      {avatarCropUrl ? (
        <AvatarCropper
          imageUrl={avatarCropUrl}
          onCancel={closeCropper}
          onConfirm={saveAvatar}
        />
      ) : null}
    </>
  );
}
