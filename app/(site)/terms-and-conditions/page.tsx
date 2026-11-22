import InfoPage from "@/features/content/components/info-page/info-page";
import { getShopSettings } from "@/db/queries/settings";
import { describeShipping } from "@/features/orders/lib/shipping";
import { COMPANY, sellerLine } from "@/lib/company";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Opšti uslovi kupovine",
  description:
    "Uslovi kupovine u online prodavnici Atelier Dekant: porudžbine, cene, plaćanje, dostava, odustanak i reklamacije.",
  path: "/terms-and-conditions",
});

export const revalidate = 300;

export default async function TermsPage() {
  const shipping = await getShopSettings();

  return (
    <InfoPage
      kicker="Pravne informacije"
      title="Opšti uslovi kupovine"
      intro="Ovi uslovi važe za sve kupovine na sajtu i u skladu su sa Zakonom o zaštiti potrošača i Zakonom o obligacionim odnosima."
      updated="20. novembar 2026."
      sections={[
        {
          title: "Prodavac",
          body: [sellerLine(), `Email: ${COMPANY.email} · Telefon: ${COMPANY.phone}`],
        },
        {
          title: "Proizvodi",
          body: [
            "Dekant je originalan parfem pretočen iz fabričke bočice u manju bočicu sa raspršivačem, pažljivo i higijenski. Dekant nije originalno pakovanje proizvođača.",
            "Nazivi brendova i parfema su zaštićeni žigovi njihovih vlasnika; prodavac nije ovlašćeni distributer niti je povezan sa proizvođačima. Fotografije prikazuju originalnu bočicu radi prepoznavanja parfema.",
          ],
        },
        {
          title: "Porudžbina i zaključenje ugovora",
          body: [
            "Porudžbina se šalje klikom na „Poruči uz obavezu plaćanja”. Ugovor je zaključen kada potvrdimo porudžbinu — o tome dobijaš mejl, a status pratiš na stranici Porudžbine.",
            "Ako neki parfem iznenada nije dostupan, javljamo ti se pre slanja i nudimo zamenu ili otkazivanje bez troškova.",
          ],
        },
        {
          title: "Cene i plaćanje",
          body: [
            "Cene su izražene u dinarima (RSD) i predstavljaju konačan iznos koji plaćaš za proizvod; cena dostave prikazuje se u korpi pre potvrde porudžbine.",
            "Plaćanje je pouzećem (kuriru pri preuzimanju) ili uplatom na račun, uključujući instant plaćanje IPS QR kodom koji dobiješ posle porudžbine.",
          ],
        },
        {
          title: "Dostava",
          body: [
            `Šaljemo Post Expressom na teritoriji Srbije, obično za 1–3 radna dana od potvrde porudžbine. Dostava je ${describeShipping(shipping)}.`,
            "Pri preuzimanju proveri da paket nije oštećen; vidljivo oštećenje prijavi kuriru i nama odmah.",
          ],
        },
        {
          title: "Pravo na odustanak",
          body: [
            "Od ugovora zaključenog na daljinu možeš odustati u roku od 14 dana od prijema, bez navođenja razloga, slanjem izjave o odustanku (obrazac je na stranici Reklamacije i povrat). Novac vraćamo najkasnije u roku od 14 dana od prijema izjave, a troškove vraćanja robe snosi kupac.",
            "Zbog zaštite zdravlja i higijene, pravo na odustanak ne važi za dekant čija je zaštitna nalepnica ili zatvarač otvoren posle isporuke, u skladu sa Zakonom o zaštiti potrošača.",
          ],
        },
        {
          title: "Reklamacije i saobraznost",
          body: [
            "Za nesaobraznost robe odgovaramo u skladu sa zakonom (dve godine od predaje). Reklamaciju možeš izjaviti mejlom, telefonom ili poštom; potvrdu prijema šaljemo odmah, odgovor u roku od 8 dana, a rešavamo je najkasnije u roku od 15 dana.",
            "Sporove rešavamo dogovorno. Možeš se obratiti i telu za vansudsko rešavanje potrošačkih sporova sa liste Ministarstva unutrašnje i spoljne trgovine, ili podneti prigovor preko portala e-potrošač (e-potrosac.gov.rs).",
          ],
        },
      ]}
      ctaTitle="Pitanje o kupovini?"
      ctaText="Za sve nejasnoće pre ili posle porudžbine, piši nam."
      ctaPrimary={{ label: "Reklamacije i povrat", href: "/returns" }}
      ctaSecondary={{ label: "Kontakt", href: "/contact" }}
    />
  );
}
