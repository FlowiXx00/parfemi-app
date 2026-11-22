/**
 * Masks customer data for the demo account: a recruiter can see how the admin works
 * without seeing real customer names, phone numbers, emails or addresses.
 */

const DOT = "•";

/** "Marko Petrović" -> "Marko P." */
export function maskName(value: string | null | undefined) {
  const parts = (value ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  const [first, ...rest] = parts;
  const initial = rest.length ? ` ${rest[rest.length - 1]!.charAt(0).toUpperCase()}.` : "";
  return `${first}${initial}`;
}

/** "marko.petrovic@gmail.com" -> "m•••@gmail.com" */
export function maskEmail(value: string | null | undefined) {
  const email = (value ?? "").trim();
  const at = email.indexOf("@");
  if (at < 1) return email ? `${DOT.repeat(3)}` : "";
  return `${email.charAt(0)}${DOT.repeat(3)}${email.slice(at)}`;
}

/** "060 123 4567" -> "06• ••• ••67" */
export function maskPhone(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length < 5) return digits ? DOT.repeat(digits.length) : "";
  return `${digits.slice(0, 2)}${DOT} ${DOT.repeat(3)} ${DOT.repeat(2)}${digits.slice(-2)}`;
}

/** "Bulevar oslobođenja 12" -> "Bulevar ••••" (keeps the first word for context) */
export function maskAddress(value: string | null | undefined) {
  const first = (value ?? "").trim().split(/\s+/)[0] ?? "";
  return first ? `${first} ${DOT.repeat(4)}` : "";
}

type CustomerFields = {
  customer_full_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  customer_note?: string | null;
};

/** Same order with masked customer data (city, items and amounts stay). */
export function maskOrderCustomer<T extends CustomerFields>(order: T): T {
  return {
    ...order,
    ...("customer_full_name" in order ? { customer_full_name: maskName(order.customer_full_name) } : {}),
    ...("customer_email" in order ? { customer_email: maskEmail(order.customer_email) } : {}),
    ...("customer_phone" in order ? { customer_phone: maskPhone(order.customer_phone) } : {}),
    ...("customer_address" in order ? { customer_address: maskAddress(order.customer_address) } : {}),
    ...("customer_note" in order && order.customer_note ? { customer_note: "(napomena kupca je skrivena u demo režimu)" } : {}),
  };
}
