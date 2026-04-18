import InfoPage from "@/features/content/components/info-page/info-page";

export default function HowToBuyPage() {
  return (
    <InfoPage
      kicker="Kupovina"
      title="Kako kupiti"
      intro="Kupovina je napravljena da bude jednostavna i brza, bez obzira na to da li poručuješ kao gost ili kao prijavljen korisnik."
      sections={[
        {
          title: "1. Izaberi parfem i zapreminu",
          body: [
            "Na stranici shop-a odaberi parfem koji želiš da probaš, a zatim odaberi dostupnu zapreminu. Kod svakog proizvoda jasno su prikazane cene i raspoložive varijante.",
          ],
        },
        {
          title: "2. Dodaj u korpu i proveri pregled",
          body: [
            "U korpi možeš menjati količinu, uklanjati artikle i primeniti kupon ako ga imaš. Ukupan iznos i trošak dostave prikazuju se pre završetka porudžbine.",
          ],
        },
        {
          title: "3. Unesi podatke za dostavu",
          body: [
            "Na checkout-u unesi ime i prezime, email, telefon, grad i adresu za dostavu. Ako si prijavljen i već imaš sačuvane adrese, checkout će automatski ponuditi postojeće podatke.",
          ],
        },
        {
          title: "4. Potvrdi porudžbinu",
          body: [
            "Nakon potvrde dobićeš broj porudžbine koji možeš koristiti za kasnije praćenje statusa. Ako imaš nalog, porudžbina će biti vidljiva i u sekciji Moj nalog.",
          ],
        },
      ]}
      ctaTitle="Spreman za kupovinu?"
      ctaText="Pogledaj ponudu parfema i izaberi dekant koji želiš da isprobaš."
      ctaPrimary={{ label: "Idi u shop", href: "/shop" }}
      ctaSecondary={{ label: "Pitanja i odgovori", href: "/faq" }}
    />
  );
}
