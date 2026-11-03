import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  onConfirm: () => void;
  children: ReactNode;
  /** Haltedauer in ms */
  duration?: number;
}

/**
 * Gedrückt halten zum Bestätigen (z. B. Löschen).
 * Drücken ist bewusst langsam (Entscheidung), Loslassen schnell (System reagiert).
 */
export function HoldButton({ onConfirm, children, duration = 1200 }: Props) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  function start() {
    if (timer.current) return;
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      setHolding(false);
      onConfirm();
    }, duration);
  }

  function stop() {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    setHolding(false);
  }

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <button
      type="button"
      className="hold-btn"
      data-holding={holding || undefined}
      style={{ ["--hold" as string]: `${duration}ms` }}
      onPointerDown={(e) => {
        if (e.button === 0) start();
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === "Enter" || e.key === " ") stop();
      }}
      onBlur={stop}
    >
      <span className="hold-label">{children}</span>
      <span className="hold-fill" aria-hidden>
        <span className="hold-label">{children}</span>
      </span>
    </button>
  );
}
