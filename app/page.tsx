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
  Check,
  ImagePlus,
  X,
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
    prompt: "给我讲讲黑洞是怎么形成的？如果掉进去会发生什么？",
    color: "bg-purple-400",
  },
  {
    icon: Lightbulb,
    label: "创意写作",
    prompt: "帮我想一个关于时间旅行的短故事开头，要有悬念！",
    color: "bg-orange-400",
  },
  {
    icon: BookOpen,
    label: "作业帮手",
    prompt: "我想理解一下勾股定理，能用生活中的例子解释吗？",
    color: "bg-green-400",
  },
  {
    icon: Gamepad2,
    label: "趣味冷知识",
    prompt: "告诉我一个超级冷门但很有趣的科学冷知识！",
    color: "bg-pink-400",
  },
];

export default function Home() {
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
  const getMessageText = (parts: typeof messages[0]["parts"]): string => {
    return parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("");
  };

  // 标准化 Markdown：将 **"文字"** 转换为 "**文字**"
  const normalizeMarkdown = (text: string): string => {
    const QUOTES = [
      ['\u201C', '\u201D'], // “ ”
      ['\u2018', '\u2019'], // ‘ ’
      ['\u300C', '\u300D'], // 「 」
      ['\u300E', '\u300F'], // 『 』
      ['"', '"'],
      ["'", "'"],
    ];

    let result = text;

    for (const [open, close] of QUOTES) {
      const pattern = new RegExp(
        `\\*\\*${open}([^\\*]+?)${close}\\*\\*`,
        'g'
      );
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
          className="bg-gray-200 text-pink-600 px-1.5 py-0.5 rounded text-sm font-mono border border-gray-300"
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
          className="!rounded-lg !border-2 !border-black !shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] !pt-8 !text-sm"
        >
          {codeString}
        </SyntaxHighlighter>
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

    setInputValue("");
    setPendingImages([]);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-2 md:p-8">
      <Card className="w-full max-w-2xl h-[95vh] md:h-[80vh] flex flex-col border-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <CardHeader className="border-b-2 border-black bg-yellow-300 rounded-t-lg py-4 md:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="bg-black p-1.5 md:p-2 rounded-xl shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] -rotate-3">
                <Zap className="w-6 h-6 md:w-8 md:h-8 text-yellow-300 fill-yellow-300" />
              </div>
              <CardTitle className="flex flex-col">
                <span className="text-3xl md:text-5xl font-black tracking-tighter leading-none drop-shadow-[2px_2px_0px_rgba(255,255,255,1)]">
                  聊聊机
                </span>
                <span className="text-xs font-black uppercase tracking-[0.3em] text-black/60 mt-1">
                  Chat-O-Matic
                </span>
              </CardTitle>
            </div>
            <Button
              onClick={resetConversation}
              size="icon"
              className="bg-white hover:bg-pink-200 text-black border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              title="开启新对话"
            >
              <Plus className="w-6 h-6" />
            </Button>
          </div>
          <p className="font-bold text-sm mt-2 bg-black text-white inline-block px-2 py-0.5 self-start transform skew-x-[-10deg]">
            你负责异想天开，我负责奇思妙想
          </p>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 px-2">
              <div className="relative">
                <Sparkles className="w-12 h-12 text-yellow-400 fill-yellow-400 animate-[spin_10s_linear_infinite]" />
                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  HOT
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-2xl md:text-3xl font-black uppercase tracking-tighter">
                  准备就绪！
                </p>
                <p className="text-sm md:text-base font-bold bg-yellow-200 border-2 border-black px-3 py-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  点击下方卡片，或自己输入问题
                </p>
              </div>

              {/* 快捷提示词卡片网格 */}
              <div className="grid grid-cols-2 gap-3 w-full max-w-md mt-2">
                {QUICK_PROMPTS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      onClick={() => handleQuickPrompt(item.prompt)}
                      disabled={isLoading}
                      className={cn(
                        "flex flex-col items-center gap-2 p-3 md:p-4 rounded-xl border-2 border-black",
                        "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
                        "transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]",
                        "active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        item.color
                      )}
                    >
                      <div className="bg-white p-2 rounded-lg border-2 border-black">
                        <Icon className="w-5 h-5 md:w-6 md:h-6 text-black" />
                      </div>
                      <span className="text-xs md:text-sm font-bold text-black">
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
                  className={cn(
                    "w-8 h-8 rounded-full border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
                    message.role === "user" ? "bg-blue-400" : "bg-red-400"
                  )}
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
                      "p-3 rounded-lg border-2 border-black font-medium text-base shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
                      message.role === "user"
                        ? "bg-blue-100 text-blue-900 rounded-tr-none"
                        : "bg-white text-black rounded-tl-none"
                    )}
                  >
                    {/* AI SDK v6 官方推荐: 使用 switch/case 遍历 message.parts */}
                    {message.parts.map((part, partIndex) => {
                      const key = `${message.id}-${partIndex}`;
                      switch (part.type) {
                        case "text":
                          return message.role === "user" ? (
                            <span key={key}>{part.text}</span>
                          ) : (
                            <div key={key} className="prose prose-base max-w-none">
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
                                className="max-w-full rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mt-2"
                              />
                            );
                          }
                          return null;
                        // 预留扩展：未来支持 tool-call 等类型
                        default:
                          return null;
                      }
                    })}
                  </div>
                  {/* AI 消息复制按钮 */}
                  {message.role === "assistant" && (
                    <button
                      onClick={() => handleCopy(getMessageText(message.parts), message.id)}
                      className={cn(
                        "absolute -bottom-2 right-2 p-1.5 rounded-lg border-2 border-black bg-white",
                        "shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100",
                        "opacity-0 group-hover:opacity-100 transition-opacity"
                      )}
                      title="复制回复"
                    >
                      {copiedId === message.id ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-600" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start w-full">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full border-2 border-black bg-red-400 flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <Bot className="w-5 h-5 text-white animate-pulse" />
                </div>
                <div className="px-4 py-2 rounded-lg border-2 border-black bg-gray-100 rounded-tl-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <span className="text-base font-bold animate-pulse">
                    思考中...
                  </span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        <CardFooter className="border-t-2 border-black p-4 bg-gray-50 rounded-b-lg">
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
                      className="w-16 h-16 object-cover rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    />
                    <button
                      type="button"
                      onClick={() => removePendingImage(index)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-red-600 transition-colors"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 输入表单 */}
            <form
              className="flex w-full gap-2"
              onSubmit={handleSubmit}
            >
              {/* 图片上传按钮 */}
              <Button
                type="button"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                className="w-12 h-10 bg-purple-400 hover:bg-purple-500 text-black"
                disabled={isLoading || pendingImages.length >= 4}
                title="上传图片（最多4张）"
              >
                <ImagePlus className="w-5 h-5" />
              </Button>

              <Input
                className="flex-1 bg-white text-lg"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  pendingImages.length > 0
                    ? "添加说明，或直接发送图片..."
                    : "跟我聊聊吧，我可聪明啦！"
                }
              />
              <Button
                type="submit"
                size="icon"
                className="w-12 h-10 bg-green-400 hover:bg-green-500 text-black"
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
