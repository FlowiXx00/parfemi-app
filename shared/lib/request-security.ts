import { NextRequest, NextResponse } from "next/server";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

declare global {
  var __atelierDekantRateLimitStore:
    | Map<string, RateLimitEntry>
    | undefined;
}

function getRateLimitStore() {
  if (!globalThis.__atelierDekantRateLimitStore) {
    globalThis.__atelierDekantRateLimitStore = new Map<string, RateLimitEntry>();
  }

  return globalThis.__atelierDekantRateLimitStore;
}

function cleanupExpiredEntries(now: number) {
  const store = getRateLimitStore();

  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function validateSameOrigin(request: NextRequest) {
  const originHeader = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const secFetchSite = request.headers.get("sec-fetch-site");

  if (!originHeader) {
    if (!secFetchSite || secFetchSite === "same-origin" || secFetchSite === "same-site" || secFetchSite === "none") {
      return null;
    }

    return NextResponse.json(
      { error: "Zahtev nije dozvoljen sa ove lokacije." },
      { status: 403 }
    );
  }

  if (!host) return null;

  try {
    const origin = new URL(originHeader);
    const expectedProtocol = forwardedProto || origin.protocol.replace(":", "");
    const expectedOrigin = `${expectedProtocol}://${host}`;

    if (origin.origin !== expectedOrigin) {
      return NextResponse.json(
        { error: "Zahtev nije dozvoljen sa ove lokacije." },
        { status: 403 }
      );
    }

    return null;
  } catch {
    return NextResponse.json(
      { error: "Neispravan origin header." },
      { status: 403 }
    );
  }
}

export function enforceRateLimit(request: NextRequest, options: RateLimitOptions) {
  const now = Date.now();
  cleanupExpiredEntries(now);

  const ip = getClientIp(request);
  const store = getRateLimitStore();
  const storeKey = `${options.key}:${ip}`;
  const existing = store.get(storeKey);

  if (!existing || existing.resetAt <= now) {
    store.set(storeKey, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return null;
  }

  if (existing.count >= options.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

    return NextResponse.json(
      { error: "Previše zahteva. Pokušaj ponovo za koji trenutak." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      }
    );
  }

  existing.count += 1;
  store.set(storeKey, existing);
  return null;
}

export function protectMutationRoute(
  request: NextRequest,
  options: RateLimitOptions
) {
  const originError = validateSameOrigin(request);
  if (originError) return originError;

  return enforceRateLimit(request, options);
}

export function protectLookupRoute(
  request: NextRequest,
  options: RateLimitOptions
) {
  return enforceRateLimit(request, options);
}
