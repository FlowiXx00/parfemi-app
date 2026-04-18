import InfoPage from "@/features/content/components/info-page/info-page";

export default function CookiesPage() {
  return (
    <InfoPage
      kicker="Pravne informacije"
      title="Politika kolačića"
      intro="Kolačići se koriste kako bi sajt radio stabilno, da bi se sačuvale osnovne korisničke postavke i unapredilo iskustvo pregledanja."
      sections={[
        {
          title: "Šta su kolačići",
          body: [
            "Kolačići su male tekstualne datoteke koje pregledač čuva na uređaju korisnika. Pomažu da sajt zapamti određene informacije između poseta i da pojedine funkcije rade ispravno.",
          ],
        },
        {
          title: "Za šta ih koristimo",
          body: [
            "Koristimo ih za osnovnu funkcionalnost sajta, prijavu korisnika, rad korpe i poboljšanje korisničkog iskustva. U zavisnosti od postavki sajta, mogu se koristiti i za analitiku i tehničko praćenje performansi.",
          ],
        },
        {
          title: "Upravljanje kolačićima",
          body: [
            "Podešavanja kolačića možeš menjati kroz opcije svog pregledača. Imaj u vidu da isključivanje pojedinih kolačića može uticati na rad sajta i dostupnost određenih funkcija.",
          ],
        },
      ]}
      ctaTitle="Treba ti više informacija?"
      ctaText="Za dodatna pitanja o privatnosti i tehničkoj obradi podataka pogledaj i politiku privatnosti."
      ctaPrimary={{ label: "Politika privatnosti", href: "/privacy-policy" }}
      ctaSecondary={{ label: "Kontakt", href: "/contact" }}
    />
  );
}
