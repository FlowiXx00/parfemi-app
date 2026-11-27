import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeTrackingNumber, trackingLinkHasNumber, trackingUrl, DEFAULT_TRACKING_URL } from "@/features/orders/lib/tracking";
import { brandHref, brandInitial, brandSlug, groupByBrand } from "@/features/shop/lib/brands";
import { CUTOUT_VERSION, cutoutFor, cutoutUrl, needsCutout, readCutout } from "@/features/shop/lib/cutout";
import { dueNotifications, unavailableVolumes } from "@/features/stock-alerts/lib/alerts";
import { parseRecentlyViewed, pushRecentlyViewed } from "@/features/shop/lib/recently-viewed";
import { ADMIN_STATUS_TRANSITIONS } from "@/features/admin/orders/types";
import { toCsv } from "@/lib/csv";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("tracking numbers", () => {
  it("cleans up what the admin types", () => {
    expect(normalizeTrackingNumber(" pe 1234 5678 rs ")).toBe("PE12345678RS");
    expect(normalizeTrackingNumber("RE-123.456")).toBe("RE-123456");
    expect(normalizeTrackingNumber("ab")).toBeNull();
    expect(normalizeTrackingNumber("PE123<script>")).toBeNull();
    expect(normalizeTrackingNumber(42)).toBeNull();
  });

  it("links to the post office page, with the number only when the template asks for it", () => {
    expect(trackingUrl("PE1", "")).toBe(DEFAULT_TRACKING_URL);
    expect(trackingUrl("PE 1", "https://example.rs/t?broj={broj}")).toBe("https://example.rs/t?broj=PE%201");
    expect(trackingLinkHasNumber("https://example.rs/t?broj={broj}")).toBe(true);
    expect(trackingLinkHasNumber("")).toBe(false);
  });
});

describe("admin order steps", () => {
  it("allows delivered only after shipped and no changes after the end", () => {
    expect(ADMIN_STATUS_TRANSITIONS.shipped).toEqual(["received"]);
    expect(ADMIN_STATUS_TRANSITIONS.pending).toContain("cancelled");
    expect(ADMIN_STATUS_TRANSITIONS.received).toEqual([]);
    expect(ADMIN_STATUS_TRANSITIONS.cancelled).toEqual([]);
  });
});

describe("brand pages", () => {
  it("makes URL slugs", () => {
    expect(brandSlug("Abercrombie & Fitch")).toBe("abercrombie-fitch");
    expect(brandSlug("Maison Francis Kurkdjian")).toBe("maison-francis-kurkdjian");
    expect(brandSlug("Đorđe Šarić")).toBe("djordje-saric");
    expect(brandSlug("  Dior  ")).toBe("dior");
    expect(brandHref("Yves Saint Laurent")).toBe("/brendovi/yves-saint-laurent");
  });

  it("groups perfumes by brand, A–Z", () => {
    const groups = groupByBrand([
      { id: "1", brand: "Dior" },
      { id: "2", brand: "Armani" },
      { id: "3", brand: "Dior" },
    ]);
    expect(groups.map((group) => [group.slug, group.products.map((product) => product.id)])).toEqual([
      ["armani", ["2"]],
      ["dior", ["1", "3"]],
    ]);
  });

  it("puts brands under their first letter", () => {
    expect(brandInitial("chanel")).toBe("C");
    expect(brandInitial("4711")).toBe("#");
  });
});

describe("processed bottle images", () => {
  const source = "https://x.supabase.co/storage/v1/object/public/perfume-images/dior/abc.avif";
  const stored = { v: CUTOUT_VERSION, source, key: "0123456789abcdef", color: "#C98A3A" };

  it("uses a cutout only for the current main image and version", () => {
    expect(readCutout(stored, source)).toEqual({ key: "0123456789abcdef", color: "#c98a3a" });
    expect(readCutout(stored, "https://other/image.avif")).toBeNull();
    expect(readCutout({ ...stored, v: CUTOUT_VERSION + 1 }, source)).toBeNull();
    expect(readCutout({ ...stored, key: "../../etc" }, source)).toBeNull();
    expect(readCutout(null, source)).toBeNull();
  });

  it("knows what still has to be processed", () => {
    expect(needsCutout(null, source)).toBe(true);
    expect(needsCutout(stored, source)).toBe(false);
    expect(needsCutout(stored, "https://other/image.avif")).toBe(true);
    // A failed attempt for the same image isn't retried (the browser processes it instead)…
    expect(needsCutout({ v: CUTOUT_VERSION, source, failed: true }, source)).toBe(false);
    expect(readCutout({ v: CUTOUT_VERSION, source, failed: true }, source)).toBeNull();
    // …and without an image there's nothing to do.
    expect(needsCutout(null, undefined)).toBe(false);
  });

  it("builds the public file URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co/");
    expect(cutoutUrl("dior-sauvage", "0123456789abcdef", 384)).toBe(
      "https://x.supabase.co/storage/v1/object/public/perfume-images/dior-sauvage/cutout-384-0123456789abcdef.webp"
    );
    expect(cutoutFor({ id: "dior-sauvage", cutout: null }, 828)).toBeNull();
    expect(cutoutFor({ id: "dior-sauvage", cutout: { key: "0123456789abcdef", color: null } }, 828)?.src).toContain(
      "cutout-828-0123456789abcdef.webp"
    );
  });
});

describe("back-in-stock alerts", () => {
  const alert = (id: string, user: string, perfume: string, ml: number | null) => ({
    id,
    user_id: user,
    perfume_id: perfume,
    ml,
  });

  it("sends only alerts whose volume is available, one email per customer and perfume", () => {
    const available = new Map([
      ["dior", [5, 10]],
      ["chanel", []],
    ]);
    const due = dueNotifications(
      [
        alert("a1", "u1", "dior", null),
        alert("a2", "u1", "dior", 10),
        alert("a3", "u2", "dior", 20),
        alert("a4", "u3", "chanel", null),
      ],
      available
    );
    expect(due).toEqual([{ userId: "u1", perfumeId: "dior", alertIds: ["a1", "a2"], volumes: [5, 10] }]);
  });

  it("lists volumes that aren't available", () => {
    expect(
      unavailableVolumes([
        { ml: 5, inStock: true },
        { ml: 10, inStock: false },
      ])
    ).toEqual([10]);
  });
});

describe("recently viewed", () => {
  it("keeps the newest first, without duplicates, up to the limit", () => {
    expect(pushRecentlyViewed(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
    expect(pushRecentlyViewed(["a", "b", "c"], "d", 3)).toEqual(["d", "a", "b"]);
  });

  it("ignores broken storage", () => {
    expect(parseRecentlyViewed("not json")).toEqual([]);
    expect(parseRecentlyViewed(JSON.stringify(["a", 1, "", "b"]))).toEqual(["a", "b"]);
    expect(parseRecentlyViewed(null)).toEqual([]);
  });
});

describe("CSV export", () => {
  it("quotes fields, adds a BOM and defuses spreadsheet formulas", () => {
    const csv = toCsv([
      ["email", "ime"],
      ["a@b.rs", 'Marko "Mare" Č.'],
      ["=HYPERLINK(1)", "-2"],
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Marko ""Mare"" Č."');
    expect(csv).toContain(`"'=HYPERLINK(1)","'-2"`);
  });
});
