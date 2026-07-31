"use client";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface SyntaxHighlightProps {
  code: string;
  language: string;
}

export function SyntaxHighlight({ code, language }: SyntaxHighlightProps) {
  return (
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
      {code}
    </SyntaxHighlighter>
  );
}
