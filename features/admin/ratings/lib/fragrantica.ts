/**
 * Quick entry for Fragrantica ratings.
 *
 * The admin browses Fragrantica THEMSELVES (like any visitor), and a bookmarks-bar button
 * (bookmarklet) reads the rating and vote count of the perfume they're looking for and sends them to
 * the admin. One click loads at most one perfume page; nothing runs on its own.
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

/**
 * Search URL. With the concentration, the perfume also goes in "#atelier=…" so the bookmarklet knows
 * what it's looking for even if the browser cuts the link to the admin tab (window.opener).
 */
export function fragranticaSearchUrl(brand: string, name: string, concentration?: string) {
  const url = `https://www.fragrantica.com/search/?query=${encodeURIComponent(`${brand} ${name}`)}`;
  if (!concentration) return url;
  return `${url}#atelier=${encodeURIComponent(JSON.stringify({ b: brand, n: name, c: concentration }))}`;
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

/** The bookmarklet asks the admin tab which perfume is next (reply carries brand/name/concentration). */
export type WantRequest = { type: typeof MESSAGE_TYPE; kind: "want" };
export function isWantRequest(value: unknown): value is WantRequest {
  const row = value as Record<string, unknown> | null;
  return !!row && row.type === MESSAGE_TYPE && row.kind === "want";
}
export function wantReply(perfume: { brand: string; name: string; concentration: string }) {
  return { type: MESSAGE_TYPE, kind: "want", b: perfume.brand, n: perfume.name, c: perfume.concentration };
}

/**
 * Code for the bookmarks-bar button.
 *
 * - On a perfume page: reads "Perfume rating X out of 5 with N votes" (or the schema.org rating) and the
 *   title, then sends them to the admin page.
 * - On the search page: asks the admin which perfume is next, picks the result with the same brand and
 *   exactly the same name (or name + concentration), loads that one page and sends its rating, so one
 *   click per perfume is enough. If the right version isn't certain, it asks the admin to click it.
 *
 * Sending: postMessage to the admin tab, or if there's no link, opens the admin with the data in #.
 */
export function buildBookmarklet(adminOrigin: string) {
  const code = String.raw`(function(){
var O=${JSON.stringify(adminOrigin)};
var T=${JSON.stringify(MESSAGE_TYPE)};
var W=${JSON.stringify(ADMIN_WINDOW_NAME)};
function toast(s,ms){var t=document.createElement('div');t.textContent=s;t.style.cssText='position:fixed;z-index:2147483647;top:16px;right:16px;max-width:360px;padding:12px 16px;border-radius:12px;background:#1d1d22;color:#fff;font:600 14px/1.4 system-ui;box-shadow:0 10px 30px rgba(0,0,0,.35)';document.body.appendChild(t);setTimeout(function(){t.remove();},ms||2200);}
function send(d){d.type=T;var sent=false;try{if(window.opener&&!window.opener.closed){window.opener.postMessage(d,O);sent=true;}}catch(e){}if(!sent){window.open(O+'/admin/ocene#fr='+encodeURIComponent(JSON.stringify(d)),W);}toast('✓ Poslato u admin: '+d.rating+' ('+d.votes+' glasova)',1800);}
function read(doc,url){var b=doc.body;var tx=b?(b.innerText||b.textContent||''):'';var r=null,v=null;var m=tx.match(/rating\s*([1-5](?:[.,]\d{1,2})?)\s*out of 5\s*with\s*([\d.,\s]+?)\s*votes/i);if(m){r=m[1];v=m[2];}if(!r){var a=doc.querySelector('[itemprop=ratingValue]'),c=doc.querySelector('[itemprop=ratingCount]');if(a){r=a.getAttribute('content')||a.textContent;}if(c){v=c.getAttribute('content')||c.textContent;}}if(!r){return null;}var h=doc.querySelector('h1');return{rating:parseFloat(String(r).replace(',','.')),votes:parseInt(String(v||'0').replace(/[^\d]/g,''),10)||0,title:(h?(h.innerText||h.textContent||''):(doc.title||'')).trim(),url:url};}
if(!/fragrantica\./i.test(location.hostname)){toast('Ovo dugme klikni na Fragrantici: prvo „Traži na Fragrantici” u adminu, pa u toj kartici klikni ⭐.',5000);return;}
if(/\/perfume\//.test(location.pathname)){var here=read(document,location.href);if(here){send(here);}else{alert('Atelier: na ovoj strani nema ocene.');}return;}
function fold(s){return String(s||'').normalize('NFD').replace(/\p{M}/gu,'').replace(/['’´\x60]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();}
var BN={by:1,parfums:1,parfum:1,perfumes:1,perfume:1,paris:1,london:1,fragrances:1,the:1,de:1,maison:1};
function bt(s){return fold(s).split(' ').filter(function(t){return t&&!BN[t];});}
var CW={'Eau de cologne':['eau de cologne','cologne'],'Eau de toilette':['eau de toilette','edt'],'Eau de parfum':['eau de parfum','edp'],'Extrait de parfum':['extrait de parfum','extrait'],'Parfum':['parfum','le parfum']};
function pickFor(want){var ob=bt(want.b),on=fold(want.n),wc=(CW[want.c]||[]).map(function(w){return on+' '+w;});var seen={},cands=[];[].forEach.call(document.querySelectorAll('a[href*="/perfume/"]'),function(a){var m=a.href.match(/\/perfume\/([^\/]+)\/(.+)-(\d+)\.html/);if(!m){return;}var u=a.href.split('#')[0].split('?')[0];if(seen[u]){return;}seen[u]=1;var br=decodeURIComponent(m[1]).replace(/-/g,' ');var tb=bt(br);if(!(fold(br)===fold(want.b)||ob.some(function(t){return tb.indexOf(t)>-1;}))){return;}cands.push({u:u,n:fold(decodeURIComponent(m[2]))});});for(var i=0;i<cands.length;i++){if(wc.indexOf(cands[i].n)>-1){return{pick:cands[i]};}}var ex=cands.filter(function(c){return c.n===on;});if(ex.length===1){return{pick:ex[0]};}return{count:cands.length};}
function go(want){if(!want){toast('Otvori parfem iz admina (Traži na Fragrantici), ili klikni pravi parfem pa ponovo ⭐',4000);return;}if(!document.querySelector('a[href*="/perfume/"]')){toast('Sačekaj da se učitaju rezultati, pa ponovo ⭐',2500);return;}var res=pickFor(want);if(!res.pick){toast(res.count?'Nisam siguran koja verzija: klikni pravi parfem, pa ponovo ⭐':'Nema ga u rezultatima: klikni ga ručno ili Preskoči u adminu',4000);return;}toast('Čitam ocenu…',1500);fetch(res.pick.u,{credentials:'include'}).then(function(r){return r.text();}).then(function(html){var x=read(new DOMParser().parseFromString(html,'text/html'),res.pick.u);if(x){send(x);}else{location.href=res.pick.u;}}).catch(function(){location.href=res.pick.u;});}
var hw=location.hash.match(/atelier=([^&]+)/);if(hw){try{var hv=JSON.parse(decodeURIComponent(hw[1]));if(hv&&hv.b&&hv.n){go(hv);return;}}catch(e){}}
var done=false;function onMsg(e){if(e.origin!==O){return;}var d=e.data;if(!d||d.type!==T||d.kind!=='want'){return;}done=true;window.removeEventListener('message',onMsg);go(d);}
window.addEventListener('message',onMsg);
try{window.opener.postMessage({type:T,kind:'want'},O);}catch(e){}
setTimeout(function(){if(!done){window.removeEventListener('message',onMsg);go(null);}},1200);
})();`;
  return `javascript:${encodeURIComponent(code.replace(/\n/g, ""))}`;
}
