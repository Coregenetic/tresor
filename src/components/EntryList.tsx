import { Plus, Search } from "lucide-react";
import type { RefObject } from "react";
import type { Entry, Member } from "../lib/types";
import { AvatarStack } from "./Avatar";
import { ProviderLogo } from "./ProviderLogo";

interface Props {
  title: string;
  entries: Entry[];
  members: Member[];
  selectedId?: string;
  onSelect: (id: string) => void;
  query: string;
  onQuery: (q: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
}

function subtitle(e: Entry) {
  if (e.category === "kundennummer" && e.customerNumber) return `Nr. ${e.customerNumber}`;
  return e.username ?? e.customerNumber ?? e.domain ?? "";
}

export function EntryList({ title, entries, members, selectedId, onSelect, query, onQuery, searchRef }: Props) {
  const byId = new Map(members.map((m) => [m.id, m]));

  return (
    <section className="list-pane">
      <header className="list-head">
        <div className="list-title-row">
          <h1 className="list-title">{title}</h1>
          <button className="primary-btn primary-btn--sm" title="Neuer Eintrag (kommt in Etappe 3)">
            <Plus size={14} strokeWidth={2.4} />
            Neu
          </button>
        </div>
        <label className="search">
          <Search size={14} className="search-icon" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Suchen…"
            spellCheck={false}
          />
          <kbd>Strg F</kbd>
        </label>
      </header>

      <div className="list-scroll" role="listbox" aria-label="Einträge">
        {entries.length === 0 && (
          <div className="empty">
            <p>Keine Einträge gefunden.</p>
            {query && <span>Andere Schreibweise oder Filter probieren.</span>}
          </div>
        )}
        {entries.map((e) => (
          <button
            key={e.id}
            role="option"
            aria-selected={e.id === selectedId}
            className="row"
            data-active={e.id === selectedId || undefined}
            onClick={() => onSelect(e.id)}
          >
            <ProviderLogo title={e.title} domain={e.domain} size={34} />
            <span className="row-text">
              <span className="row-title">{e.title}</span>
              <span className="row-sub">{subtitle(e)}</span>
            </span>
            <AvatarStack members={e.memberIds.map((id) => byId.get(id)).filter((m): m is Member => !!m)} size={18} />
          </button>
        ))}
      </div>
    </section>
  );
}
