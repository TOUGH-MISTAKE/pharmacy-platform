const LABELS: Record<string, string> = {
  daily: "Every day",
  mon_sat: "Monday to Saturday",
  mon_fri: "Monday to Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const ORDER = ["daily", "mon_sat", "mon_fri", "sat", "sun"];

export function hoursRows(hours: Record<string, string>): { label: string; value: string }[] {
  return Object.keys(hours)
    .sort((a, b) => {
      const indexA = ORDER.indexOf(a);
      const indexB = ORDER.indexOf(b);
      return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
    })
    .map((key) => ({ label: LABELS[key] ?? key, value: formatRange(hours[key]) }));
}

function formatRange(value: string): string {
  return value.toLowerCase() === "closed" ? "Closed" : value.replace("-", " - ");
}

function pickKey(hours: Record<string, string>, weekday: string): string | null {
  const candidates =
    weekday === "Sun"
      ? ["sun", "daily"]
      : weekday === "Sat"
        ? ["sat", "mon_sat", "daily"]
        : ["mon_fri", "mon_sat", "daily"];
  return candidates.find((key) => key in hours) ?? null;
}

/** Returns true or false, or null when the opening hours cannot be understood. Uses Nairobi time. */
export function isOpenNow(hours: Record<string, string>, date: Date): boolean | null {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Nairobi",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (!weekday || Number.isNaN(hour) || Number.isNaN(minute)) return null;

  const key = pickKey(hours, weekday);
  if (!key) return null;

  const value = hours[key].trim().toLowerCase();
  if (value === "closed") return false;

  const match = value.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const opens = Number(match[1]) * 60 + Number(match[2]);
  const closes = Number(match[3]) * 60 + Number(match[4]);
  const current = hour * 60 + minute;
  return current >= opens && current < closes;
}
