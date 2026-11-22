import Link from "next/link";
import StatusPage, { statusPageStyles as s } from "./status-page";

/** 404 page content (search + useful links); used by app/not-found and app/(site)/not-found. */
export default function NotFoundContent() {
  return (
    <StatusPage
      code="404"
      kicker="Stranica nije pronađena"
      title="Ovaj miris nismo pronašli"
      text="Link je možda zastareo ili parfem više nije u ponudi. Probaj pretragu ili pogledaj celu kolekciju."
    >
      <form action="/shop" method="get" className={s.search} role="search">
        <input type="search" name="q" placeholder="Pretraži parfeme ili brend…" aria-label="Pretraga parfema" />
        <button type="submit" className={s.primary}>
          Traži
        </button>
      </form>
      <nav className={s.links} aria-label="Korisni linkovi">
        <Link href="/shop">Svi parfemi</Link>
        <Link href="/paketi">Paketi za probu</Link>
        <Link href="/kviz">Pronađi svoj miris</Link>
        <Link href="/">Početna</Link>
      </nav>
    </StatusPage>
  );
}
