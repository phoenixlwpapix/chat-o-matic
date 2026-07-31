"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Check, Copy } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

const LazySyntaxHighlight = dynamic(
  () =>
    import("@/components/syntax-highlight").then(
      (module) => module.SyntaxHighlight,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-24 rounded-lg border-2 bg-gray-900" />
    ),
  },
);

const QUOTE_PAIRS = [
  ["\u201C", "\u201D"],
  ["\u2018", "\u2019"],
  ["\u300C", "\u300D"],
  ["\u300E", "\u300F"],
  ['"', '"'],
  ["'", "'"],
] as const;

export function normalizeMarkdown(text: string): string {
  let result = text;
  for (const [open, close] of QUOTE_PAIRS) {
    const pattern = new RegExp(`\\*\\*${open}([^\\*]+?)${close}\\*\\*`, "g");
    result = result.replace(pattern, `${open}**$1**${close}`);
  }
  return result;
}

function MarkdownCode({ className, children, ...props }: React.ComponentProps<"code">) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className ?? "");
  const language = match?.[1] ?? "";
  const code = String(children).replace(/\n$/, "");

  if (!className) {
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

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("复制代码失败:", error);
    }
  };

  return (
    <div className="relative group my-3">
      <div className="absolute right-2 top-2 z-10">
        <button
          type="button"
          onClick={copyCode}
          className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors border border-gray-600"
          aria-label={copied ? "代码已复制" : "复制代码"}
          title={copied ? "代码已复制" : "复制代码"}
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
      {language ? (
        <div className="absolute left-3 top-2 z-10 text-xs text-gray-400 font-mono">
          {language}
        </div>
      ) : null}
      <LazySyntaxHighlight code={code} language={language} />
    </div>
  );
}

const MARKDOWN_COMPONENTS: Components = { code: MarkdownCode };

export function MarkdownContent({ text }: { text: string }) {
  return (
    <div className="prose prose-base max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={MARKDOWN_COMPONENTS}
      >
        {normalizeMarkdown(text)}
      </ReactMarkdown>
    </div>
  );
}
