import InfoPage from "@/features/content/components/info-page/info-page";
import { getShopSettings } from "@/db/queries/settings";
import { formatRsd } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Dostava",
  description:
    "Rokovi i cena dostave dekanata parfema Post Expressom širom Srbije i prag za besplatnu dostavu.",
  path: "/shipping",
});

// Shipping price is edited in Admin > Settings (the page revalidates right after a save).
export const revalidate = 300;

export default async function ShippingPage() {
  const settings = await getShopSettings();
  const costLine =
    settings.shippingRsd === 0
      ? "Dostava je besplatna za sve porudžbine."
      : settings.freeShippingFromRsd
        ? `Dostava Post-expressom košta ${formatRsd(settings.shippingRsd)}, a za porudžbine od ${formatRsd(settings.freeShippingFromRsd)} (iznos proizvoda posle popusta) dostava je besplatna.`
        : `Dostava Post-expressom košta ${formatRsd(settings.shippingRsd)}.`;

  return (
    <InfoPage
      kicker="Isporuka"
      title="Dostava robe"
      intro="Na ovoj stranici su osnovne informacije o rokovima slanja, troškovima dostave i preuzimanju pošiljke."
      sections={[
        {
          title: "Rokovi slanja",
          body: [
            "Porudžbine se obrađuju nakon potvrde, a pošiljka se predaje kurirskoj službi kada bude spremna za slanje. Uobičajen rok isporuke je od jednog do tri radna dana od trenutka slanja.",
          ],
        },
        {
          title: "Troškovi dostave",
          body: [
            costLine,
            "Trošak dostave je jasno prikazan u korpi i checkout koraku pre završetka porudžbine. Na taj način ukupan iznos vidiš unapred i bez skrivenih troškova.",
          ],
        },
        {
          title: "Preuzimanje pošiljke",
          body: [
            "Kupac je dužan da proveri osnovno stanje paketa prilikom prijema. Ako primetiš da je paket fizički oštećen, prijavi to odmah kuriru i kontaktiraj nas čim pre.",
          ],
        },
      ]}
      ctaTitle="Treba ti pomoć oko isporuke?"
      ctaText="Za pitanja o postojećoj pošiljci pripremi broj porudžbine i javi nam se."
      ctaPrimary={{ label: "Kontakt", href: "/contact" }}
      ctaSecondary={{ label: "Pregled porudžbine", href: "/orders" }}
    />
  );
}
