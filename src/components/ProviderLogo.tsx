import { useState } from "react";
import { initials, logoUrl } from "../lib/logo";

interface Props {
  title: string;
  domain?: string;
  size?: number;
}

/** Hash → stabiler Farbton für die Initialen-Kachel */
function hueFor(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
  return h;
}

export function ProviderLogo({ title, domain, size = 32 }: Props) {
  const [state, setState] = useState<"loading" | "ok" | "fallback">(domain ? "loading" : "fallback");
  const radius = Math.round(size * 0.26);

  if (state === "fallback" || !domain) {
    const hue = hueFor(title);
    return (
      <div
        className="logo logo--initials"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          fontSize: Math.round(size * 0.36),
          ["--h" as string]: hue,
        }}
        aria-hidden
      >
        {initials(title)}
      </div>
    );
  }

  return (
    <div className="logo" style={{ width: size, height: size, borderRadius: radius }} aria-hidden>
      <img
        src={logoUrl(domain, size >= 48 ? 128 : 64)}
        alt=""
        draggable={false}
        data-loaded={state === "ok"}
        style={{ width: Math.round(size * 0.66), height: Math.round(size * 0.66) }}
        onLoad={(e) => {
          // Google liefert für unbekannte Domains ein winziges Standard-Icon – dann lieber Initialen
          const img = e.currentTarget;
          setState(img.naturalWidth < 32 ? "fallback" : "ok");
        }}
        onError={() => setState("fallback")}
      />
    </div>
  );
}
