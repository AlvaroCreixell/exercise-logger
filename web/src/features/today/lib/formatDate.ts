const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "long" });
const MONTH = new Intl.DateTimeFormat("en-US", { month: "short" });

export function formatTodayEyebrow(date: Date): string {
  const weekday = WEEKDAY.format(date).toUpperCase();
  const month = MONTH.format(date).toUpperCase();
  const day = date.getDate();
  return `${weekday} · ${month} ${day}`;
}
