import InfoPage from "@/features/content/components/info-page/info-page";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Politika kolačića",
  description:
    "Koje kolačiće i lokalno skladište koristi Atelier Dekant, zašto, i kako da promeniš svoj izbor.",
  path: "/cookie-policy",
});

export default function CookiesPage() {
  return (
    <InfoPage
      kicker="Pravne informacije"
      title="Politika kolačića"
      intro="Kolačići i lokalno skladište su mali podaci koje pregledač čuva na tvom uređaju. Neophodne koristimo da bi sajt radio, a analitičke samo ako ih prihvatiš."
      updated="20. novembar 2026."
      sections={[
        {
          title: "Neophodni (uvek uključeni)",
          body: [
            "Prijava na nalog: kolačići sb-… (Supabase) čuvaju sesiju dok si prijavljen.",
            "Korpa (cart), izbor kolačića (atelier-consent), podešavanja naloga i istorija AI četa čuvaju se u lokalnom skladištu pregledača i ne šalju se trećim licima.",
            "Bez njih korpa, prijava i plaćanje ne bi radili, pa za njih nije potreban pristanak.",
          ],
        },
        {
          title: "Analitički (samo uz pristanak)",
          body: [
            "Google Analytics (_ga, _ga_…): anonimna statistika poseta — koje stranice se gledaju i odakle posetioci dolaze. IP adresa se anonimizuje.",
            "Meta pixel (_fbp): merenje uspešnosti reklama na Instagramu i Facebook-u.",
            "Ovi kolačići se ne postavljaju dok ne klikneš „Prihvati” na traci za kolačiće.",
          ],
        },
        {
          title: "Kako da promeniš izbor",
          body: [
            "Klikni „Podešavanja kolačića” na dnu svake stranice i ponovo izaberi „Prihvati” ili „Odbij”. Kada odbiješ, analitički kolačići se brišu.",
            "Kolačiće možeš obrisati i u podešavanjima pregledača; tada se odjavljuješ, a korpa se prazni.",
          ],
        },
      ]}
      ctaTitle="Više o obradi podataka"
      ctaText="Šta radimo sa podacima iz porudžbine i koja su tvoja prava, piše u politici privatnosti."
      ctaPrimary={{ label: "Politika privatnosti", href: "/privacy-policy" }}
      ctaSecondary={{ label: "Kontakt", href: "/contact" }}
    />
  );
}
