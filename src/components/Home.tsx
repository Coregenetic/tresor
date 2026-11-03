import { ArrowRight, CalendarClock, Copy, Download, Fingerprint, History, Lock, Plus, Search, ShieldCheck, Star } from "lucide-react";
import { useMemo } from "react";
import { contractLabel } from "../lib/format";
import type { HealthReport, Issue } from "../lib/health";
import { useCountUp } from "../lib/motion";
import type { AvailableUpdate } from "../lib/system";
import type { Entry, Member } from "../lib/types";
import { Avatar } from "./Avatar";
import { ProviderLogo } from "./ProviderLogo";
import { Ring } from "./Ring";

interface Props {
  entries: Entry[];
  members: Member[];
  health: HealthReport;
  memberCounts: Record<string, number>;
  due: { entry: Entry; days: number }[];
  helloEnabled: boolean;
  update: AvailableUpdate | null;
  onInstallUpdate: () => void;
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

function Stat({ dot, label, value, sub, onClick }: { dot: string; label: string; value: number; sub: string; onClick?: () => void }) {
  const n = useCountUp(value, 900, 150);
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className="stat" onClick={onClick} data-clickable={onClick ? true : undefined}>
      <span className="stat-label">
        <span className="dot" style={{ background: dot }} />
        {label}
      </span>
      <span className="stat-value">{n}</span>
      <span className="stat-sub">{sub}</span>
    </Tag>
  );
}

export function Home(props: Props) {
  const { entries, members, health, memberCounts, due, helloEnabled, update } = props;
  const { onInstallUpdate, onSearch, onOpen, onMember, onIssue, onNew, onAddMember } = props;

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

  const score = health.checked === 0 ? 1 : (health.checked - health.affected) / health.checked;
  const percent = useCountUp(Math.round(score * 100), 1100, 120);
  const allGood = health.affected === 0;
  const tone = score >= 0.9 ? "success" : score >= 0.6 ? "brand" : "warning";
  const firstIssue: Issue | null = health.weak.size ? "weak" : health.reused.size ? "reused" : health.old.size ? "old" : null;

  const issues: { key: Issue; count: number; title: string; hint: string }[] = [
    { key: "weak", count: health.weak.size, title: "Schwach", hint: "Kurz oder leicht zu erraten" },
    { key: "reused", count: health.reused.size, title: "Mehrfach verwendet", hint: "Gleiches Passwort bei mehreren Anbietern" },
    { key: "old", count: health.old.size, title: "Alt", hint: "Seit über einem Jahr nicht geändert" },
  ];

  return (
    <section className="home">
      <div className="home-inner">
        {/* ── Hero ── */}
        <div className="hero home-anim">
          <Ring value={score} size={196} stroke={16} tone={tone} animateIn className="hero-ring">
            <span className="hero-percent">
              {percent}
              <small>%</small>
            </span>
            <span className="hero-ring-label">Sicher</span>
          </Ring>

          <div className="hero-body">
            <span className="eyebrow">{greeting()}</span>
            <h1 className="hero-title">
              {entries.length === 0 ? "Bereit für deinen ersten Zugang" : allGood ? "Alles sicher" : `${health.affected} Einträge prüfen`}
            </h1>
            <div className="stats">
              <Stat
                dot="var(--blue)"
                label="Zugänge"
                value={entries.length}
                sub={`für ${members.length} ${members.length === 1 ? "Person" : "Personen"}`}
              />
              <Stat
                dot="var(--pink)"
                label="Hinweise"
                value={health.affected}
                sub={allGood ? "nichts zu tun" : "im Sicherheitscheck"}
                onClick={firstIssue ? () => onIssue(firstIssue) : undefined}
              />
              <Stat
                dot={due.length ? "var(--orange)" : "var(--green)"}
                label="Verträge"
                value={due.length}
                sub={due.length ? `${due[0].entry.title} ${contractLabel(due[0].days)}` : "keiner endet bald"}
                onClick={due.length ? () => onOpen(due[0].entry.id) : undefined}
              />
            </div>
            <div className="pills">
              <span className="pill">
                <Lock size={12} /> AES-256 verschlüsselt
              </span>
              {helloEnabled && (
                <span className="pill">
                  <Fingerprint size={12} /> Windows Hello aktiv
                </span>
              )}
            </div>
          </div>
        </div>

        {update && (
          <button className="update-banner home-anim" onClick={onInstallUpdate}>
            <span className="update-icon">
              <Download size={16} />
            </span>
            <span className="toggle-text">
              <span className="toggle-title">Version {update.version} ist verfügbar</span>
              <span className="toggle-sub">Jetzt aktualisieren – dauert nur einen Moment.</span>
            </span>
            <ArrowRight size={16} />
          </button>
        )}

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
                <Star size={13} /> Favoriten
              </h2>
            </div>
            <div className="tile-grid">
              {favorites.map((e, i) => (
                <button key={e.id} className="tile" onClick={() => onOpen(e.id)} style={{ ["--i" as string]: i }}>
                  <ProviderLogo title={e.title} domain={e.domain} size={42} />
                  <span className="tile-title">{e.title}</span>
                  <span className="tile-sub">{subtitle(e)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {due.length > 0 && (
          <div className="home-section home-anim">
            <div className="home-section-head">
              <h2>
                <CalendarClock size={13} /> Verträge
              </h2>
            </div>
            <div className="panel">
              {due.map(({ entry, days }) => (
                <button key={entry.id} className="panel-row" onClick={() => onOpen(entry.id)}>
                  <ProviderLogo title={entry.title} domain={entry.domain} size={30} />
                  <span className="row-text">
                    <span className="row-title">{entry.title}</span>
                    <span className="row-sub">{contractLabel(days)}</span>
                  </span>
                  <span className="due-chip" data-tone={days < 0 ? "past" : days <= 7 ? "urgent" : "soon"}>
                    {days < 0 ? "abgelaufen" : days === 0 ? "heute" : `${days} T.`}
                  </span>
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
                  <History size={13} /> Zuletzt verwendet
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
                  <ShieldCheck size={13} /> Sicherheitscheck
                </h2>
              </div>
              <div className="panel">
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
                      <span className="row-title">{i.title}</span>
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
              <button key={m.id} className="family-card" onClick={() => onMember(m.id)} style={{ ["--hue" as string]: m.hue }}>
                <Avatar member={m} size={38} />
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
