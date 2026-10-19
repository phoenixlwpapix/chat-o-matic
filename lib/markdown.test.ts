import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkCjkFriendly from "remark-cjk-friendly/parseOnly";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { describe, expect, it } from "vitest";
import { normalizeMarkdown } from "./markdown";

function render(text: string) {
  return renderToStaticMarkup(createElement(ReactMarkdown, {
    remarkPlugins: [remarkGfm, remarkCjkFriendly, remarkMath],
    rehypePlugins: [rehypeKatex],
  }, normalizeMarkdown(text)));
}

describe("Chinese Markdown emphasis compatibility", () => {
  it.each([
    ["重点（附注）", "后续中文"],
    ["重点(附注)", "后续中文"],
    ["重点【附注】", "后续中文"],
    ["重点《书名》", "后续中文"],
    ["重点。", "后续中文"],
    ["重点：", "后续中文"],
    ["（附注）重点", "后续中文"],
    ["“重点”内容", "后续中文"],
  ])("renders bold %s beside Chinese text", (bold, suffix) => {
    expect(render(`前文**${bold}**${suffix}`)).toBe(`<p>前文<strong>${bold}</strong>${suffix}</p>`);
  });

  it("keeps adjacent bold spans separate", () => {
    expect(render("**第一项（甲）**、**第二项（乙）**后续")).toBe(
      "<p><strong>第一项（甲）</strong>、<strong>第二项（乙）</strong>后续</p>",
    );
  });

  it("preserves nested inline formatting inside bold text", () => {
    const html = render("前文**重点 *斜体* 与 `code` 和 [链接](https://example.com)（附注）**后续");
    expect(html).toContain('<strong>重点 <em>斜体</em> 与 <code>code</code> 和 <a href="https://example.com">链接</a>（附注）</strong>后续');
  });

  it("supports lists and GFM tables", () => {
    const html = render("- **重点（附注）**后续\n\n| 内容 |\n| --- |\n| **结论（附注）**后续 |");
    expect(html).toContain("<li><strong>重点（附注）</strong>后续</li>");
    expect(html).toContain("<td><strong>结论（附注）</strong>后续</td>");
  });

  it("keeps code samples and escaped asterisks literal", () => {
    const html = render('`**重点（附注）**后续`\n\n```text\n**重点（附注）**后续\n```\n\n\\*\\*重点（附注）\\*\\*后续');
    expect(html).not.toContain("<strong>");
    expect(html).toContain("<code>**重点（附注）**后续</code>");
    expect(html).toContain('<code class="language-text">**重点（附注）**后续\n</code>');
    expect(html).toContain("<p>**重点（附注）**后续</p>");
  });

  it("waits for the closing delimiter in streaming text", () => {
    expect(render("前文**重点（附注）")).toBe("<p>前文**重点（附注）</p>");
    expect(render("前文**重点（附注）*")).not.toContain("<strong>");
    expect(render("前文**重点（附注）**后续")).toBe("<p>前文<strong>重点（附注）</strong>后续</p>");
  });

  it("preserves standard English emphasis", () => {
    expect(render("**bold** and *italic* and **(note)**.")).toBe(
      "<p><strong>bold</strong> and <em>italic</em> and <strong>(note)</strong>.</p>",
    );
  });
});

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
