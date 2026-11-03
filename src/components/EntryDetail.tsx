import { Eye, EyeOff, ExternalLink, Pencil, Plus, Star } from "lucide-react";
import { useState } from "react";
import { openExternal } from "../lib/open";
import { CATEGORY_LABEL, type Entry, type Member } from "../lib/types";
import { Avatar } from "./Avatar";
import { CopyButton } from "./CopyButton";
import { ProviderLogo } from "./ProviderLogo";

interface Props {
  entry?: Entry;
  members: Member[];
  isEmptyVault: boolean;
  onEdit: () => void;
  onNew: () => void;
  onToggleFavorite: () => void;
  onUsed: () => void;
}

function relative(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "heute";
  if (days === 1) return "gestern";
  if (days < 30) return `vor ${days} Tagen`;
  const months = Math.round(days / 30);
  return months === 1 ? "vor einem Monat" : `vor ${months} Monaten`;
}

function Field({ label, value, mono, onUsed }: { label: string; value: string; mono?: boolean; onUsed: () => void }) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div className="field-row">
        <div className={mono ? "field-value field-value--mono" : "field-value"}>{value}</div>
        <div className="field-actions">
          <CopyButton value={value} label={label} onCopied={onUsed} />
        </div>
      </div>
    </div>
  );
}

function PasswordField({ value, onUsed }: { value: string; onUsed: () => void }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="field">
      <div className="field-label">Passwort</div>
      <div className="field-row">
        <div className="field-value field-value--mono">
          <span className="swap swap--text" data-state={shown ? "b" : "a"}>
            <span className="swap-a">{"•".repeat(Math.min(value.length, 14))}</span>
            <span className="swap-b">{value}</span>
          </span>
        </div>
        <div className="field-actions">
          <button
            className="icon-btn"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? "Passwort verbergen" : "Passwort anzeigen"}
            title={shown ? "Verbergen" : "Anzeigen"}
          >
            {shown ? <EyeOff size={15} strokeWidth={1.8} /> : <Eye size={15} strokeWidth={1.8} />}
          </button>
          <CopyButton value={value} label="Passwort" onCopied={onUsed} />
        </div>
      </div>
    </div>
  );
}

export function EntryDetail({ entry, members, isEmptyVault, onEdit, onNew, onToggleFavorite, onUsed }: Props) {
  if (!entry) {
    return (
      <section className="detail-pane detail-pane--empty">
        {isEmptyVault ? (
          <div className="welcome">
            <p className="welcome-title">Leg deinen ersten Zugang an</p>
            <p className="welcome-sub">Login, Kundennummer oder WLAN – alles landet verschlüsselt im Tresor.</p>
            <button className="primary-btn" onClick={onNew}>
              <Plus size={15} strokeWidth={2.4} />
              Neuer Eintrag
            </button>
          </div>
        ) : (
          <p>Wähle links einen Eintrag aus.</p>
        )}
      </section>
    );
  }

  const owners = members.filter((m) => entry.memberIds.includes(m.id));
  const hasCredentials = entry.username || entry.password || entry.customerNumber || entry.url;

  return (
    // key = Eintrag-ID: Beim Wechsel wird das Passwort automatisch wieder verborgen
    <section className="detail-pane" key={entry.id}>
      <header className="detail-head">
        <ProviderLogo title={entry.title} domain={entry.domain} size={56} />
        <div className="detail-head-text">
          <div className="detail-title-row">
            <h2 className="detail-title">{entry.title}</h2>
            <button
              className="icon-btn fav-btn"
              data-on={entry.favorite || undefined}
              onClick={onToggleFavorite}
              aria-label={entry.favorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
              title={entry.favorite ? "Aus Favoriten entfernen" : "Zu Favoriten"}
            >
              <Star size={16} fill={entry.favorite ? "currentColor" : "none"} />
            </button>
          </div>
          <div className="detail-meta">
            <span className="chip">{CATEGORY_LABEL[entry.category]}</span>
            {entry.domain && <span className="detail-domain">{entry.domain}</span>}
          </div>
        </div>
        <button className="ghost-btn ghost-btn--boxed" onClick={onEdit} title="Bearbeiten (Strg+E)">
          <Pencil size={14} />
          Bearbeiten
        </button>
      </header>

      {hasCredentials && (
        <div className="card">
          {entry.username && (
            <Field label={entry.category === "wlan" ? "Netzwerkname" : "Benutzername"} value={entry.username} onUsed={onUsed} />
          )}
          {entry.password && <PasswordField value={entry.password} onUsed={onUsed} />}
          {entry.customerNumber && <Field label="Kundennummer" value={entry.customerNumber} mono onUsed={onUsed} />}
          {entry.url && (
            <div className="field">
              <div className="field-label">Website</div>
              <div className="field-row">
                <button
                  className="field-value field-link"
                  onClick={() => {
                    openExternal(entry.url!);
                    onUsed();
                  }}
                >
                  {entry.url.replace(/^https?:\/\//, "")}
                </button>
                <div className="field-actions">
                  <button className="icon-btn" onClick={() => openExternal(entry.url!)} aria-label="Website öffnen">
                    <ExternalLink size={15} strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {entry.notes && (
        <div className="card card--notes">
          <div className="field-label">Notizen</div>
          <p>{entry.notes}</p>
        </div>
      )}

      <div className="detail-section-label">Gehört zu</div>
      <div className="owners">
        {owners.length === 0 && <span className="owners-empty">Niemandem zugeordnet</span>}
        {owners.map((m) => (
          <span key={m.id} className="owner">
            <Avatar member={m} size={20} />
            {m.name}
          </span>
        ))}
      </div>

      <footer className="detail-foot">Zuletzt geändert {relative(entry.updatedAt)}</footer>
    </section>
  );
}
