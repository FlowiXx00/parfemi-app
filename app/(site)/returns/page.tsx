import InfoPage from "@/features/content/components/info-page/info-page";
import { COMPANY, sellerLine } from "@/lib/company";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Reklamacije i povrat",
  description:
    "Kako se podnosi reklamacija, kada možeš da odustaneš od kupovine dekanta parfema i obrazac za odustanak.",
  path: "/returns",
});

export default function ReturnsPage() {
  return (
    <InfoPage
      kicker="Podrška kupcima"
      title="Reklamacije i povrat"
      intro="Ako nešto nije u redu sa porudžbinom, javi nam se — rešavamo brzo i u skladu sa Zakonom o zaštiti potrošača."
      updated="20. novembar 2026."
      sections={[
        {
          title: "Kako da izjaviš reklamaciju",
          body: [
            `Pošalji mejl na ${COMPANY.email} (ili pozovi ${COMPANY.phone}) sa brojem porudžbine, opisom problema i, ako možeš, fotografijom paketa ili proizvoda.`,
            "Prijem reklamacije potvrđujemo odmah, odgovor šaljemo u roku od 8 dana, a reklamaciju rešavamo najkasnije u roku od 15 dana — zamenom, povraćajem novca ili drugim rešenjem koje izabereš u skladu sa zakonom.",
          ],
        },
        {
          title: "Oštećen ili pogrešan paket",
          body: [
            "Vidljivo oštećen paket prijavi kuriru pri preuzimanju i odmah nam javi. Ako je stigao pogrešan parfem ili zapremina, šaljemo ispravan o našem trošku.",
          ],
        },
        {
          title: "Odustanak od kupovine (14 dana)",
          body: [
            "U roku od 14 dana od prijema možeš odustati od kupovine bez navođenja razloga — pošalji nam popunjen obrazac ispod mejlom ili poštom. Robu vrati u roku od 14 dana od slanja izjave; troškove vraćanja snosiš ti, a novac vraćamo najkasnije u roku od 14 dana od prijema izjave.",
            "Izuzetak: zbog zaštite zdravlja i higijene ne može se vratiti dekant čija je zaštitna nalepnica ili zatvarač otvoren posle isporuke.",
          ],
        },
        {
          title: "Obrazac za odustanak od ugovora",
          body: [
            `Prima: ${sellerLine()}, ${COMPANY.email}.`,
            "Ovim obaveštavam da odustajem od ugovora o kupovini sledeće robe: ______ (parfem, zapremina). Broj porudžbine: ______. Datum prijema: ______.",
            "Ime i prezime: ______ · Adresa: ______ · Broj računa za povraćaj novca: ______ · Datum i potpis (ako se šalje na papiru): ______.",
          ],
        },
      ]}
      ctaTitle="Prijavi problem"
      ctaText="Pošalji broj porudžbine i kratak opis — odgovaramo sa narednim koracima."
      ctaPrimary={{ label: "Kontakt", href: "/contact" }}
      ctaSecondary={{ label: "Opšti uslovi", href: "/terms-and-conditions" }}
    />
  );
}
