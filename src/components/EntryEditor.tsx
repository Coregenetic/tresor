import { Check, Dices, Eye, EyeOff, Hash, KeyRound, StickyNote, Star, Trash2, Wifi } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { domainFrom } from "../lib/logo";
import { generatePassword } from "../lib/password";
import type { Category, Entry, Member } from "../lib/types";
import { Avatar } from "./Avatar";
import { HoldButton } from "./HoldButton";
import { ProviderLogo } from "./ProviderLogo";

interface Props {
  /** undefined = neuer Eintrag */
  entry?: Entry;
  members: Member[];
  defaultMemberIds: string[];
  onSave: (entry: Entry) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

const CATEGORIES: { value: Category; label: string; icon: ReactNode }[] = [
  { value: "login", label: "Login", icon: <KeyRound size={14} /> },
  { value: "kundennummer", label: "Kundennummer", icon: <Hash size={14} /> },
  { value: "wlan", label: "WLAN", icon: <Wifi size={14} /> },
  { value: "notiz", label: "Notiz", icon: <StickyNote size={14} /> },
];

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function EntryEditor({ entry, members, defaultMemberIds, onSave, onCancel, onDelete }: Props) {
  const isNew = !entry;
  const [title, setTitle] = useState(entry?.title ?? "");
  const [category, setCategory] = useState<Category>(entry?.category ?? "login");
  const [url, setUrl] = useState(entry?.url ?? (entry?.domain ? entry.domain : ""));
  const [username, setUsername] = useState(entry?.username ?? "");
  const [password, setPassword] = useState(entry?.password ?? "");
  const [customerNumber, setCustomerNumber] = useState(entry?.customerNumber ?? "");
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [memberIds, setMemberIds] = useState<string[]>(entry?.memberIds ?? defaultMemberIds);
  const [favorite, setFavorite] = useState(!!entry?.favorite);
  const [showPw, setShowPw] = useState(isNew);
  const titleRef = useRef<HTMLInputElement>(null);

  // Logo erst laden, wenn kurz nicht mehr getippt wird
  const debouncedUrl = useDebounced(url, 450);
  const domain = useMemo(() => domainFrom(debouncedUrl), [debouncedUrl]);

  const canSave = title.trim().length > 0;

  function save(e?: FormEvent) {
    e?.preventDefault();
    if (!canSave) {
      titleRef.current?.focus();
      return;
    }
    const clean = (s: string) => s.trim() || undefined;
    onSave({
      id: entry?.id ?? crypto.randomUUID(),
      title: title.trim(),
      category,
      domain: domainFrom(url),
      url: clean(url),
      username: clean(username),
      password: password || undefined,
      customerNumber: clean(customerNumber),
      notes: clean(notes),
      memberIds,
      favorite: favorite || undefined,
      updatedAt: new Date().toISOString(),
    });
  }

  // Strg+S speichert, Esc bricht ab
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === "s") {
        ev.preventDefault();
        save();
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const userLabel = category === "wlan" ? "Netzwerkname" : "Benutzername / E-Mail";
  const pwLabel = category === "wlan" ? "WLAN-Schlüssel" : "Passwort";

  return (
    <section className="detail-pane">
      <form className="editor" onSubmit={save}>
        <header className="detail-head">
          <ProviderLogo title={title || "?"} domain={domain} size={56} />
          <div className="detail-head-text">
            <input
              ref={titleRef}
              className="title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Anbieter, z. B. Telekom"
              autoFocus={isNew}
              maxLength={80}
            />
            <div className="detail-meta">
              <span className="detail-domain">{domain ?? "Logo erscheint, sobald eine Website eingetragen ist"}</span>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn fav-btn"
            data-on={favorite || undefined}
            onClick={() => setFavorite((f) => !f)}
            aria-label="Favorit"
            title="Favorit"
          >
            <Star size={16} fill={favorite ? "currentColor" : "none"} />
          </button>
        </header>

        <div className="segmented" role="radiogroup" aria-label="Kategorie">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={category === c.value}
              className="segment"
              data-active={category === c.value || undefined}
              onClick={() => setCategory(c.value)}
            >
              {c.icon}
              {c.label}
            </button>
          ))}
        </div>

        <div className="card card--form">
          {category !== "notiz" && (
            <>
              <label className="form-field">
                <span className="field-label">Website</span>
                <input
                  className="input"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="telekom.de"
                  spellCheck={false}
                  autoComplete="off"
                />
              </label>
              <label className="form-field">
                <span className="field-label">{userLabel}</span>
                <input
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                />
              </label>
              <div className="form-field">
                <span className="field-label">{pwLabel}</span>
                <div className="input-group">
                  <input
                    className="input input--mono"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    spellCheck={false}
                    autoComplete="new-password"
                    aria-label={pwLabel}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setShowPw((s) => !s)}
                    aria-label={showPw ? "Verbergen" : "Anzeigen"}
                    title={showPw ? "Verbergen" : "Anzeigen"}
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => {
                      setPassword(generatePassword());
                      setShowPw(true);
                    }}
                    aria-label="Sicheres Passwort erzeugen"
                    title="Sicheres Passwort erzeugen"
                  >
                    <Dices size={15} />
                  </button>
                </div>
              </div>
              {category !== "wlan" && (
                <label className="form-field">
                  <span className="field-label">Kundennummer</span>
                  <input
                    className="input input--mono"
                    value={customerNumber}
                    onChange={(e) => setCustomerNumber(e.target.value)}
                    spellCheck={false}
                    autoComplete="off"
                  />
                </label>
              )}
            </>
          )}
          <label className="form-field">
            <span className="field-label">Notizen</span>
            <textarea
              className="input textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={category === "notiz" ? 8 : 3}
              placeholder={category === "notiz" ? "Sichere Notiz…" : "z. B. Vertragslaufzeit, Sicherheitsfragen"}
            />
          </label>
        </div>

        <div className="detail-section-label">Gehört zu</div>
        <div className="owners">
          {members.length === 0 && <span className="owners-empty">Lege in der Seitenleiste Personen an.</span>}
          {members.map((m) => {
            const on = memberIds.includes(m.id);
            return (
              <button
                type="button"
                key={m.id}
                className="owner owner--toggle"
                data-on={on || undefined}
                aria-pressed={on}
                onClick={() => setMemberIds((ids) => (on ? ids.filter((x) => x !== m.id) : [...ids, m.id]))}
              >
                <Avatar member={m} size={20} />
                {m.name}
                <span className="owner-check">
                  <Check size={12} strokeWidth={3} />
                </span>
              </button>
            );
          })}
        </div>

        <footer className="editor-foot">
          {onDelete ? (
            <HoldButton onConfirm={onDelete}>
              <Trash2 size={14} />
              Halten zum Löschen
            </HoldButton>
          ) : (
            <span />
          )}
          <div className="editor-actions">
            <button type="button" className="ghost-btn" onClick={onCancel}>
              Abbrechen
            </button>
            <button type="submit" className="primary-btn" disabled={!canSave} title="Speichern (Strg+S)">
              {isNew ? "Anlegen" : "Speichern"}
            </button>
          </div>
        </footer>
      </form>
    </section>
  );
}
