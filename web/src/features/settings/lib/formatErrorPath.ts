/**
 * Turn a machine-readable YAML validation path (e.g. "days.A.entries[2].sets")
 * into a user-readable breadcrumb (e.g. "Day A · Entry 3 · sets").
 *
 * Conversions:
 *   - ""                                      → "Root"
 *   - "name" / "version" / "day_order"        → title-cased
 *   - "days.X..."                             → "Day X · ..."
 *   - "entries[N]..."                         → "Entry {N+1} · ..."  (1-indexed)
 *   - "items[N]..."                           → "Item {N+1} · ..."
 *   - "set_blocks[N]..."                      → "set block {N+1} · ..."
 *   - "cardio.options[N]..."                  → "Cardio · Option {N+1} · ..."
 *   - any unknown token                       → kept verbatim, joined with " · "
 */
export function formatErrorPath(path: string): string {
  if (path === "") return "Root";

  const TOP_LEVEL: Record<string, string> = {
    name: "Name",
    version: "Version",
    day_order: "Day order",
    rest_default_sec: "Rest default",
    rest_superset_sec: "Rest superset",
    notes: "Notes",
  };
  if (TOP_LEVEL[path] !== undefined) return TOP_LEVEL[path]!;

  const segments: string[] = [];

  // Split on dots but keep bracketed indices attached to their token.
  // "days.A.entries[2].sets" → ["days", "A", "entries[2]", "sets"]
  const parts = path.split(".");

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    const bracketMatch = part.match(/^([a-z_]+)\[(\d+)\]$/);

    if (bracketMatch) {
      const [, name, idxStr] = bracketMatch;
      const idx = Number(idxStr) + 1;
      if (name === "entries") segments.push(`Entry ${idx}`);
      else if (name === "items") segments.push(`Item ${idx}`);
      else if (name === "set_blocks") segments.push(`set block ${idx}`);
      else if (name === "options") segments.push(`Option ${idx}`);
      else segments.push(`${name} ${idx}`);
      continue;
    }

    if (part === "days" && i + 1 < parts.length) {
      // Consume the next segment as the day ID.
      const dayId = parts[i + 1]!;
      segments.push(`Day ${dayId}`);
      i++;
      continue;
    }

    if (part === "cardio") {
      segments.push("Cardio");
      continue;
    }

    // Unknown segment — keep as-is.
    segments.push(part);
  }

  return segments.join(" · ");
}
