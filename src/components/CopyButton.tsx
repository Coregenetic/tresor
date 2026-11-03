import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { api, errorText } from "../lib/api";

/** Sekunden, nach denen kopierte Werte aus der Zwischenablage entfernt werden */
export const CLIPBOARD_SECONDS = 30;

interface Props {
  value: string;
  label: string;
  onCopied?: () => void;
}

export function CopyButton({ value, label, onCopied }: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await api.copySecret(value, CLIPBOARD_SECONDS);
      setCopied(true);
      onCopied?.();
      toast(`${label} kopiert`, {
        id: "copied", // ersetzt den vorherigen Hinweis statt zu stapeln
        description: `Wird nach ${CLIPBOARD_SECONDS} Sekunden aus der Zwischenablage gelöscht.`,
      });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1400);
    } catch (e) {
      toast.error("Kopieren fehlgeschlagen", { description: errorText(e) });
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
