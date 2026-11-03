import { Eye, EyeOff, ExternalLink, Pencil, Star } from "lucide-react";
import { useState } from "react";
import { CATEGORY_LABEL, type Entry, type Member } from "../lib/types";
import { Avatar } from "./Avatar";
import { CopyButton } from "./CopyButton";
import { ProviderLogo } from "./ProviderLogo";

interface Props {
  entry?: Entry;
  members: Member[];
}

function relative(iso: string) {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "heute";
  if (days === 1) return "gestern";
  if (days < 30) return `vor ${days} Tagen`;
  const months = Math.round(days / 30);
  return months === 1 ? "vor einem Monat" : `vor ${months} Monaten`;
}

function Field({ label, value, mono, children }: { label: string; value: string; mono?: boolean; children?: React.ReactNode }) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div className="field-row">
        <div className={mono ? "field-value field-value--mono" : "field-value"}>{children ?? value}</div>
        <div className="field-actions">
          <CopyButton value={value} label={label} />
        </div>
      </div>
    </div>
  );
}

function PasswordField({ value }: { value: string }) {
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
          <CopyButton value={value} label="Passwort" />
        </div>
      </div>
    </div>
  );
}

export function EntryDetail({ entry, members }: Props) {
  if (!entry) {
    return (
      <section className="detail-pane detail-pane--empty">
        <p>Wähle links einen Eintrag aus.</p>
      </section>
    );
  }

  const owners = members.filter((m) => entry.memberIds.includes(m.id));

  return (
    // key = Eintrag-ID: Beim Wechsel wird das Passwort automatisch wieder verborgen
    <section className="detail-pane" key={entry.id}>
      <header className="detail-head">
        <ProviderLogo title={entry.title} domain={entry.domain} size={56} />
        <div className="detail-head-text">
          <div className="detail-title-row">
            <h2 className="detail-title">{entry.title}</h2>
            {entry.favorite && <Star size={15} className="fav-star" fill="currentColor" />}
          </div>
          <div className="detail-meta">
            <span className="chip">{CATEGORY_LABEL[entry.category]}</span>
            {entry.domain && <span className="detail-domain">{entry.domain}</span>}
          </div>
        </div>
        <button className="ghost-btn" title="Bearbeiten (kommt in Etappe 3)">
          <Pencil size={14} />
          Bearbeiten
        </button>
      </header>

      <div className="card">
        {entry.username && <Field label={entry.category === "wlan" ? "Netzwerk" : "Benutzername"} value={entry.username} />}
        {entry.password && <PasswordField value={entry.password} />}
        {entry.customerNumber && <Field label="Kundennummer" value={entry.customerNumber} mono />}
        {entry.url && (
          <div className="field">
            <div className="field-label">Website</div>
            <div className="field-row">
              <a className="field-value field-link" href={entry.url} target="_blank" rel="noreferrer">
                {entry.url.replace(/^https?:\/\//, "")}
              </a>
              <div className="field-actions">
                <a className="icon-btn" href={entry.url} target="_blank" rel="noreferrer" aria-label="Website öffnen">
                  <ExternalLink size={15} strokeWidth={1.8} />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {entry.notes && (
        <div className="card card--notes">
          <div className="field-label">Notizen</div>
          <p>{entry.notes}</p>
        </div>
      )}

      <div className="detail-section-label">Gehört zu</div>
      <div className="owners">
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
