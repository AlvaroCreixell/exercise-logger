/**
 * Return the current time as an ISO 8601 UTC string.
 *
 * Format: "2026-03-28T14:30:00.000Z"
 *
 * All persisted timestamps in the app use this format.
 * We always store UTC — never local time — to avoid timezone bugs.
 */
export function nowISO(): string {
  return new Date().toISOString();
}
