import InfoPage from "@/features/content/components/info-page/info-page";

export default function PrivacyPage() {
  return (
    <InfoPage
      kicker="Pravne informacije"
      title="Politika privatnosti"
      intro="Privatnost korisnika shvatamo ozbiljno. Podatke koristimo isključivo za obradu porudžbina, komunikaciju sa kupcima i unapređenje korisničkog iskustva."
      sections={[
        {
          title: "Koje podatke prikupljamo",
          body: [
            "Prilikom registracije, kupovine ili kontakta možemo prikupljati ime i prezime, email adresu, broj telefona, adresu za dostavu i druge podatke neophodne za obradu porudžbine i podršku kupcima.",
          ],
        },
        {
          title: "Zašto obrađujemo podatke",
          body: [
            "Podatke koristimo da bismo obradili porudžbine, omogućili prijavu korisnika, prikaz istorije kupovine, odgovorili na upite i unapredili rad sajta. Bez neophodnih podataka nije moguće uspešno realizovati porudžbinu.",
          ],
        },
        {
          title: "Čuvanje i bezbednost",
          body: [
            "Preduzimamo razumne tehničke i organizacione mere kako bismo zaštitili podatke od neovlašćenog pristupa, gubitka ili zloupotrebe. Podaci se čuvaju onoliko dugo koliko je potrebno za pružanje usluge i ispunjavanje zakonskih obaveza.",
          ],
        },
      ]}
      ctaTitle="Želiš dodatne informacije o obradi podataka?"
      ctaText="Ako imaš pitanje o svojim podacima ili načinu obrade, kontaktiraj nas direktno."
      ctaPrimary={{ label: "Kontakt", href: "/contact" }}
      ctaSecondary={{ label: "Politika kolačića", href: "/cookie-policy" }}
    />
  );
}
