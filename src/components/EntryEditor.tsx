import {
  CalendarClock,
  Check,
  Dices,
  Eye,
  EyeOff,
  Hash,
  HelpCircle,
  KeyRound,
  Landmark,
  Plus,
  Star,
  StickyNote,
  Trash2,
  Wifi,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { formatIban, isValidIban } from "../lib/format";
import { domainFrom } from "../lib/logo";
import type { Category, Entry, Member, SecurityQuestion } from "../lib/types";
import { Avatar } from "./Avatar";
import { HoldButton } from "./HoldButton";
import { PasswordGenerator } from "./PasswordGenerator";
import { ProviderLogo } from "./ProviderLogo";
import { Segmented } from "./Segmented";

interface Props {
  /** undefined = neuer Eintrag */
  entry?: Entry;
  members: Member[];
  defaultMemberIds: string[];
  onSave: (entry: Entry) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

type Extra = "pin" | "iban" | "contract" | "questions";

const EXTRA_LABEL: Record<Extra, { label: string; icon: React.ReactNode }> = {
  pin: { label: "PIN", icon: <Hash size={13} /> },
  iban: { label: "IBAN", icon: <Landmark size={13} /> },
  contract: { label: "Vertragsende", icon: <CalendarClock size={13} /> },
  questions: { label: "Sicherheitsfrage", icon: <HelpCircle size={13} /> },
};

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

function SecretInput({
  value,
  onChange,
  label,
  shown,
  onToggle,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  shown: boolean;
  onToggle: () => void;
  inputMode?: "numeric" | "text";
}) {
  return (
    <div className="input-group">
      <input
        className="input input--mono"
        type={shown ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoComplete="new-password"
        aria-label={label}
        inputMode={inputMode}
      />
      <button type="button" className="icon-btn" onClick={onToggle} aria-label={shown ? "Verbergen" : "Anzeigen"} title={shown ? "Verbergen" : "Anzeigen"}>
        {shown ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

export function EntryEditor({ entry, members, defaultMemberIds, onSave, onCancel, onDelete }: Props) {
  const isNew = !entry;
  const [title, setTitle] = useState(entry?.title ?? "");
  const [category, setCategory] = useState<Category>(entry?.category ?? "login");
  const [url, setUrl] = useState(entry?.url ?? entry?.domain ?? "");
  const [username, setUsername] = useState(entry?.username ?? "");
  const [password, setPassword] = useState(entry?.password ?? "");
  const [customerNumber, setCustomerNumber] = useState(entry?.customerNumber ?? "");
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [pin, setPin] = useState(entry?.pin ?? "");
  const [iban, setIban] = useState(entry?.iban ? formatIban(entry.iban) : "");
  const [contractEnd, setContractEnd] = useState(entry?.contractEnd ?? "");
  const [questions, setQuestions] = useState<SecurityQuestion[]>(entry?.questions ?? []);
  const [memberIds, setMemberIds] = useState<string[]>(entry?.memberIds ?? defaultMemberIds);
  const [favorite, setFavorite] = useState(!!entry?.favorite);
  const [showPw, setShowPw] = useState(isNew);
  const [showPin, setShowPin] = useState(isNew);
  const [genOpen, setGenOpen] = useState(false);
  const [extras, setExtras] = useState<Set<Extra>>(() => {
    const s = new Set<Extra>();
    if (entry?.pin) s.add("pin");
    if (entry?.iban) s.add("iban");
    if (entry?.contractEnd) s.add("contract");
    if (entry?.questions?.length) s.add("questions");
    return s;
  });
  const titleRef = useRef<HTMLInputElement>(null);

  const debouncedUrl = useDebounced(url, 450);
  const domain = useMemo(() => domainFrom(debouncedUrl), [debouncedUrl]);
  const ibanInvalid = iban.replace(/\s/g, "").length > 4 && !isValidIban(iban);
  const canSave = title.trim().length > 0;

  function addExtra(x: Extra) {
    setExtras((s) => new Set(s).add(x));
    if (x === "questions" && questions.length === 0) setQuestions([{ q: "", a: "" }]);
  }
  function removeExtra(x: Extra) {
    setExtras((s) => {
      const n = new Set(s);
      n.delete(x);
      return n;
    });
    if (x === "pin") setPin("");
    if (x === "iban") setIban("");
    if (x === "contract") setContractEnd("");
    if (x === "questions") setQuestions([]);
  }

  function save(e?: FormEvent) {
    e?.preventDefault();
    if (!canSave) {
      titleRef.current?.focus();
      return;
    }
    const clean = (s: string) => s.trim() || undefined;
    const qs = questions.filter((x) => x.q.trim() || x.a.trim()).map((x) => ({ q: x.q.trim(), a: x.a }));
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
      pin: pin || undefined,
      iban: iban.replace(/\s/g, "").toUpperCase() || undefined,
      contractEnd: contractEnd || undefined,
      questions: qs.length ? qs : undefined,
      memberIds,
      favorite: favorite || undefined,
      updatedAt: new Date().toISOString(),
      // "Alt" im Sicherheitscheck richtet sich nach der letzten Passwortänderung
      passwordChangedAt:
        entry && entry.password === (password || undefined)
          ? (entry.passwordChangedAt ?? entry.updatedAt)
          : new Date().toISOString(),
      usedAt: entry?.usedAt,
    });
  }

  // Strg+S speichert, Esc bricht ab (Generator fängt Esc selbst ab)
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "s") {
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
  const available = (Object.keys(EXTRA_LABEL) as Extra[]).filter((x) => !extras.has(x) || x === "questions");

  return (
    <section className="detail-pane">
      <form className="editor" onSubmit={save}>
        <header className="detail-head">
          <ProviderLogo title={title || "?"} domain={domain} size={60} />
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
            <Star size={17} fill={favorite ? "currentColor" : "none"} />
          </button>
        </header>

        <Segmented
          label="Kategorie"
          value={category}
          onChange={setCategory}
          options={[
            { value: "login", label: <><KeyRound size={14} />Login</> },
            { value: "kundennummer", label: <><Hash size={14} />Kundennummer</> },
            { value: "wlan", label: <><Wifi size={14} />WLAN</> },
            { value: "notiz", label: <><StickyNote size={14} />Notiz</> },
          ]}
        />

        <div className="card card--form">
          {category !== "notiz" && (
            <>
              <label className="form-field">
                <span className="field-label">Website</span>
                <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="telekom.de" spellCheck={false} autoComplete="off" />
              </label>
              <label className="form-field">
                <span className="field-label">{userLabel}</span>
                <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} spellCheck={false} autoComplete="off" />
              </label>
              <div className="form-field">
                <span className="field-label">{pwLabel}</span>
                <div className="gen-anchor">
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
                    <button type="button" className="icon-btn" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Verbergen" : "Anzeigen"} title={showPw ? "Verbergen" : "Anzeigen"}>
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      data-active={genOpen || undefined}
                      onClick={() => setGenOpen((o) => !o)}
                      aria-label="Passwort-Generator"
                      title="Passwort-Generator"
                      aria-expanded={genOpen}
                    >
                      <Dices size={15} />
                    </button>
                  </div>
                  {genOpen && (
                    <PasswordGenerator
                      onUse={(pw) => {
                        setPassword(pw);
                        setShowPw(true);
                        setGenOpen(false);
                      }}
                      onClose={() => setGenOpen(false)}
                    />
                  )}
                </div>
              </div>
              {category !== "wlan" && (
                <label className="form-field">
                  <span className="field-label">Kundennummer</span>
                  <input className="input input--mono" value={customerNumber} onChange={(e) => setCustomerNumber(e.target.value)} spellCheck={false} autoComplete="off" />
                </label>
              )}
            </>
          )}

          {extras.has("pin") && (
            <div className="form-field extra-field">
              <span className="field-label">
                PIN
                <button type="button" className="mini-btn" onClick={() => removeExtra("pin")} aria-label="PIN entfernen">
                  <X size={12} />
                </button>
              </span>
              <SecretInput value={pin} onChange={setPin} label="PIN" shown={showPin} onToggle={() => setShowPin((s) => !s)} inputMode="numeric" />
            </div>
          )}

          {extras.has("iban") && (
            <div className="form-field extra-field">
              <span className="field-label">
                IBAN
                <button type="button" className="mini-btn" onClick={() => removeExtra("iban")} aria-label="IBAN entfernen">
                  <X size={12} />
                </button>
              </span>
              <input
                className="input input--mono"
                value={iban}
                onChange={(e) => setIban(formatIban(e.target.value))}
                placeholder="DE00 0000 0000 0000 0000 00"
                spellCheck={false}
                autoComplete="off"
                aria-invalid={ibanInvalid}
              />
              {ibanInvalid && <span className="field-hint field-hint--warn">Die Prüfziffer passt nicht – bitte noch einmal kontrollieren.</span>}
            </div>
          )}

          {extras.has("contract") && (
            <div className="form-field extra-field">
              <span className="field-label">
                Vertragsende
                <button type="button" className="mini-btn" onClick={() => removeExtra("contract")} aria-label="Vertragsende entfernen">
                  <X size={12} />
                </button>
              </span>
              <input className="input input--date" type="date" value={contractEnd} onChange={(e) => setContractEnd(e.target.value)} />
              <span className="field-hint">30 Tage vorher erinnert dich Tresor daran.</span>
            </div>
          )}

          {extras.has("questions") &&
            questions.map((qa, i) => (
              <div className="form-field extra-field qa" key={i}>
                <span className="field-label">
                  Sicherheitsfrage {questions.length > 1 ? i + 1 : ""}
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => {
                      const next = questions.filter((_, j) => j !== i);
                      setQuestions(next);
                      if (next.length === 0) removeExtra("questions");
                    }}
                    aria-label="Frage entfernen"
                  >
                    <X size={12} />
                  </button>
                </span>
                <input
                  className="input"
                  value={qa.q}
                  onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))}
                  placeholder="Frage, z. B. Name des ersten Haustiers"
                />
                <input
                  className="input input--mono"
                  value={qa.a}
                  onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))}
                  placeholder="Antwort"
                  spellCheck={false}
                />
              </div>
            ))}

          <label className="form-field">
            <span className="field-label">Notizen</span>
            <textarea
              className="input textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={category === "notiz" ? 8 : 3}
              placeholder={category === "notiz" ? "Sichere Notiz…" : "z. B. Tarif, Ansprechpartner"}
            />
          </label>

          <div className="extra-chips">
            {available.map((x) => (
              <button
                type="button"
                key={x}
                className="extra-chip"
                onClick={() => (x === "questions" && extras.has("questions") ? setQuestions([...questions, { q: "", a: "" }]) : addExtra(x))}
              >
                <Plus size={12} strokeWidth={2.6} />
                {EXTRA_LABEL[x].icon}
                {x === "questions" && extras.has("questions") ? "Weitere Frage" : EXTRA_LABEL[x].label}
              </button>
            ))}
          </div>
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
