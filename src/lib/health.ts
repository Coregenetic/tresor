import type { Entry } from "./types";

export type Issue = "weak" | "reused" | "old";

export const ISSUE_LABEL: Record<Issue, string> = {
  weak: "Schwache Passwörter",
  reused: "Mehrfach verwendet",
  old: "Länger als 1 Jahr unverändert",
};

const YEAR_MS = 365 * 86_400_000;

/** Grob: kurz oder wenig Zeichenvielfalt = schwach. WLAN-Schlüssel aus Ziffern gelten als ok, wenn lang. */
export function isWeak(pw: string): boolean {
  if (pw.length < 10) return true;
  let variety = 0;
  if (/[a-zäöüß]/.test(pw)) variety++;
  if (/[A-ZÄÖÜ]/.test(pw)) variety++;
  if (/\d/.test(pw)) variety++;
  if (/[^\wäöüßÄÖÜ]/.test(pw)) variety++;
  if (pw.length >= 16) return false;
  return variety < 3;
}

export interface HealthReport {
  weak: Set<string>;
  reused: Set<string>;
  old: Set<string>;
  /** Einträge mit mindestens einem Problem */
  affected: number;
  /** Einträge mit Passwort */
  checked: number;
}

export function analyze(entries: Entry[], now = Date.now()): HealthReport {
  const weak = new Set<string>();
  const reused = new Set<string>();
  const old = new Set<string>();
  const byPassword = new Map<string, string[]>();
  let checked = 0;

  for (const e of entries) {
    if (!e.password) continue;
    checked++;
    if (isWeak(e.password)) weak.add(e.id);
    if (now - new Date(e.passwordChangedAt ?? e.updatedAt).getTime() > YEAR_MS) old.add(e.id);
    const list = byPassword.get(e.password) ?? [];
    list.push(e.id);
    byPassword.set(e.password, list);
  }
  for (const ids of byPassword.values()) {
    if (ids.length > 1) ids.forEach((id) => reused.add(id));
  }
  const affected = new Set([...weak, ...reused, ...old]).size;
  return { weak, reused, old, affected, checked };
}
