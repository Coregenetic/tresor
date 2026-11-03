import { useEffect, useMemo, useRef, useState } from "react";
import { Toaster } from "sonner";
import { EntryDetail } from "./components/EntryDetail";
import { EntryList } from "./components/EntryList";
import { LockScreen } from "./components/LockScreen";
import { Sidebar, type Filter } from "./components/Sidebar";
import { DEMO_ENTRIES, DEMO_MEMBERS } from "./lib/demo";
import type { Category, Entry } from "./lib/types";

type Theme = "light" | "dark";

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
  const [locked, setLocked] = useState(true);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const searchRef = useRef<HTMLInputElement>(null);

  const members = DEMO_MEMBERS;
  const entries = DEMO_ENTRIES;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("tresor-theme", theme);
    } catch {
      /* ignorieren */
    }
  }, [theme]);

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

  // Auswahl gültig halten, wenn Filter/Suche den Eintrag ausblenden
  useEffect(() => {
    if (!visible.some((e) => e.id === selectedId)) setSelectedId(visible[0]?.id);
  }, [visible, selectedId]);

  // Tastatur: Strg+F Suche, Strg+L sperren, Pfeile in der Liste – bewusst ohne Animation
  useEffect(() => {
    if (locked) return;
    function onKey(ev: KeyboardEvent) {
      const mod = ev.ctrlKey || ev.metaKey;
      if (mod && (ev.key === "f" || ev.key === "k")) {
        ev.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (mod && ev.key === "l") {
        ev.preventDefault();
        setLocked(true);
      } else if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        const i = visible.findIndex((e) => e.id === selectedId);
        const next = ev.key === "ArrowDown" ? Math.min(i + 1, visible.length - 1) : Math.max(i - 1, 0);
        if (visible[next]) {
          ev.preventDefault();
          setSelectedId(visible[next].id);
          document.querySelector(`[aria-selected="true"]`)?.scrollIntoView({ block: "nearest" });
        }
      } else if (ev.key === "Escape" && document.activeElement === searchRef.current) {
        setQuery("");
        searchRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, visible, selectedId]);

  const listTitle =
    filter.kind === "all"
      ? "Alle Einträge"
      : filter.kind === "favorites"
        ? "Favoriten"
        : filter.kind === "member"
          ? (members.find((m) => m.id === filter.memberId)?.name ?? "")
          : { login: "Logins", kundennummer: "Kundennummern", wlan: "WLAN", notiz: "Notizen" }[filter.category];

  return (
    <>
      {locked ? (
        <LockScreen onUnlock={() => setLocked(false)} />
      ) : (
        <div className="shell">
          <Sidebar
            members={members}
            filter={filter}
            onFilter={setFilter}
            counts={counts}
            onLock={() => setLocked(true)}
            theme={theme}
            onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          />
          <EntryList
            title={listTitle}
            entries={visible}
            members={members}
            selectedId={selectedId}
            onSelect={setSelectedId}
            query={query}
            onQuery={setQuery}
            searchRef={searchRef}
          />
          <EntryDetail entry={entries.find((e) => e.id === selectedId)} members={members} />
        </div>
      )}
      <Toaster position="bottom-right" theme={theme} toastOptions={{ className: "toast" }} />
    </>
  );
}
