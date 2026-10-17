const QUOTE_PAIRS = [
  ["\u201C", "\u201D"],
  ["\u2018", "\u2019"],
  ["\u300C", "\u300D"],
  ["\u300E", "\u300F"],
  ['"', '"'],
  ["'", "'"],
] as const;

export function normalizeMarkdown(text: string): string {
  let result = text
    .replace(/^\s*🔟\s+/gm, "10. ")
    .replace(/^\s*([1-9])\uFE0F?\u20E3\s+/gm, "$1. ");
  for (const [open, close] of QUOTE_PAIRS) {
    const pattern = new RegExp(`\\*\\*${open}([^\\*]+?)${close}\\*\\*`, "g");
    result = result.replace(pattern, `${open}**$1**${close}`);
  }
  return normalizeMathDelimiters(result);
}

/** Repair mixed $/$$ pairs only for recognizable, single-line mathematics.
 * Code and already balanced math are consumed intact before considering repairs.
 */
function normalizeMathDelimiters(text: string): string {
  return text.replace(
    /(^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^[ \t]*\2[ \t]*$|(?![\s\S])))|(`+)[^`]*?\3|(?<![\\$])(\${1,2})(?!\$)([^\n$]+?)(?<!\\)(\${1,2})(?!\$)/gm,
    (match: string, codeBlock: string | undefined, _fence: string | undefined, inlineCode: string | undefined, opening: string | undefined, formula: string | undefined, closing: string | undefined) => {
      if (codeBlock || inlineCode || !formula || opening === closing) return match;
      if (!/[=<>]|\\(?:frac|sqrt|quad|text|sum|int)\b/.test(formula)) return match;
      return `$${formula.trim()}$`;
    },
  );
}

