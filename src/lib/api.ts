import { invoke } from "@tauri-apps/api/core";
import { DEMO_ENTRIES, DEMO_MEMBERS } from "./demo";
import type { Entry, Member } from "./types";

export interface VaultData {
  version: 1;
  members: Member[];
  entries: Entry[];
}

export interface VaultStatus {
  exists: boolean;
  unlocked: boolean;
  helloSupported: boolean;
  helloEnabled: boolean;
}

export interface CreateResult {
  helloEnabled: boolean;
  helloError: string | null;
}

export interface VaultApi {
  status(): Promise<VaultStatus>;
  create(password: string, data: VaultData, enableHello: boolean): Promise<CreateResult>;
  unlockWithPassword(password: string): Promise<VaultData>;
  unlockWithHello(): Promise<VaultData>;
  lock(): Promise<void>;
  save(data: VaultData): Promise<void>;
  enableHello(): Promise<void>;
  disableHello(): Promise<void>;
  changePassword(current: string, next: string): Promise<void>;
}

function normalize(raw: unknown): VaultData {
  const d = (raw ?? {}) as Partial<VaultData>;
  return { version: 1, members: d.members ?? [], entries: d.entries ?? [] };
}

/** Echte App: alles läuft über den Rust-Kern. */
const tauriApi: VaultApi = {
  status: () => invoke<VaultStatus>("vault_status"),
  create: (password, data, enableHello) => invoke<CreateResult>("vault_create", { password, data, enableHello }),
  unlockWithPassword: async (password) => normalize(await invoke("vault_unlock_password", { password })),
  unlockWithHello: async () => normalize(await invoke("vault_unlock_hello")),
  lock: () => invoke("vault_lock"),
  save: (data) => invoke("vault_save", { data }),
  enableHello: () => invoke("vault_enable_hello"),
  disableHello: () => invoke("vault_disable_hello"),
  changePassword: (current, next) => invoke("vault_change_password", { current, next }),
};

/**
 * Nur für die Entwicklung im Browser (npm run dev): Tresor im Arbeitsspeicher mit Demodaten.
 * Master-Passwort der Demo: "demo-passwort". Mit ?setup in der URL startet die Ersteinrichtung.
 */
function createBrowserMock(): VaultApi {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const fresh = new URLSearchParams(location.search).has("setup");
  let password = "demo-passwort";
  let exists = !fresh;
  let hello = !fresh;
  let unlocked = false;
  let stored: VaultData = { version: 1, members: DEMO_MEMBERS, entries: DEMO_ENTRIES };

  return {
    async status() {
      return { exists, unlocked, helloSupported: true, helloEnabled: hello };
    },
    async create(pw, data, enableHello) {
      await wait(500);
      password = pw;
      stored = data;
      exists = true;
      hello = enableHello;
      unlocked = true;
      return { helloEnabled: enableHello, helloError: null };
    },
    async unlockWithPassword(pw) {
      await wait(450);
      if (pw !== password) throw "Falsches Master-Passwort";
      unlocked = true;
      return structuredClone(stored);
    },
    async unlockWithHello() {
      await wait(700);
      if (!hello) throw "Windows Hello ist für diesen Tresor nicht eingerichtet";
      unlocked = true;
      return structuredClone(stored);
    },
    async lock() {
      unlocked = false;
    },
    async save(data) {
      stored = structuredClone(data);
    },
    async enableHello() {
      hello = true;
    },
    async disableHello() {
      hello = false;
    },
    async changePassword(current, next) {
      if (current !== password) throw "Falsches Master-Passwort";
      password = next;
    },
  };
}

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const api: VaultApi = isTauri ? tauriApi : createBrowserMock();

/** Fehlertext aus invoke()-Fehlern (Rust liefert Strings) */
export function errorText(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  return "Unbekannter Fehler";
}
