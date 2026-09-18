"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Check,
  Globe2,
  Loader2,
  Pencil,
  Radio,
  RotateCcw,
  Settings2,
  Trash2,
  UserRound,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";
import { AvatarCropper } from "@/components/avatar-cropper";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { MAX_USER_NAME_LENGTH } from "@/lib/constants";
import { PERSONAS, getPersonaById, type Persona } from "@/lib/personas";
import { SEARCH_MODES, type SearchMode } from "@/lib/search-modes";
import { type Theme } from "@/lib/use-theme";
import { cn } from "@/lib/utils";

const SEARCH_MODE_ICONS: Record<SearchMode, LucideIcon> = {
  auto: Radio,
  always: Globe2,
  off: WifiOff,
};

interface AppSettingsProps {
  open: boolean;
  personaId: string;
  searchMode: SearchMode;
  theme: Theme;
  userAvatar: string | null;
  userName: string;
  hasActiveConversation: boolean;
  historyCount: number;
  onOpenChange: (open: boolean) => void;
  onPersonaChange: (persona: Persona) => void;
  onSearchModeChange: (mode: SearchMode) => void;
  onThemeChange: (theme: Theme) => void;
  onUserAvatarChange: (avatar: string | null) => void;
  onUserNameChange: (userName: string) => void;
  onClearHistory: () => void;
}

export function AppSettings({
  open,
  personaId,
  searchMode,
  theme,
  userAvatar,
  userName,
  hasActiveConversation,
  historyCount,
  onOpenChange,
  onPersonaChange,
  onSearchModeChange,
  onThemeChange,
  onUserAvatarChange,
  onUserNameChange,
  onClearHistory,
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

  const [pendingPersonaId, setPendingPersonaId] = useState<string | null>(null);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [avatarCropUrl, setAvatarCropUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const selectedPersonaId = pendingPersonaId ?? personaId;
  const pendingPersona = pendingPersonaId
    ? getPersonaById(pendingPersonaId)
    : null;

  // 当弹窗打开时，同步外部的用户名状态并重置编辑态
  useEffect(() => {
    if (open) {
      setInputUserName(userName);
      setIsEditingUserName(false);
      setUserNameError(null);
      setUserNameSuccess(null);
      setLengthWarning(false);
    }
  }, [open, userName]);

  const closeDialog = useCallback(() => {
    if (avatarCropUrlRef.current) URL.revokeObjectURL(avatarCropUrlRef.current);
    avatarCropUrlRef.current = null;
    setAvatarCropUrl(null);
    setAvatarError(null);
    setUserNameError(null);
    setUserNameSuccess(null);
    setLengthWarning(false);
    setIsEditingUserName(false);
    setPendingPersonaId(null);
    setConfirmClearHistory(false);
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

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusFrame = requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !avatarCropUrlRef.current) closeDialog();
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [closeDialog, open]);

  if (!open) return null;

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

    // 允许留空，直接保存并清空
    if (!trimmed) {
      onUserNameChange("");
      setInputUserName("");
      setIsEditingUserName(false);
      setUserNameSuccess("用户名已清除");
      setTimeout(() => setUserNameSuccess(null), 2500);
      return;
    }

    // 若与当前已保存的用户名一致，无需重复调用模型检查
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
      setUserNameSuccess("用户名已保存生效");
      setTimeout(() => setUserNameSuccess(null), 2500);
    } catch {
      setUserNameError("网络异常，无法验证用户名");
    } finally {
      setIsValidatingUserName(false);
    }
  };

  const selectPersona = (persona: Persona) => {
    setConfirmClearHistory(false);
    setPendingPersonaId(persona.id === personaId ? null : persona.id);
  };

  const confirmPersonaChange = () => {
    if (!pendingPersona) return;
    onPersonaChange(pendingPersona);
    closeDialog();
  };

  const clearHistory = () => {
    onClearHistory();
    closeDialog();
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
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-3 backdrop-blur-[2px] sm:p-6"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="app-settings-title"
          className="flex max-h-[86vh] w-full max-w-[620px] flex-col overflow-hidden rounded-2xl border-[3px]"
          style={{
            borderColor: "var(--border-color)",
            backgroundColor: "var(--settings-panel-bg)",
            color: "var(--settings-option-text)",
            boxShadow: "8px 8px 0px 0px rgba(var(--shadow-color), 1)",
          }}
        >
          <header
            className="flex items-center justify-between gap-4 border-b-2 px-5 py-4"
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
                <Settings2 className="h-4.5 w-4.5" />
              </span>
              <h2 id="app-settings-title" className="text-lg font-black leading-none">
                设置
              </h2>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeDialog}
              className="grid h-9 w-9 place-items-center rounded-lg border-2 transition-transform hover:-translate-y-0.5"
              style={{
                borderColor: "var(--border-color)",
                backgroundColor: "var(--btn-new-bg)",
                color: "var(--btn-new-text)",
                boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
              }}
              aria-label="关闭设置"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="overflow-y-auto px-5 py-6 sm:px-6 space-y-6">
            {/* ── 1. 上方区域：用户资料（单栏：头像 + 用户名展示/编辑态） ── */}
            <div>
              <div className="mb-2">
                <label
                  htmlFor="app-username-input"
                  className="text-xs font-black uppercase tracking-[0.16em]"
                >
                  用户资料
                </label>
              </div>

              <div className="flex items-center gap-2.5">
                {/* 可交互头像按钮 */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="group relative grid h-11 w-11 place-items-center overflow-hidden rounded-full border-2 transition-transform hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
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
                    {userAvatar ? null : <UserRound className="h-5 w-5 text-white" />}
                    {/* 方案 1：底部半月微托底 + 精致微型相机图标 */}
                    <div className="absolute inset-x-0 bottom-0 flex h-4.5 items-center justify-center bg-black/60 pb-0.5 opacity-0 backdrop-blur-[0.5px] transition-all duration-200 group-hover:opacity-100">
                      <Camera className="h-2.5 w-2.5 text-white drop-shadow-sm" />
                    </div>
                  </button>

                  {/* 恢复默认头像按钮（仅在自定义头像时显示） */}
                  {userAvatar ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUserAvatarChange(null);
                      }}
                      className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        borderColor: "var(--border-color)",
                        backgroundColor: "var(--settings-option-bg)",
                        color: "var(--settings-option-text)",
                        boxShadow: "1px 1px 0px 0px rgba(var(--shadow-color), 1)",
                      }}
                      title="恢复默认头像"
                      aria-label="恢复默认头像"
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                    </button>
                  ) : null}

                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    tabIndex={-1}
                    onChange={(event) => selectAvatarFile(event.target.files?.[0])}
                  />
                </div>

                {isEditingUserName ? (
                  <>
                    {/* 编辑状态：输入框（内嵌字符计数） */}
                    <div className="relative flex-1 min-w-0">
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
                        className="h-11 w-full rounded-xl border-2 pl-3 pr-11 text-sm font-bold transition-all placeholder:text-xs placeholder:font-normal focus:outline-none"
                        style={{
                          borderColor: "var(--border-color)",
                          backgroundColor: "var(--settings-option-bg)",
                          color: "var(--settings-option-text)",
                          boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
                        }}
                      />
                      <span
                        className={cn(
                          "pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] font-bold transition-colors",
                          inputUserName.length >= MAX_USER_NAME_LENGTH
                            ? "text-red-500 font-black"
                            : inputUserName.length >= MAX_USER_NAME_LENGTH * 0.8
                              ? "text-amber-500"
                              : "opacity-45",
                        )}
                      >
                        {inputUserName.length}/{MAX_USER_NAME_LENGTH}
                      </span>
                    </div>

                    {/* 取消与保存按钮组 */}
                    <div className="flex shrink-0 gap-1.5">
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
                        className="h-11 rounded-xl border-2 px-2.5 text-xs font-bold"
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
                        className="h-11 gap-1.5 rounded-xl border-2 px-3 text-xs font-black transition-transform hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
                        style={{
                          borderColor: "var(--border-color)",
                          backgroundColor: "var(--btn-send-bg)",
                          color: "var(--settings-option-text)",
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
                    </div>
                  </>
                ) : (
                  /* 默认展示状态：当前用户名黑框 + 外部独立的修改按钮 */
                  <>
                    <div
                      className="flex h-11 flex-1 min-w-0 items-center rounded-xl border-2 px-3.5"
                      style={{
                        borderColor: "var(--border-color)",
                        backgroundColor: "var(--settings-option-bg)",
                        color: "var(--settings-option-text)",
                        boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
                      }}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="text-[11px] font-bold opacity-50 shrink-0">
                          用户名
                        </span>
                        <span className="truncate text-sm font-black">
                          {userName ? (
                            userName
                          ) : (
                            <span className="font-normal opacity-40">未设置</span>
                          )}
                        </span>
                      </div>
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
                      className="h-11 shrink-0 gap-1.5 rounded-xl border-2 px-3.5 text-xs font-black transition-transform hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
                      style={{
                        borderColor: "var(--border-color)",
                        backgroundColor: "var(--btn-new-bg)",
                        color: "var(--btn-new-text)",
                        boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>修改</span>
                    </Button>
                  </>
                )}
              </div>

              {/* 状态与提示行 */}
              {(avatarError || userNameError || userNameSuccess || lengthWarning) ? (
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold">
                  {avatarError ? (
                    <span className="flex items-center gap-1 text-red-500">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {avatarError}
                    </span>
                  ) : userNameError ? (
                    <span className="flex items-center gap-1 text-red-500">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {userNameError}
                    </span>
                  ) : userNameSuccess ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5 shrink-0" />
                      {userNameSuccess}
                    </span>
                  ) : lengthWarning ? (
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      已达到最大 {MAX_USER_NAME_LENGTH} 个字符限制
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* ── 2. 上方区域：系统偏好（联网设置 + 主题配色） ── */}
            <div
              className="grid gap-6 border-t pt-6 sm:grid-cols-2"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--settings-option-muted) 35%, transparent)",
              }}
            >
              <fieldset>
                <legend className="mb-3 text-xs font-black uppercase tracking-[0.16em]">
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
                        className="flex h-14 flex-col items-center justify-center gap-1 rounded-lg border-2 px-2 transition-all hover:-translate-y-0.5"
                        style={{
                          borderColor: isActive
                            ? "var(--settings-selected-border)"
                            : "var(--border-color)",
                          backgroundColor: isActive
                            ? "var(--settings-selected-bg)"
                            : "var(--settings-option-bg)",
                          color: isActive
                            ? "var(--settings-selected-text)"
                            : "var(--settings-option-text)",
                          boxShadow: isActive
                            ? "2px 2px 0px 0px var(--settings-selected-border)"
                            : "none",
                        }}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-[10px] font-black">{mode.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-3 text-xs font-black uppercase tracking-[0.16em]">
                  主题配色
                </legend>
                <ThemeSwitcher theme={theme} setTheme={onThemeChange} variant="inline" />
              </fieldset>
            </div>

            {/* ── 3. 下方区域：性格选择 ── */}
            <fieldset
              className="border-t pt-6"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--settings-option-muted) 35%, transparent)",
              }}
            >
              <legend className="mb-3 text-xs font-black uppercase tracking-[0.16em]">
                性格选择
              </legend>
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
                {PERSONAS.map((persona) => {
                  const Icon = persona.icon;
                  const isSelected = persona.id === selectedPersonaId;
                  return (
                    <button
                      key={persona.id}
                      type="button"
                      onClick={() => selectPersona(persona)}
                      aria-pressed={isSelected}
                      className={cn(
                        "relative flex min-h-22 flex-col items-center justify-center gap-2 rounded-xl border-2 px-2 py-3 text-center transition-all",
                        "hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5",
                      )}
                      style={{
                        borderColor: "var(--border-color)",
                        backgroundColor: isSelected
                          ? `var(${persona.colorVar})`
                          : "var(--settings-option-bg)",
                        color: isSelected
                          ? "var(--prompt-card-text)"
                          : "var(--settings-option-text)",
                        boxShadow: isSelected
                          ? "3px 3px 0px 0px rgba(var(--shadow-color), 1)"
                          : "none",
                      }}
                      title={persona.subtitle}
                    >
                      <span
                        className="grid h-9 w-9 place-items-center rounded-lg border-2"
                        style={{
                          borderColor: "var(--border-color)",
                          backgroundColor: "var(--prompt-card-icon-bg)",
                          color: "var(--prompt-card-text)",
                        }}
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <span className="text-[11px] font-black leading-tight">
                        {persona.name}
                      </span>
                      {isSelected ? (
                        <span
                          className="absolute right-1.5 top-1.5 grid h-4.5 w-4.5 place-items-center rounded-full border"
                          style={{
                            borderColor: "var(--border-color)",
                            backgroundColor: "var(--settings-selected-badge-bg)",
                            color: "var(--settings-selected-badge-text)",
                          }}
                          aria-hidden="true"
                        >
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* ── 4. 下方区域：清理记录 ── */}
            <div
              className="border-t pt-6"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--settings-option-muted) 35%, transparent)",
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.16em]">
                    清理记录
                  </p>
                  {confirmClearHistory ? (
                    <p className="mt-1 text-[10px] font-semibold text-red-500">
                      清空后无法恢复，当前对话也会重置
                    </p>
                  ) : null}
                </div>

                {confirmClearHistory ? (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmClearHistory(false)}
                    >
                      取消
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={clearHistory}
                      style={{
                        backgroundColor: "var(--hot-badge-bg)",
                        color: "var(--hot-badge-text)",
                        borderColor: "var(--border-color)",
                      }}
                    >
                      确认清空
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setPendingPersonaId(null);
                      setConfirmClearHistory(true);
                    }}
                    disabled={historyCount === 0}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-[11px] font-black transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-30"
                    style={{
                      borderColor: "var(--border-color)",
                      backgroundColor: "var(--settings-option-bg)",
                      color: "var(--hot-badge-bg)",
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    清空记录
                  </button>
                )}
              </div>
            </div>
          </div>

          {pendingPersona ? (
            <footer
              className="flex flex-col gap-3 border-t-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              style={{
                borderColor: "var(--border-color)",
                backgroundColor: "var(--card-footer-bg)",
              }}
            >
              <p className="text-xs font-bold">
                切换为 <span className="font-black">{pendingPersona.name}</span>
                {hasActiveConversation ? "，当前对话会自动保存" : ""}
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPendingPersonaId(null)}
                >
                  取消
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={confirmPersonaChange}
                  style={{
                    backgroundColor: "var(--header-bg)",
                    color: "var(--header-text)",
                    borderColor: "var(--border-color)",
                  }}
                >
                  {hasActiveConversation ? "确认并新建对话" : "确认切换"}
                </Button>
              </div>
            </footer>
          ) : null}
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
