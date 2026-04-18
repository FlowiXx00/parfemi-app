import InfoPage from "@/features/content/components/info-page/info-page";

export default function ContactPage() {
  return (
    <InfoPage
      kicker="Podrška"
      title="Kontakt"
      intro="Za pitanja o porudžbinama, dostavi, dostupnosti parfema ili savet pri izboru dekanta, kontaktiraj nas i odgovorićemo u najkraćem roku."
      sections={[
        {
          title: "Kako da nas kontaktiraš",
          body: [
            "Najbrži način za pitanja u vezi sa porudžbinama je email na info@atelierdekant.rs. Za hitne upite u vezi sa isporukom možeš nas pozvati na +381 62 803 0775.",
            "Kada nas kontaktiraš povodom postojeće porudžbine, pošalji broj porudžbine i email koji si koristio pri kupovini kako bismo ti brže pomogli.",
          ],
        },
        {
          title: "Radno vreme podrške",
          body: [
            "Odgovaramo radnim danima tokom standardnog radnog vremena. Upiti poslati vikendom ili praznikom biće obrađeni prvog narednog radnog dana.",
            "Za opšta pitanja o kupovini, dekantima i dostavi proveri i sekciju pitanja i odgovora, jer su tamo pokrivene najčešće nedoumice kupaca.",
          ],
        },
      ]}
      ctaTitle="Treba ti odgovor pre poručivanja?"
      ctaText="Pogledaj često postavljana pitanja ili idi pravo u shop ako već znaš šta želiš da naručiš."
      ctaPrimary={{ label: "Pitanja i odgovori", href: "/faq" }}
      ctaSecondary={{ label: "Idi u shop", href: "/shop" }}
    />
  );
}
