import InfoPage from "@/features/content/components/info-page/info-page";

export default function FaqPage() {
  return (
    <InfoPage
      kicker="Podrška"
      title="Pitanja i odgovori"
      intro="Na jednom mestu su odgovori na najčešća pitanja o dekantima, kupovini, dostavi i stanju porudžbine."
      sections={[
        {
          title: "Šta je dekant?",
          body: [
            "Dekant je originalan parfem pretočen iz fabričke bočice u manju, praktičnu ambalažu. Ovakav format omogućava da miris isprobaš pre kupovine cele bočice ili da ga lakše nosiš sa sobom.",
            "Opis svakog proizvoda u shop-u jasno prikazuje zapreminu, cenu i dostupnost, kako bi pre kupovine tačno znao šta poručuješ.",
          ],
        },
        {
          title: "Kako mogu da proverim status porudžbine?",
          body: [
            "Ako imaš nalog, sve svoje porudžbine vidiš na stranici Porudžbine. Ako kupuješ kao gost, status možeš proveriti unosom broja porudžbine i email adrese korišćene pri kupovini.",
            "Status porudžbine se ažurira kada je potvrđena, poslata ili uspešno preuzeta."
          ],
        },
        {
          title: "Koliko traje isporuka?",
          body: [
            "Rok isporuke zavisi od kurirske službe i mesta dostave, ali je uobičajeno da paket stigne u roku od jednog do tri radna dana od trenutka slanja.",
            "Tačne informacije o isporuci i troškovima pogledaj na stranici Dostava robe.",
          ],
        },
        {
          title: "Mogu li da izmenim adresu nakon poručivanja?",
          body: [
            "Ako porudžbina još nije poslata, javi nam se što pre sa brojem porudžbine i tačnim podacima za isporuku. Kada paket bude predat kurirskoj službi, izmene zavise od pravila kurira.",
          ],
        },
      ]}
      ctaTitle="Nisi pronašao odgovor?"
      ctaText="Pošalji nam pitanje i odgovorićemo ti direktno."
      ctaPrimary={{ label: "Kontakt", href: "/contact" }}
      ctaSecondary={{ label: "Dostava robe", href: "/shipping" }}
    />
  );
}
