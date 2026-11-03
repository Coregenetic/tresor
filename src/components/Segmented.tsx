import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

interface Option<T> {
  value: T;
  label: ReactNode;
}

interface Props<T> {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  full?: boolean;
  size?: "sm" | "md";
  role?: "radiogroup" | "tablist";
}

/**
 * Umschalter mit gleitender Markierung. Die Markierung bewegt sich per transform
 * (GPU, unterbrechbar) zur aktiven Option – kein Neuzeichnen des Layouts.
 */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  full,
  size = "md",
  role = "radiogroup",
}: Props<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measure = () => {
      const active = root.querySelector<HTMLElement>('[data-active="true"]');
      if (active) setThumb({ x: active.offsetLeft, w: active.offsetWidth });
    };
    measure();
    // Erst nach der ersten Messung animieren, sonst gleitet die Markierung beim Öffnen von links herein
    const t = requestAnimationFrame(() => setReady(true));
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => {
      cancelAnimationFrame(t);
      ro.disconnect();
    };
  }, [value, options.length]);

  const itemRole = role === "tablist" ? "tab" : "radio";

  return (
    <div
      ref={ref}
      className="seg"
      data-full={full || undefined}
      data-size={size}
      data-ready={ready || undefined}
      role={role}
      aria-label={label}
    >
      {thumb && (
        <span
          className="seg-thumb"
          aria-hidden
          style={{ width: thumb.w, transform: `translateX(${thumb.x}px)` }}
        />
      )}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role={itemRole}
            aria-checked={itemRole === "radio" ? active : undefined}
            aria-selected={itemRole === "tab" ? active : undefined}
            data-active={active}
            className="seg-item"
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
