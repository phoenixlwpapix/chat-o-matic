"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import {
  Send,
  Bot,
  User as UserIcon,
  Sparkles,
  Zap,
  Plus,
  Rocket,
  BookOpen,
  Lightbulb,
  Gamepad2,
  Copy,
  RefreshCw,
  Check,
  ImagePlus,
  X,
  Mic,
  MicOff,
  ThumbsUp,
  ThumbsDown,
  Globe,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/use-theme";
import { ThemeSwitcher } from "@/components/theme-switcher";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

// 快捷提示词配置
const QUICK_PROMPTS = [
  {
    icon: Rocket,
    label: "宇宙探索",
    prompt: "告诉我一个超级酷的宇宙小知识！",
    colorVar: "--qp-1",
  },
  {
    icon: Lightbulb,
    label: "创意灵感",
    prompt: "给我一个脑洞大开的故事开头！",
    colorVar: "--qp-2",
  },
  {
    icon: BookOpen,
    label: "知识大百科",
    prompt: "用最简单的方式讲懂一个科学知识。",
    colorVar: "--qp-3",
  },
  {
    icon: Gamepad2,
    label: "趣味冷知识",
    prompt: "告诉我一个有趣又冷门的生活小知识！",
    colorVar: "--qp-4",
  },
];

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

export default function Home() {
  const { theme, setTheme, mounted } = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  // 图片上传状态：存储 base64 数据 URL
  const [pendingImages, setPendingImages] = useState<string[]>([]);

  // AI SDK 6 useChat - 默认连接到 /api/chat
  const { messages, sendMessage, status, setMessages } = useChat();

  const isLoading = status === "streaming" || status === "submitted";

  // 复制状态管理
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 反馈状态管理
  const [messageFeedback, setMessageFeedback] = useState<Map<string, 'helpful' | 'unclear'>>(new Map());
  const [simplifyRequested, setSimplifyRequested] = useState<Set<string>>(new Set());

  // 语音输入状态
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  // 记录语音识别开始前已有的文本，用于追加
  const preVoiceTextRef = useRef("");

  const [isSpeechSupported, setIsSpeechSupported] = useState(false);

  useEffect(() => {
    setIsSpeechSupported(
      "SpeechRecognition" in window || "webkitSpeechRecognition" in window
    );
  }, []);

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
      setInputValue(prefix ? `${prefix} ${combined}` : combined);

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

  // 处理反馈点击
  const handleFeedback = useCallback((messageId: string, feedback: 'helpful' | 'unclear') => {
    setMessageFeedback(prev => {
      const newMap = new Map(prev);
      newMap.set(messageId, feedback);
      return newMap;
    });

    // 如果是"没太懂"且未请求过简化，自动发送简化请求
    if (feedback === 'unclear' && !simplifyRequested.has(messageId)) {
      setSimplifyRequested(prev => new Set(prev).add(messageId));
      sendMessage({
        text: "请用更简单的方式,用我能听懂的例子再解释一遍刚才的回答"
      });
    }
  }, [simplifyRequested, sendMessage]);

  // 压缩图片（确保不超过 1MB，最大边 1024px）
  const compressImage = useCallback(
    (file: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
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
    []
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
          filesToProcess.map((file) => compressImage(file))
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
    [pendingImages.length, compressImage]
  );

  // 移除待发送的图片
  const removePendingImage = useCallback((index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // 从消息 parts 中提取纯文本（用于复制）
  const getMessageText = (parts: (typeof messages)[0]["parts"]): string => {
    return parts
      .filter(
        (part): part is { type: "text"; text: string } => part.type === "text"
      )
      .map((part) => part.text)
      .join("");
  };

  // 标准化 Markdown：将 **"文字"** 转换为 "**文字**"
  const normalizeMarkdown = (text: string): string => {
    const QUOTES = [
      ["\u201C", "\u201D"], // “ ”
      ["\u2018", "\u2019"], // ‘ ’
      ["\u300C", "\u300D"], // 「 」
      ["\u300E", "\u300F"], // 『 』
      ['"', '"'],
      ["'", "'"],
    ];

    let result = text;

    for (const [open, close] of QUOTES) {
      const pattern = new RegExp(`\\*\\*${open}([^\\*]+?)${close}\\*\\*`, "g");
      result = result.replace(pattern, `${open}**$1**${close}`);
    }

    return result;
  };

  // 自定义代码块渲染组件（支持语法高亮和复制）
  const CodeBlock: Components["code"] = ({ className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || "");
    const language = match ? match[1] : "";
    const codeString = String(children).replace(/\n$/, "");
    const codeId = `code-${codeString.slice(0, 20)}`;
    const isInline = !className;

    if (isInline) {
      return (
        <code
          className="px-1.5 py-0.5 rounded text-sm font-mono border"
          style={{
            backgroundColor: "var(--inline-code-bg)",
            color: "var(--inline-code-text)",
            borderColor: "var(--inline-code-border)",
          }}
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <div className="relative group my-3">
        <div className="absolute right-2 top-2 z-10">
          <button
            onClick={() => handleCopy(codeString, codeId)}
            className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors border border-gray-600"
            title="复制代码"
          >
            {copiedId === codeId ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
        {language && (
          <div className="absolute left-3 top-2 text-xs text-gray-400 font-mono">
            {language}
          </div>
        )}
        <SyntaxHighlighter
          style={oneDark}
          language={language || "text"}
          PreTag="div"
          className="!rounded-lg !border-2 !pt-8 !text-sm"
          customStyle={{
            borderColor: "var(--border-color)",
            boxShadow: "4px 4px 0px 0px rgba(var(--shadow-color), 1)",
          }}
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    );
  };

  // 反馈按钮组件
  const FeedbackButtons = ({
    messageId,
    currentFeedback,
    onFeedbackClick,
    isDisabled,
  }: {
    messageId: string;
    currentFeedback: 'helpful' | 'unclear' | null;
    onFeedbackClick: (messageId: string, feedback: 'helpful' | 'unclear') => void;
    isDisabled: boolean;
  }) => {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => onFeedbackClick(messageId, 'helpful')}
          disabled={isDisabled}
          className={cn(
            "px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all",
            "hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          style={{
            backgroundColor: currentFeedback === 'helpful' ? 'var(--fb-helpful-bg)' : 'var(--fb-inactive-bg)',
            borderColor: currentFeedback === 'helpful' ? 'var(--border-color)' : 'var(--fb-inactive-border)',
            color: currentFeedback === 'helpful' ? '#fff' : 'var(--fb-inactive-text)',
            boxShadow: `2px 2px 0px 0px rgba(var(--shadow-color), 1)`,
          }}
        >
          <span className="flex items-center gap-1.5">
            <ThumbsUp className="w-4 h-4" />
            <span>有帮助</span>
          </span>
        </button>
        <button
          onClick={() => onFeedbackClick(messageId, 'unclear')}
          disabled={isDisabled}
          className={cn(
            "px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all",
            "hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          style={{
            backgroundColor: currentFeedback === 'unclear' ? 'var(--fb-unclear-bg)' : 'var(--fb-inactive-bg)',
            borderColor: currentFeedback === 'unclear' ? 'var(--border-color)' : 'var(--fb-inactive-border)',
            color: currentFeedback === 'unclear' ? '#fff' : 'var(--fb-inactive-text)',
            boxShadow: `2px 2px 0px 0px rgba(var(--shadow-color), 1)`,
          }}
        >
          <span className="flex items-center gap-1.5">
            <ThumbsDown className="w-4 h-4" />
            <span>没太懂</span>
          </span>
        </button>
      </div>
    );
  };

  // 处理快捷提示词点击
  const handleQuickPrompt = (prompt: string) => {
    sendMessage({ text: prompt });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const resetConversation = () => {
    setMessages([]);
    setInputValue("");
    setPendingImages([]);
  };

  // 重新生成最后一条 AI 回复
  const handleRegenerate = useCallback(() => {
    // 找到最后一条 assistant 消息的索引
    const lastAssistantIndex = messages.findLastIndex(m => m.role === "assistant");
    if (lastAssistantIndex === -1) return;

    // 找到该 assistant 消息之前最近的 user 消息及其索引
    const precedingMessages = messages.slice(0, lastAssistantIndex);
    const lastUserIndex = precedingMessages.findLastIndex(m => m.role === "user");
    if (lastUserIndex === -1) return;

    const lastUserMessage = precedingMessages[lastUserIndex];

    // 提取用户消息文本
    const userText = getMessageText(lastUserMessage.parts);

    // 移除最后一条 user 消息和 assistant 消息（sendMessage 会重新添加 user 消息）
    setMessages(messages.slice(0, lastUserIndex));

    // 重新发送
    sendMessage({ text: userText || "请再回答一次" });
  }, [messages, setMessages, sendMessage]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 允许只发图片或只发文字
    if (!inputValue.trim() && pendingImages.length === 0) return;

    // 构建消息附件（图片）
    const files = pendingImages.map((dataUrl) => ({
      // AI SDK 6 期望的 FileUIPart 格式
      type: "file" as const,
      mediaType: "image/jpeg" as const,
      url: dataUrl,
    }));

    sendMessage({
      text: inputValue || "请看这张图片，帮我解决问题",
      files,
    });

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
    <main className="min-h-screen flex items-center justify-center p-2 md:p-8 relative">

      <Card
        className="w-full max-w-2xl md:max-w-4xl h-[95vh] md:h-[85vh] flex flex-col border-4"
        style={{ boxShadow: "8px 8px 0px 0px rgba(var(--shadow-color), 1)" }}
      >
        <CardHeader
          className="border-b-2 rounded-t-lg py-4 md:py-6"
          style={{
            borderColor: "var(--border-color)",
            background: "var(--header-bg)",
            color: "var(--header-text)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 md:gap-4">
              <div
                className="p-1.5 md:p-2 rounded-xl -rotate-3"
                style={{
                  backgroundColor: "var(--logo-bg)",
                  boxShadow: `4px 4px 0px 0px var(--logo-shadow)`,
                }}
              >
                <Zap className="w-6 h-6 md:w-8 md:h-8" style={{ color: "var(--logo-icon)", fill: "var(--logo-icon)" }} />
              </div>
              <CardTitle className="flex flex-col">
                <span
                  className="text-3xl md:text-5xl font-black tracking-tighter leading-none"
                  style={{ color: "var(--header-text)" }}
                >
                  聊聊机
                </span>
                <span
                  className="text-xs font-black uppercase tracking-[0.3em] mt-1"
                  style={{ color: "var(--header-subtitle)" }}
                >
                  Chat-O-Matic
                </span>
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <ThemeSwitcher theme={theme} setTheme={setTheme} />
              <Button
                onClick={resetConversation}
                size="icon"
                className="transition-all active:translate-x-0.5 active:translate-y-0.5"
                style={{
                  backgroundColor: "var(--btn-new-bg)",
                  color: "var(--btn-new-text)",
                  borderColor: "var(--border-color)",
                  boxShadow: "4px 4px 0px 0px rgba(var(--shadow-color), 1)",
                }}
                title="开启新对话"
              >
                <Plus className="w-6 h-6" />
              </Button>
            </div>
          </div>
          <p
            className="font-bold text-sm mt-2 inline-block px-2 py-0.5 self-start transform skew-x-[-10deg]"
            style={{
              backgroundColor: "var(--header-tag-bg)",
              color: "var(--header-tag-text)",
            }}
          >
            你负责好奇，我负责想象
          </p>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4" style={{ backgroundColor: "var(--card-content-bg)" }}>
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 px-2">
              <div className="relative">
                <Sparkles
                  className="w-16 h-16 md:w-24 md:h-24 animate-[spin_10s_linear_infinite]"
                  style={{ color: "var(--sparkle-color)", fill: "var(--sparkle-color)" }}
                />
                <div
                  className="absolute -top-2 -right-2 md:-top-3 md:-right-3 text-[10px] md:text-xs font-bold px-2 py-1 rounded-full border-2"
                  style={{
                    backgroundColor: "var(--hot-badge-bg)",
                    color: "var(--hot-badge-text)",
                    borderColor: "var(--border-color)",
                    boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
                  }}
                >
                  HOT
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-2xl md:text-3xl font-black uppercase tracking-tighter">
                  准备就绪！
                </p>
                <p
                  className="text-sm md:text-base font-bold border-2 px-3 py-1"
                  style={{
                    backgroundColor: "var(--header-bg)",
                    borderColor: "var(--border-color)",
                    boxShadow: "4px 4px 0px 0px rgba(var(--shadow-color), 1)",
                    color: "var(--header-text)",
                  }}
                >
                  点击下方卡片，或自己输入问题
                </p>
              </div>

              {/* 快捷提示词卡片网格 */}
              <div className="grid grid-cols-2 gap-3 w-full max-w-sm mt-2">
                {QUICK_PROMPTS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      onClick={() => handleQuickPrompt(item.prompt)}
                      disabled={isLoading}
                      className={cn(
                        "flex flex-col items-center gap-2 p-3 rounded-xl border-2",
                        "transition-all hover:-translate-y-0.5",
                        "active:translate-x-0.5 active:translate-y-0.5",
                        "disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                      style={{
                        backgroundColor: `var(${item.colorVar})`,
                        borderColor: "var(--border-color)",
                        boxShadow: "3px 3px 0px 0px rgba(var(--shadow-color), 1)",
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
                        <Icon className="w-5 h-5" style={{ color: "var(--prompt-card-text)" }} />
                      </div>
                      <span className="text-sm font-bold whitespace-nowrap">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex w-full",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "flex max-w-[92%] md:max-w-[80%] items-start gap-2",
                  message.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div
                  className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0"
                  style={{
                    borderColor: "var(--border-color)",
                    backgroundColor: message.role === "user" ? "var(--user-avatar-bg)" : "var(--ai-avatar-bg)",
                    boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
                  }}
                >
                  {message.role === "user" ? (
                    <UserIcon className="w-5 h-5 text-white" />
                  ) : (
                    <Bot className="w-5 h-5 text-white" />
                  )}
                </div>
                <div className="relative group">
                  <div
                    className={cn(
                      "p-3 rounded-lg border-2 font-medium text-base",
                      message.role === "user" ? "rounded-tr-none" : "rounded-tl-none"
                    )}
                    style={{
                      borderColor: "var(--border-color)",
                      backgroundColor: message.role === "user" ? "var(--user-bubble-bg)" : "var(--ai-bubble-bg)",
                      color: message.role === "user" ? "var(--user-bubble-text)" : "var(--ai-bubble-text)",
                      boxShadow: "4px 4px 0px 0px rgba(var(--shadow-color), 1)",
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
                            <div
                              key={key}
                              className="prose prose-base max-w-none"
                            >
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                                components={{ code: CodeBlock }}
                              >
                                {normalizeMarkdown(part.text)}
                              </ReactMarkdown>
                            </div>
                          );
                        case "file":
                          // 渲染用户上传的图片
                          if (part.mediaType?.startsWith("image/")) {
                            return (
                              <img
                                key={key}
                                src={part.url}
                                alt="上传的图片"
                                className="max-w-full rounded-lg border-2 mt-2"
                                style={{
                                  borderColor: "var(--border-color)",
                                  boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
                                }}
                              />
                            );
                          }
                          return null;
                        default:
                          return null;
                      }
                    })}

                    {/* 搜索来源 */}
                    {(() => {
                      const sources = message.parts.filter(
                        (part) => part.type === "source-url"
                      );
                      if (sources.length === 0) return null;
                      return (
                        <div
                          className="mt-3 pt-3 border-t-2 border-dashed"
                          style={{ borderColor: "var(--fb-inactive-border)" }}
                        >
                          <div className="flex items-center gap-1.5 mb-2">
                            <Globe className="w-3.5 h-3.5" style={{ color: "var(--fb-inactive-text)" }} />
                            <span
                              className="text-xs font-bold uppercase tracking-wide"
                              style={{ color: "var(--fb-inactive-text)" }}
                            >
                              搜索来源
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {sources.map((part, sourceIndex) => {
                              if (part.type !== "source-url") return null;
                              const hostname = (() => {
                                try {
                                  return new URL(part.url).hostname.replace(
                                    /^www\./,
                                    ""
                                  );
                                } catch {
                                  return part.url;
                                }
                              })();
                              return (
                                <a
                                  key={`${message.id}-source-${sourceIndex}`}
                                  href={part.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border transition-colors"
                                  style={{
                                    backgroundColor: "var(--source-bg)",
                                    color: "var(--source-text)",
                                    borderColor: "var(--source-border)",
                                  }}
                                  title={part.title ?? part.url}
                                >
                                  <Globe className="w-3 h-3 shrink-0" />
                                  <span className="truncate max-w-[150px]">
                                    {part.title ?? hostname}
                                  </span>
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  {/* AI 消息操作按钮区域 */}
                  {message.role === "assistant" && (
                    <div className={cn(
                      "flex items-center justify-between gap-2 mt-2 transition-opacity",
                      "md:opacity-0 md:group-hover:opacity-100"
                    )}>
                      {/* 反馈按钮（左侧） */}
                      <FeedbackButtons
                        messageId={message.id}
                        currentFeedback={messageFeedback.get(message.id) || null}
                        onFeedbackClick={handleFeedback}
                        isDisabled={isLoading}
                      />
                      {/* 重新生成 & 复制按钮（右侧） */}
                      <div className="flex items-center gap-1.5">
                        {/* 重新生成按钮（仅最后一条 AI 消息显示） */}
                        {message.id === [...messages].reverse().find(m => m.role === "assistant")?.id && (
                          <button
                            onClick={handleRegenerate}
                            disabled={isLoading}
                            className={cn(
                              "p-1.5 rounded-lg border-2",
                              "transition-all hover:-translate-y-0.5",
                              "active:translate-x-0.5 active:translate-y-0.5",
                              "disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                            style={{
                              borderColor: "var(--border-color)",
                              backgroundColor: "var(--fb-inactive-bg)",
                              boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
                            }}
                            title="重新生成"
                          >
                            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} style={{ color: "var(--fb-inactive-text)" }} />
                          </button>
                        )}
                        {/* 复制按钮 */}
                        <button
                          onClick={() =>
                            handleCopy(getMessageText(message.parts), message.id)
                          }
                          className={cn(
                            "p-1.5 rounded-lg border-2",
                            "transition-all hover:-translate-y-0.5",
                            "active:translate-x-0.5 active:translate-y-0.5"
                          )}
                          style={{
                            borderColor: "var(--border-color)",
                            backgroundColor: "var(--fb-inactive-bg)",
                            boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
                          }}
                          title="复制回复"
                        >
                          {copiedId === message.id ? (
                            <Check className="w-4 h-4" style={{ color: "var(--fb-helpful-bg)" }} />
                          ) : (
                            <Copy className="w-4 h-4" style={{ color: "var(--fb-inactive-text)" }} />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (() => {
            const lastMsg = messages[messages.length - 1];
            const isSearching = lastMsg?.role === "assistant" &&
              lastMsg.parts.some(
                (p) => p.type.startsWith("tool-") && "state" in p && p.state !== "done" && p.state !== "output-available"
              );
            const hasNoText = !lastMsg || lastMsg.role !== "assistant" ||
              !lastMsg.parts.some((p) => p.type === "text" && p.text.length > 0);

            if (!isSearching && !hasNoText) return null;

            return (
              <div className="flex justify-start w-full">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
                    style={{
                      borderColor: "var(--border-color)",
                      backgroundColor: isSearching ? "var(--loading-search-avatar)" : "var(--ai-avatar-bg)",
                      boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
                    }}
                  >
                    {isSearching ? (
                      <Search className="w-5 h-5 text-white animate-pulse" />
                    ) : (
                      <Bot className="w-5 h-5 text-white animate-pulse" />
                    )}
                  </div>
                  <div
                    className="px-4 py-2 rounded-lg border-2 rounded-tl-none"
                    style={{
                      borderColor: "var(--border-color)",
                      backgroundColor: isSearching ? "var(--loading-search-bg)" : "var(--loading-bg)",
                      boxShadow: "4px 4px 0px 0px rgba(var(--shadow-color), 1)",
                    }}
                  >
                    <span className="text-base font-bold animate-pulse">
                      {isSearching ? "联网搜索中..." : "思考中..."}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
          <div ref={messagesEndRef} />
        </CardContent>

        <CardFooter
          className="border-t-2 p-4 rounded-b-lg"
          style={{
            borderColor: "var(--border-color)",
            backgroundColor: "var(--card-footer-bg)",
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

          <div className="flex flex-col w-full gap-2">
            {/* 图片预览区域 */}
            {pendingImages.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {pendingImages.map((src, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={src}
                      alt={`待发送图片 ${index + 1}`}
                      className="w-16 h-16 object-cover rounded-lg border-2"
                      style={{
                        borderColor: "var(--border-color)",
                        boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removePendingImage(index)}
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center hover:opacity-80 transition-colors"
                      style={{
                        backgroundColor: "var(--hot-badge-bg)",
                        borderColor: "var(--border-color)",
                        boxShadow: "2px 2px 0px 0px rgba(var(--shadow-color), 1)",
                      }}
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 输入表单 */}
            <form className="flex w-full gap-2" onSubmit={handleSubmit}>
              {/* 图片上传按钮 */}
              <Button
                type="button"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                className="w-12 h-10"
                style={{
                  backgroundColor: "var(--btn-image-bg)",
                  color: "var(--btn-action-text)",
                }}
                disabled={isLoading || pendingImages.length >= 4}
                title="上传图片（最多4张）"
              >
                <ImagePlus className="w-5 h-5" />
              </Button>

              <Input
                className="flex-1 text-lg"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  pendingImages.length > 0
                    ? "添加说明，或直接发送图片..."
                    : "跟我聊聊吧，我可聪明啦！"
                }
              />

              {/* 语音输入按钮 */}
              {isSpeechSupported && (
                <Button
                  type="button"
                  size="icon"
                  onClick={toggleVoiceInput}
                  className={cn(
                    "w-12 h-10 transition-all",
                    isListening && "animate-pulse"
                  )}
                  style={{
                    backgroundColor: isListening ? "var(--hot-badge-bg)" : "var(--btn-voice-bg)",
                    color: "var(--btn-action-text)",
                  }}
                  disabled={isLoading}
                  title={isListening ? "停止语音输入" : "语音输入"}
                >
                  {isListening ? (
                    <MicOff className="w-5 h-5" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </Button>
              )}

              <Button
                type="submit"
                size="icon"
                className="w-12 h-10"
                style={{
                  backgroundColor: "var(--btn-send-bg)",
                  color: "var(--btn-action-text)",
                }}
                disabled={isLoading}
              >
                <Send className="w-5 h-5" />
              </Button>
            </form>
          </div>
        </CardFooter>
      </Card>
    </main>
  );
}
