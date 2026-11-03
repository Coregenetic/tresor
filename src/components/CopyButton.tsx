import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

interface Props {
  value: string;
  label: string;
}

export function CopyButton({ value, label }: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast(`${label} kopiert`, { description: "Wird nach 30 Sekunden aus der Zwischenablage gelöscht." });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error("Kopieren fehlgeschlagen");
    }
  }

  return (
    <button className="icon-btn" onClick={copy} aria-label={`${label} kopieren`} title={`${label} kopieren`}>
      <span className="swap" data-state={copied ? "b" : "a"}>
        <Copy size={15} strokeWidth={1.8} className="swap-a" />
        <Check size={15} strokeWidth={2.2} className="swap-b swap-b--success" />
      </span>
    </button>
  );
}
