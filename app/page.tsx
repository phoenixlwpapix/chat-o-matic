"use client";

import { useState, useRef, useEffect } from "react";
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

interface Message {
  role: "user" | "bot";
  content: string;
}

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const resetConversation = () => {
    setMessages([]);
    setInput("");
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function sendMessage() {
    if (!input.trim()) return;

    const userMessage = input;
    const newHistory = [
      ...messages,
      { role: "user", content: userMessage } as Message,
    ];
    setMessages(newHistory);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newHistory.map((m) => ({
            role: m.role === "bot" ? "assistant" : m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) throw new Error(res.statusText);
      if (!res.body) throw new Error("No response body");

      // Add an empty bot message to start streaming into
      setMessages((m) => [...m, { role: "bot", content: "" }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value, { stream: true });

        setMessages((m) => {
          const lastMessage = m[m.length - 1];
          if (lastMessage.role === "bot") {
            return [
              ...m.slice(0, -1),
              { ...lastMessage, content: lastMessage.content + chunkValue },
            ];
          }
          return m;
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((m) => [
        ...m,
        { role: "bot", content: "哎呀！出错了。*砰！*" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 md:p-8">
      <Card className="w-full max-w-2xl h-[80vh] flex flex-col border-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <CardHeader className="border-b-2 border-black bg-yellow-300 rounded-t-lg py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-black p-2 rounded-xl shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] -rotate-3">
                <Zap className="w-8 h-8 text-yellow-300 fill-yellow-300" />
              </div>
              <CardTitle className="flex flex-col">
                <span className="text-4xl md:text-5xl font-black tracking-tighter leading-none drop-shadow-[2px_2px_0px_rgba(255,255,255,1)]">
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
            你负责好奇，我负责回答
          </p>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative">
                <Sparkles className="w-20 h-20 text-yellow-400 fill-yellow-400 animate-[spin_5s_linear_infinite]" />
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

          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "flex w-full",
                m.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "flex max-w-[80%] items-start gap-2",
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
                    m.content
                  ) : (
                    <div className="prose prose-base max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {loading && messages[messages.length - 1]?.role !== "bot" && (
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
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
          >
            <Input
              className="flex-1 bg-white text-lg"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="问啥都行，我可聪明啦！"
            />
            <Button
              type="submit"
              size="icon"
              className="w-12 h-10 bg-green-400 hover:bg-green-500 text-black"
              disabled={loading}
            >
              <Send className="w-5 h-5" />
            </Button>
          </form>
        </CardFooter>
      </Card>
    </main>
  );
}
