"use client";

import { getStoryChoiceReply } from "@/lib/story-choices";
import { ADVENTURE_PERSONA_ID, getLatestAdventure, getSelectedAdventureAction } from "@/lib/adventure";
import { QuizSkeleton } from "@/components/quiz-skeleton";

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { MAX_INPUT_LENGTH } from "@/lib/constants";
import {
  Send,
  Square,
  Copy,
  Check,
  User as UserIcon,
  Plus,
  ImagePlus,
  X,
  Mic,
  MicOff,
  Search,
  Globe2,
  Radio,
  WifiOff,
  AlertTriangle,
  PanelLeftOpen,
  PanelLeftClose,
  ChevronRight,
  Settings2,
  Star,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardHeader,
  CardFooter,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/use-theme";
import { useChatPreferences } from "@/lib/use-chat-preferences";
import {
  getPersonaById,
  type Persona,
} from "@/lib/personas";
import { ChatHistory } from "@/components/chat-history";
import { MarkdownContent } from "@/components/markdown-content";
import { AppSettings } from "@/components/app-settings";
import { PersonaSwitcher } from "@/components/persona-switcher";
import {
  ResponseActions,
  type ResponseAction,
} from "@/components/response-actions";
import { SourceList } from "@/components/source-list";
import { useChatHistory, toStoredMessages } from "@/lib/use-chat-history";
import { MAX_FAVORITE_SESSIONS } from "@/lib/chat-history";
import { CHAT_FONTS } from "@/lib/chat-typography";
import { isNextQuizPrompt, parseQuizCard, readQuizAnswers, type QuizAnswer } from "@/lib/quizzes";
import { getResponseActionContext, getResponseActions, getMoreResponseActions, isSubstantiveReply, isQuizGroupContext } from "@/lib/response-actions";
import {
  getSearchMode,
  SEARCH_MODE_IDS,
  type SearchMode,
} from "@/lib/search-modes";
import type { ReplyLanguage } from "@/lib/reply-languages";
import { getLocalizedOpening } from "@/lib/persona-localization";
import { getClientChatErrorMessage } from "@/lib/chat-errors";
import { getMessageLayout } from "@/lib/message-layout";
import { ReplyFollowUpProvider } from "@/components/reply-follow-up";
import "katex/dist/katex.min.css";

// SpeechRecognition 类型声明
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

const chatTransport = new DefaultChatTransport({
  fetch: async (input, init) => {
    const response = await fetch(input, init);
    if (response.ok) return response;

    const rawMessage = await response.clone().text();
    const message = getClientChatErrorMessage(rawMessage, response.status);
    const headers = new Headers(response.headers);
    headers.set("Content-Type", "application/json; charset=utf-8");

    return new Response(JSON.stringify({ error: message }), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
});
const subscribeToBrowserCapability = () => () => undefined;
const getSpeechSupportSnapshot = () =>
  "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
const getServerSpeechSupportSnapshot = () => false;
const ChatAdventure = dynamic(() => import("@/components/chat-adventure").then((module) => module.ChatAdventure), { ssr: false });

const SEARCH_MODE_ICONS = {
  auto: Radio,
  always: Globe2,
  off: WifiOff,
} as const;

function getMessageText(parts: UIMessage["parts"]): string {
  return parts
    .filter(
      (part): part is { type: "text"; text: string } => part.type === "text",
    )
    .map((part) => part.text)
    .join("");
}

function createChatRequestBody(
  personaId: string,
  searchMode: SearchMode,
  userName?: string,
  replyLanguage: ReplyLanguage = "auto",
) {
  return {
    personaId,
    searchMode,
    replyLanguage,
    ...(userName?.trim() ? { userName: userName.trim() } : {}),
  };
}

export default function Home() {
  const { theme, setTheme } = useTheme();
  const {
    personaId,
    searchMode,
    userAvatar,
    userName,
    chatFont,
    chatFontSize,
    setChatFont,
    setChatFontSize,
    setPersonaId,
    setSearchMode,
    replyLanguage,
    setReplyLanguage,
    setUserAvatar,
    setUserName,
  } = useChatPreferences();
  const messageListRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState("");
  // 图片上传状态：存储 base64 数据 URL
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  // API 错误提示
  const [apiError, setApiError] = useState<string | null>(null);
  const [quizStage, setQuizStage] = useState<"generating" | "validating" | null>(null);
  const [activeRequestSearchMode, setActiveRequestSearchMode] = useState<SearchMode | null>(null);

  // 侧边栏
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!sidebarOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSidebarOpen(false);
      drawerTriggerRef.current?.focus();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [sidebarOpen]);
  const [historySearch, setHistorySearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [personaSwitcherOpen, setPersonaSwitcherOpen] = useState(false);
  const [favoriteBurst, setFavoriteBurst] = useState(false);
  const favoriteBurstTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (favoriteBurstTimerRef.current) window.clearTimeout(favoriteBurstTimerRef.current);
  }, []);

  const currentPersona = getPersonaById(personaId);
  const opening = getLocalizedOpening(currentPersona, replyLanguage);
  const CurrentPersonaIcon = currentPersona.icon;
  const currentSearchMode = getSearchMode(searchMode);
  const CurrentSearchModeIcon = SEARCH_MODE_ICONS[searchMode];
  const hasDraft = Boolean(inputValue.trim() || pendingImages.length > 0);
  const inputPlaceholder =
    pendingImages.length > 0
      ? "添加说明，或直接发送图片…"
      : opening.placeholder ?? opening.inputHint;

  // AI SDK 6 useChat - 默认连接到 /api/chat
  const { messages, sendMessage, regenerate, status, setMessages, stop } = useChat({
    transport: chatTransport,
    onData: (part) => {
      if (part.type !== "data-quiz-status" || !part.data || typeof part.data !== "object" || !("stage" in part.data)) return;
      setQuizStage(part.data.stage === "generating" || part.data.stage === "validating" ? part.data.stage : null);
    },
    onFinish: () => setQuizStage(null),
    onError: (error) => {
      if (process.env.NODE_ENV === "development") console.error("Chat reply failed", error);
      setQuizStage(null);
      setApiError(getClientChatErrorMessage(error.message));
    },
  });

  const isLoading = status === "streaming" || status === "submitted";
  const lastAssistantId = messages.findLast(
    (message) => message.role === "assistant",
  )?.id;
  const adventure = useMemo(() => personaId === ADVENTURE_PERSONA_ID ? getLatestAdventure(messages) : undefined, [messages, personaId]);
  const adventureMessageIndex = adventure ? messages.findLastIndex(({ id }) => id === adventure.messageId) : -1;
  const adventureIsCurrent = adventureMessageIndex >= 0 && adventureMessageIndex === messages.length - 1;
  const adventureNeedsRetry = Boolean(adventure && !isLoading && !adventureIsCurrent && messages.at(-1)?.role === "assistant" &&
    getSelectedAdventureAction(messages[adventureMessageIndex + 1], adventure.update.updateDataModel.value));

  // ── History ──
  const history = useChatHistory();
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const currentSession = history.sessions.find(
    (session) => session.id === history.currentSessionId,
  );
  const favoriteSessionCount = history.sessions.filter(
    (session) => session.isFavorite,
  ).length;
  const favoriteButtonDisabled =
    !currentSession ||
    (!currentSession.isFavorite &&
      favoriteSessionCount >= MAX_FAVORITE_SESSIONS);

  // Keep the hook's currentSessionId in sync
  useEffect(() => {
    history.setCurrentSessionId(sessionIdRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save whenever messages change (only when not streaming)
  useEffect(() => {
    if (isLoading) return;
    if (messages.length === 0) return;
    history.saveSession(
      sessionIdRef.current,
      toStoredMessages(messages),
      { personaId, searchMode },
    );
    void history.summarizeSession(sessionIdRef.current, replyLanguage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isLoading, personaId, searchMode, replyLanguage]);

  // 带字符限制的输入更新
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value.slice(0, MAX_INPUT_LENGTH));
  }, []);

  // 自动调整 textarea 高度
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [inputValue]);

  // Enter 发送，Shift+Enter 换行
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        const form = e.currentTarget.closest("form");
        form?.requestSubmit();
      }
    },
    [],
  );

  // 复制状态管理
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 语音输入状态
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  // 记录语音识别开始前已有的文本，用于追加
  const preVoiceTextRef = useRef("");

  const isSpeechSupported = useSyncExternalStore(
    subscribeToBrowserCapability,
    getSpeechSupportSnapshot,
    getServerSpeechSupportSnapshot,
  );

  const toggleVoiceInput = useCallback(() => {
    if (isListening) {
      // 停止识别
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    if (!isSpeechSupported) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "zh-CN";

    // 保存当前已有文本
    preVoiceTextRef.current = inputValue;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const combined = finalTranscript || interimTranscript;
      const prefix = preVoiceTextRef.current;
      const voiceText = prefix ? `${prefix} ${combined}` : combined;
      setInputValue(voiceText.slice(0, MAX_INPUT_LENGTH));

      // 如果有最终识别结果，更新 prefix 以支持持续追加
      if (finalTranscript) {
        preVoiceTextRef.current = prefix
          ? `${prefix} ${finalTranscript}`
          : finalTranscript;
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "aborted") return; // abort() 触发，属于正常行为
      console.error("语音识别错误:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, isSpeechSupported, inputValue]);

  // 复制消息内容
  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("复制失败:", err);
    }
  }, []);

  // 压缩图片（确保不超过 1MB，最大边 1024px）
  const compressImage = useCallback(
    (file: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new window.Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const MAX_SIZE = 1024;
            let { width, height } = img;
            if (width > MAX_SIZE || height > MAX_SIZE) {
              if (width > height) {
                height = (height / width) * MAX_SIZE;
                width = MAX_SIZE;
              } else {
                width = (width / height) * MAX_SIZE;
                height = MAX_SIZE;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, 0, 0, width, height);
            // 使用 JPEG 格式压缩，质量 0.8
            const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
            resolve(dataUrl);
          };
          img.onerror = () => reject(new Error("图片加载失败"));
          img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error("文件读取失败"));
        reader.readAsDataURL(file);
      }),
    [],
  );

  // 处理图片上传
  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      // 最多同时上传 4 张图片
      const filesToProcess = files.slice(0, 4 - pendingImages.length);

      try {
        const compressed = await Promise.all(
          filesToProcess.map((file) => compressImage(file)),
        );
        setPendingImages((prev) => [...prev, ...compressed].slice(0, 4));
      } catch (err) {
        console.error("图片处理失败:", err);
      }

      // 重置 input 以便再次选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [pendingImages.length, compressImage],
  );

  // 移除待发送的图片
  const removePendingImage = useCallback((index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // 处理粘贴剪切板中的图片
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items);
      const imageFiles = items
        .filter((item) => item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);

      if (imageFiles.length === 0) return;

      // 阻止默认粘贴行为（避免在输入框插入乱码）
      e.preventDefault();

      const filesToProcess = imageFiles.slice(0, 4 - pendingImages.length);
      if (filesToProcess.length === 0) return;

      try {
        const compressed = await Promise.all(
          filesToProcess.map((file) => compressImage(file)),
        );
        setPendingImages((prev) => [...prev, ...compressed].slice(0, 4));
      } catch (err) {
        console.error("粘贴图片处理失败:", err);
      }
    },
    [pendingImages.length, compressImage],
  );

  // 处理人设选择
  const handlePersonaSelect = useCallback(
    (persona: Persona) => {
      if (persona.id === personaId) return;
      // 切换人设前保存当前对话
      if (messages.length > 0) {
        history.saveSession(
          sessionIdRef.current,
          toStoredMessages(messages),
          { personaId, searchMode },
        );
        const newId = crypto.randomUUID();
        sessionIdRef.current = newId;
        history.setCurrentSessionId(newId);
        setMessages([]);
        setInputValue("");
        setPendingImages([]);
      }
      setPersonaId(persona.id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, personaId, searchMode, setMessages],
  );

  // 处理快捷提示词点击
  const handleQuizSubmit = (messageId: string, answer: QuizAnswer) => {
    if (isLoading) return;
    const quiz = parseQuizCard(answer.raw);
    if (!quiz || readQuizAnswers({ quizAnswers: [answer] }).length !== 1) return;
    setMessages((current) => {
      const message = current.find((item) => item.id === messageId);
      if (!message || message.role !== "assistant") return current;
      const answers = readQuizAnswers(message.metadata);
      if (answers.length >= 8 || answers.some((item) => item.key === answer.key && item.raw === answer.raw)) return current;
      const metadata = typeof message.metadata === "object" && message.metadata !== null ? message.metadata : {};
      return current.map((item) => item.id === messageId ? { ...item, metadata: { ...metadata, quizAnswers: [...answers.filter((item) => item.key !== answer.key), answer] } } : item);
    });
  };

  const handleQuickPrompt = (prompt: string) => {
    if (isLoading) return;
    setApiError(null);
    setActiveRequestSearchMode(searchMode);
    sendMessage(
      { text: prompt },
      {
        body: createChatRequestBody(personaId, searchMode, userName, replyLanguage),
      },
    );
  };

  const handleResponseAction = useCallback(
    (actionId: ResponseAction) => {
      if (isLoading) return;
      const context = getResponseActionContext(messages, lastAssistantId ?? "");
      const action = [...getResponseActions(context, isQuizGroupContext(messages, lastAssistantId ?? ""), personaId, isSubstantiveReply(messages.find((message) => message.id === lastAssistantId))), ...getMoreResponseActions(context, personaId)].find((item) => item.id === actionId);
      if (!action) return;
      const requestSearchMode = actionId === "verify" ? "always" : searchMode;
      setApiError(null);
      setActiveRequestSearchMode(requestSearchMode);
      sendMessage(
        { text: action.prompt },
        {
          body: createChatRequestBody(
            personaId,
            requestSearchMode,
            userName,
            replyLanguage,
          ),
        },
      );
    },
    [sendMessage, personaId, searchMode, userName, replyLanguage, messages, lastAssistantId, isLoading],
  );

  const scrollToBottom = useCallback(() => {
    const list = messageListRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, []);

  const handleNewConversation = () => {
    if (isLoading) return;

    // Save current non-empty conversation before resetting
    if (messages.length > 0) {
      history.saveSession(
        sessionIdRef.current,
        toStoredMessages(messages),
        { personaId, searchMode },
      );
    }
    // Generate new session id
    const newId = crypto.randomUUID();
    sessionIdRef.current = newId;
    history.setCurrentSessionId(newId);
    setMessages([]);
    setInputValue("");
    setPendingImages([]);
    setApiError(null);
    setActiveRequestSearchMode(null);
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setIsListening(false);
    preVoiceTextRef.current = "";
    setSidebarOpen(false);
    setSettingsOpen(false);
  };

  const handleDeleteSession = (id: string) => {
    history.deleteSession(id);
    if (sessionIdRef.current !== id) return;

    // Discard the active conversation without running resetConversation's save.
    void stop();
    const newId = crypto.randomUUID();
    sessionIdRef.current = newId;
    history.setCurrentSessionId(newId);
    setMessages([]);
    setInputValue("");
    setPendingImages([]);
    setApiError(null);
    setActiveRequestSearchMode(null);
  };

  // Restore a conversation from history
  const handleRestoreSession = useCallback(
    (id: string) => {
      // Save current first
      if (messages.length > 0) {
        history.saveSession(
          sessionIdRef.current,
          toStoredMessages(messages),
          { personaId, searchMode },
        );
      }
      const restored = history.loadSession(id);
      if (!restored) return;
      sessionIdRef.current = id;
      history.setCurrentSessionId(id);
      const restoredPersonaId = getPersonaById(restored.personaId).id;
      setPersonaId(restoredPersonaId);
      setSearchMode(restored.searchMode);
      setMessages(restored.messages);
      setInputValue("");
      setPendingImages([]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, personaId, searchMode, setMessages],
  );

  // 重新生成最后一条 AI 回复
  const handleRegenerate = useCallback(() => {
    const lastAssistant = messages.findLast((message) => message.role === "assistant");
    if (!lastAssistant) return;

    // AI SDK 会复用原始用户消息，包含其中的图片 parts。
    setApiError(null);
    setActiveRequestSearchMode(searchMode);
    regenerate({
      messageId: lastAssistant.id,
      body: createChatRequestBody(personaId, searchMode, userName, replyLanguage),
    });
  }, [messages, personaId, searchMode, userName, replyLanguage, regenerate]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, apiError, scrollToBottom]);

  const handleCycleSearchMode = useCallback(() => {
    const currentIndex = SEARCH_MODE_IDS.indexOf(searchMode);
    const nextMode = SEARCH_MODE_IDS[(currentIndex + 1) % SEARCH_MODE_IDS.length];
    setSearchMode(nextMode);
  }, [searchMode, setSearchMode]);

  const handleStop = useCallback(() => {
    setQuizStage(null);
    void stop();
  }, [stop]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    // 允许只发图片或只发文字
    if (!inputValue.trim() && pendingImages.length === 0) return;

    // 构建消息附件（图片）
    const files = pendingImages.map((dataUrl) => ({
      // AI SDK 6 期望的 FileUIPart 格式
      type: "file" as const,
      mediaType: "image/jpeg" as const,
      url: dataUrl,
    }));

    setApiError(null);
    setActiveRequestSearchMode(searchMode);
    sendMessage(
      {
        text: inputValue || "请看这张图片，帮我解决问题",
        files,
      },
      {
        body: createChatRequestBody(personaId, searchMode, userName, replyLanguage),
      },
    );

    // 发送前先关闭语音识别，abort() 不会再触发 onresult
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setIsListening(false);
    preVoiceTextRef.current = "";

    setInputValue("");
    setPendingImages([]);
  };

  return (
    <main className="relative flex h-dvh min-h-dvh items-center justify-center overflow-hidden md:p-3 lg:p-4">
      <div className="flex h-full w-full max-w-[1200px] gap-0 lg:gap-4 xl:h-[min(92dvh,960px)]">
        {/* ── 左侧边栏 ── */}

        {/* 移动端 / 平板竖屏遮罩 */}
        {sidebarOpen && (
          <button
            type="button"
            aria-label="关闭侧边栏遮罩"
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            onClick={() => { setSidebarOpen(false); drawerTriggerRef.current?.focus(); }}
          />
        )}

        <aside
          id="chat-sidebar"
          aria-label="对话导航"
          className={cn(
            // 手机 & 平板竖屏：固定定位抽屉；iPad 横屏及以上（>= 1024px）：常驻侧边栏
            "fixed inset-y-0 left-0 z-50 flex w-64 flex-col gap-3 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] transition-transform duration-200",
            "lg:static lg:z-auto lg:w-56 lg:shrink-0 lg:translate-x-0 lg:visible lg:py-3",
            "rounded-none border-r-2 lg:rounded-2xl lg:border-2",
            sidebarOpen ? "visible translate-x-0" : "invisible -translate-x-full",
            desktopSidebarCollapsed && "lg:hidden",
          )}
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--border-color)",
            boxShadow: "4px 4px 0px 0px rgba(var(--shadow-color), 1)",
          }}
        >
          {/* Logo */}
          <div className="flex items-center gap-2 px-1 pb-2 border-b-2" style={{ borderColor: "var(--border-color)" }}>
            <Image
              src="/icon-192.png"
              alt="聊聊机"
              width={36}
              height={36}
              className="size-9 rounded-lg border-2 object-cover -rotate-3"
              style={{
                borderColor: "var(--border-color)",
                boxShadow: "2px 2px 0px 0px var(--logo-shadow)",
              }}
            />
            <div>
              <p className="text-lg font-black tracking-tighter leading-none" style={{ color: "var(--foreground)" }}>聊聊机</p>
              <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: "var(--header-subtitle)" }}>Chat-O-Matic</p>
            </div>
            <button type="button" aria-label="关闭侧边栏" onClick={() => { setSidebarOpen(false); drawerTriggerRef.current?.focus(); }} className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md focus-visible:outline-2 lg:hidden"><X aria-hidden="true" className="h-4 w-4" /></button>
          </div>

          {/* 新对话按钮 */}
          <Button
            type="button"
            onClick={handleNewConversation}
            disabled={isLoading}
            className="w-full justify-start gap-2 transition-all active:translate-x-0.5 active:translate-y-0.5"
            style={{
              backgroundColor: "var(--header-bg)",
              color: "var(--header-text)",
              borderColor: "var(--border-color)",
              boxShadow: "3px 3px 0px 0px rgba(var(--shadow-color), 1)",
            }}
          >
            <Plus className="w-4 h-4" />
            <span className="font-bold text-sm">新对话</span>
          </Button>

          {/* 搜索历史标题 */}
          <div
            className="flex items-center gap-2 rounded-lg border-2 px-2.5 focus-within:ring-2 focus-within:ring-[var(--header-bg)]"
            style={{
              backgroundColor: "var(--input-bg)",
              borderColor: "var(--border-color)",
              color: "var(--foreground)",
            }}
          >
            <Search aria-hidden="true" className="h-4 w-4 shrink-0 opacity-60" />
            <input
              type="search"
              aria-label="搜索历史标题"
              placeholder="搜索历史标题"
              value={historySearch}
              onChange={(event) => setHistorySearch(event.target.value)}
              className="h-10 min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:opacity-50 md:text-sm [&::-webkit-search-cancel-button]:appearance-none"
            />
            {historySearch ? (
              <button
                type="button"
                onClick={() => setHistorySearch("")}
                aria-label="清除历史搜索"
                className="grid h-8 w-6 shrink-0 place-items-center rounded transition-opacity hover:opacity-60 focus-visible:outline-2"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {/* 历史记录 */}
          <div className="flex-1 min-h-0 flex flex-col">
            <ChatHistory
              sessions={history.sessions}
              searchQuery={historySearch}
              currentSessionId={history.currentSessionId}
              onSelect={(id) => { handleRestoreSession(id); setSidebarOpen(false); setSettingsOpen(false); }}
              onDelete={handleDeleteSession}
              onToggleFavorite={history.toggleFavorite}
              variant="sidebar"
            />
          </div>

          {/* 统一设置入口 */}
          <button
            type="button"
            onClick={() => { setSettingsOpen(true); setSidebarOpen(false); }}
            disabled={isLoading}
            className="inline-flex self-end items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-black transition-all hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: "var(--btn-new-bg)",
              borderColor: "var(--border-color)",
              color: "var(--btn-new-text)",
              boxShadow: "3px 3px 0px 0px rgba(var(--shadow-color), 1)",
            }}
          >
            <Settings2 className="h-4 w-4" />
            设置
          </button>
        </aside>

        {/* ── 主聊天区域 ── */}
        {settingsOpen ? (
          <AppSettings
            open={settingsOpen}
            searchMode={searchMode}
            replyLanguage={replyLanguage}
            onReplyLanguageChange={setReplyLanguage}
            theme={theme}
            userAvatar={userAvatar}
            userName={userName}
            chatFont={chatFont}
            chatFontSize={chatFontSize}
            onChatFontChange={setChatFont}
            onChatFontSizeChange={setChatFontSize}
            onOpenChange={setSettingsOpen}
            onSearchModeChange={setSearchMode}
            onThemeChange={setTheme}
            onUserAvatarChange={setUserAvatar}
            onUserNameChange={setUserName}
          />
        ) : (
        <Card
          className="chat-shell flex h-full min-w-0 flex-1 flex-col rounded-none border-0 md:rounded-lg md:border-4"
          style={{ boxShadow: "var(--chat-shell-shadow)", "--chat-font": CHAT_FONTS[chatFont].family, "--chat-font-size": `${chatFontSize}px` } as CSSProperties}
        >
          <CardHeader
            className="rounded-none border-b-2 px-3 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] sm:px-5 md:rounded-t-lg md:py-3.5"
            style={{
              borderColor: "var(--border-color)",
              background: "var(--header-bg)",
              color: "var(--header-text)",
            }}
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                {/* 手机与平板竖屏使用抽屉；iPad 横屏及桌面可收起固定侧边栏。 */}
                <Button
                  ref={drawerTriggerRef}
                  onClick={() => setSidebarOpen((v) => !v)}
                  aria-label={sidebarOpen ? "收起对话导航" : "打开对话导航"}
                  aria-expanded={sidebarOpen}
                  aria-controls="chat-sidebar"
                  size="icon"
                  className="h-10 w-10 shrink-0 transition-all active:translate-x-0.5 active:translate-y-0.5 lg:hidden"
                  style={{
                    backgroundColor: "var(--btn-new-bg)",
                    color: "var(--btn-new-text)",
                    borderColor: "var(--border-color)",
                    boxShadow: "3px 3px 0px 0px rgba(var(--shadow-color), 1)",
                  }}
                >
                  {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
                </Button>
                <Button type="button" size="icon" aria-label={desktopSidebarCollapsed ? "展开对话导航" : "收起对话导航"} aria-expanded={!desktopSidebarCollapsed} aria-controls="chat-sidebar" onClick={() => setDesktopSidebarCollapsed((value) => !value)} className="hidden h-9 w-9 shrink-0 transition-all active:translate-x-0.5 active:translate-y-0.5 lg:inline-flex lg:any-pointer-coarse:h-10 lg:any-pointer-coarse:w-10" style={{ backgroundColor: "var(--btn-new-bg)", color: "var(--btn-new-text)", borderColor: "var(--border-color)", boxShadow: "3px 3px 0px 0px rgba(var(--shadow-color), 1)" }}>{desktopSidebarCollapsed ? <PanelLeftOpen aria-hidden="true" className="h-5 w-5" /> : <PanelLeftClose aria-hidden="true" className="h-5 w-5" />}</Button>

                <button
                  type="button"
                  onClick={() => setPersonaSwitcherOpen(true)}
                  disabled={isLoading}
                  aria-label={`切换人设，当前：${currentPersona.name}`}
                  aria-haspopup="dialog"
                  aria-expanded={personaSwitcherOpen}
                  className="group flex min-w-0 items-center gap-1.5 rounded-lg p-1 text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2"
                >
                  <span
                    className="shrink-0 rounded-lg border-2 p-1.5"
                    style={{
                      backgroundColor: `var(${currentPersona.colorVar})`,
                      borderColor: "var(--border-color)",
                      boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
                    }}
                  >
                    <CurrentPersonaIcon className="h-4 w-4" style={{ color: "var(--prompt-card-text)" }} />
                  </span>
                  <span className="min-w-0">
                    <span
                      className="block truncate text-sm font-black leading-none tracking-tight sm:text-base md:text-lg"
                      style={{ color: "var(--header-text)" }}
                    >
                      {currentPersona.name}
                    </span>
                    <span className="block truncate text-[10px] font-bold" style={{ color: "var(--header-subtitle)" }}>
                      {currentPersona.subtitle}
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" className="hidden h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 sm:block" />
                </button>
              </div>
              <Button
                type="button"
                onClick={handleNewConversation}
                disabled={isLoading}
                className={cn(
                  "h-10 shrink-0 gap-1 px-2.5 text-xs md:h-9 md:any-pointer-coarse:h-10",
                  desktopSidebarCollapsed ? "inline-flex" : "inline-flex lg:hidden",
                )}
                style={{
                  backgroundColor: "var(--btn-new-bg)",
                  color: "var(--btn-new-text)",
                  boxShadow: "3px 3px 0px 0px rgba(var(--shadow-color), 1)",
                }}
              >
                <Plus aria-hidden="true" className="size-4 shrink-0" />
                新对话
              </Button>
              <button
                type="button"
                data-burst={favoriteBurst || undefined}
                onClick={() => {
                  if (!currentSession) return;
                  const nextIsFavorite = !currentSession.isFavorite;
                  history.toggleFavorite(currentSession.id);
                  if (favoriteBurstTimerRef.current) {
                    window.clearTimeout(favoriteBurstTimerRef.current);
                    favoriteBurstTimerRef.current = null;
                  }
                  if (nextIsFavorite) {
                    setFavoriteBurst(false);
                    requestAnimationFrame(() => setFavoriteBurst(true));
                    favoriteBurstTimerRef.current = window.setTimeout(() => {
                      setFavoriteBurst(false);
                      favoriteBurstTimerRef.current = null;
                    }, 600);
                  } else {
                    setFavoriteBurst(false);
                  }
                }}
                disabled={favoriteButtonDisabled}
                className="favorite-btn relative inline-flex h-10 min-w-10 shrink-0 items-center justify-center overflow-visible rounded-lg border-2 px-2 py-1.5 text-xs font-black transition-[transform,background-color,color,box-shadow] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-x-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35 md:h-9 md:min-w-9 md:any-pointer-coarse:h-10 md:any-pointer-coarse:min-w-10"
                style={{
                  backgroundColor: currentSession?.isFavorite
                    ? "var(--qp-2)"
                    : "var(--btn-new-bg)",
                  borderColor: "var(--border-color)",
                  color: currentSession?.isFavorite
                    ? "var(--prompt-card-text)"
                    : "var(--btn-new-text)",
                  boxShadow: "3px 3px 0px 0px rgba(var(--shadow-color), 1)",
                }}
                aria-label={currentSession?.isFavorite ? "取消收藏当前对话" : "收藏当前对话"}
                title={
                  !currentSession
                    ? "发送消息后可收藏"
                    : favoriteButtonDisabled
                      ? `收藏夹最多 ${MAX_FAVORITE_SESSIONS} 条`
                      : currentSession.isFavorite
                        ? "取消收藏当前对话"
                        : "收藏当前对话"
                }
              >
                <span className="relative inline-flex shrink-0 items-center justify-center">
                  <Star
                    aria-hidden="true"
                    className="favorite-star-icon h-4 w-4"
                    fill={currentSession?.isFavorite ? "currentColor" : "none"}
                  />
                  {favoriteBurst ? (
                    <span className="favorite-sparkles" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : null}
                </span>
                <span className="favorite-label-wrap">
                  <span className="pr-1">
                    {currentSession?.isFavorite ? "已收藏" : "收藏"}
                  </span>
                </span>
              </button>
            </div>
          </CardHeader>

        <CardContent
          ref={messageListRef}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 md:p-4"
          style={{ backgroundColor: "var(--card-content-bg)" }}
        >
          {messages.length === 0 && (
            <div className="flex min-h-full flex-col items-center justify-center space-y-5 px-2 py-4 text-center">
              {(() => {
                const PersonaIcon = currentPersona.icon;
                return (
                  <PersonaIcon
                    className="w-12 h-12 md:w-16 md:h-16"
                    style={{
                      color: "var(--sparkle-color)",
                    }}
                  />
                );
              })()}
              <p
                className="text-sm font-bold border-2 px-3 py-1 rounded-lg"
                style={{
                  backgroundColor: "var(--header-bg)",
                  borderColor: "var(--border-color)",
                  boxShadow: "3px 3px 0px 0px rgba(var(--shadow-color), 1)",
                  color: "var(--header-text)",
                }}
              >
                {opening.intro}
              </p>

              {/* 快捷提示词卡片网格 */}
              <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                {opening.quickPrompts.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      onClick={() => handleQuickPrompt(item.prompt)}
                      disabled={isLoading}
                      className={cn(
                        "flex min-w-0 flex-col items-center gap-2 p-3 rounded-xl border-2",
                        "transition-all hover:-translate-y-0.5",
                        "active:translate-x-0.5 active:translate-y-0.5",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                      )}
                      style={{
                        backgroundColor: `var(${item.colorVar})`,
                        borderColor: "var(--border-color)",
                        boxShadow:
                          "3px 3px 0px 0px rgba(var(--shadow-color), 1)",
                        color: "var(--prompt-card-text)",
                      }}
                    >
                      <div
                        className="p-2 rounded-lg border-2"
                        style={{
                          backgroundColor: "var(--prompt-card-icon-bg)",
                          borderColor: "var(--border-color)",
                        }}
                      >
                        <Icon
                          className="w-5 h-5"
                          style={{ color: "var(--prompt-card-text)" }}
                        />
                      </div>
                      <span className="flex min-h-10 max-w-full items-center justify-center break-words text-sm font-bold leading-snug">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {messages.map((message) => {
            // Keep the continuation instruction in model context and saved history,
            // while the conversation goes straight from the button to the next quiz.
            if (message.role === "user" && message.parts.length === 1 &&
              message.parts[0].type === "text" && isNextQuizPrompt(message.parts[0].text)) return null;
            const pendingQuiz = isLoading && message.id === lastAssistantId ? quizStage : null;
            const layout = pendingQuiz ? "mixed" : getMessageLayout(message, isLoading && message.id === lastAssistantId);
            const cardOnly = layout === "cards" || layout === "compact-cards";
            const hasEmbeddedCard = message.role === "assistant" && (
              layout !== "text" ||
              message.parts.some((part) => part.type === "text" && /^[ \t]*(`{3,}|~{3,})(chart|quiz|sentence|choice)[ \t]*\r?\n/m.test(part.text))
            );
            return (
            <div
              key={message.id}
              className={cn(
                "mx-auto flex w-full max-w-[900px]",
                message.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "flex min-w-0 items-start",
                  message.role === "user"
                    ? "max-w-[94%] flex-row-reverse gap-2 md:max-w-[80%]"
                    : cn("w-full flex-col gap-1.5 md:flex-row md:gap-2", layout === "mixed" || layout === "cards" ? "max-w-[900px]" : "max-w-[760px]"),
                )}
              >
                <div
                  role="img"
                  aria-label={message.role === "user" ? "用户头像" : "聊聊机头像"}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-cover bg-center md:h-8 md:w-8",
                    message.role === "assistant" && "md:sticky md:top-2",
                  )}
                  style={{
                    borderColor: "var(--border-color)",
                    backgroundColor:
                      message.role === "user"
                        ? "var(--user-avatar-bg)"
                        : "var(--ai-avatar-bg)",
                    backgroundImage:
                      message.role === "user" && userAvatar
                        ? `url(${userAvatar})`
                        : undefined,
                    boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
                  }}
                >
                  {message.role === "user" ? (
                    userAvatar ? null : <UserIcon className="w-5 h-5 text-white" />
                  ) : (
                    <Image
                      src="/icon-192.png"
                      alt=""
                      width={32}
                      height={32}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <ReplyFollowUpProvider disabled={isLoading} allowEntry={layout !== "text" || getMessageText(message.parts).length >= 180}>
                <div
                  className={cn(
                    "group relative min-w-0",
                    message.role === "assistant" && "w-full",
                  )}
                >
                  <div
                    className={cn(
                      "chat-message break-words text-base font-medium",
                      cardOnly ? "chat-message-cards border-0 p-0" : "rounded-lg border-2 p-3",
                      layout === "mixed" && "chat-message-wide",
                      message.role === "user"
                        ? "rounded-tr-none"
                        : hasEmbeddedCard
                          ? "w-full rounded-tl-none"
                          : "w-full rounded-tl-none md:w-fit md:max-w-full",
                    )}
                    style={{
                      borderColor: "var(--border-color)",
                      backgroundColor:
                        message.role === "user"
                          ? "var(--user-bubble-bg)"
                          : cardOnly ? "transparent" : "var(--ai-bubble-bg)",
                      color:
                        message.role === "user"
                          ? "var(--user-bubble-text)"
                          : "var(--ai-bubble-text)",
                      boxShadow: cardOnly ? "none" : "4px 4px 0px 0px rgba(var(--shadow-color), 1)",
                    }}
                  >
                    {/* AI SDK v6 官方推荐: 使用 switch/case 遍历 message.parts */}
                    {message.parts.map((part, partIndex) => {
                      const key = `${message.id}-${partIndex}`;
                      switch (part.type) {
                        case "text":
                          return message.role === "user" ? (
                            <span key={key}>{part.text}</span>
                          ) : (
                            <MarkdownContent
                              key={key}
                              text={part.text}
                              isStreaming={isLoading && message.id === lastAssistantId}
                              quizPrefix={String(partIndex)}
                              storyControls={{ disabled: isLoading || messages.at(-1)?.id !== message.id, reply: getStoryChoiceReply(messages, message.id), onChoose: handleQuickPrompt }}
                              onFollowUp={isLoading ? undefined : handleQuickPrompt}
                              quizControls={{
                                answers: readQuizAnswers(message.metadata),
                                disabled: isLoading,
                                onSubmit: (answer) => handleQuizSubmit(message.id, answer),
                                onFollowUp: isLoading ? undefined : handleQuickPrompt,
                              }}
                            />
                          );
                        case "file":
                          // 渲染用户上传的图片
                          if (part.mediaType?.startsWith("image/")) {
                            return (
                              <Image
                                key={key}
                                src={part.url}
                                alt="上传的图片"
                                width={1024}
                                height={1024}
                                unoptimized
                                className="w-auto h-auto max-w-full rounded-lg border-2 mt-2"
                                style={{
                                  borderColor: "var(--border-color)",
                                  boxShadow:
                                    "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
                                }}
                              />
                            );
                          }
                          return null;
                        default:
                          return null;
                      }
                    })}

                    {pendingQuiz ? <QuizSkeleton stage={pendingQuiz} /> : null}
                    {message.role === "assistant" ? (
                      <SourceList
                        parts={message.parts}
                        metadata={message.metadata}
                        isComplete={!isLoading || message.id !== lastAssistantId}
                      />
                    ) : null}
                  </div>
                  {message.role === "assistant" ? (
                    <ResponseActions
                      disabled={isLoading}
                      showLearningActions={message.id === lastAssistantId}
                      isCopied={copiedId === message.id}
                      isRegenerating={
                        isLoading && message.id === lastAssistantId
                      }
                      onAction={handleResponseAction}
                      context={getResponseActionContext(messages, message.id)}
                      grouped={isQuizGroupContext(messages, message.id)}
                      personaId={personaId}
                      substantive={isSubstantiveReply(message)}
                      onRegenerate={handleRegenerate}
                      onCopy={() =>
                        handleCopy(getMessageText(message.parts), message.id)
                      }
                    />
                  ) : message.role === "user" && getMessageText(message.parts).trim() ? (
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleCopy(getMessageText(message.parts), message.id)}
                        className="user-message-copy inline-flex h-7 w-7 items-center justify-center gap-0 rounded-md border p-0 text-[11px] font-bold transition-all hover:-translate-y-0.5 hover:brightness-95 active:translate-x-0.5 active:translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
                        style={{
                          borderColor: "var(--fb-inactive-border)",
                          backgroundColor: "var(--fb-inactive-bg)",
                          color: "var(--fb-inactive-text)",
                        }}
                        aria-label={copiedId === message.id ? "消息已复制" : "复制消息"}
                        title={copiedId === message.id ? "已复制" : "复制"}
                      >
                        {copiedId === message.id ? (
                          <Check aria-hidden="true" className="h-3.5 w-3.5" style={{ color: "var(--fb-helpful-bg)" }} />
                        ) : (
                          <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  ) : null}
                </div>
                </ReplyFollowUpProvider>
              </div>
            </div>
          ); })}
          {isLoading &&
            (() => {
              if (quizStage) return null;
              const lastMsg = messages[messages.length - 1];
              const isToolSearching =
                lastMsg?.role === "assistant" &&
                lastMsg.parts.some(
                  (p) =>
                    p.type.startsWith("tool-") &&
                    "state" in p &&
                    p.state !== "done" &&
                    p.state !== "output-available",
                );
              const hasNoText =
                !lastMsg ||
                lastMsg.role !== "assistant" ||
                !lastMsg.parts.some(
                  (p) => p.type === "text" && p.text.length > 0,
                );
              const isSearching =
                isToolSearching ||
                (hasNoText && activeRequestSearchMode === "always");

              if (!isSearching && !hasNoText) return null;

              return (
                <div className="mx-auto flex w-full max-w-[900px] justify-start">
                  <div className="flex items-center gap-2">
                    <div
                      role="img"
                      aria-label={isSearching ? "联网搜索图标" : "聊聊机头像"}
                      className={cn(
                        "relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-cover bg-center md:h-8 md:w-8",
                        isSearching && "status-icon-search",
                      )}
                      style={{
                        borderColor: "var(--border-color)",
                        backgroundColor: isSearching
                          ? "var(--loading-search-avatar)"
                          : "var(--ai-avatar-bg)",
                        boxShadow:
                          "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
                      }}
                    >
                      {isSearching ? (
                        <Search className="relative z-10 h-4.5 w-4.5 text-white" />
                      ) : (
                        <Image
                          src="/icon-192.png"
                          alt=""
                          width={32}
                          height={32}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div
                      className="rounded-lg rounded-tl-none border-2 px-4 py-2"
                      style={{
                        borderColor: "var(--border-color)",
                        backgroundColor: isSearching
                          ? "var(--loading-search-bg)"
                          : "var(--loading-bg)",
                        boxShadow:
                          "4px 4px 0px 0px rgba(var(--shadow-color), 1)",
                      }}
                    >
                      <span className="inline-flex items-center gap-2.5 text-base font-bold" role="status" aria-live="polite">
                        {!isSearching ? (
                          <span className="status-trailing-dots" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                            <span />
                            <span />
                          </span>
                        ) : null}
                        {isSearching ? "联网搜索中" : "思考中"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          {apiError ? (
            <div className="mx-auto flex w-full max-w-[900px] justify-start" role="alert" aria-live="assertive">
              <div className="flex w-full max-w-xl items-start gap-2">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2"
                  style={{
                    backgroundColor: "var(--hot-badge-bg)",
                    borderColor: "var(--border-color)",
                    color: "var(--hot-badge-text)",
                    boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
                  }}
                >
                  <AlertTriangle aria-hidden="true" className="h-4 w-4" />
                </div>
                <div
                  className="relative flex-1 rounded-lg rounded-tl-none border-2 py-3 pl-3 pr-11"
                  style={{
                    backgroundColor: "var(--ai-bubble-bg)",
                    borderColor: "var(--hot-badge-bg)",
                    color: "var(--ai-bubble-text)",
                    boxShadow: "4px 4px 0px 0px rgba(var(--shadow-color), 1)",
                  }}
                >
                  <p className="text-sm font-black">这次没有回复成功</p>
                  <p className="mt-1 text-sm font-medium leading-6">{apiError}</p>
                  <button
                    type="button"
                    onClick={() => setApiError(null)}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md border-2 transition-transform hover:-translate-y-0.5 active:translate-y-0"
                    style={{
                      backgroundColor: "var(--card-footer-bg)",
                      borderColor: "var(--border-color)",
                    }}
                    aria-label="关闭错误提示"
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {adventure && (!adventure.update.updateDataModel.value.ended || adventure.messageId === lastAssistantId) && (
            <div className="mx-auto flex w-full max-w-[900px] md:pl-10">
              <ChatAdventure
                key={history.currentSessionId}
                update={adventure.update}
                messageId={adventure.messageId}
                disabled={isLoading || !adventureIsCurrent}
                awaitingUpdate={isLoading && !adventureIsCurrent}
                onRetry={adventureNeedsRetry ? handleRegenerate : undefined}
                onChoose={handleQuickPrompt}
                onMount={scrollToBottom}
              />
            </div>
          )}
        </CardContent>

        <CardFooter
          className="rounded-none border-t px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 md:rounded-b-lg md:px-4 md:pb-4 md:pt-3"
          style={{
            borderColor: "var(--fb-inactive-border)",
            backgroundColor: "var(--card-content-bg)",
          }}
        >
          {/* 隐藏的文件输入 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageUpload}
          />

          <div className="mx-auto flex w-full max-w-[900px] flex-col">
            {/* 双层一体输入表单 */}
            <form
              className="flex w-full flex-col rounded-2xl border-2 transition-[box-shadow,border-color] focus-within:ring-2 focus-within:ring-offset-2"
              style={{
                backgroundColor: "var(--input-bg)",
                borderColor: "var(--input-border)",
                boxShadow: "3px 3px 0px 0px rgba(var(--shadow-color), 1)",
                // @ts-expect-error -- CSS custom property for focus ring
                "--tw-ring-color": "var(--input-focus-ring)",
              }}
              onSubmit={handleSubmit}
            >
              {/* 图片预览区（收纳在输入框内部顶部） */}
              {pendingImages.length > 0 && (
                <div className="flex flex-wrap gap-2 px-3 pt-3">
                  {pendingImages.map((src, index) => (
                    <div key={src} className="group relative h-14 w-14">
                      <Image
                        src={src}
                        alt={`待发送图片 ${index + 1}`}
                        fill
                        unoptimized
                        className="rounded-lg border-2 object-cover"
                        style={{
                          borderColor: "var(--border-color)",
                          boxShadow:
                            "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => removePendingImage(index)}
                        aria-label={`移除第 ${index + 1} 张图片`}
                        className="absolute -right-1.5 -top-1.5 flex h-6 w-6 touch-manipulation items-center justify-center rounded-full border-2 transition-opacity hover:opacity-85"
                        style={{
                          backgroundColor: "var(--hot-badge-bg)",
                          borderColor: "var(--border-color)",
                          boxShadow:
                            "1.5px 1.5px 0px 0px rgba(var(--shadow-color), 1)",
                        }}
                      >
                        <X aria-hidden="true" className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 通栏文本输入区 */}
              <div className="relative w-full min-w-0">
                <textarea
                  ref={textareaRef}
                  aria-label="消息内容"
                  name="message"
                  autoComplete="off"
                  className={cn(
                    "chat-input block max-h-32 min-h-11 w-full resize-none overflow-y-auto border-0 bg-transparent px-3.5 pb-1.5 text-base font-medium leading-6 placeholder:text-transparent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:placeholder:text-[var(--input-placeholder)]",
                    pendingImages.length > 0 ? "pt-2" : "pt-3",
                  )}
                  style={{ color: "var(--input-text)" }}
                  rows={1}
                  value={inputValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onPaste={handlePaste}
                  onKeyDown={handleKeyDown}
                  maxLength={MAX_INPUT_LENGTH}
                  placeholder={inputPlaceholder}
                />
                {inputValue.length === 0 ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "chat-input pointer-events-none absolute left-3.5 right-3.5 truncate font-medium md:hidden",
                      pendingImages.length > 0 ? "top-2" : "top-3",
                    )}
                    style={{ color: "var(--input-placeholder)" }}
                  >
                    {inputPlaceholder}
                  </span>
                ) : null}
              </div>

              {/* 底部工具栏：左侧辅助与联网切换，右侧语音与主操作 */}
              <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
                <div className="flex min-w-0 items-center gap-1">
                  {/* 图片上传（次要降权） */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="上传图片"
                    disabled={isLoading || pendingImages.length >= 4}
                    title={`上传图片（${pendingImages.length}/4）`}
                    className="relative inline-flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-[10px] transition-colors hover:bg-[var(--loading-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 md:h-9 md:w-9"
                    style={{
                      color:
                        pendingImages.length > 0
                          ? "var(--source-text)"
                          : "var(--settings-option-muted)",
                    }}
                  >
                    <ImagePlus aria-hidden="true" className="h-[18px] w-[18px]" />
                    {pendingImages.length > 0 ? (
                      <span
                        aria-hidden="true"
                        className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border px-1 text-[10px] font-black leading-none"
                        style={{
                          backgroundColor: "var(--header-bg)",
                          borderColor: "var(--border-color)",
                          color: "var(--header-text)",
                        }}
                      >
                        {pendingImages.length}
                      </span>
                    ) : null}
                  </button>

                  {/* 联网模式快捷切换胶囊 */}
                  <button
                    type="button"
                    onClick={handleCycleSearchMode}
                    disabled={isLoading}
                    aria-label={`联网模式：${currentSearchMode.label}，点击切换`}
                    title={`${currentSearchMode.label}：${currentSearchMode.description}（点击切换）`}
                    className="inline-flex h-10 shrink-0 touch-manipulation items-center gap-1.5 rounded-[10px] border px-2.5 text-xs font-bold transition-colors hover:bg-[var(--loading-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 md:h-9"
                    style={
                      searchMode === "always"
                        ? {
                            backgroundColor: "var(--source-bg)",
                            borderColor: "var(--source-border)",
                            color: "var(--source-text)",
                          }
                        : searchMode === "auto"
                          ? {
                              backgroundColor: "transparent",
                              borderColor: "var(--fb-inactive-border)",
                              color: "var(--settings-option-muted)",
                            }
                          : {
                              backgroundColor: "transparent",
                              borderColor: "transparent",
                              color: "var(--settings-option-muted)",
                              opacity: 0.65,
                            }
                    }
                  >
                    <CurrentSearchModeIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">{currentSearchMode.label}</span>
                    <span className="sm:hidden">{currentSearchMode.shortLabel}</span>
                  </button>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {/* 字数接近上限时才显示，不挤压输入文本 */}
                  {inputValue.length >= MAX_INPUT_LENGTH * 0.8 ? (
                    <span
                      className="px-1 text-[11px] font-bold tabular-nums"
                      style={{
                        color:
                          inputValue.length >= MAX_INPUT_LENGTH
                            ? "var(--hot-badge-bg)"
                            : "var(--fb-unclear-bg)",
                      }}
                    >
                      {inputValue.length}/{MAX_INPUT_LENGTH}
                    </span>
                  ) : null}

                  {/* 语音输入（未录音时降权，录音中亮起警示红） */}
                  {isSpeechSupported && (
                    <button
                      type="button"
                      onClick={toggleVoiceInput}
                      aria-label={isListening ? "停止语音输入" : "开始语音输入"}
                      disabled={isLoading}
                      title={isListening ? "停止语音输入" : "语音输入"}
                      className={cn(
                        "inline-flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-[10px] transition-all focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 md:h-9 md:w-9",
                        isListening
                          ? "border-2 animate-pulse motion-reduce:animate-none"
                          : "hover:bg-[var(--loading-bg)]",
                      )}
                      style={
                        isListening
                          ? {
                              backgroundColor: "var(--hot-badge-bg)",
                              borderColor: "var(--border-color)",
                              color: "var(--hot-badge-text)",
                              boxShadow:
                                "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
                            }
                          : {
                              color: "var(--settings-option-muted)",
                            }
                      }
                    >
                      {isListening ? (
                        <MicOff aria-hidden="true" className="h-[18px] w-[18px]" />
                      ) : (
                        <Mic aria-hidden="true" className="h-[18px] w-[18px]" />
                      )}
                    </button>
                  )}

                  {/* 主操作：生成中显示停止，空闲时显示发送 */}
                  {isLoading ? (
                    <button
                      type="button"
                      onClick={handleStop}
                      aria-label="停止生成"
                      title="停止生成"
                      className="inline-flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-[10px] border-2 transition-all hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 md:h-9 md:w-9"
                      style={{
                        backgroundColor: "var(--hot-badge-bg)",
                        color: "var(--hot-badge-text)",
                        borderColor: "var(--border-color)",
                        boxShadow:
                          "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
                      }}
                    >
                      <Square aria-hidden="true" className="h-3.5 w-3.5 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      aria-label="发送消息"
                      title="发送消息（Enter）"
                      disabled={!hasDraft}
                      className={cn(
                        "inline-flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-[10px] border-2 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 md:h-9 md:w-9",
                        hasDraft
                          ? "hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                          : "cursor-not-allowed opacity-45",
                      )}
                      style={
                        hasDraft
                          ? {
                              backgroundColor: "var(--btn-send-bg)",
                              color: "var(--btn-action-text)",
                              borderColor: "var(--border-color)",
                              boxShadow:
                                "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
                            }
                          : {
                              backgroundColor: "var(--loading-bg)",
                              color: "var(--settings-option-muted)",
                              borderColor: "transparent",
                              boxShadow: "none",
                            }
                      }
                    >
                      <Send aria-hidden="true" className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </CardFooter>
      </Card>
        )}
      </div>
      <PersonaSwitcher
        open={personaSwitcherOpen}
        personaId={personaId}
        hasActiveConversation={messages.length > 0}
        onOpenChange={setPersonaSwitcherOpen}
        onPersonaChange={handlePersonaSelect}
      />
      <div
        className="phone-landscape-guard"
        role="dialog"
        aria-modal="true"
        aria-label="请竖屏使用聊聊机"
      >
        <div
          className="flex max-w-xs flex-col items-center gap-3 rounded-2xl border-4 px-6 py-5 text-center"
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--border-color)",
            color: "var(--foreground)",
            boxShadow: "6px 6px 0px 0px rgba(var(--shadow-color), 1)",
          }}
        >
          <span
            className="grid h-12 w-12 place-items-center rounded-xl border-2"
            style={{
              backgroundColor: "var(--header-bg)",
              borderColor: "var(--border-color)",
              color: "var(--header-text)",
              boxShadow: "3px 3px 0px 0px rgba(var(--shadow-color), 1)",
            }}
          >
            <Smartphone aria-hidden="true" className="h-6 w-6" />
          </span>
          <p className="text-base font-black">请竖屏使用聊聊机</p>
          <p className="text-xs font-bold opacity-75">
            把手机竖过来，对话和输入更顺手
          </p>
        </div>
      </div>
    </main>
  );
}
