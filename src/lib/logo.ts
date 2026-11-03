/**
 * Anbieter-Logos werden online über den Favicon-Dienst von Google geladen.
 * Hinweis: Der Dienst sieht dabei die Domain des Anbieters (nicht aber Zugangsdaten).
 */
export function logoUrl(domain: string, size = 128): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

/** Leitet aus einer URL oder Eingabe eine saubere Domain ab ("https://www.telekom.de/x" → "telekom.de"). */
export function domainFrom(input: string): string | undefined {
  const raw = input.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./, "") || undefined;
  } catch {
    return undefined;
  }
}

export function initials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
