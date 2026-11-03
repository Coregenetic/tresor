import { AlertTriangle, ArrowRight, Copy, History, Plus, Search, ShieldCheck, Star } from "lucide-react";
import { useMemo } from "react";
import type { HealthReport, Issue } from "../lib/health";
import type { Entry, Member } from "../lib/types";
import { Avatar } from "./Avatar";
import { ProviderLogo } from "./ProviderLogo";

interface Props {
  entries: Entry[];
  members: Member[];
  health: HealthReport;
  memberCounts: Record<string, number>;
  onSearch: (q: string) => void;
  onOpen: (id: string) => void;
  onMember: (id: string) => void;
  onIssue: (issue: Issue) => void;
  onNew: () => void;
  onAddMember: () => void;
}

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return "Gute Nacht";
  if (h < 11) return "Guten Morgen";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
}

function ago(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  return d === 1 ? "gestern" : `vor ${d} Tagen`;
}

function subtitle(e: Entry) {
  if (e.category === "kundennummer" && e.customerNumber) return `Nr. ${e.customerNumber}`;
  return e.username ?? e.domain ?? "";
}

export function Home(props: Props) {
  const { entries, members, health, memberCounts, onSearch, onOpen, onMember, onIssue, onNew, onAddMember } = props;

  const favorites = useMemo(
    () => entries.filter((e) => e.favorite).sort((a, b) => a.title.localeCompare(b.title, "de")),
    [entries],
  );
  const recent = useMemo(
    () =>
      entries
        .filter((e) => e.usedAt)
        .sort((a, b) => (b.usedAt! > a.usedAt! ? 1 : -1))
        .slice(0, 5),
    [entries],
  );

  const issues: { key: Issue; count: number; hint: string }[] = [
    { key: "weak", count: health.weak.size, hint: "Kurz oder leicht zu erraten" },
    { key: "reused", count: health.reused.size, hint: "Gleiches Passwort bei mehreren Anbietern" },
    { key: "old", count: health.old.size, hint: "Seit über einem Jahr nicht geändert" },
  ];
  const allGood = health.affected === 0;

  return (
    <section className="home">
      <div className="home-inner">
        <header className="home-head home-anim">
          <h1 className="home-title">{greeting()}</h1>
          <p className="home-sub">
            {entries.length === 0
              ? "Dein Tresor ist bereit für den ersten Zugang."
              : `${entries.length} ${entries.length === 1 ? "Zugang" : "Zugänge"} für ${members.length} ${
                  members.length === 1 ? "Person" : "Personen"
                } – sicher verschlüsselt.`}
          </p>
        </header>

        <label className="home-search home-anim">
          <Search size={18} className="home-search-icon" />
          <input
            id="home-search"
            placeholder="Wonach suchst du? Anbieter, E-Mail, Kundennummer…"
            onChange={(e) => onSearch(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          <kbd>Strg F</kbd>
        </label>

        {entries.length === 0 && (
          <div className="home-empty home-anim">
            <button className="primary-btn primary-btn--lg home-empty-btn" onClick={onNew}>
              <Plus size={16} strokeWidth={2.4} />
              Ersten Eintrag anlegen
            </button>
          </div>
        )}

        {favorites.length > 0 && (
          <div className="home-section home-anim">
            <div className="home-section-head">
              <h2>
                <Star size={14} /> Favoriten
              </h2>
            </div>
            <div className="tile-grid">
              {favorites.map((e) => (
                <button key={e.id} className="tile" onClick={() => onOpen(e.id)}>
                  <ProviderLogo title={e.title} domain={e.domain} size={40} />
                  <span className="tile-title">{e.title}</span>
                  <span className="tile-sub">{subtitle(e)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="home-columns">
          {recent.length > 0 && (
            <div className="home-section home-anim">
              <div className="home-section-head">
                <h2>
                  <History size={14} /> Zuletzt verwendet
                </h2>
              </div>
              <div className="panel">
                {recent.map((e) => (
                  <button key={e.id} className="panel-row" onClick={() => onOpen(e.id)}>
                    <ProviderLogo title={e.title} domain={e.domain} size={30} />
                    <span className="row-text">
                      <span className="row-title">{e.title}</span>
                      <span className="row-sub">{subtitle(e)}</span>
                    </span>
                    <span className="panel-meta">
                      <Copy size={11} />
                      {ago(e.usedAt!)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {health.checked > 0 && (
            <div className="home-section home-anim">
              <div className="home-section-head">
                <h2>
                  <ShieldCheck size={14} /> Sicherheitscheck
                </h2>
              </div>
              <div className="panel">
                <div className="health-summary" data-good={allGood || undefined}>
                  <span className="health-badge">
                    {allGood ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}
                  </span>
                  <span className="toggle-text">
                    <span className="toggle-title">{allGood ? "Alles in Ordnung" : `${health.affected} Einträge prüfen`}</span>
                    <span className="toggle-sub">
                      {health.checked} {health.checked === 1 ? "Passwort" : "Passwörter"} geprüft
                    </span>
                  </span>
                </div>
                {issues.map((i) => (
                  <button
                    key={i.key}
                    className="panel-row health-row"
                    data-zero={i.count === 0 || undefined}
                    onClick={() => onIssue(i.key)}
                    disabled={i.count === 0}
                  >
                    <span className="health-count">{i.count}</span>
                    <span className="row-text">
                      <span className="row-title">
                        {i.key === "weak" ? "Schwach" : i.key === "reused" ? "Mehrfach verwendet" : "Alt"}
                      </span>
                      <span className="row-sub">{i.hint}</span>
                    </span>
                    {i.count > 0 && <ArrowRight size={14} className="panel-arrow" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="home-section home-anim">
          <div className="home-section-head">
            <h2>Familie</h2>
          </div>
          <div className="family-grid">
            {members.map((m) => (
              <button key={m.id} className="family-card" onClick={() => onMember(m.id)}>
                <Avatar member={m} size={36} />
                <span className="family-name">{m.name}</span>
                <span className="family-count">
                  {memberCounts[m.id] ?? 0} {(memberCounts[m.id] ?? 0) === 1 ? "Eintrag" : "Einträge"}
                </span>
              </button>
            ))}
            <button className="family-card family-card--add" onClick={onAddMember}>
              <span className="family-add">
                <Plus size={16} />
              </span>
              <span className="family-name">Hinzufügen</span>
              <span className="family-count">Neue Person</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
