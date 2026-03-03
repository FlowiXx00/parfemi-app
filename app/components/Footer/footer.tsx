"use client";

export default function Footer() {
  return (
    <footer
      style={{ background: "#1f1f1f", color: "#eaeaea", borderTop: "1px solid #eee" }}
    >
      <style>{`
        .mf-wrap { max-width: 1200px; margin: 0 auto; padding: 64px 24px; }
        .mf-grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1.2fr; gap: 48px; }
        .mf-title { font-size: 12px; letter-spacing: 1.6px; font-weight: 800; color: #fff; }
        .mf-brand { font-size: 26px; letter-spacing: 4px; font-weight: 300; color: #fff; }
        .mf-text { margin-top: 18px; color: #cfcfcf; font-size: 14px; line-height: 1.6; max-width: 360px; }
        .mf-hr { margin-top: 12px; width: 40px; height: 1px; background: rgba(255,255,255,0.18); }
        .mf-links { margin-top: 14px; display: grid; gap: 10px; }
        .mf-link { color: #d7d7d7; text-decoration: none; font-size: 14px; display: inline-flex; align-items: center; gap: 8px; }
        .mf-link:hover { color: #fff; }
        .mf-arrow { opacity: .7; }
        .mf-row { margin-top: 14px; display: grid; gap: 12px; color: #d7d7d7; font-size: 14px; }
        .mf-icon { width: 18px; display: inline-block; opacity: .9; }
        .mf-social { margin-top: 18px; display: flex; gap: 14px; align-items: center; }
        .mf-sbtn { width: 34px; height: 34px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.15); display: grid; place-items: center; color: #fff; text-decoration: none; }
        .mf-sbtn:hover { border-color: rgba(255,255,255,0.35); }
        .mf-sbtn svg { display: block; } /* centriranje svg */

        .mf-pay { margin-top: 12px; display: flex; align-items: center; gap: 10px; color: #d7d7d7; font-size: 14px; }
        .mf-badge { width: 28px; height: 28px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); display: grid; place-items: center; }

        .mf-news { margin-top: 18px; display: grid; gap: 12px; }
        .mf-input { height: 44px; border-radius: 0; border: 1px solid rgba(255,255,255,0.18); background: transparent; color: #fff; padding: 0 12px; outline: none; }
        .mf-input::placeholder { color: rgba(255,255,255,0.55); }
        .mf-btn { height: 44px; width: 120px; background: #fff; color: #111; border: none; font-weight: 700; cursor: pointer; }
        .mf-btn:hover { opacity: .92; }

        .mf-bottom { border-top: 1px solid rgba(255,255,255,0.12); }
        .mf-bottomin { max-width: 1200px; margin: 0 auto; padding: 18px 24px; display: flex; justify-content: space-between; gap: 16px; color: rgba(255,255,255,0.65); font-size: 13px; flex-wrap: wrap; }
        .mf-bottomlinks { display: flex; gap: 22px; flex-wrap: wrap; }
        .mf-bottomlinks a { color: rgba(255,255,255,0.65); text-decoration: none; }
        .mf-bottomlinks a:hover { color: #fff; }

        @media (max-width: 980px) {
          .mf-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 560px) {
          .mf-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="mf-wrap">
        <div className="mf-grid">
          {/* 1) Brand */}
          <div>
            <div className="mf-brand">DEKANTI</div>
            <div className="mf-text">
              Isprobajte najbolje dizajnerske i niche parfeme po 10x–20x nižim cenama u DEKANT bočicama od 5ml ili 10ml.
            </div>
          </div>

          {/* 2) Pratite + Kontakt */}
          <div>
            <div className="mf-title">ZAPRATITE NAS</div>
            <div className="mf-hr" />
            <div className="mf-social">
              <a
                className="mf-sbtn"
                href="https://instagram.com/TVOJ_NALOG"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
              >
                <InstagramIcon size={16} />
              </a>

              <a
                className="mf-sbtn"
                href="https://tiktok.com/@TVOJ_NALOG"
                target="_blank"
                rel="noreferrer"
                aria-label="TikTok"
              >
                <TikTokIcon size={16} />
              </a>

              <a
                className="mf-sbtn"
                href="https://youtube.com/@TVOJ_KANAL"
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
              >
                <YouTubeIcon size={16} />
              </a>
            </div>

            <div style={{ marginTop: 44 }}>
              <div className="mf-title">KONTAKTIRAJTE NAS</div>
              <div className="mf-hr" />
              <div className="mf-row">
                <div>
                  <span className="mf-icon">📞</span> 0628030775
                </div>
                <div>
                  <span className="mf-icon">✉️</span> info@dekanti.rs
                </div>
              </div>
            </div>
          </div>

          {/* 3) Plaćanje + Pogodnosti */}
          <div>
            <div className="mf-title">NAČINI PLAĆANJA</div>
            <div className="mf-hr" />

            <div className="mf-pay">
              <div className="mf-badge">💵</div>
              <div>GOTOVINOM PRI POUZEĆU</div>
            </div>

            <div style={{ marginTop: 44 }}>
              <div className="mf-title">POGODNOSTI</div>
              <div className="mf-hr" />
              <div className="mf-pay" style={{ marginTop: 12 }}>
                <div className="mf-badge">✓</div>
                <div>BEZBEDNA KUPOVINA</div>
              </div>
            </div>
          </div>

          {/* 4) Podrška + Newsletter */}
          <div>
            <div className="mf-title">KORISNIČKA PODRŠKA</div>
            <div className="mf-hr" />
            <div className="mf-links">
              {[
                "Kontakt",
                "Pitanja i odgovori",
                "Zašto odabrati?",
                "Kako kupiti?",
                "Načini plaćanja",
                "Dostava robe",
                "Reklamacije",
                "Povrat robe",
                "Izjava o ograničenoj odgovornosti",
              ].map((t) => (
                <a key={t} className="mf-link" href="#">
                  {t} <span className="mf-arrow">›</span>
                </a>
              ))}
            </div>

            <div style={{ marginTop: 28 }}>
              <div className="mf-title" style={{ fontSize: 16, letterSpacing: 0.4 }}>
                Prijavite se na Newsletter
              </div>
              <div className="mf-news">
                <input className="mf-input" placeholder="Vaša e-mail adresa" />
                <button className="mf-btn">Pošaljite</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mf-bottom">
        <div className="mf-bottomin">
          <div>© 2026 DEKANT. Sva prava zadržana. — Dizajn i razvoj: FlowiXx</div>
          <div className="mf-bottomlinks">
            <a href="#">Opšti uslovi kupovine i korišćenja</a>
            <a href="#">Politika privatnosti</a>
            <a href="#">Politika kolačića</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ===== SVG IKONICE (inline) ===== */

function InstagramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9A5.5 5.5 0 0 1 16.5 22h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9Z"
      />
      <path
        fill="currentColor"
        d="M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
      />
      <path fill="currentColor" d="M17.8 6.2a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0Z" />
    </svg>
  );
}

function TikTokIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        fill="currentColor"
        d="M14 3h2.1c.2 2.1 1.5 3.9 3.6 4.6V10c-1.6-.1-3.1-.6-4.3-1.5V15c0 3.3-2.7 6-6 6s-6-2.7-6-6 2.7-6 6-6c.4 0 .7 0 1.1.1v2.6c-.3-.1-.7-.2-1.1-.2-1.9 0-3.4 1.6-3.4 3.5S8.1 18.5 10 18.5s3.5-1.6 3.5-3.5V3Z"
      />
    </svg>
  );
}

function YouTubeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.8 4.6 12 4.6 12 4.6s-5.8 0-7.5.5A3 3 0 0 0 2.4 7.2 31.2 31.2 0 0 0 2.2 12c0 1.6.1 3.2.2 4.8a3 3 0 0 0 2.1 2.1c1.7.5 7.5.5 7.5.5s5.8 0 7.5-.5a3 3 0 0 0 2.1-2.1c.1-1.6.2-3.2.2-4.8 0-1.6-.1-3.2-.2-4.8ZM10 15.5v-7l6 3.5-6 3.5Z"
      />
    </svg>
  );
}