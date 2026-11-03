import { Check, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_GENERATOR, entropyBits, generatePassword, type GeneratorOptions } from "../lib/password";
import { Segmented } from "./Segmented";

interface Props {
  onUse: (password: string) => void;
  onClose: () => void;
}

const STORAGE_KEY = "tresor-generator";

function loadOptions(): GeneratorOptions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_GENERATOR, ...JSON.parse(raw) };
  } catch {
    /* ignorieren */
  }
  return DEFAULT_GENERATOR;
}

function strengthLabel(bits: number) {
  if (bits >= 100) return { label: "Extrem stark", tone: "great" };
  if (bits >= 72) return { label: "Sehr stark", tone: "great" };
  if (bits >= 56) return { label: "Stark", tone: "good" };
  if (bits >= 40) return { label: "Mittel", tone: "ok" };
  return { label: "Schwach", tone: "weak" };
}

/** Kleines Popover unter dem Würfel-Button. Einstellungen (nicht die Passwörter) werden gemerkt. */
export function PasswordGenerator({ onUse, onClose }: Props) {
  const [o, setO] = useState<GeneratorOptions>(loadOptions);
  const [seed, setSeed] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const value = useMemo(() => generatePassword(o), [o, seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const bits = entropyBits(o);
  const strength = strengthLabel(bits);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
    } catch {
      /* ignorieren */
    }
  }, [o]);

  // Klick außerhalb / Esc schließt
  useEffect(() => {
    function onDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  const set = (patch: Partial<GeneratorOptions>) => setO((prev) => ({ ...prev, ...patch }));
  const groupCount = [o.lower, o.upper, o.digits, o.symbols].filter(Boolean).length;

  return (
    <div className="gen" ref={ref} role="dialog" aria-label="Passwort-Generator">
      <div className="gen-preview">
        <span className="gen-value" key={value}>
          {value}
        </span>
        <button type="button" className="icon-btn" onClick={() => setSeed((s) => s + 1)} aria-label="Neu würfeln" title="Neu würfeln">
          <RefreshCw size={15} />
        </button>
      </div>
      <div className="gen-strength" data-tone={strength.tone}>
        <span className="gen-bar">
          <span style={{ transform: `scaleX(${Math.min(1, bits / 110)})` }} />
        </span>
        <span>
          {strength.label} · {bits} Bit
        </span>
      </div>

      <Segmented
        label="Art"
        full
        size="sm"
        value={o.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: "random", label: "Zufällig" },
          { value: "words", label: "Wörter" },
        ]}
      />

      {o.mode === "random" ? (
        <>
          <label className="gen-row">
            <span>Länge</span>
            <input
              type="range"
              min={8}
              max={64}
              value={o.length}
              onChange={(e) => set({ length: Number(e.target.value) })}
              className="slider"
            />
            <span className="gen-num">{o.length}</span>
          </label>
          <div className="gen-chips">
            {(
              [
                ["upper", "A–Z"],
                ["lower", "a–z"],
                ["digits", "0–9"],
                ["symbols", "!#%"],
              ] as const
            ).map(([key, label]) => {
              const on = o[key];
              return (
                <button
                  type="button"
                  key={key}
                  className="gen-chip"
                  data-on={on || undefined}
                  aria-pressed={on}
                  // mindestens eine Gruppe bleibt aktiv
                  onClick={() => (on && groupCount === 1 ? undefined : set({ [key]: !on }))}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <label className="gen-row">
            <span>Wörter</span>
            <input
              type="range"
              min={3}
              max={8}
              value={o.words}
              onChange={(e) => set({ words: Number(e.target.value) })}
              className="slider"
            />
            <span className="gen-num">{o.words}</span>
          </label>
          <div className="gen-chips">
            {["-", ".", "_", " "].map((sep) => (
              <button
                type="button"
                key={sep}
                className="gen-chip"
                data-on={o.separator === sep || undefined}
                aria-pressed={o.separator === sep}
                onClick={() => set({ separator: sep })}
              >
                {sep === " " ? "Leerz." : sep}
              </button>
            ))}
            <button type="button" className="gen-chip" data-on={o.capitalize || undefined} onClick={() => set({ capitalize: !o.capitalize })}>
              Aa
            </button>
            <button type="button" className="gen-chip" data-on={o.addNumber || undefined} onClick={() => set({ addNumber: !o.addNumber })}>
              +42
            </button>
          </div>
        </>
      )}

      <button type="button" className="primary-btn gen-use" onClick={() => onUse(value)}>
        <Check size={15} strokeWidth={2.4} />
        Übernehmen
      </button>
    </div>
  );
}
