import { fromMarkdown } from "mdast-util-from-markdown";
import type { Nodes } from "mdast";

export function normalizeMarkdown(text: string): string {
  // Ordinary prose and emphasis need no source parsing. Repairs require either
  // a double dollar delimiter or a numeric emoji somewhere in the source.
  if (!text.includes("$$") && !/[🔟\u20E3]/.test(text)) return text;

  const ranges: { start: number; end: number }[] = [];
  const nodes: Nodes[] = [fromMarkdown(text)];
  while (nodes.length) {
    const node = nodes.pop()!;
    // Use the parser's boundaries for nested/unfinished fences, indentation,
    // escaped backticks, links and raw HTML rather than guessing with regexes.
    if (["code", "inlineCode", "html", "link", "image", "definition"].includes(node.type)) {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (start !== undefined && end !== undefined) ranges.push({ start, end });
    } else if ("children" in node) {
      nodes.push(...node.children);
    }
  }
  ranges.sort((a, b) => a.start - b.start);

  const parts: string[] = [];
  let cursor = 0;
  for (const { start, end } of ranges) {
    parts.push(normalizeProse(text.slice(cursor, start), cursor === 0 || text[cursor - 1] === "\n", text[start]));
    parts.push(text.slice(start, end));
    cursor = end;
  }
  parts.push(normalizeProse(text.slice(cursor), cursor === 0 || text[cursor - 1] === "\n"));
  return parts.join("");
}

function normalizeProse(text: string, startsLine = true, nextCharacter = ""): string {
  const result = text.replace(
    /^([ \t]*)(🔟|[1-9]\uFE0F?\u20E3)[ \t]+/gm,
    (match: string, indent: string, marker: string, offset: number) => {
      if (offset === 0 && !startsLine) return match;
      if (!/\S/.test(text[offset + match.length] ?? nextCharacter)) return match;
      return `${indent}${marker === "🔟" ? "10" : marker[0]}. `;
    },
  );
  return normalizeMathDelimiters(result);
}

/** Repair mixed $/$$ pairs only for recognizable, single-line mathematics.
 * Consume escaped characters, longer dollar runs and balanced math intact.
 */
function normalizeMathDelimiters(text: string): string {
  return text.replace(
    /\\[\s\S]|\${3,}|(\${1,2})(?!\$)((?:\\[\s\S]|[^\\$])*?)(\${1,2})(?!\$)/g,
    (match: string, opening: string | undefined, formula: string | undefined, closing: string | undefined) => {
      if (!formula || opening === closing || /[\r\n]/.test(formula)) return match;
      if (!/[=<>]|\\(?:frac|sqrt|quad|text|sum|int)\b/.test(formula)) return match;
      return `$${formula.trim()}$`;
    },
  );
}

