const QUOTE_PAIRS = [
  ["\u201C", "\u201D"],
  ["\u2018", "\u2019"],
  ["\u300C", "\u300D"],
  ["\u300E", "\u300F"],
  ['"', '"'],
  ["'", "'"],
] as const;

/** Old renders rewrote quiz JSON before saving answers. Only reproduce those
 * exact changes when matching historical submissions; never render this text.
 */
export function normalizeLegacyQuizRaw(raw: string): string {
  let result = raw
    .replace(/^\s*🔟\s+/gm, "10. ")
    .replace(/^\s*([1-9])\uFE0F?\u20E3\s+/gm, "$1. ");
  for (const [open, close] of QUOTE_PAIRS) {
    const pattern = new RegExp(`\\*\\*${open}([^\\*]+?)${close}\\*\\*`, "g");
    result = result.replace(pattern, `${open}**$1**${close}`);
  }
  return result;
}

/** New normalization preserves line breaks. Reproduce the old source offset
 * for saved card keys when old emoji repairs removed preceding blank lines.
 */
export function getLegacyQuizOffset(source: string, line: number, column: number): number {
  let offset = 0;
  for (let currentLine = 1; currentLine < line; currentLine++) {
    const newline = source.indexOf("\n", offset);
    if (newline < 0) return source.length;
    offset = newline + 1;
  }
  const prefix = normalizeLegacyQuizRaw(source.slice(0, offset + column - 1));
  // This is the exact math repair used before code preservation was corrected.
  return prefix.replace(
    /(^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^[ \t]*\2[ \t]*$|(?![\s\S])))|(`+)[^`]*?\3|(?<![\\$])(\${1,2})(?!\$)([^\n$]+?)(?<!\\)(\${1,2})(?!\$)/gm,
    (match: string, codeBlock: string | undefined, _fence: string | undefined, inlineCode: string | undefined, opening: string | undefined, formula: string | undefined, closing: string | undefined) => {
      if (codeBlock || inlineCode || !formula || opening === closing) return match;
      if (!/[=<>]|\\(?:frac|sqrt|quad|text|sum|int)\b/.test(formula)) return match;
      return `$${formula.trim()}$`;
    },
  ).length;
}
