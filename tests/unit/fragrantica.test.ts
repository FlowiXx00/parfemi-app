import { describe, expect, it } from "vitest";
import { parsePastedRating, titleMatchScore } from "@/features/admin/ratings/lib/fragrantica";

describe("parsePastedRating", () => {
  it("reads the rating and vote count from pasted text", () => {
    expect(parsePastedRating("Perfume rating 4.31 out of 5 with 29,185 votes")).toEqual({ rating: 4.31, votes: 29185 });
  });

  it("returns null for text without a rating", () => {
    expect(parsePastedRating("nema ničeg ovde")).toBeNull();
  });
});

describe("titleMatchScore (guards against saving a rating to the wrong perfume)", () => {
  it("the same perfume is a full match", () => {
    expect(titleMatchScore("Creed", "Aventus", "Aventus Creed for men")).toBe(1);
  });

  it("a flanker (Elixir, Intense…) lowers the score", () => {
    expect(titleMatchScore("Paco Rabanne", "1 Million", "1 Million Elixir Paco Rabanne for men")).toBeLessThan(1);
  });

  it("'Le Parfum' is a different version", () => {
    expect(titleMatchScore("YSL", "Black Opium", "Black Opium Le Parfum Yves Saint Laurent")).toBeLessThan(1);
  });

  it("an unread title doesn't block saving", () => {
    expect(titleMatchScore("Creed", "Aventus", "")).toBe(1);
  });
});
