// Maps opponent country names / abbreviations (as entered by admins) to a flag emoji.
// Keys are lowercased and stripped of punctuation for matching.
//
// Shared between the public site (@workspace/hk-masters-web) and staff admin
// (@workspace/hk-masters) so new countries/abbreviations only need to be added once.
const FLAG_MAP: Record<string, string> = {
  "hong kong": "🇭🇰", "hk": "🇭🇰", "hkg": "🇭🇰",
  australia: "🇦🇺", aus: "🇦🇺",
  ireland: "🇮🇪", irl: "🇮🇪", ire: "🇮🇪",
  "northern ireland": "🇬🇧",
  england: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", eng: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", sco: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  wales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", wal: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  "great britain": "🇬🇧", britain: "🇬🇧", gbr: "🇬🇧", uk: "🇬🇧",
  belgium: "🇧🇪", bel: "🇧🇪",
  netherlands: "🇳🇱", holland: "🇳🇱", ned: "🇳🇱", nld: "🇳🇱",
  germany: "🇩🇪", ger: "🇩🇪", deu: "🇩🇪",
  france: "🇫🇷", fra: "🇫🇷",
  spain: "🇪🇸", esp: "🇪🇸",
  italy: "🇮🇹", ita: "🇮🇹",
  austria: "🇦🇹", aut: "🇦🇹",
  switzerland: "🇨🇭", sui: "🇨🇭", che: "🇨🇭",
  poland: "🇵🇱", pol: "🇵🇱",
  "czech republic": "🇨🇿", czechia: "🇨🇿", cze: "🇨🇿",
  "new zealand": "🇳🇿", nzl: "🇳🇿",
  "south africa": "🇿🇦", rsa: "🇿🇦", za: "🇿🇦",
  usa: "🇺🇸", "united states": "🇺🇸", "united states of america": "🇺🇸", us: "🇺🇸",
  canada: "🇨🇦", can: "🇨🇦",
  argentina: "🇦🇷", arg: "🇦🇷",
  chile: "🇨🇱", chi: "🇨🇱",
  japan: "🇯🇵", jpn: "🇯🇵",
  "south korea": "🇰🇷", korea: "🇰🇷", kor: "🇰🇷",
  china: "🇨🇳", chn: "🇨🇳", prc: "🇨🇳",
  india: "🇮🇳", ind: "🇮🇳",
  pakistan: "🇵🇰", pak: "🇵🇰",
  malaysia: "🇲🇾", mas: "🇲🇾", mys: "🇲🇾",
  singapore: "🇸🇬", sin: "🇸🇬", sgp: "🇸🇬",
  "sri lanka": "🇱🇰", sri: "🇱🇰",
  bangladesh: "🇧🇩", ban: "🇧🇩",
  thailand: "🇹🇭", tha: "🇹🇭",
  fiji: "🇫🇯", fij: "🇫🇯",
  kenya: "🇰🇪", ken: "🇰🇪",
  egypt: "🇪🇬", egy: "🇪🇬",
  zimbabwe: "🇿🇼", zim: "🇿🇼",
  namibia: "🇳🇦", nam: "🇳🇦",
  "trinidad and tobago": "🇹🇹", trinidad: "🇹🇹", tri: "🇹🇹",
  denmark: "🇩🇰", den: "🇩🇰",
  sweden: "🇸🇪", swe: "🇸🇪",
  norway: "🇳🇴", nor: "🇳🇴",
  finland: "🇫🇮", fin: "🇫🇮",
  portugal: "🇵🇹", por: "🇵🇹",
  brazil: "🇧🇷", bra: "🇧🇷",
  mexico: "🇲🇽", mex: "🇲🇽",
  indonesia: "🇮🇩", ina: "🇮🇩",
  philippines: "🇵🇭", phi: "🇵🇭",
  "chinese taipei": "🇹🇼", taiwan: "🇹🇼", tpe: "🇹🇼",
};

function normalize(name: string | null | undefined): string {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim();
}

// Returns a flag emoji for a given opponent name/abbreviation, or null if unknown.
export function getCountryFlag(name: string | null | undefined): string | null {
  if (!name) return null;
  const key = normalize(name);
  if (FLAG_MAP[key]) return FLAG_MAP[key];

  // Try matching against the leading word(s), e.g. "Australia A" -> "australia"
  for (const candidate of [key.split(" ").slice(0, 2).join(" "), key.split(" ")[0]]) {
    if (FLAG_MAP[candidate]) return FLAG_MAP[candidate];
  }
  return null;
}

export const HK_FLAG = "🇭🇰";

// Windows browsers (Chrome/Edge on Windows) don't ship a color emoji font with
// flag glyphs — regional-indicator flag emoji render as plain two-letter
// country-code text instead of a flag picture there. To get a real flag image
// on every OS, we render Twemoji's PNG assets instead of the raw emoji glyph.
// The Twemoji asset filename is just the emoji's codepoints (lowercase hex,
// dash-joined, with the U+FE0F variation selector stripped).
// NOTE: the twemoji npm package (jsdelivr.net/npm/twemoji@.../assets/...) does
// NOT ship the image assets in its published tarball — only the JS lib. The
// PNGs only exist in the twitter/twemoji GitHub repo itself, so we must pull
// them via jsdelivr's GitHub-file CDN (cdn.jsdelivr.net/gh/...), pinned to a
// tagged release so the URLs never change under us.
const TWEMOJI_VERSION = "14.0.2";

export function getFlagImageUrl(flagEmoji: string): string {
  const codepoints = Array.from(flagEmoji)
    .map((char) => char.codePointAt(0)!.toString(16))
    .filter((cp) => cp !== "fe0f")
    .join("-");
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@${TWEMOJI_VERSION}/assets/72x72/${codepoints}.png`;
}

export const HK_FLAG_IMAGE_URL = getFlagImageUrl(HK_FLAG);

// Returns a flag image URL for a given opponent name/abbreviation, or null if unknown.
export function getCountryFlagImageUrl(name: string | null | undefined): string | null {
  const flag = getCountryFlag(name);
  return flag ? getFlagImageUrl(flag) : null;
}
