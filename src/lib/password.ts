/** Zufälliges Passwort ohne leicht verwechselbare Zeichen (l, I, 1, O, 0). */
export function generatePassword(length = 20): string {
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!#$%&*+-=?@_";
  const all = lower + upper + digits + symbols;

  const pick = (set: string) => {
    // Ablehnungsverfahren gegen Modulo-Verzerrung
    const max = Math.floor(256 / set.length) * set.length;
    const buf = new Uint8Array(1);
    for (;;) {
      crypto.getRandomValues(buf);
      if (buf[0] < max) return set[buf[0] % set.length];
    }
  };

  // Jede Zeichengruppe mindestens einmal, Rest zufällig
  const chars = [pick(lower), pick(upper), pick(digits), pick(symbols)];
  while (chars.length < length) chars.push(pick(all));

  // Fisher-Yates mischen
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Number(crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
