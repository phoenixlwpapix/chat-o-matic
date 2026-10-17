import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { describe, expect, it } from "vitest";
import { normalizeMarkdown } from "./markdown";

function render(text: string) {
  return renderToStaticMarkup(createElement(ReactMarkdown, {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  }, normalizeMarkdown(text)));
}

describe("math Markdown compatibility", () => {
  it.each([
    String.raw`2. 让每个括号分别等于 0：$x - 2 = 0 \quad \text{或者} \quad x - 3 = 0$$`,
    String.raw`2. 让每个括号分别等于 0：$$x - 2 = 0 \quad \text{或者} \quad x - 3 = 0$`,
  ])("renders mixed formula delimiters inside a list", (text) => {
    const html = render(text);
    expect(html).toContain('class="katex"');
    expect(html).not.toContain('class="katex-error"');
    expect(html).toContain("或者");
    expect(normalizeMarkdown(text)).toContain(String.raw`$x - 2 = 0 \quad \text{或者} \quad x - 3 = 0$`);
  });

  it("preserves balanced inline and display formulas", () => {
    const text = "$a$ 和 $b$\n\n$$\n\\frac{1}{2}\n$$";
    expect(normalizeMarkdown(text)).toBe(text);
    expect(render(text)).toContain('class="katex-display"');
  });

  it.each([
    '`$x = 0$$`',
    '```latex\n$x = 0$$\n```',
    '~~~latex\n$$x = 0$\n~~~',
    '```latex\n$x = 0$$',
    '价格 $20 和 $30',
    String.raw`转义美元 \$x = 0$$`,
  ])("does not alter code, currency, or escaped delimiters: %s", (text) => {
    expect(normalizeMarkdown(text)).toBe(text);
  });

  it("preserves adjacent valid formulas and an unfinished streaming formula", () => {
    const text = "$x = 0$ 和 $y = 1$，下一步 $z =";
    expect(normalizeMarkdown(text)).toBe(text);
  });
});
