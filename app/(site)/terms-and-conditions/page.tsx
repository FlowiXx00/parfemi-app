import InfoPage from "@/features/content/components/info-page/info-page";

export default function TermsPage() {
  return (
    <InfoPage
      kicker="Pravne informacije"
      title="Opšti uslovi kupovine"
      intro="Korišćenjem sajta i slanjem porudžbine prihvataš osnovna pravila kupovine, obrade porudžbina i komunikacije sa kupcima."
      sections={[
        {
          title: "Poručivanje i tačnost podataka",
          body: [
            "Kupac je odgovoran da pri poručivanju unese tačne i potpune podatke za kontakt i dostavu. Netočni podaci mogu dovesti do kašnjenja ili nemogućnosti isporuke.",
          ],
        },
        {
          title: "Dostupnost proizvoda i cene",
          body: [
            "Prikazani proizvodi, cene i dostupnost mogu se menjati bez prethodne najave. Ukoliko dođe do tehničke greške u prikazu podataka, prodavac zadržava pravo da kupca obavesti i predloži dalje korake pre finalizacije porudžbine.",
          ],
        },
        {
          title: "Komunikacija i podrška",
          body: [
            "Za sva pitanja, reklamacije i izmene u vezi sa porudžbinom kupac može kontaktirati podršku putem dostupnih kontakt kanala navedenih na sajtu.",
          ],
        },
      ]}
      ctaTitle="Treba ti dodatno pojašnjenje?"
      ctaText="Za konkretna pitanja o kupovini ili podršci kontaktiraj nas direktno."
      ctaPrimary={{ label: "Kontakt", href: "/contact" }}
      ctaSecondary={{ label: "Politika privatnosti", href: "/privacy-policy" }}
    />
  );
}
