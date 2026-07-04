// Maps opponent country names / abbreviations (as entered by admins) to a flag emoji.
// Keys are lowercased and stripped of punctuation for matching.
// Kept in sync with artifacts/hk-masters-web/src/utils/countryFlags.js
const FLAG_MAP = {
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

function normalize(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim();
}

// Returns a flag emoji for a given opponent name/abbreviation, or null if unknown.
export function getCountryFlag(name) {
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
