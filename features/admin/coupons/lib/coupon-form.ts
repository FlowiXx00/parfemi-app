/**
 * Admin coupon form: form state <-> database row, with validation (the same checks run on the server).
 */
import {
  COUPON_CODE_RE,
  normalizeCouponCode,
  type CouponRow,
  type CouponType,
} from "@/features/orders/lib/coupons";

export type CouponFormState = {
  code: string;
  label: string;
  type: CouponType;
  value: string;
  minSubtotal: string;
  /** datetime-local vrednost ("2026-12-01T00:00"), lokalno vreme */
  startsAt: string;
  expiresAt: string;
  maxUses: string;
  isActive: boolean;
};

export type CouponPayload = {
  code: string;
  label: string;
  type: CouponType;
  value: number;
  min_subtotal_rsd: number | null;
  starts_at: string | null;
  expires_at: string | null;
  max_uses: number | null;
  is_active: boolean;
};

export function emptyCouponForm(): CouponFormState {
  return {
    code: "",
    label: "",
    type: "percent",
    value: "10",
    minSubtotal: "",
    startsAt: "",
    expiresAt: "",
    maxUses: "",
    isActive: true,
  };
}

/** ISO (UTC) -> value for <input type="datetime-local"> in local time. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function couponToForm(row: CouponRow): CouponFormState {
  return {
    code: row.code,
    label: row.label,
    type: row.type,
    value: String(row.value),
    minSubtotal: row.min_subtotal_rsd ? String(row.min_subtotal_rsd) : "",
    startsAt: toLocalInput(row.starts_at),
    expiresAt: toLocalInput(row.expires_at),
    maxUses: row.max_uses ? String(row.max_uses) : "",
    isActive: row.is_active,
  };
}

/** Form (browser, local time) -> API payload. Throws with a message for the admin. */
export function formToPayload(form: CouponFormState): CouponPayload {
  const toIso = (value: string) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error("Datum nije ispravan.");
    return date.toISOString();
  };
  return validateCouponPayload({
    code: form.code,
    label: form.label,
    type: form.type,
    value: form.value,
    min_subtotal_rsd: form.minSubtotal,
    starts_at: toIso(form.startsAt),
    expires_at: toIso(form.expiresAt),
    max_uses: form.maxUses,
    is_active: form.isActive,
  });
}

const optionalInt = (value: unknown, label: string, min: number) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) throw new Error(`${label} mora biti ceo broj (najmanje ${min}).`);
  return n;
};

const optionalDate = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error("Datum nije ispravan.");
  return date.toISOString();
};

/** Coupon payload validation (also used by the server on every request). */
export function validateCouponPayload(input: Record<string, unknown>): CouponPayload {
  const code = normalizeCouponCode(typeof input.code === "string" ? input.code : "");
  if (!COUPON_CODE_RE.test(code)) {
    throw new Error("Kod: 3–30 znakova, samo slova A–Z, brojevi, - i _ (npr. LETO15).");
  }

  const type: CouponType = input.type === "fixed" ? "fixed" : "percent";
  const value = Number(input.value);
  if (!Number.isInteger(value) || value <= 0) throw new Error("Popust mora biti ceo broj veći od 0.");
  if (type === "percent" && value > 100) throw new Error("Procenat popusta može biti najviše 100.");

  const starts_at = optionalDate(input.starts_at);
  const expires_at = optionalDate(input.expires_at);
  if (starts_at && expires_at && new Date(starts_at) >= new Date(expires_at)) {
    throw new Error("Datum početka mora biti pre datuma isteka.");
  }

  const label = typeof input.label === "string" ? input.label.trim().slice(0, 80) : "";

  return {
    code,
    label,
    type,
    value,
    min_subtotal_rsd: optionalInt(input.min_subtotal_rsd, "Minimalni iznos", 0) || null,
    starts_at,
    expires_at,
    max_uses: optionalInt(input.max_uses, "Broj upotreba", 1),
    is_active: input.is_active !== false,
  };
}

/** Random, easy-to-read code (no 0/O or 1/I). */
export function generateCouponCode(prefix = "AD") {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `${prefix}${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}
