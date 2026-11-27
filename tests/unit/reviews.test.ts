import { describe, expect, it } from "vitest";
import {
  ANONYMOUS_REVIEWER,
  cleanReviewComment,
  formatRating,
  formatReviewDate,
  isEditedReview,
  mapReviewRow,
  normalizeMlList,
  parseReviewInput,
  resolveReviewMl,
  reviewCountLabel,
  reviewsStructuredData,
  shortDisplayName,
  sortReviews,
  starsLabel,
  summarizeReviews,
  type PublicReview,
} from "@/features/reviews/lib/reviews";

const review = (id: string, rating: number, createdAt: string, extra: Partial<PublicReview> = {}): PublicReview => ({
  id,
  rating,
  comment: "Odličan miris, dugo traje.",
  ml: 10,
  name: "Marko P.",
  createdAt,
  updatedAt: createdAt,
  ...extra,
});

describe("summarizeReviews", () => {
  it("counts per star and rounds the average to one decimal", () => {
    const summary = summarizeReviews([{ rating: 5 }, { rating: 4 }, { rating: 4 }]);
    expect(summary.count).toBe(3);
    expect(summary.average).toBe(4.3); // 13 / 3 = 4.333
    expect(summary.distribution).toEqual([0, 0, 0, 2, 1]);
  });

  it("is empty without reviews", () => {
    expect(summarizeReviews([])).toEqual({ count: 0, average: 0, distribution: [0, 0, 0, 0, 0] });
  });
});

describe("shortDisplayName", () => {
  it("shows the first name and the initial of the last name", () => {
    expect(shortDisplayName("Marko Petrović")).toBe("Marko P.");
    expect(shortDisplayName("  ana  maria   šarić ")).toBe("Ana Š.");
  });

  it("keeps a single name and returns null without a name", () => {
    expect(shortDisplayName("marko")).toBe("Marko");
    expect(shortDisplayName("   ")).toBeNull();
    expect(shortDisplayName(null)).toBeNull();
  });
});

describe("cleanReviewComment", () => {
  it("removes control and text-direction characters and extra empty lines", () => {
    expect(cleanReviewComment("  Super\u0007 miris‮ \r\n\r\n\r\n\r\nTraje   dugo.\t ")).toBe("Super miris\n\nTraje dugo.");
  });
});

describe("parseReviewInput", () => {
  const valid = { productId: "dior-sauvage", rating: 5, comment: "Odličan miris za svaki dan.", ml: 10 };

  it("accepts a valid review", () => {
    expect(parseReviewInput(valid)).toEqual({ ok: true, value: valid });
  });

  it("rejects a missing rating, a short comment and a bad volume", () => {
    expect(parseReviewInput({ ...valid, rating: 0 }).ok).toBe(false);
    expect(parseReviewInput({ ...valid, rating: 4.5 }).ok).toBe(false);
    expect(parseReviewInput({ ...valid, comment: "  ok  " }).ok).toBe(false);
    expect(parseReviewInput({ ...valid, comment: "a".repeat(1001) }).ok).toBe(false);
    expect(parseReviewInput({ ...valid, ml: -5 }).ok).toBe(false);
    expect(parseReviewInput(null).ok).toBe(false);
  });

  it("treats a missing volume as none", () => {
    const result = parseReviewInput({ ...valid, ml: null });
    expect(result.ok && result.value.ml).toBeNull();
  });
});

describe("received volumes", () => {
  it("normalizes the database array", () => {
    expect(normalizeMlList([10, "5", 10, null, -3, 2.5])).toEqual([5, 10]);
    expect(normalizeMlList(null)).toEqual([]);
  });

  it("stores only a volume the customer received", () => {
    expect(resolveReviewMl(10, [5, 10])).toEqual({ ok: true, ml: 10 });
    expect(resolveReviewMl(20, [5, 10])).toEqual({ ok: false });
    expect(resolveReviewMl(null, [5])).toEqual({ ok: true, ml: 5 });
    expect(resolveReviewMl(null, [5, 10])).toEqual({ ok: true, ml: null });
  });
});

describe("labels", () => {
  it("uses Serbian plurals", () => {
    expect(reviewCountLabel(1)).toBe("1 recenzija");
    expect(reviewCountLabel(3)).toBe("3 recenzije");
    expect(reviewCountLabel(5)).toBe("5 recenzija");
    expect(reviewCountLabel(12)).toBe("12 recenzija");
    expect(reviewCountLabel(21)).toBe("21 recenzija");
    expect(reviewCountLabel(22)).toBe("22 recenzije");
    expect(starsLabel(1)).toBe("1 zvezdica");
    expect(starsLabel(4)).toBe("4 zvezdice");
    expect(starsLabel(5)).toBe("5 zvezdica");
    expect(formatRating(4.75)).toBe("4,8");
  });

  it("formats the date in Belgrade time", () => {
    // 23:30 UTC on 26 Nov is already 27 Nov in Belgrade (UTC+1).
    expect(formatReviewDate("2026-11-26T23:30:00Z")).toBe("27. novembar 2026.");
    expect(formatReviewDate("nije datum")).toBe("");
  });
});

describe("mapReviewRow", () => {
  it("falls back to a generic name and to created_at", () => {
    const mapped = mapReviewRow({
      id: "1",
      rating: 4,
      comment: "Lep miris",
      ml: null,
      full_name: null,
      created_at: "2026-11-01T10:00:00Z",
      updated_at: null,
    });
    expect(mapped.name).toBe(ANONYMOUS_REVIEWER);
    expect(mapped.updatedAt).toBe("2026-11-01T10:00:00Z");
  });
});

describe("sorting and editing", () => {
  const list = [
    review("a", 3, "2026-11-01T10:00:00Z"),
    review("b", 5, "2026-11-03T10:00:00Z"),
    review("c", 1, "2026-11-02T10:00:00Z"),
  ];

  it("sorts newest, highest and lowest first", () => {
    expect(sortReviews(list, "newest").map((r) => r.id)).toEqual(["b", "c", "a"]);
    expect(sortReviews(list, "highest").map((r) => r.id)).toEqual(["b", "a", "c"]);
    expect(sortReviews(list, "lowest").map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("marks a review as edited only after more than a minute", () => {
    expect(isEditedReview({ createdAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-01T10:00:30Z" })).toBe(false);
    expect(isEditedReview({ createdAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-02T10:00:00Z" })).toBe(true);
  });
});

describe("reviewsStructuredData", () => {
  it("adds aggregateRating and the newest reviews only when there are reviews", () => {
    const reviews = [review("b", 5, "2026-11-03T10:00:00Z"), review("a", 4, "2026-11-01T10:00:00Z")];
    const data = reviewsStructuredData({ reviews, summary: summarizeReviews(reviews) });
    expect(data.aggregateRating).toMatchObject({ ratingValue: 4.5, reviewCount: 2, bestRating: 5 });
    expect(data.review?.[0]).toMatchObject({
      author: { name: "Marko P." },
      datePublished: "2026-11-03",
      reviewRating: { ratingValue: 5 },
    });
    expect(reviewsStructuredData({ reviews: [], summary: summarizeReviews([]) })).toEqual({});
  });
});
