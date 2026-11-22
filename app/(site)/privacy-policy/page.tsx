import InfoPage from "@/features/content/components/info-page/info-page";
import { COMPANY, sellerLine } from "@/lib/company";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Politika privatnosti",
  description:
    "Koje podatke o ličnosti Atelier Dekant obrađuje, u koje svrhe, koliko dugo ih čuva i koja su tvoja prava.",
  path: "/privacy-policy",
});

export default function PrivacyPage() {
  return (
    <InfoPage
      kicker="Pravne informacije"
      title="Politika privatnosti"
      intro="Ovde je objašnjeno koje podatke o ličnosti obrađujemo kada koristiš sajt, zašto, koliko dugo ih čuvamo i koja su tvoja prava, u skladu sa Zakonom o zaštiti podataka o ličnosti."
      updated="20. novembar 2026."
      sections={[
        {
          title: "Ko obrađuje podatke",
          body: [
            `Rukovalac podacima je ${sellerLine()}.`,
            `Za sva pitanja o podacima piši na ${COMPANY.email} ili pozovi ${COMPANY.phone}.`,
          ],
        },
        {
          title: "Koje podatke prikupljamo",
          body: [
            "Porudžbina: ime i prezime, email, broj telefona, grad i adresa za dostavu, napomena i sadržaj porudžbine.",
            "Nalog (ako ga otvoriš): email, ime i šifrovana lozinka ili prijava preko Google naloga, sačuvane adrese i lista želja.",
            "Tehnički podaci: korpa, izbor kolačića i istorija razgovora sa AI savetnikom čuvaju se samo u tvom pregledaču (lokalno skladište), ne na našem serveru.",
          ],
        },
        {
          title: "Svrha i pravni osnov",
          body: [
            "Izvršenje ugovora: prijem, slanje i dostava porudžbine, obaveštenja o statusu porudžbine i rešavanje reklamacija.",
            "Zakonska obaveza: čuvanje podataka o prodaji u skladu sa propisima o računovodstvu i zaštiti potrošača.",
            "Pristanak: analitika poseta (Google Analytics, Meta pixel) radi samo ako prihvatiš kolačiće; pristanak možeš povući u svakom trenutku.",
          ],
        },
        {
          title: "Kome podaci mogu biti dostupni",
          body: [
            "Podatke ne prodajemo i ne ustupamo radi reklama. Koristimo pouzdane pružaoce usluga koji ih obrađuju samo po našem nalogu: Supabase (baza podataka i nalozi), Vercel (hosting sajta), Resend (slanje mejlova o porudžbini), Post Express (dostava: ime, adresa i telefon) i, uz tvoj pristanak, Google i Meta (analitika).",
            "AI savetnik (Anthropic) prima samo tekst poruka koje sam upišeš u čet, radi odgovora; ne šalji mu lične podatke. Deo ovih servisa obrađuje podatke van Srbije, uz zaštitne mere predviđene zakonom (standardne ugovorne klauzule).",
          ],
        },
        {
          title: "Koliko dugo čuvamo podatke",
          body: [
            "Podatke o porudžbinama čuvamo onoliko koliko propisi o računovodstvu i zaštiti potrošača zahtevaju, a podatke o nalogu dok nalog postoji.",
            "Ako obrišeš nalog, brišemo podatke koji nam više nisu potrebni; podatke o ranijim porudžbinama čuvamo do isteka zakonskog roka.",
          ],
        },
        {
          title: "Tvoja prava",
          body: [
            "Imaš pravo na pristup svojim podacima, ispravku, brisanje, ograničenje obrade, prenosivost i prigovor, kao i pravo da povučeš pristanak bez uticaja na raniju obradu. Zahtev pošalji mejlom — odgovaramo najkasnije u roku od 30 dana.",
            "Ako smatraš da su ti prava povređena, možeš podneti pritužbu Povereniku za informacije od javnog značaja i zaštitu podataka o ličnosti (www.poverenik.rs).",
          ],
        },
        {
          title: "Bezbednost",
          body: [
            "Sajt radi isključivo preko šifrovane veze (HTTPS), lozinke se čuvaju šifrovano, a pristup podacima kupaca ima samo administrator prodavnice. Ne donosimo automatizovane odluke niti pravimo profile kupaca.",
          ],
        },
      ]}
      ctaTitle="Pitanje o tvojim podacima?"
      ctaText="Piši nam i odgovorićemo u najkraćem roku."
      ctaPrimary={{ label: "Kontakt", href: "/contact" }}
      ctaSecondary={{ label: "Politika kolačića", href: "/cookie-policy" }}
    />
  );
}
