import { useEffect, useId, useState, type ReactNode } from "react";
import { prefersReducedMotion } from "../lib/motion";

interface Props {
  /** 0–1 */
  value: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  /** "brand" = Pink→Orange, "success" = Grün */
  tone?: "brand" | "success" | "warning";
  /** Kreis beim Erscheinen von 0 aufziehen */
  animateIn?: boolean;
  spinning?: boolean;
  className?: string;
}

/** Fortschrittsring im Raid-Monitor-Stil: Spur + Verlaufsbogen + weicher Schein. */
export function Ring({ value, size = 180, stroke = 14, children, tone = "brand", animateIn, spinning, className }: Props) {
  const id = useId().replace(/:/g, "");
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [shown, setShown] = useState(animateIn && !prefersReducedMotion() ? 0 : value);

  useEffect(() => {
    if (!animateIn || prefersReducedMotion()) {
      setShown(value);
      return;
    }
    // Doppelt rAF: erst mit 0 zeichnen, dann zum Zielwert übergehen
    let a = 0;
    let b = 0;
    a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => setShown(value));
    });
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, [value, animateIn]);

  const colors =
    tone === "success" ? ["#34d399", "#6ee7b7"] : tone === "warning" ? ["#f5a524", "#ff8f45"] : ["#ff4f86", "#ff9a4a"];
  const offset = c * (1 - Math.max(0, Math.min(1, shown)));

  return (
    <div className={`ring ${className ?? ""}`} style={{ width: size, height: size }} data-spinning={spinning || undefined}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={colors[0]} />
            <stop offset="100%" stopColor={colors[1]} />
          </linearGradient>
        </defs>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        <circle
          className="ring-glow"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          stroke={`url(#g${id})`}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <circle
          className="ring-arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          stroke={`url(#g${id})`}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}
