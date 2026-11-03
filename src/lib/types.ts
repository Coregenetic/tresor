export type MemberId = string;

export interface Member {
  id: MemberId;
  name: string;
  /** Farbton (0–360) für Avatar und Markierungen */
  hue: number;
}

export type Category = "login" | "kundennummer" | "wlan" | "notiz";

export interface Entry {
  id: string;
  title: string;
  /** Domain des Anbieters, z. B. "telekom.de" – daraus wird das Logo geladen */
  domain?: string;
  category: Category;
  username?: string;
  password?: string;
  customerNumber?: string;
  url?: string;
  notes?: string;
  memberIds: MemberId[];
  favorite?: boolean;
  updatedAt: string; // ISO
}

export const CATEGORY_LABEL: Record<Category, string> = {
  login: "Login",
  kundennummer: "Kundennummer",
  wlan: "WLAN",
  notiz: "Notiz",
};
