import { isTauri } from "./api";
import { CONTRACT_REMINDER_DAYS, contractLabel, daysUntil } from "./format";
import type { Entry } from "./types";

export interface AvailableUpdate {
  version: string;
  notes?: string;
  /** Lädt herunter, installiert und startet neu. `onProgress` liefert 0–1. */
  install: (onProgress?: (p: number) => void) => Promise<void>;
}

export async function appVersion(): Promise<string> {
  if (!isTauri) return "Vorschau";
  const { getVersion } = await import("@tauri-apps/api/app");
  return getVersion();
}

/** Fragt GitHub nach einer neueren Version. Fehler (offline etc.) werden still als "keine" behandelt. */
export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  if (!isTauri) return null;
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (!update) return null;
  return {
    version: update.version,
    notes: update.body ?? undefined,
    install: async (onProgress) => {
      let total = 0;
      let done = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        if (event.event === "Progress") {
          done += event.data.chunkLength;
          if (total > 0) onProgress?.(Math.min(1, done / total));
        }
        if (event.event === "Finished") onProgress?.(1);
      });
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    },
  };
}

/** Verträge, die bald enden (oder gerade abgelaufen sind), sortiert nach Datum. */
export function dueContracts(entries: Entry[]) {
  return entries
    .filter((e) => e.contractEnd)
    .map((e) => ({ entry: e, days: daysUntil(e.contractEnd!) }))
    .filter((x) => x.days <= CONTRACT_REMINDER_DAYS && x.days >= -14)
    .sort((a, b) => a.days - b.days);
}

/** Einmal pro Tag eine Windows-Benachrichtigung zu fälligen Verträgen. */
export async function notifyDueContracts(entries: Entry[]) {
  if (!isTauri) return;
  const due = dueContracts(entries);
  if (due.length === 0) return;

  const today = new Date().toISOString().slice(0, 10);
  try {
    if (localStorage.getItem("tresor-notified") === today) return;
  } catch {
    /* ignorieren */
  }

  const { isPermissionGranted, requestPermission, sendNotification } = await import(
    "@tauri-apps/plugin-notification"
  );
  let granted = await isPermissionGranted();
  if (!granted) granted = (await requestPermission()) === "granted";
  if (!granted) return;

  const first = due[0];
  sendNotification({
    title: due.length === 1 ? `${first.entry.title}: Vertrag ${contractLabel(first.days)}` : `${due.length} Verträge enden bald`,
    body:
      due.length === 1
        ? "Jetzt ist ein guter Zeitpunkt zum Kündigen oder Verlängern."
        : due
            .slice(0, 3)
            .map((d) => `${d.entry.title} – ${contractLabel(d.days)}`)
            .join("\n"),
  });
  try {
    localStorage.setItem("tresor-notified", today);
  } catch {
    /* ignorieren */
  }
}
