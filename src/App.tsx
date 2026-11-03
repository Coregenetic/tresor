import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { EntryDetail } from "./components/EntryDetail";
import { EntryList } from "./components/EntryList";
import { LockScreen } from "./components/LockScreen";
import { SetupScreen } from "./components/SetupScreen";
import { Sidebar, type Filter } from "./components/Sidebar";
import { api, errorText, type VaultData, type VaultStatus } from "./lib/api";
import type { Category, Entry } from "./lib/types";

type Theme = "light" | "dark";
type Phase = "loading" | "setup" | "locked" | "unlocked" | "error";

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem("tresor-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* ignorieren */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function matches(e: Entry, q: string) {
  if (!q) return true;
  const hay = [e.title, e.domain, e.username, e.customerNumber, e.notes].filter(Boolean).join(" ").toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((w) => hay.includes(w));
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [data, setData] = useState<VaultData | null>(null);
  const [firstLock, setFirstLock] = useState(true);
  const pending = useRef<VaultData | null>(null);

  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const searchRef = useRef<HTMLInputElement>(null);

  // Startzustand ermitteln
  useEffect(() => {
    api
      .status()
      .then((s) => {
        setStatus(s);
        setPhase(s.exists ? "locked" : "setup");
      })
      .catch((e) => {
        setFatal(errorText(e));
        setPhase("error");
      });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("tresor-theme", theme);
    } catch {
      /* ignorieren */
    }
  }, [theme]);

  const lock = useCallback(async () => {
    await api.lock().catch(() => undefined);
    setData(null);
    setQuery("");
    setSelectedId(undefined);
    setFirstLock(false);
    setStatus(await api.status().catch(() => status));
    setPhase("locked");
  }, [status]);

  const members = data?.members ?? [];
  const entries = data?.entries ?? [];

  const counts = useMemo(() => {
    const category = { login: 0, kundennummer: 0, wlan: 0, notiz: 0 } as Record<Category, number>;
    const member: Record<string, number> = {};
    for (const e of entries) {
      category[e.category]++;
      for (const id of e.memberIds) member[id] = (member[id] ?? 0) + 1;
    }
    return { all: entries.length, favorites: entries.filter((e) => e.favorite).length, category, member };
  }, [entries]);

  const visible = useMemo(() => {
    const list = entries.filter((e) => {
      switch (filter.kind) {
        case "favorites":
          return e.favorite;
        case "category":
          return e.category === filter.category;
        case "member":
          return e.memberIds.includes(filter.memberId);
        default:
          return true;
      }
    });
    return list.filter((e) => matches(e, query.trim())).sort((a, b) => a.title.localeCompare(b.title, "de"));
  }, [entries, filter, query]);

  useEffect(() => {
    if (!visible.some((e) => e.id === selectedId)) setSelectedId(visible[0]?.id);
  }, [visible, selectedId]);

  // Tastatur: Strg+F Suche, Strg+L sperren, Pfeile in der Liste – bewusst ohne Animation
  useEffect(() => {
    if (phase !== "unlocked") return;
    function onKey(ev: KeyboardEvent) {
      const mod = ev.ctrlKey || ev.metaKey;
      if (mod && (ev.key === "f" || ev.key === "k")) {
        ev.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (mod && ev.key === "l") {
        ev.preventDefault();
        lock();
      } else if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        const i = visible.findIndex((e) => e.id === selectedId);
        const next = ev.key === "ArrowDown" ? Math.min(i + 1, visible.length - 1) : Math.max(i - 1, 0);
        if (visible[next]) {
          ev.preventDefault();
          setSelectedId(visible[next].id);
          requestAnimationFrame(() =>
            document.querySelector(`[aria-selected="true"]`)?.scrollIntoView({ block: "nearest" }),
          );
        }
      } else if (ev.key === "Escape" && document.activeElement === searchRef.current) {
        setQuery("");
        searchRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, visible, selectedId, lock]);

  const listTitle =
    filter.kind === "all"
      ? "Alle Einträge"
      : filter.kind === "favorites"
        ? "Favoriten"
        : filter.kind === "member"
          ? (members.find((m) => m.id === filter.memberId)?.name ?? "")
          : { login: "Logins", kundennummer: "Kundennummern", wlan: "WLAN", notiz: "Notizen" }[filter.category];

  let screen: React.ReactNode = null;

  if (phase === "error") {
    screen = (
      <div className="lock">
        <div className="lock-card">
          <h1 className="lock-title">Tresor konnte nicht starten</h1>
          <p className="lock-sub">{fatal}</p>
        </div>
      </div>
    );
  } else if (phase === "setup" && status) {
    screen = (
      <SetupScreen
        helloSupported={status.helloSupported}
        onCreate={async (password, initial, enableHello) => {
          const result = await api.create(password, initial, enableHello);
          pending.current = initial;
          return result;
        }}
        onDone={(result) => {
          setData(pending.current);
          setStatus({ ...status, exists: true, unlocked: true, helloEnabled: result.helloEnabled });
          setPhase("unlocked");
          if (result.helloError) {
            toast.warning("Windows Hello wurde nicht eingerichtet", {
              description: `${result.helloError} Du kannst es später in den Einstellungen nachholen.`,
            });
          } else {
            toast.success("Tresor angelegt");
          }
        }}
      />
    );
  } else if (phase === "locked" && status) {
    screen = (
      <LockScreen
        helloEnabled={status.helloEnabled}
        autoHello={firstLock}
        onUnlockHello={async () => {
          pending.current = await api.unlockWithHello();
        }}
        onUnlockPassword={async (pw) => {
          pending.current = await api.unlockWithPassword(pw);
        }}
        onUnlocked={() => {
          setData(pending.current);
          pending.current = null;
          setPhase("unlocked");
        }}
      />
    );
  } else if (phase === "unlocked" && data) {
    screen = (
      <div className="shell">
        <Sidebar
          members={members}
          filter={filter}
          onFilter={setFilter}
          counts={counts}
          onLock={lock}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        />
        <EntryList
          title={listTitle}
          entries={visible}
          isEmptyVault={entries.length === 0}
          members={members}
          selectedId={selectedId}
          onSelect={setSelectedId}
          query={query}
          onQuery={setQuery}
          searchRef={searchRef}
        />
        <EntryDetail entry={entries.find((e) => e.id === selectedId)} members={members} />
      </div>
    );
  }

  return (
    <>
      {screen}
      <Toaster position="bottom-right" theme={theme} toastOptions={{ className: "toast" }} />
    </>
  );
}
