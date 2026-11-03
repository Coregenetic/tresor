import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { EntryDetail } from "./components/EntryDetail";
import { EntryEditor } from "./components/EntryEditor";
import { EntryList } from "./components/EntryList";
import { Home } from "./components/Home";
import { LockScreen } from "./components/LockScreen";
import { MEMBER_HUES, MemberDialog } from "./components/MemberDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { SetupScreen } from "./components/SetupScreen";
import { Sidebar, type Filter } from "./components/Sidebar";
import { api, errorText, isTauri, type VaultData, type VaultStatus } from "./lib/api";
import { analyze, ISSUE_LABEL, type HealthReport } from "./lib/health";
import { checkForUpdate, dueContracts, notifyDueContracts, type AvailableUpdate } from "./lib/system";
import type { Category, Entry, Member, Settings } from "./lib/types";

type Phase = "loading" | "setup" | "locked" | "unlocked" | "error";
type Editing = null | { id?: string };
type Dialog = null | { kind: "settings" } | { kind: "member"; member?: Member };

const HOME: Filter = { kind: "home" };

function matches(e: Entry, q: string) {
  if (!q) return true;
  const hay = [e.title, e.domain, e.username, e.customerNumber, e.notes, e.iban]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((w) => hay.includes(w));
}

function passesFilter(e: Entry, filter: Filter, health: HealthReport) {
  switch (filter.kind) {
    case "favorites":
      return !!e.favorite;
    case "category":
      return e.category === filter.category;
    case "member":
      return e.memberIds.includes(filter.memberId);
    case "health":
      return health[filter.issue].has(e.id);
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

  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const updateChecked = useRef(false);
  const [freshId, setFreshId] = useState<string | undefined>();
  const [filter, setFilter] = useState<Filter>(HOME);
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

  /** Änderungen sofort anzeigen und der Reihe nach verschlüsselt speichern. */
  const persist = useCallback((next: VaultData) => {
    setData(next);
    saveChain.current = saveChain.current
      .then(() => api.save(next))
      .catch((e) => toast.error("Speichern fehlgeschlagen", { description: errorText(e) }));
  }, []);

  /** Oberfläche auf "gesperrt" zurücksetzen (der Kern ist dann schon gesperrt). */
  const showLocked = useCallback(async () => {
    setData(null);
    setQuery("");
    setSelectedId(undefined);
    setEditing(null);
    setDialog(null);
    setFilter(HOME);
    setFirstLock(false);
    const s = await api.status().catch(() => null);
    if (s) setStatus(s);
    setPhase("locked");
  }, []);

  const lock = useCallback(async () => {
    await saveChain.current; // nichts verlieren, was noch gespeichert wird
    await api.lock().catch(() => undefined);
    await showLocked();
  }, [showLocked]);

  const enterUnlocked = useCallback((next: VaultData) => {
    setData(next);
    setFilter(HOME);
    setPhase("unlocked");
    api.setLockOnMinimize(next.settings.lockOnMinimize).catch(() => undefined);
    notifyDueContracts(next.entries).catch(() => undefined);
    // Einmal pro Programmstart still nach Updates schauen
    if (!updateChecked.current) {
      updateChecked.current = true;
      checkForUpdate()
        .then((u) => {
          if (!u) return;
          setUpdate(u);
          toast(`Version ${u.version} ist verfügbar`, {
            id: "update",
            duration: 10_000,
            action: { label: "Aktualisieren", onClick: () => installUpdate(u) },
          });
        })
        .catch(() => undefined);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function installUpdate(u: AvailableUpdate) {
    const id = toast.loading("Update wird geladen…", { id: "update" });
    u.install((p) => toast.loading(`Update wird geladen… ${Math.round(p * 100)} %`, { id }))
      .catch((e) => toast.error("Update fehlgeschlagen", { id, description: errorText(e) }));
  }

  // Rust sperrt beim Minimieren selbst und meldet das hier
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    import("@tauri-apps/api/event").then(({ listen }) =>
      listen("vault-locked", () => showLocked()).then((u) => (unlisten = u)),
    );
    return () => unlisten?.();
  }, [showLocked]);

  // Auto-Sperre nach Inaktivität
  const autoLockMinutes = data?.settings.autoLockMinutes ?? 0;
  useEffect(() => {
    if (phase !== "unlocked" || autoLockMinutes <= 0) return;
    let last = Date.now();
    const touch = () => (last = Date.now());
    const events = ["pointermove", "pointerdown", "keydown", "wheel"] as const;
    events.forEach((ev) => window.addEventListener(ev, touch, { passive: true }));
    const timer = window.setInterval(() => {
      if (Date.now() - last > autoLockMinutes * 60_000) {
        lock();
        toast("Automatisch gesperrt", { id: "auto-lock", description: `Nach ${autoLockMinutes} Min. ohne Aktivität.` });
      }
    }, 10_000);
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, touch));
      window.clearInterval(timer);
    };
  }, [phase, autoLockMinutes, lock]);

  const members = data?.members ?? [];
  const entries = data?.entries ?? [];
  const health = useMemo(() => analyze(entries), [entries]);
  const due = useMemo(() => dueContracts(entries), [entries]);

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
        .filter((e) => passesFilter(e, filter, health) && matches(e, query.trim()))
        .sort((a, b) => a.title.localeCompare(b.title, "de")),
    [entries, filter, query, health],
  );

  useEffect(() => {
    if (filter.kind === "home") return;
    if (editing && editing.id === undefined) return; // neuer Eintrag: Auswahl nicht anfassen
    if (!visible.some((e) => e.id === selectedId)) setSelectedId(visible[0]?.id);
  }, [visible, selectedId, editing, filter.kind]);

  // ── Einträge ───────────────────────────────

  function saveEntry(entry: Entry) {
    if (!data) return;
    const exists = data.entries.some((e) => e.id === entry.id);
    const nextEntries = exists ? data.entries.map((e) => (e.id === entry.id ? entry : e)) : [...data.entries, entry];
    persist({ ...data, entries: nextEntries });
    if (!passesFilter(entry, filter, analyze(nextEntries))) setFilter({ kind: "all" });
    if (!matches(entry, query.trim())) setQuery("");
    setSelectedId(entry.id);
    setEditing(null);
    setFreshId(entry.id);
    window.setTimeout(() => setFreshId((id) => (id === entry.id ? undefined : id)), 1200);
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

  function updateEntry(id: string, patch: (e: Entry) => Entry) {
    if (!data) return;
    persist({ ...data, entries: data.entries.map((e) => (e.id === id ? patch(e) : e)) });
  }

  const startNew = useCallback(() => {
    setDialog(null);
    setFilter((f) => (f.kind === "home" || f.kind === "health" ? { kind: "all" } : f));
    setEditing({});
  }, []);

  function openEntry(id: string) {
    setQuery("");
    setFilter({ kind: "all" });
    setSelectedId(id);
    setEditing(null);
  }

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
    if (filter.kind === "member" && filter.memberId === id) setFilter(HOME);
    setDialog(null);
    toast(`${member?.name ?? "Person"} entfernt`);
  }

  // ── Einstellungen & Backup ─────────────────

  function updateSettings(settings: Settings) {
    if (!data) return;
    persist({ ...data, settings });
    api.setLockOnMinimize(settings.lockOnMinimize).catch(() => undefined);
  }

  /** Fehlende Einträge und Personen ergänzen – Vorhandenes bleibt unangetastet. */
  function importData(incoming: VaultData) {
    if (!data) return { entries: 0, members: 0 };
    const memberIds = new Set(data.members.map((m) => m.id));
    const entryIds = new Set(data.entries.map((e) => e.id));
    const newMembers = incoming.members.filter((m) => !memberIds.has(m.id));
    const newEntries = incoming.entries.filter((e) => !entryIds.has(e.id));
    if (newMembers.length || newEntries.length) {
      persist({ ...data, members: [...data.members, ...newMembers], entries: [...data.entries, ...newEntries] });
    }
    return { entries: newEntries.length, members: newMembers.length };
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
        const target = filter.kind === "home" ? document.getElementById("home-search") : searchRef.current;
        (target as HTMLInputElement | null)?.focus();
        (target as HTMLInputElement | null)?.select();
      } else if (mod && key === "n") {
        ev.preventDefault();
        startNew();
      } else if (filter.kind === "home") {
        return;
      } else if (mod && key === "e" && selectedId) {
        ev.preventDefault();
        setEditing({ id: selectedId });
      } else if (
        (ev.key === "ArrowDown" || ev.key === "ArrowUp") &&
        (!isTyping(ev.target) || ev.target === searchRef.current)
      ) {
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
  }, [phase, visible, selectedId, lock, editing, dialog, startNew, filter.kind]);

  // ── Ansicht ────────────────────────────────

  const listTitle = (() => {
    switch (filter.kind) {
      case "favorites":
        return "Favoriten";
      case "member":
        return members.find((m) => m.id === filter.memberId)?.name ?? "";
      case "category":
        return { login: "Logins", kundennummer: "Kundennummern", wlan: "WLAN", notiz: "Notizen" }[filter.category];
      case "health":
        return ISSUE_LABEL[filter.issue];
      default:
        return "Alle Einträge";
    }
  })();

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
          setStatus({ ...status, exists: true, unlocked: true, helloEnabled: result.helloEnabled });
          enterUnlocked(pending.current!);
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
          enterUnlocked(pending.current!);
          pending.current = null;
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
        />

        {filter.kind === "home" && !editing ? (
          <Home
            entries={entries}
            members={members}
            health={health}
            memberCounts={counts.member}
            due={due}
            helloEnabled={!!status?.helloEnabled}
            update={update}
            onInstallUpdate={() => update && installUpdate(update)}
            onSearch={(q) => {
              setQuery(q);
              setFilter({ kind: "all" });
              // Fokus wandert in die Listensuche, Weitertippen geht nahtlos
              requestAnimationFrame(() => searchRef.current?.focus());
            }}
            onOpen={openEntry}
            onMember={(id) => setFilter({ kind: "member", memberId: id })}
            onIssue={(issue) => setFilter({ kind: "health", issue })}
            onNew={startNew}
            onAddMember={() => setDialog({ kind: "member" })}
          />
        ) : (
          <>
            <EntryList
              title={listTitle}
              entries={visible}
              isEmptyVault={entries.length === 0}
              members={members}
              selectedId={editing && !editing.id ? undefined : selectedId}
              freshId={freshId}
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
                onToggleFavorite={() =>
                  selectedEntry && updateEntry(selectedEntry.id, (e) => ({ ...e, favorite: e.favorite ? undefined : true }))
                }
                onUsed={() =>
                  selectedEntry && updateEntry(selectedEntry.id, (e) => ({ ...e, usedAt: new Date().toISOString() }))
                }
              />
            )}
          </>
        )}

        {dialog?.kind === "member" && (
          <MemberDialog
            member={dialog.member}
            existingNames={members.map((m) => m.name)}
            entryCount={dialog.member ? (counts.member[dialog.member.id] ?? 0) : 0}
            suggestedHue={
              MEMBER_HUES.find((h) => !members.some((m) => m.hue === h)) ?? MEMBER_HUES[members.length % MEMBER_HUES.length]
            }
            onSave={saveMember}
            onDelete={dialog.member ? () => deleteMember(dialog.member!.id) : undefined}
            onClose={() => setDialog(null)}
          />
        )}
        {dialog?.kind === "settings" && status && (
          <SettingsDialog
            settings={data.settings}
            onSettingsChange={updateSettings}
            helloSupported={status.helloSupported}
            helloEnabled={status.helloEnabled}
            onHelloChanged={(on) => setStatus({ ...status, helloEnabled: on })}
            onImport={importData}
            onClose={() => setDialog(null)}
          />
        )}
      </div>
    );
  }

  return (
    <>
      {screen}
      <Toaster position="bottom-right" theme="dark" toastOptions={{ className: "toast" }} />
    </>
  );
}
