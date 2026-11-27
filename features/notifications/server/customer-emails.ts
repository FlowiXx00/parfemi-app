import "server-only";
import { getSiteUrl } from "@/lib/site";
import { emailButton, escapeHtml, layout } from "./order-emails";
import { sendEmail } from "./email";

const replyTo = () => process.env.ADMIN_NOTIFY_EMAIL?.trim() || undefined;

const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? "";

/**
 * A few days after delivery: "How do you like it?" with a link to each perfume's review form.
 * Guest orders (no account) are invited to create an account with the same email: their orders join
 * it automatically, and then they can review.
 */
export async function sendReviewRequestEmail(order: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  hasAccount: boolean;
  perfumes: { id: string; name: string; brand: string | null }[];
}) {
  const site = getSiteUrl();
  const name = firstName(order.customerName);
  const perfumes = order.perfumes
    .map(
      (perfume) => `<tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px">
${perfume.brand ? `<span style="color:#7a756d;font-size:12px;text-transform:uppercase;letter-spacing:.06em">${escapeHtml(perfume.brand)}</span><br>` : ""}
<strong>${escapeHtml(perfume.name)}</strong></td>
<td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">
${order.hasAccount ? `<a href="${site}/shop/${encodeURIComponent(perfume.id)}#recenzije" style="color:#a8853f;font-size:14px;font-weight:bold">★ Oceni</a>` : ""}
</td></tr>`
    )
    .join("");

  const body = order.hasAccount
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${perfumes}</table>
<p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#7a756d">Ocena uz kratak utisak (trajanje, za koje prilike ga nosiš) mnogo znači onima koji tek biraju. Uz recenziju se prikazuju samo ime i početno slovo prezimena.</p>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${perfumes}</table>
<p style="margin:16px 0 0;font-size:14px;line-height:1.6">Recenzije ostavljaju kupci sa nalogom. Napravi nalog sa ovom email adresom: porudžbina će se sama povezati sa nalogom i odmah ćeš moći da oceniš parfeme.</p>
${emailButton(`${site}/register`, "Napravi nalog")}`;

  return await sendEmail({
    to: order.customerEmail,
    ...(replyTo() ? { replyTo: replyTo()! } : {}),
    subject: "Kako ti se dopao miris? ★",
    html: layout(
      name ? `${name}, kako ti se dopao?` : "Kako ti se dopao miris?",
      `Nadamo se da uživaš u dekantima iz porudžbine <strong>#${escapeHtml(order.orderNumber)}</strong>. Kad ih isprobaš nekoliko dana, podeli utisak sa drugima.`,
      body +
        `<p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#9a948b">Ovo je jednokratna poruka u vezi sa tvojom porudžbinom.</p>`
    ),
  });
}

/** "Back in stock": the customer asked to be told when the perfume (or a volume) is available. */
export async function sendBackInStockEmail(message: {
  to: string;
  perfume: { id: string; name: string; brand: string };
  volumes: number[];
}) {
  const site = getSiteUrl();
  const href = `${site}/shop/${encodeURIComponent(message.perfume.id)}`;
  const volumes = message.volumes.length ? `${message.volumes.join(", ")} ml` : "";

  return await sendEmail({
    to: message.to,
    ...(replyTo() ? { replyTo: replyTo()! } : {}),
    subject: `${message.perfume.brand} ${message.perfume.name} je ponovo na stanju`,
    html: layout(
      "Ponovo na stanju!",
      `Parfem <strong>${escapeHtml(message.perfume.brand)} ${escapeHtml(message.perfume.name)}</strong> koji si čekao/la je ponovo dostupan${volumes ? ` (${escapeHtml(volumes)})` : ""}. Zalihe dekanata su male, pa ne čekaj predugo.`,
      emailButton(href, "Pogledaj parfem") +
        `<p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#9a948b">Dobio/la si ovaj mejl jer si na sajtu kliknuo/la „Javi mi kad bude na stanju”. Obaveštenje se šalje samo jednom.</p>`
    ),
  });
}
