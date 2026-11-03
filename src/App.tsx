import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { EntryDetail } from "./components/EntryDetail";
import { EntryEditor } from "./components/EntryEditor";
import { EntryList } from "./components/EntryList";
import { LockScreen } from "./components/LockScreen";
import { MEMBER_HUES, MemberDialog } from "./components/MemberDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { SetupScreen } from "./components/SetupScreen";
import { Sidebar, type Filter } from "./components/Sidebar";
import { api, errorText, type VaultData, type VaultStatus } from "./lib/api";
import type { Category, Entry, Member } from "./lib/types";

type Theme = "light" | "dark";
type Phase = "loading" | "setup" | "locked" | "unlocked" | "error";
type Editing = null | { id?: string };
type Dialog = null | { kind: "settings" } | { kind: "member"; member?: Member };

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

function passesFilter(e: Entry, filter: Filter) {
  switch (filter.kind) {
    case "favorites":
      return !!e.favorite;
    case "category":
      return e.category === filter.category;
    case "member":
      return e.memberIds.includes(filter.memberId);
    default:
      return true;
  }
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [data, setData] = useState<VaultData | null>(null);
  const [firstLock, setFirstLock] = useState(true);
  const pending = useRef<VaultData | null>(null);
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());

  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [editing, setEditing] = useState<Editing>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
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

  /** Änderungen sofort anzeigen und der Reihe nach verschlüsselt speichern. */
  const persist = useCallback((next: VaultData) => {
    setData(next);
    saveChain.current = saveChain.current
      .then(() => api.save(next))
      .catch((e) => toast.error("Speichern fehlgeschlagen", { description: errorText(e) }));
  }, []);

  const lock = useCallback(async () => {
    await saveChain.current; // nichts verlieren, was noch gespeichert wird
    await api.lock().catch(() => undefined);
    setData(null);
    setQuery("");
    setSelectedId(undefined);
    setEditing(null);
    setDialog(null);
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

  const visible = useMemo(
    () =>
      entries
        .filter((e) => passesFilter(e, filter) && matches(e, query.trim()))
        .sort((a, b) => a.title.localeCompare(b.title, "de")),
    [entries, filter, query],
  );

  useEffect(() => {
    if (editing?.id === undefined && editing) return; // neuer Eintrag: Auswahl nicht anfassen
    if (!visible.some((e) => e.id === selectedId)) setSelectedId(visible[0]?.id);
  }, [visible, selectedId, editing]);

  // ── Einträge ───────────────────────────────

  function saveEntry(entry: Entry) {
    if (!data) return;
    const exists = data.entries.some((e) => e.id === entry.id);
    const nextEntries = exists ? data.entries.map((e) => (e.id === entry.id ? entry : e)) : [...data.entries, entry];
    persist({ ...data, entries: nextEntries });
    if (!passesFilter(entry, filter)) setFilter({ kind: "all" });
    if (!matches(entry, query.trim())) setQuery("");
    setSelectedId(entry.id);
    setEditing(null);
    toast.success(exists ? "Gespeichert" : `${entry.title} angelegt`);
  }

  function deleteEntry(id: string) {
    if (!data) return;
    const entry = data.entries.find((e) => e.id === id);
    persist({ ...data, entries: data.entries.filter((e) => e.id !== id) });
    setEditing(null);
    setSelectedId(undefined);
    toast(`${entry?.title ?? "Eintrag"} gelöscht`);
  }

  function toggleFavorite(id: string) {
    if (!data) return;
    persist({
      ...data,
      entries: data.entries.map((e) => (e.id === id ? { ...e, favorite: e.favorite ? undefined : true } : e)),
    });
  }

  const startNew = useCallback(() => {
    setDialog(null);
    setEditing({});
  }, []);

  // ── Familie ────────────────────────────────

  function saveMember(member: Member) {
    if (!data) return;
    const exists = data.members.some((m) => m.id === member.id);
    persist({
      ...data,
      members: exists ? data.members.map((m) => (m.id === member.id ? member : m)) : [...data.members, member],
    });
    setDialog(null);
  }

  function deleteMember(id: string) {
    if (!data) return;
    const member = data.members.find((m) => m.id === id);
    persist({
      ...data,
      members: data.members.filter((m) => m.id !== id),
      entries: data.entries.map((e) =>
        e.memberIds.includes(id) ? { ...e, memberIds: e.memberIds.filter((x) => x !== id) } : e,
      ),
    });
    if (filter.kind === "member" && filter.memberId === id) setFilter({ kind: "all" });
    setDialog(null);
    toast(`${member?.name ?? "Person"} entfernt`);
  }

  // ── Tastatur (bewusst ohne Animation) ──────

  useEffect(() => {
    if (phase !== "unlocked") return;
    function onKey(ev: KeyboardEvent) {
      if (dialog) return; // Dialog hat eigene Tasten
      const mod = ev.ctrlKey || ev.metaKey;
      const key = ev.key.toLowerCase();

      if (mod && key === "l") {
        ev.preventDefault();
        lock();
        return;
      }
      if (editing) return; // Editor kümmert sich um Strg+S / Esc

      if (mod && (key === "f" || key === "k")) {
        ev.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (mod && key === "n") {
        ev.preventDefault();
        startNew();
      } else if (mod && key === "e" && selectedId) {
        ev.preventDefault();
        setEditing({ id: selectedId });
      } else if ((ev.key === "ArrowDown" || ev.key === "ArrowUp") && (!isTyping(ev.target) || ev.target === searchRef.current)) {
        const i = visible.findIndex((e) => e.id === selectedId);
        const next = ev.key === "ArrowDown" ? Math.min(i + 1, visible.length - 1) : Math.max(i - 1, 0);
        if (visible[next]) {
          ev.preventDefault();
          setSelectedId(visible[next].id);
          requestAnimationFrame(() =>
            document.querySelector(`[aria-selected="true"]`)?.scrollIntoView({ block: "nearest" }),
          );
        }
      } else if (ev.key === "Enter" && ev.target === searchRef.current && selectedId) {
        searchRef.current?.blur();
      } else if (ev.key === "Escape" && ev.target === searchRef.current) {
        setQuery("");
        searchRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, visible, selectedId, lock, editing, dialog, startNew]);

  // ── Ansicht ────────────────────────────────

  const listTitle =
    filter.kind === "all"
      ? "Alle Einträge"
      : filter.kind === "favorites"
        ? "Favoriten"
        : filter.kind === "member"
          ? (members.find((m) => m.id === filter.memberId)?.name ?? "")
          : { login: "Logins", kundennummer: "Kundennummern", wlan: "WLAN", notiz: "Notizen" }[filter.category];

  const selectedEntry = entries.find((e) => e.id === selectedId);
  const editingEntry = editing?.id ? entries.find((e) => e.id === editing.id) : undefined;

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
          onFilter={(f) => {
            setEditing(null);
            setFilter(f);
          }}
          counts={counts}
          onLock={lock}
          onSettings={() => setDialog({ kind: "settings" })}
          onAddMember={() => setDialog({ kind: "member" })}
          onEditMember={(m) => setDialog({ kind: "member", member: m })}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        />
        <EntryList
          title={listTitle}
          entries={visible}
          isEmptyVault={entries.length === 0}
          members={members}
          selectedId={editing && !editing.id ? undefined : selectedId}
          onSelect={(id) => {
            setEditing(null);
            setSelectedId(id);
          }}
          onNew={startNew}
          query={query}
          onQuery={setQuery}
          searchRef={searchRef}
        />
        {editing ? (
          <EntryEditor
            key={editing.id ?? "new"}
            entry={editingEntry}
            members={members}
            defaultMemberIds={filter.kind === "member" ? [filter.memberId] : []}
            onSave={saveEntry}
            onCancel={() => setEditing(null)}
            onDelete={editingEntry ? () => deleteEntry(editingEntry.id) : undefined}
          />
        ) : (
          <EntryDetail
            entry={selectedEntry}
            members={members}
            isEmptyVault={entries.length === 0}
            onEdit={() => selectedEntry && setEditing({ id: selectedEntry.id })}
            onNew={startNew}
            onToggleFavorite={() => selectedEntry && toggleFavorite(selectedEntry.id)}
          />
        )}

        {dialog?.kind === "member" && (
          <MemberDialog
            member={dialog.member}
            existingNames={members.map((m) => m.name)}
            entryCount={dialog.member ? (counts.member[dialog.member.id] ?? 0) : 0}
            suggestedHue={MEMBER_HUES.find((h) => !members.some((m) => m.hue === h)) ?? MEMBER_HUES[members.length % MEMBER_HUES.length]}
            onSave={saveMember}
            onDelete={dialog.member ? () => deleteMember(dialog.member!.id) : undefined}
            onClose={() => setDialog(null)}
          />
        )}
        {dialog?.kind === "settings" && status && (
          <SettingsDialog
            helloSupported={status.helloSupported}
            helloEnabled={status.helloEnabled}
            onHelloChanged={(on) => setStatus({ ...status, helloEnabled: on })}
            onClose={() => setDialog(null)}
          />
        )}
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
