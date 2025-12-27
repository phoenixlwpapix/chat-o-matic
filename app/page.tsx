"use client";

import { useRef, useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Send, Bot, User as UserIcon, Sparkles, Zap, Plus } from "lucide-react";
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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Home() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");

  // AI SDK 6 useChat - 默认连接到 /api/chat
  const { messages, sendMessage, status, setMessages } = useChat();

  const isLoading = status === "streaming" || status === "submitted";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const resetConversation = () => {
    setMessages([]);
    setInputValue("");
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    sendMessage({ text: inputValue });
    setInputValue("");
  };

  // 从消息的 parts 中提取文本内容
  const getMessageContent = (message: typeof messages[0]): string => {
    return message.parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("");
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
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative">
                <Sparkles className="w-20 h-20 text-yellow-400 fill-yellow-400 animate-[spin_10s_linear_infinite]" />
                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  HOT
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-black uppercase tracking-tighter">
                  准备就绪！
                </p>
                <p className="text-base font-bold bg-yellow-200 border-2 border-black px-4 py-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  在下方输入内容，开启冒险之旅。
                </p>
              </div>
            </div>
          )}

          {messages.map((m) => {
            const content = getMessageContent(m);
            return (
              <div
                key={m.id}
                className={cn(
                  "flex w-full",
                  m.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "flex max-w-[92%] md:max-w-[80%] items-start gap-2",
                    m.role === "user" ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
                      m.role === "user" ? "bg-blue-400" : "bg-red-400"
                    )}
                  >
                    {m.role === "user" ? (
                      <UserIcon className="w-5 h-5 text-white" />
                    ) : (
                      <Bot className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div
                    className={cn(
                      "p-3 rounded-lg border-2 border-black font-medium text-base shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
                      m.role === "user"
                        ? "bg-blue-100 text-blue-900 rounded-tr-none"
                        : "bg-white text-black rounded-tl-none"
                    )}
                  >
                    {m.role === "user" ? (
                      content
                    ) : (
                      <div className="prose prose-base max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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
          <form
            className="flex w-full gap-2"
            onSubmit={handleSubmit}
          >
            <Input
              className="flex-1 bg-white text-lg"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="跟我聊聊吧，我可聪明啦！"
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
        </CardFooter>
      </Card>
    </main>
  );
}
