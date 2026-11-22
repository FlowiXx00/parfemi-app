/**
 * Quick entry for Fragrantica ratings.
 *
 * The admin opens the perfume page on Fragrantica THEMSELVES (like any visitor), and a bookmarks-bar
 * button (bookmarklet) reads the rating and vote count from that page and sends them to the admin.
 * Nothing crawls their site automatically; the button just replaces "copy → paste".
 */

const MESSAGE_TYPE = "atelier-fragrantica";
/** Window name of the admin page (the bookmarklet targets it if it has no link to the window that opened it). */
export const ADMIN_WINDOW_NAME = "atelier-ocene";
/** Window/tab name for Fragrantica (the admin reuses it for the next perfume). */
export const FRAGRANTICA_WINDOW_NAME = "fragrantica";

export type FragranticaReading = {
  rating: number;
  votes: number;
  /** Page title on Fragrantica, e.g. "Aventus Creed for men" */
  title: string;
  url: string;
};

/** Messages are accepted only from Fragrantica (any locale: .com, .es, .ru, .com.br…). */
export function isFragranticaOrigin(origin: string) {
  return /^https:\/\/([a-z0-9-]+\.)*fragrantica\.[a-z]{2,3}(\.[a-z]{2})?$/i.test(origin);
}

export function fragranticaSearchUrl(brand: string, name: string) {
  return `https://www.fragrantica.com/search/?query=${encodeURIComponent(`${brand} ${name}`)}`;
}

export function googleSearchUrl(brand: string, name: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(`site:fragrantica.com ${brand} ${name}`)}`;
}

/** Validates and cleans data from a message/link (we don't blindly trust what arrives). */
export function parseReading(value: unknown): FragranticaReading | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.type !== undefined && row.type !== MESSAGE_TYPE) return null;

  const rating = Number(row.rating);
  const votes = Math.round(Number(row.votes));
  if (!(Number.isFinite(rating) && rating >= 1 && rating <= 5)) return null;
  if (!(Number.isFinite(votes) && votes >= 0 && votes < 10_000_000)) return null;

  return {
    rating: Math.round(rating * 100) / 100,
    votes,
    title: typeof row.title === "string" ? row.title.slice(0, 200) : "",
    url: typeof row.url === "string" && /^https:\/\//.test(row.url) ? row.url.slice(0, 500) : "",
  };
}

/** "Perfume rating 4.31 out of 5 with 29,185 votes" (nalepljen tekst) -> { rating, votes } */
export function parsePastedRating(text: string): { rating: number; votes: number } | null {
  const match = text.match(/([1-5](?:[.,]\d{1,2})?)\s*(?:out of|od|\/)\s*5\D{0,20}?([\d.,\s]+?)\s*(?:votes|glas)/i);
  if (!match) return null;
  const rating = Number(match[1]!.replace(",", "."));
  const votes = Number(match[2]!.replace(/[^\d]/g, ""));
  if (!(rating >= 1 && rating <= 5) || !Number.isFinite(votes)) return null;
  return { rating, votes };
}

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’'`´]/g, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Words that don't identify the perfume (concentration, gender, conjunctions). */
const NOISE = new Set([
  "eau", "de", "parfum", "toilette", "cologne", "edp", "edt", "edc", "extrait", "for", "men", "man",
  "women", "woman", "and", "pour", "homme", "femme", "the", "le", "la", "l", "d", "unisex",
]);

const FLANKER_WORDS = new Set([
  "intense", "intensely", "elixir", "absolu", "absolute", "extreme", "noir", "sport", "night",
  "black", "gold", "platinum", "fraiche", "fresh", "legere", "edition", "limited", "privee",
]);

/**
 * Whether the Fragrantica title matches our perfume (so a rating isn't saved to the wrong perfume
 * if the admin opens another version). Returns the share of words from our name found in the title
 * (0–1).
 */
export function titleMatchScore(brand: string, name: string, title: string) {
  if (!title.trim()) return 1; // title wasn't read: don't block
  const theirs = new Set(fold(title).split(" "));
  const ours = fold(name).split(" ").filter((token) => token && !NOISE.has(token));
  const brandTokens = fold(brand).split(" ").filter((token) => token && !NOISE.has(token));
  if (!ours.length) return brandTokens.some((token) => theirs.has(token)) ? 1 : 0;
  const hits = ours.filter((token) => theirs.has(token)).length;
  // Their title contains a flanker word that our name doesn't (e.g. "Elixir", "Intense") -> probably a
  // different version, ask for confirmation. ("parfum"/"cologne" aren't listed because they're part of
  // "Eau de Parfum".)
  const ourTokens = new Set([...fold(name).split(" "), ...fold(brand).split(" ")]);
  let extra = [...theirs].filter((token) => FLANKER_WORDS.has(token) && !ourTokens.has(token)).length;
  // "Le Parfum" is its own flanker (e.g. "Black Opium" and "Black Opium Le Parfum" are two perfumes).
  if (/\ble parfum\b/.test(fold(title)) && !/\ble parfum\b/.test(fold(name))) extra++;
  return Math.max(0, hits / ours.length - extra * 0.5);
}

/**
 * Code for the bookmarks-bar button. Runs on a Fragrantica perfume page:
 * reads "Perfume rating X out of 5 with N votes" (or the schema.org rating) and the title,
 * then sends them to the admin page (postMessage, or if there's no link, opens the admin with the data
 * in #).
 */
export function buildBookmarklet(adminOrigin: string) {
  const code = `(function(){
var O=${JSON.stringify(adminOrigin)};
var tx=document.body?document.body.innerText:'';
var r=null,v=null;
var m=tx.match(/rating\\s+([1-5](?:[.,]\\d{1,2})?)\\s+out of 5\\s+with\\s+([\\d.,\\s]+?)\\s+votes/i);
if(m){r=m[1];v=m[2];}
if(!r){var a=document.querySelector('[itemprop=ratingValue]'),b=document.querySelector('[itemprop=ratingCount]');
if(a){r=a.getAttribute('content')||a.textContent;}if(b){v=b.getAttribute('content')||b.textContent;}}
if(!r){alert('Atelier: na ovoj strani nema ocene. Otvori stranicu parfema na Fragrantici pa klikni ponovo.');return;}
var h=document.querySelector('h1');
var d={type:${JSON.stringify(MESSAGE_TYPE)},rating:parseFloat(String(r).replace(',','.')),votes:parseInt(String(v||'0').replace(/[^\\d]/g,''),10)||0,title:(h?h.innerText:document.title).trim(),url:location.href};
var sent=false;
try{if(window.opener&&!window.opener.closed){window.opener.postMessage(d,O);sent=true;}}catch(e){}
if(!sent){window.open(O+'/admin/ocene#fr='+encodeURIComponent(JSON.stringify(d)),${JSON.stringify(ADMIN_WINDOW_NAME)});}
var t=document.createElement('div');t.textContent='\\u2713 Poslato u admin: '+d.rating+' ('+d.votes+' glasova)';
t.style.cssText='position:fixed;z-index:2147483647;top:16px;right:16px;padding:12px 16px;border-radius:12px;background:#1d1d22;color:#fff;font:600 14px system-ui;box-shadow:0 10px 30px rgba(0,0,0,.35)';
document.body.appendChild(t);setTimeout(function(){t.remove();},1800);
})();`;
  return `javascript:${encodeURIComponent(code.replace(/\n/g, ""))}`;
}
