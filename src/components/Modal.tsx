import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}

export function Modal({ title, onClose, children, width = 420 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Nur beim Öffnen: Fokus setzen, Esc abfangen, Fokus beim Schließen zurückgeben
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    // Erstes Eingabefeld fokussieren, sonst den Dialog selbst
    const first = ref.current?.querySelector<HTMLElement>("input, textarea, select");
    (first ?? ref.current)?.focus();

    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        closeRef.current();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal aria-label={title} ref={ref} tabIndex={-1} style={{ width }}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Schließen">
            <X size={16} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
