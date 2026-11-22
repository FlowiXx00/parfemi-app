import { describe, expect, it } from "vitest";
import {
  buildIpsQrPayload,
  formatAccount,
  formatIpsAmount,
  isValidAccount,
  normalizeAccount,
  referenceFromOrderNumber,
} from "@/features/orders/lib/ips-qr";

// Valid account (check digits 54 = 98 - (1600000000123456 * 100 mod 97))
const VALID = "160-123456-54";
const VALID_18 = "160000000012345654";

describe("normalizeAccount", () => {
  it("zero-pads the middle part to 13 digits", () => {
    expect(normalizeAccount(VALID)).toBe(VALID_18);
  });

  it("accepts 18 digits with or without dashes", () => {
    expect(normalizeAccount(VALID_18)).toBe(VALID_18);
    expect(normalizeAccount("160-0000000123456-54")).toBe(VALID_18);
  });

  it("rejects malformed input", () => {
    expect(normalizeAccount("")).toBeNull();
    expect(normalizeAccount("16-123456-54")).toBeNull();
    expect(normalizeAccount("abc")).toBeNull();
  });
});

describe("isValidAccount (MOD 97-10)", () => {
  it("detects valid and invalid check digits", () => {
    expect(isValidAccount(VALID_18)).toBe(true);
    expect(isValidAccount("160000000012345600")).toBe(false);
  });
});

describe("formatIpsAmount / referenceFromOrderNumber / formatAccount", () => {
  it("uses a comma and two decimals", () => {
    expect(formatIpsAmount(3800)).toBe("RSD3800,00");
    expect(formatIpsAmount(1234.5)).toBe("RSD1234,50");
  });

  it("builds a model-00 reference from the order number digits", () => {
    expect(referenceFromOrderNumber("AD-611992")).toBe("00611992");
    expect(referenceFromOrderNumber("BEZ-CIFARA")).toBeNull();
  });

  it("formats the account for display", () => {
    expect(formatAccount(VALID_18)).toBe("160-0000000123456-54");
  });
});

describe("buildIpsQrPayload", () => {
  it("builds the NBS-format payload (the same string passes the official NBS validator)", () => {
    expect(
      buildIpsQrPayload({
        account: VALID,
        payeeName: "Test Prodavnica, Beograd",
        amountRsd: 3800,
        purpose: "Porudzbina AD-611992",
        reference: "00611992",
      })
    ).toBe(
      "K:PR|V:01|C:1|R:160000000012345654|N:Test Prodavnica, Beograd|I:RSD3800,00|SF:289|S:Porudzbina AD-611992|RO:00611992"
    );
  });

  it("rejects an account with wrong check digits (so customers can't pay a wrong account)", () => {
    expect(() =>
      buildIpsQrPayload({ account: "160-123456-00", payeeName: "X", amountRsd: 100, purpose: "x" })
    ).toThrow();
  });

  it("rejects a zero amount", () => {
    expect(() => buildIpsQrPayload({ account: VALID, payeeName: "X", amountRsd: 0, purpose: "x" })).toThrow();
  });

  it("strips '|' and truncates the purpose to 35 characters", () => {
    const payload = buildIpsQrPayload({
      account: VALID,
      payeeName: "A|B",
      amountRsd: 10,
      purpose: "x".repeat(50),
    });
    expect(payload).toContain("N:A B|");
    expect(payload).toContain(`S:${"x".repeat(35)}`);
    expect(payload).not.toContain("RO:");
  });
});
