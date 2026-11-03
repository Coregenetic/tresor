import { openUrl } from "@tauri-apps/plugin-opener";
import { isTauri } from "./api";

/** Website im Standardbrowser öffnen (in der App nicht im eigenen Fenster). */
export function openExternal(url: string) {
  const full = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  if (isTauri) {
    openUrl(full).catch(() => undefined);
  } else {
    window.open(full, "_blank", "noopener");
  }
}
