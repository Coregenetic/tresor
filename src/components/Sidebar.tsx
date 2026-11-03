import { KeyRound, Hash, Layers, Lock, Moon, Star, StickyNote, Sun, Wifi } from "lucide-react";
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
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

const same = (a: Filter, b: Filter) => JSON.stringify(a) === JSON.stringify(b);

export function Sidebar({ members, filter, onFilter, counts, onLock, theme, onToggleTheme }: Props) {
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

      <div className="nav-section">Familie</div>
      <nav className="nav">
        {members.map((m) => (
          <button
            key={m.id}
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
        ))}
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
        <button className="icon-btn" onClick={onToggleTheme} aria-label="Farbschema wechseln" title="Farbschema wechseln">
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </aside>
  );
}
