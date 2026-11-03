/** Passwort-Erzeugung mit kryptografisch sicherem Zufall (crypto.getRandomValues). */

export interface GeneratorOptions {
  mode: "random" | "words";
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  words: number;
  separator: string;
  capitalize: boolean;
  addNumber: boolean;
}

export const DEFAULT_GENERATOR: GeneratorOptions = {
  mode: "random",
  length: 20,
  lower: true,
  upper: true,
  digits: true,
  symbols: true,
  words: 5,
  separator: "-",
  capitalize: true,
  addNumber: true,
};

// Ohne leicht verwechselbare Zeichen (l, I, 1, O, 0)
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!#$%&*+-=?@_";

/** Gleichverteilte Zufallszahl 0..n-1 (Ablehnungsverfahren gegen Modulo-Verzerrung). */
export function randomInt(n: number): number {
  const max = Math.floor(0x1_0000_0000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < max) return buf[0] % n;
  }
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Über 500 kurze, gut lesbare deutsche Wörter ohne Umlaute → gut 9 Bit pro Wort
const WORDS = (
  "abend adler ahorn akte alarm anker apfel arena atlas auge auto bach bad bahn ball band bank bar bart baum " +
  "becher beere berg besen bett biene bild birne blatt blitz blume boden bogen bohne boot brief brille brot " +
  "bruder brunnen buch burg busch butter dach dackel dampf daumen decke deich delfin degen dorf dose drache " +
  "draht dunst dusche ebbe echo ecke efeu eiche eimer eis elch engel ente erbse erde esel eule fabel faden " +
  "fahne falke farbe fass feder fee feld fels fenster ferien fest feuer fichte figur film finger fisch flagge " +
  "flasche fleck flocke floh flur fluss fohlen form foto frosch frucht fuchs funke gabel gans garten gast " +
  "geige geist gelb geld gerste gipfel glas glocke glut gold gras grille gruppe gurke gurt hafen hagel hahn " +
  "hai haken halle hals hammer hand harfe hase haus hecht hecke hefe heft held helm hemd herbst herz heu " +
  "himmel hirsch hitze hobel hof hose hotel huhn hummel hund hut igel insel jacke jagd jahr juwel kabel " +
  "kaffee kahn kakao kamel kamin kamm kanal kanne kante kapsel karte kasse kater katze kegel keks keller " +
  "kerze kette kiefer kind kino kirche kissen kiste klee knopf koch koffer komet kompass kopf korb korn " +
  "kraft kran krone krug kuchen kugel kunst kurve kutsche labor lachs laden lager lamm lampe land laterne " +
  "laub lauch leiter lerche licht lied linde linse liste loch loewe luft lupe mahl mais maler mantel marder " +
  "markt maske mauer maus meer mehl meise melone messer metall milch minze mond moos motor muehle mund " +
  "muschel muster nabel nacht nadel nagel name nebel nest netz nudel nuss oase obst ofen ohr onkel oper " +
  "orange orgel otter paket palme panda papier park pass pauke pedal perle pfad pfanne pfeil pferd pflanze " +
  "pilot pilz pinsel pirat planet platz pokal polar post preis prinz puder puls pult punkt puppe quelle rabe " +
  "rad rahmen rakete rasen raupe regal regen reh reise rettich riese ring robbe rock rose rubin ruder " +
  "saal saft sage salbei salz samen sand sattel schaf schal schiff schild schirm schloss schnee schrank " +
  "schuh schule see segel seife seil sessel sichel sieb silber sirup socke sofa sonne spatz spiegel spinne " +
  "sport stadt stall stamm stern stiefel stift stock storch strand strom stuhl sturm suppe tafel tag tal " +
  "tanne tante tasche tasse taube teich teller tempel teppich theater tiger tinte tisch toast tomate topf " +
  "tor torte traum treppe tropfen trommel tuch tulpe tunnel turm uhr ufer vase vogel vulkan waage wagen " +
  "wal wald walnuss wand wanne watte weide welle welt wiese wind winter wolke wolle wurm wurzel zahl zahn " +
  "zange zaun zebra zelt ziege zimmer zitrone zucker zug zweig zwerg anis apfelbaum armband ast auster " +
  "backe balkon banane basar beton biber blech bluse boje borke brezel bruecke buche buerste dattel diamant " +
  "docht dohle eber eiland emaille erker fackel fasan feige filz flamme flieder floss forelle frost fuss " +
  "galgen gecko gemse gitarre granit hafer harz hering hornisse hummer ingwer jaguar joghurt kaktus kamille " +
  "kanu karpfen kastanie kiwi klinge koala kobold kohle koralle kraeher kresse kroete kuppel lavendel lehm " +
  "libelle lilie lotus luchs magnet mandel marmor matrose mohn moewe muskat narzisse nashorn neffe nichte " +
  "nymphe opal orkan pappel pelikan pfau pinguin pirol pudel quarz quitte rentier rinde salamander saphir"
)
  .split(/\s+/)
  .filter(Boolean);

export const WORD_COUNT = WORDS.length;

function generateRandom(o: GeneratorOptions): string {
  const groups = [o.lower && LOWER, o.upper && UPPER, o.digits && DIGITS, o.symbols && SYMBOLS].filter(
    Boolean,
  ) as string[];
  if (groups.length === 0) groups.push(LOWER);
  const all = groups.join("");
  const length = Math.max(o.length, groups.length);
  // Jede gewählte Gruppe mindestens einmal
  const chars = groups.map((g) => g[randomInt(g.length)]);
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  return shuffle(chars).join("");
}

function generateWords(o: GeneratorOptions): string {
  const parts = Array.from({ length: Math.max(2, o.words) }, () => {
    const w = WORDS[randomInt(WORDS.length)];
    return o.capitalize ? w[0].toUpperCase() + w.slice(1) : w;
  });
  if (o.addNumber) parts.push(String(randomInt(90) + 10));
  return parts.join(o.separator);
}

export function generatePassword(options: Partial<GeneratorOptions> = {}): string {
  const o = { ...DEFAULT_GENERATOR, ...options };
  return o.mode === "words" ? generateWords(o) : generateRandom(o);
}

/** Geschätzte Stärke in Bit (für die Anzeige im Generator). */
export function entropyBits(o: GeneratorOptions): number {
  if (o.mode === "words") {
    return Math.round(Math.max(2, o.words) * Math.log2(WORD_COUNT) + (o.addNumber ? Math.log2(90) : 0));
  }
  const size =
    (o.lower ? LOWER.length : 0) + (o.upper ? UPPER.length : 0) + (o.digits ? DIGITS.length : 0) + (o.symbols ? SYMBOLS.length : 0);
  return Math.round(o.length * Math.log2(Math.max(size, LOWER.length)));
}
