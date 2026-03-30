/**
 * Parse a CSV string into an array of objects.
 *
 * Assumptions:
 * - The first line is a header row.
 * - Fields are comma-separated.
 * - No quoted fields with embedded commas or newlines (the exercise catalog
 *   uses simple values like "Machine / Cable" which contain slashes, not commas).
 * - Empty lines are skipped.
 * - Leading and trailing whitespace is trimmed from each field.
 *
 * Returns an array of Record<string, string> where keys are the header names.
 */
export function parseCsv(csv: string): Record<string, string>[] {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) {
    return [];
  }

  const headers = lines[0]!.split(",").map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i]!.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = values[j] ?? "";
    }
    rows.push(row);
  }

  return rows;
}
