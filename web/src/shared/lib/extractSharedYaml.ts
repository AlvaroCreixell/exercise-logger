/**
 * Normalize YAML that arrives via share sheets, clipboard, or chat exports.
 *
 * ChatGPT (and most chat apps) wrap code in ``` fences and often surround the
 * block with prose ("Here's your routine! ..."). Importing that verbatim fails
 * YAML validation with a confusing error, so every convenience input path runs
 * through this first. Plain YAML passes through untouched (trimmed).
 */
export function extractSharedYaml(text: string): string {
  const trimmed = text.trim();
  if (trimmed === "") return "";

  // First complete fenced block (with optional language tag) wins.
  const fenced = /```[^\n]*\n([\s\S]*?)```/.exec(trimmed);
  if (fenced) return fenced[1]!.trim();

  // Unclosed opening fence: drop the fence line, keep the rest.
  if (trimmed.startsWith("```")) {
    const newline = trimmed.indexOf("\n");
    return newline === -1 ? "" : trimmed.slice(newline + 1).trim();
  }

  return trimmed;
}
