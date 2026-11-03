import { Hash, KeyRound, Layers, Lock, Moon, Pencil, Plus, Settings, Star, StickyNote, Sun, Wifi } from "lucide-react";
import type { ReactNode } from "react";
import type { Category, Member } from "../lib/types";
import { Avatar } from "./Avatar";

export type Filter =
  | { kind: "all" }
  | { kind: "favorites" }
  | { kind: "category"; category: Category }
  | { kind: "member"; memberId: string };

interface Props {
  members: Member[];
  filter: Filter;
  onFilter: (f: Filter) => void;
  counts: { all: number; favorites: number; category: Record<Category, number>; member: Record<string, number> };
  onLock: () => void;
  onSettings: () => void;
  onAddMember: () => void;
  onEditMember: (m: Member) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

const same = (a: Filter, b: Filter) => JSON.stringify(a) === JSON.stringify(b);

export function Sidebar(props: Props) {
  const { members, filter, onFilter, counts, onLock, onSettings, onAddMember, onEditMember, theme, onToggleTheme } =
    props;

  const Item = ({ f, icon, label, count }: { f: Filter; icon: ReactNode; label: string; count: number }) => (
    <button className="nav-item" data-active={same(f, filter) || undefined} onClick={() => onFilter(f)}>
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
      <span className="nav-count">{count}</span>
    </button>
  );

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <KeyRound size={15} strokeWidth={2.2} />
        </div>
        <span>Tresor</span>
      </div>

      <nav className="nav">
        <Item f={{ kind: "all" }} icon={<Layers size={15} />} label="Alle Einträge" count={counts.all} />
        <Item f={{ kind: "favorites" }} icon={<Star size={15} />} label="Favoriten" count={counts.favorites} />
      </nav>

      <div className="nav-section nav-section--action">
        <span>Familie</span>
        <button className="mini-btn" onClick={onAddMember} aria-label="Person hinzufügen" title="Person hinzufügen">
          <Plus size={13} strokeWidth={2.4} />
        </button>
      </div>
      <nav className="nav">
        {members.map((m) => (
          <div key={m.id} className="nav-row">
            <button
              className="nav-item"
              data-active={same({ kind: "member", memberId: m.id }, filter) || undefined}
              onClick={() => onFilter({ kind: "member", memberId: m.id })}
            >
              <span className="nav-icon">
                <Avatar member={m} size={18} />
              </span>
              <span className="nav-label">{m.name}</span>
              <span className="nav-count">{counts.member[m.id] ?? 0}</span>
            </button>
            <button
              className="mini-btn nav-edit"
              onClick={() => onEditMember(m)}
              aria-label={`${m.name} bearbeiten`}
              title="Bearbeiten"
            >
              <Pencil size={12} />
            </button>
          </div>
        ))}
        {members.length === 0 && (
          <button className="nav-item nav-item--hint" onClick={onAddMember}>
            <span className="nav-icon">
              <Plus size={14} />
            </span>
            <span className="nav-label">Person hinzufügen</span>
          </button>
        )}
      </nav>

      <div className="nav-section">Kategorien</div>
      <nav className="nav">
        <Item f={{ kind: "category", category: "login" }} icon={<KeyRound size={15} />} label="Logins" count={counts.category.login} />
        <Item f={{ kind: "category", category: "kundennummer" }} icon={<Hash size={15} />} label="Kundennummern" count={counts.category.kundennummer} />
        <Item f={{ kind: "category", category: "wlan" }} icon={<Wifi size={15} />} label="WLAN" count={counts.category.wlan} />
        <Item f={{ kind: "category", category: "notiz" }} icon={<StickyNote size={15} />} label="Notizen" count={counts.category.notiz} />
      </nav>

      <div className="sidebar-foot">
        <button className="ghost-btn" onClick={onLock} title="Sperren (Strg+L)">
          <Lock size={14} />
          Sperren
        </button>
        <div className="sidebar-foot-icons">
          <button className="icon-btn" onClick={onSettings} aria-label="Einstellungen" title="Einstellungen">
            <Settings size={15} />
          </button>
          <button className="icon-btn" onClick={onToggleTheme} aria-label="Farbschema wechseln" title="Farbschema wechseln">
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>
    </aside>
  );
}
