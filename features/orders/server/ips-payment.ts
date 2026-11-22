import "server-only";
import QRCode from "qrcode";
import {
  buildIpsQrPayload,
  DEFAULT_PAYMENT_CODE,
  formatAccount,
  isValidAccount,
  normalizeAccount,
  referenceFromOrderNumber,
  type IpsPaymentView,
} from "@/features/orders/lib/ips-qr";

/** Settings from the env; null if IPS payment isn't configured or the account is invalid. */
export function readIpsConfig() {
  const account = normalizeAccount(process.env.IPS_ACCOUNT_NUMBER ?? "");
  const payeeName = (process.env.IPS_PAYEE_NAME ?? "").trim();
  if (!account || !payeeName) return null;
  if (!isValidAccount(account)) {
    console.error("IPS_ACCOUNT_NUMBER nema ispravan kontrolni broj — IPS QR je isključen.");
    return null;
  }
  const paymentCode = (process.env.IPS_PAYMENT_CODE ?? DEFAULT_PAYMENT_CODE).trim();
  return { account, payeeName, paymentCode };
}

/** Payment details + QR code for an order; null if IPS isn't configured (the site works without it). */
export async function buildIpsPayment(orderNumber: string, amountRsd: number): Promise<IpsPaymentView | null> {
  const config = readIpsConfig();
  if (!config || !(amountRsd > 0)) return null;

  const purpose = `Porudzbina ${orderNumber}`;
  const reference = referenceFromOrderNumber(orderNumber);

  try {
    const payload = buildIpsQrPayload({
      account: config.account,
      payeeName: config.payeeName,
      amountRsd,
      paymentCode: config.paymentCode,
      purpose,
      reference,
    });
    const qrSvg = await QRCode.toString(payload, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      color: { dark: "#111111", light: "#ffffff" },
    });

    return {
      account: formatAccount(config.account),
      payeeName: config.payeeName,
      amountRsd,
      purpose,
      reference,
      paymentCode: config.paymentCode,
      qrSvg,
    };
  } catch (error) {
    console.error("IPS QR ERROR:", error);
    return null;
  }
}
