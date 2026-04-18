import InfoPage from "@/features/content/components/info-page/info-page";

export default function ShippingPage() {
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
