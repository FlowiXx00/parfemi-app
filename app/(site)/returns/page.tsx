import InfoPage from "@/features/content/components/info-page/info-page";

export default function ReturnsPage() {
  return (
    <InfoPage
      kicker="Podrška kupcima"
      title="Reklamacije i povrat"
      intro="Ako postoji problem sa porudžbinom, javi nam se što je pre moguće kako bismo proverili situaciju i ponudili adekvatno rešenje."
      sections={[
        {
          title: "Kada da nas kontaktiraš",
          body: [
            "Ukoliko je isporučen pogrešan artikal, paket stigne oštećen ili postoji drugi problem sa porudžbinom, pošalji nam broj porudžbine, opis problema i po mogućstvu fotografije paketa ili proizvoda.",
          ],
        },
        {
          title: "Način rešavanja reklamacije",
          body: [
            "Svaki slučaj se proverava pojedinačno. Nakon pregleda dostavljenih informacija javljamo sledeće korake, što može uključivati zamenu artikla, dodatna pojašnjenja ili drugi primeren vid rešenja.",
          ],
        },
        {
          title: "Povrat robe",
          body: [
            "Pre slanja robe nazad obavezno nas prvo kontaktiraj. Povrat bez prethodnog dogovora može usporiti obradu zahteva i otežati proveru porudžbine.",
          ],
        },
      ]}
      ctaTitle="Želiš da prijaviš problem?"
      ctaText="Pošalji nam broj porudžbine i kratak opis situacije, a mi ćemo ti odgovoriti sa narednim koracima."
      ctaPrimary={{ label: "Kontakt", href: "/contact" }}
      ctaSecondary={{ label: "Opšti uslovi", href: "/terms-and-conditions" }}
    />
  );
}
