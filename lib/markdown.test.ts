import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkCjkFriendly from "remark-cjk-friendly/parseOnly";
import remarkCjkFriendlyStrikethrough from "remark-cjk-friendly-gfm-strikethrough/parseOnly";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { fromMarkdown } from "mdast-util-from-markdown";
import { describe, expect, it } from "vitest";
import { normalizeMarkdown } from "./markdown";
import { getLegacyQuizOffset } from "./legacy-quiz-markdown";

function render(text: string) {
  return renderToStaticMarkup(createElement(ReactMarkdown, {
    remarkPlugins: [remarkGfm, remarkCjkFriendly, remarkCjkFriendlyStrikethrough, remarkMath],
    rehypePlugins: [rehypeKatex],
  }, normalizeMarkdown(text)));
}

describe("Chinese Markdown emphasis compatibility", () => {
  it.each([
    ["（", "）"],
    ["(", ")"],
    ["【", "】"],
    ["《", "》"],
    ["「", "」"],
    ["『", "』"],
    ["“", "”"],
    ["‘", "’"],
  ])("recognizes opening asterisks immediately before %s", (open, close) => {
    for (const prefix of ["", "前文", "（"]) {
      for (const bold of [`${open}重点${close}`, `${open}附注${close}重点`]) {
        expect(render(`${prefix}**${bold}**后续`)).toBe(`<p>${prefix}<strong>${bold}</strong>后续</p>`);
      }
    }
  });

  it.each(["“重点”", "‘重点’", "「重点」", "『重点』"])("keeps quotes inside the bold span: %s", (bold) => {
    expect(render(`前文**${bold}**后续`)).toBe(`<p>前文<strong>${bold}</strong>后续</p>`);
  });

  it("supports strikethrough adjacent to Chinese punctuation", () => {
    expect(render("前文~~错误（附注）~~后续")).toBe("<p>前文<del>错误（附注）</del>后续</p>");
    expect(render("前文~~**错误（附注）**~~后续")).toBe("<p>前文<del><strong>错误（附注）</strong></del>后续</p>");
    expect(render('`~~错误（附注）~~`')).toBe("<p><code>~~错误（附注）~~</code></p>");
  });

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

describe("Markdown source preservation", () => {
  it.each([
    '`**“重点”**`',
    '```text\n**“重点”**\n1️⃣ 示例\n```',
    '~~~text\n**“重点”**\n~~~',
    '```text\n**“重点”**',
    '    **“重点”**\n    1️⃣ 示例',
    '``示例 ` **“重点”**``',
    '\\*\\*“重点”\\*\\*',
    '**“一个”** 和 **“另一个”**',
  ])("does not rewrite code, escapes, or emphasis boundaries: %s", (text) => {
    expect(normalizeMarkdown(text)).toBe(text);
  });

  it("does not turn separated emoji paragraphs into a list", () => {
    expect(normalizeMarkdown("开头\n\n1️⃣\n\n下一段")).toBe("开头\n\n1️⃣\n\n下一段");
  });

  it("normalizes only emoji list markers followed by content on the same line", () => {
    expect(normalizeMarkdown("开头\n\n1️⃣ 第一项\n2️⃣ 第二项\n🔟 第十项")).toBe("开头\n\n1. 第一项\n2. 第二项\n10. 第十项");
    expect(normalizeMarkdown("1️⃣ `code` 和 $x = 0$$")).toBe("1. `code` 和 $x = 0$");
    expect(normalizeMarkdown("`code`1️⃣ 不是行首")).toBe("`code`1️⃣ 不是行首");
  });

  it.each([
    '    $x = 0$$',
    '````latex\n```\n$x = 0$$\n````',
    '```latex\r\n$x = 0$$\r\n```\r\n$$y = 1$',
    '> ```latex\n> $x = 0$$\n> ```',
    '- ```latex\n  $x = 0$$\n  ```',
  ])("does not repair mathematics inside code: %s", (text) => {
    const expected = text.endsWith("$$y = 1$") ? text.replace("$$y = 1$", "$y = 1$") : text;
    expect(normalizeMarkdown(text)).toBe(expected);
  });

  it("preserves mixed-looking dollars inside a balanced display formula", () => {
    const text = '$$\n\\text{price \\$x = 0$}\n$$';
    expect(normalizeMarkdown(text)).toBe(text);
  });

  it("protects link destinations, titles, definitions, and HTML attributes", () => {
    for (const text of [
      '[链接](https://example.com/$x=0$$ "说明 $y=1$$")',
      '[链接][ref]\n\n[ref]: https://example.com/$x=0$$',
      '<span title="$x=0$$">内容</span>',
      '![图片](https://example.com/$x=0$$)',
    ]) expect(normalizeMarkdown(text)).toBe(text);
  });

  it("repairs prose next to code without pairing with dollars inside the code", () => {
    expect(normalizeMarkdown('`$示例` 正文 $x = 0$$')).toBe('`$示例` 正文 $x = 0$');
    expect(normalizeMarkdown('```text\n$x\n```\n\n正文 $y = 1$$')).toBe('```text\n$x\n```\n\n正文 $y = 1$');
    expect(normalizeMarkdown('``示例 ` $x = 0$$`` 后面 $y = 1$$')).toBe('``示例 ` $x = 0$$`` 后面 $y = 1$');
  });

  it("honors escaped dollars and even numbers of backslashes", () => {
    expect(normalizeMarkdown(String.raw`\$x = 0$$`)).toBe(String.raw`\$x = 0$$`);
    expect(normalizeMarkdown(String.raw`\\$x = 0$$`)).toBe(String.raw`\\$x = 0$`);
    expect(normalizeMarkdown(String.raw`$x = \$1$$`)).toBe(String.raw`$x = \$1$`);
    expect(normalizeMarkdown('$$$x = 0$$$')).toBe('$$$x = 0$$$');
  });

  it("retains the old quiz key when emoji normalization changes source offsets", () => {
    const prefix = '开头\n\n1️⃣ 提示 $x = 0$$\n\n';
    const source = `${prefix}\`\`\`quiz\n{}\n\`\`\``;
    const position = fromMarkdown(normalizeMarkdown(source)).children.find((node) => node.type === "code")!.position!.start;
    const legacyPrefix = '开头\n1. 提示 $x = 0$\n\n';
    expect(getLegacyQuizOffset(source, position.line, position.column)).toBe(legacyPrefix.length);
    expect(position.offset).not.toBe(legacyPrefix.length);
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
