/**
 * Safe download of an image from a link the admin pastes.
 * - https only, public addresses only (no localhost / internal networks -> SSRF protection)
 * - redirects are followed manually and each one is checked again
 * - time and response size are limited
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** Error with a message shown to the admin. */
export class ImportError extends Error {
  constructor(
    message: string,
    readonly status = 422
  ) {
    super(message);
  }
}

const MAX_REDIRECTS = 4;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a = 0, b = 0] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

async function assertPublicHttpsUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ImportError("Link nije ispravan. Nalepi ceo link, npr. https://brend.com/products/parfem", 400);
  }

  if (url.protocol !== "https:") {
    throw new ImportError("Link mora počinjati sa https://", 400);
  }
  if (url.username || url.password || (url.port && url.port !== "443")) {
    throw new ImportError("Ovakav link nije dozvoljen.", 400);
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || isIP(host)) {
    throw new ImportError("Dozvoljeni su samo linkovi javnih sajtova.", 400);
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new ImportError(`Sajt ${host} ne postoji ili trenutno nije dostupan.`);
  }
  if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new ImportError("Dozvoljeni su samo linkovi javnih sajtova.", 400);
  }

  return url;
}

function statusMessage(host: string, status: number) {
  if (status === 403 || status === 401) {
    return `Sajt ${host} ne dozvoljava automatski uvoz (zaštita od botova).`;
  }
  if (status === 429) {
    return `Sajt ${host} je privremeno odbio zahtev (previše pokušaja). Probaj ponovo za par minuta.`;
  }
  if (status === 404) {
    return `Na ${host} ne postoji ta adresa (404). Proveri link.`;
  }
  return `Sajt ${host} je vratio grešku ${status}.`;
}

export type SafeFetchResult = {
  url: URL;
  bytes: Uint8Array;
  contentType: string;
  /** true if the response was larger than the limit (truncated) */
  truncated: boolean;
};

/**
 * Downloads content from a public https URL.
 * `truncateOverLimit`: for HTML pages the beginning is enough (JSON-LD lives in <head>),
 * while an oversized image is an error.
 */
export async function safeFetch(
  raw: string | URL,
  options: { accept: string; maxBytes: number; timeoutMs: number; truncateOverLimit: boolean }
): Promise<SafeFetchResult> {
  let current = await assertPublicHttpsUrl(raw.toString());

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      let response: Response;
      try {
        response = await fetch(current, {
          redirect: "manual",
          signal: controller.signal,
          cache: "no-store",
          headers: {
            "User-Agent": BROWSER_UA,
            Accept: options.accept,
            "Accept-Language": "en-US,en;q=0.9",
          },
        });
      } catch {
        throw new ImportError(`Sajt ${current.hostname} se nije javio na vreme.`);
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new ImportError("Sajt je preusmerio na nepoznatu adresu.");
        current = await assertPublicHttpsUrl(new URL(location, current).toString());
        continue;
      }

      if (!response.ok) {
        throw new ImportError(statusMessage(current.hostname, response.status));
      }

      const declared = Number(response.headers.get("content-length") ?? 0);
      if (declared > options.maxBytes && !options.truncateOverLimit) {
        throw new ImportError(`Fajl je prevelik (najviše ${Math.round(options.maxBytes / 1024 / 1024)} MB).`);
      }

      const { bytes, truncated } = await readLimited(response, options.maxBytes);
      if (truncated && !options.truncateOverLimit) {
        throw new ImportError(`Fajl je prevelik (najviše ${Math.round(options.maxBytes / 1024 / 1024)} MB).`);
      }

      return {
        url: current,
        bytes,
        contentType: (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase(),
        truncated,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  throw new ImportError("Previše preusmeravanja.");
}

async function readLimited(response: Response, maxBytes: number) {
  const reader = response.body?.getReader();
  if (!reader) return { bytes: new Uint8Array(), truncated: false };

  const chunks: Uint8Array[] = [];
  let received = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (received + value.byteLength > maxBytes) {
      chunks.push(value.subarray(0, maxBytes - received));
      received = maxBytes;
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    received += value.byteLength;
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, truncated };
}
