import "server-only";
import { getSiteUrl } from "@/lib/site";
import { sendEmail } from "./email";

/** Order data needed for the email. */
export type OrderEmailData = {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  phone: string;
  city: string;
  address: string;
  note: string | null;
  couponCode: string | null;
  subtotalRsd: number;
  discountRsd: number;
  shippingRsd: number;
  totalRsd: number;
  items: { name: string; ml: number; qty: number; lineTotalRsd: number }[];
  /** Bank transfer details (only when IPS payment is configured) */
  payment?: { account: string; payeeName: string; reference: string | null } | null;
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const rsd = (value: number) => `${Math.round(value).toLocaleString("sr-RS")} rsd`;

/** Shared email layout (tables + inline styles, so it looks the same in Gmail, Outlook…). */
function layout(title: string, intro: string, body: string) {
  const site = getSiteUrl();
  return `<!doctype html><html lang="sr"><body style="margin:0;background:#f4f2ee;font-family:Arial,Helvetica,sans-serif;color:#1d1b18">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ee;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#15151a;padding:22px 28px;color:#f5f2ec;font-size:22px;letter-spacing:.04em;font-family:Georgia,serif">Atelier Dekant</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 10px;font-size:22px;color:#15151a">${escapeHtml(title)}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4a4640">${intro}</p>
${body}
<p style="margin:26px 0 0;font-size:13px;line-height:1.6;color:#7a756d">Pitanja? Samo odgovori na ovaj mejl ili poseti <a href="${site}/contact" style="color:#a8853f">${site.replace(/^https?:\/\//, "")}/contact</a>.</p>
</td></tr>
</table>
</td></tr></table></body></html>`;
}

function itemsTable(order: OrderEmailData) {
  const rows = order.items
    .map(
      (item) => `<tr>
<td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px">${escapeHtml(item.name)}<br><span style="color:#7a756d;font-size:12px">${item.ml} ml × ${item.qty}</span></td>
<td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;text-align:right;white-space:nowrap">${rsd(item.lineTotalRsd)}</td></tr>`
    )
    .join("");
  const line = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:4px 0;font-size:14px;${strong ? "font-weight:bold" : "color:#4a4640"}">${label}</td><td style="padding:4px 0;font-size:14px;text-align:right;${strong ? "font-weight:bold" : ""}">${value}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">
${line("Proizvodi", rsd(order.subtotalRsd))}
${order.discountRsd > 0 ? line(`Popust${order.couponCode ? ` (${escapeHtml(order.couponCode)})` : ""}`, `−${rsd(order.discountRsd)}`) : ""}
${line("Dostava", order.shippingRsd > 0 ? rsd(order.shippingRsd) : "besplatno")}
${line("Ukupno za uplatu", rsd(order.totalRsd), true)}
</table>`;
}

/** Bank transfer (alternative to cash on delivery): payee, account, amount, purpose, reference. */
function paymentBlock(order: OrderEmailData) {
  const payment = order.payment;
  if (!payment) return "";
  const row = (label: string, value: string) =>
    `<tr><td style="padding:3px 0;font-size:13px;color:#7a756d;width:120px">${label}</td><td style="padding:3px 0;font-size:14px;font-weight:bold">${value}</td></tr>`;
  return `<div style="margin:18px 0 0;padding:16px;border:1px solid #e7d9b9;background:#fbf7ee;border-radius:10px">
<p style="margin:0 0 10px;font-size:14px;line-height:1.5"><strong>Plaćanje:</strong> pouzećem kuriru, ili odmah uplatom na račun (QR kod je bio prikazan posle porudžbine):</p>
<table role="presentation" cellpadding="0" cellspacing="0">
${row("Primalac", escapeHtml(payment.payeeName))}
${row("Račun", escapeHtml(payment.account))}
${row("Iznos", rsd(order.totalRsd))}
${row("Svrha", `Porudzbina ${escapeHtml(order.orderNumber)}`)}
${payment.reference ? row("Poziv na broj", `${escapeHtml(payment.reference.slice(0, 2))} ${escapeHtml(payment.reference.slice(2))}`) : ""}
</table></div>`;
}

function addressBlock(order: OrderEmailData) {
  return `<p style="margin:18px 0 0;padding:14px;background:#f7f5f1;border-radius:10px;font-size:14px;line-height:1.6">
<strong>Dostava na:</strong><br>${escapeHtml(order.customerName)}<br>${escapeHtml(order.address)}, ${escapeHtml(order.city)}<br>Tel: ${escapeHtml(order.phone)}
${order.note ? `<br><em>Napomena: ${escapeHtml(order.note)}</em>` : ""}</p>`;
}

/** New order: confirmation to the customer + notification to the owner (ADMIN_NOTIFY_EMAIL). Errors are only logged. */
export async function sendNewOrderEmails(order: OrderEmailData) {
  const site = getSiteUrl();
  const tasks: Promise<boolean>[] = [];

  const ownerEmail = process.env.ADMIN_NOTIFY_EMAIL?.trim();

  tasks.push(
    sendEmail({
      to: order.customerEmail,
      // When the customer replies to the email, it goes to the owner.
      ...(ownerEmail ? { replyTo: ownerEmail } : {}),
      subject: `Primili smo tvoju porudžbinu #${order.orderNumber}`,
      html: layout(
        `Hvala, ${order.customerName.split(" ")[0] ?? ""}!`,
        `Tvoja porudžbina <strong>#${escapeHtml(order.orderNumber)}</strong> je primljena. Javićemo ti kad je potvrdimo i pošaljemo. Status možeš pratiti na <a href="${site}/orders" style="color:#a8853f">stranici Porudžbine</a>.`,
        itemsTable(order) + paymentBlock(order) + addressBlock(order)
      ),
    })
  );

  if (ownerEmail) {
    tasks.push(
      sendEmail({
        to: ownerEmail,
        replyTo: order.customerEmail,
        subject: `🛍 Nova porudžbina #${order.orderNumber} — ${rsd(order.totalRsd)}`,
        html: layout(
          `Nova porudžbina #${order.orderNumber}`,
          `${escapeHtml(order.customerName)} (${escapeHtml(order.customerEmail)}) je poručio/la. <a href="${site}/admin/orders" style="color:#a8853f">Otvori u adminu →</a>`,
          itemsTable(order) + addressBlock(order)
        ),
      })
    );
  }

  await Promise.allSettled(tasks);
}

const STATUS_COPY: Record<string, { subject: string; title: string; text: string }> = {
  confirmed: {
    subject: "Porudžbina #{n} je potvrđena",
    title: "Porudžbina je potvrđena ✓",
    text: "Pripremamo tvoje dekante. Javićemo ti čim paket krene na put.",
  },
  shipped: {
    subject: "Porudžbina #{n} je poslata 🚚",
    title: "Paket je na putu!",
    text: "Predali smo paket kurirskoj službi (Post-express). Obično stiže za 1–3 radna dana. Kad ga preuzmeš, potvrdi prijem na stranici Porudžbine.",
  },
  cancelled: {
    subject: "Porudžbina #{n} je otkazana",
    title: "Porudžbina je otkazana",
    text: "Tvoja porudžbina je otkazana. Ako misliš da je u pitanju greška ili imaš pitanja, samo odgovori na ovaj mejl.",
  },
};

/** Status change (confirmed / shipped / cancelled) -> email to the customer. */
export async function sendOrderStatusEmail(order: OrderEmailData, status: string) {
  const copy = STATUS_COPY[status];
  if (!copy) return;
  const site = getSiteUrl();
  const ownerEmail = process.env.ADMIN_NOTIFY_EMAIL?.trim();
  await sendEmail({
    to: order.customerEmail,
    ...(ownerEmail ? { replyTo: ownerEmail } : {}),
    subject: copy.subject.replace("{n}", order.orderNumber),
    html: layout(
      copy.title,
      `Porudžbina <strong>#${escapeHtml(order.orderNumber)}</strong>: ${copy.text} <a href="${site}/orders" style="color:#a8853f">Pogledaj porudžbinu →</a>`,
      itemsTable(order)
    ),
  });
}
