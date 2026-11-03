/** IBAN in Viererblöcken anzeigen: DE89 3704 0044 0532 0130 00 */
export function formatIban(raw: string): string {
  return raw
    .replace(/\s+/g, "")
    .toUpperCase()
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

/** Grobe Prüfung per Modulo 97 (fängt Tippfehler ab). */
export function isValidIban(raw: string): boolean {
  const iban = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const moved = iban.slice(4) + iban.slice(0, 4);
  const digits = moved.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  return rest === 1;
}

/** Tage bis zu einem Datum (JJJJ-MM-TT), bezogen auf heute 00:00. Negativ = vorbei. */
export function daysUntil(date: string, now = new Date()): number {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - today) / 86_400_000);
}

export function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
}

export function contractLabel(days: number): string {
  if (days < 0) return days === -1 ? "seit gestern abgelaufen" : `seit ${-days} Tagen abgelaufen`;
  if (days === 0) return "endet heute";
  if (days === 1) return "endet morgen";
  if (days < 60) return `endet in ${days} Tagen`;
  const months = Math.round(days / 30);
  return `endet in ${months} Monaten`;
}

/** Ab wie vielen Tagen vorher erinnert wird */
export const CONTRACT_REMINDER_DAYS = 30;
