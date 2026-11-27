"use client";

import Link from "next/link";
import UserAvatar from "@/components/ui/user-avatar";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCheck,
  FiChevronRight,
  FiHeart,
  FiMail,
  FiPhone,
  FiTruck,
  FiLogIn,
  FiLogOut,
  FiMapPin,
  FiPackage,
  FiSettings,
  FiShoppingBag,
  FiShoppingCart,
  FiSliders,
  FiUser,
  FiUserPlus,
} from "react-icons/fi";
import styles from "./footer.module.css";
import { analyticsEnabled, reopenCookieBanner } from "@/features/analytics/components/analytics";
import { COMPANY, sellerLine, SOCIAL_LINKS } from "@/lib/company";
import { PiFacebookLogo, PiInstagramLogo, PiTiktokLogo } from "react-icons/pi";

const SOCIAL_ICONS: Record<string, typeof PiInstagramLogo> = {
  instagram: PiInstagramLogo,
  tiktok: PiTiktokLogo,
  facebook: PiFacebookLogo,
};

import { useCartState } from "@/features/cart/client/use-cart-state";
import {
  getAvatarUrl,
  getUserDisplayName,
  getUserInitials,
} from "@/features/auth/client/auth-user";
import { useAuthUser } from "@/features/auth/client/use-auth-user";

const shopLinks = [
  { label: "Svi parfemi", href: "/shop" },
  { label: "Brendovi", href: "/brendovi" },
  { label: "Paketi za probu", href: "/paketi" },
  { label: "Pronađi svoj miris", href: "/kviz" },
  { label: "Lista želja", href: "/wishlist" },
  { label: "O nama", href: "/about" },
];

const supportLinks = [
  { label: "Kontakt", href: "/contact" },
  { label: "Pitanja i odgovori", href: "/faq" },
  { label: "Kako kupiti?", href: "/how-to-buy" },
  { label: "Dostava robe", href: "/shipping" },
  { label: "Reklamacije i povrat", href: "/returns" },
];

const legalLinks = [
  { label: "Opšti uslovi kupovine", href: "/terms-and-conditions" },
  { label: "Politika privatnosti", href: "/privacy-policy" },
  { label: "Politika kolačića", href: "/cookie-policy" },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const pathname = usePathname();
  const router = useRouter();
  const {
    authUser,
    profile,
    isSupabaseConfigured,
    supabase,
    supabaseSetupMessage,
  } = useAuthUser();

  const { cartCount } = useCartState();
  const [cartOpen, setCartOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [shopFiltersOpen, setShopFiltersOpen] = useState(false);

  // Only the product list (/shop) has filters; a single product page (/shop/naxos) doesn't.
  const isShopPage = useMemo(() => pathname === "/shop", [pathname]);
  const areShopFiltersActive = isShopPage && shopFiltersOpen;

  const isOrdersPage = useMemo(() => pathname?.startsWith("/orders") ?? false, [pathname]);

  const isProfilePage = useMemo(() => {
    if (!pathname) return false;

    return (
      pathname.startsWith("/account") ||
      pathname.startsWith("/profile") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/register") ||
      pathname.startsWith("/addresses") ||
      pathname.startsWith("/settings")
    );
  }, [pathname]);

  const userDisplayName = useMemo(
    () => getUserDisplayName(authUser, profile),
    [authUser, profile]
  );
  const userInitials = useMemo(() => getUserInitials(authUser, profile), [authUser, profile]);
  const userAvatarUrl = useMemo(() => getAvatarUrl(authUser, profile), [authUser, profile]);

  useEffect(() => {
    if (!profileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [profileOpen]);

  useEffect(() => {
    const syncFiltersState = (event: Event) => {
      const customEvent = event as CustomEvent<{ open?: boolean }>;
      setShopFiltersOpen(Boolean(customEvent.detail?.open));
    };

    const syncCartState = (event: Event) => {
      const customEvent = event as CustomEvent<{ open?: boolean }>;
      setCartOpen(Boolean(customEvent.detail?.open));
    };

    window.addEventListener("shop:filters-state", syncFiltersState as EventListener);
    window.addEventListener("cart:state", syncCartState as EventListener);

    return () => {
      window.removeEventListener(
        "shop:filters-state",
        syncFiltersState as EventListener
      );
      window.removeEventListener("cart:state", syncCartState as EventListener);
    };
  }, []);

  const logout = useCallback(async () => {
    setProfileOpen(false);

    if (!supabase) {
      router.replace("/login");
      return;
    }

    await supabase.auth.signOut();
    router.refresh();
    router.replace("/");
  }, [router, supabase]);

  const openCart = useCallback(() => {
    setProfileOpen(false);
    (document.activeElement as HTMLElement | null)?.blur();
    window.dispatchEvent(new Event("cart:toggle"));
  }, []);

  const openFilters = useCallback(() => {
    if (!isShopPage) return;

    setProfileOpen(false);
    (document.activeElement as HTMLElement | null)?.blur();
    window.dispatchEvent(
      new CustomEvent("shop:set-filters-state", {
        detail: { open: !shopFiltersOpen },
      })
    );
  }, [isShopPage, shopFiltersOpen]);

  return (
    <>
      <footer className={styles.footer}>
        <div className={styles.wrap}>
          <div className={styles.grid}>
            <div className={styles.brandBlock}>
              <Link href="/" className={styles.brand}>
                <span className={styles.brandMark} aria-hidden="true">◆</span>
                Atelier Dekant
              </Link>
              <p className={styles.text}>
                Pažljivo pripremljeni dekanti originalnih dizajnerskih i niche parfema — za sve koji žele da miris
                upoznaju pre kupovine cele bočice.
              </p>
              <div className={styles.badges}>
                <span className={styles.badge}>
                  <FiCheck aria-hidden="true" /> Originalni parfemi
                </span>
                <span className={styles.badge}>
                  <FiTruck aria-hidden="true" /> Post-express 1–3 dana
                </span>
              </div>
            </div>

            <nav aria-label="Kupovina">
              <div className={styles.title}>Kupovina</div>
              <ul className={styles.links}>
                {shopLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Pomoć">
              <div className={styles.title}>Pomoć</div>
              <ul className={styles.links}>
                {supportLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div>
              <div className={styles.title}>Kontakt</div>
              <ul className={styles.links}>
                <li>
                  <a href={`tel:${COMPANY.phone.replace(/[^\d+]/g, "")}`}>
                    <FiPhone aria-hidden="true" /> {COMPANY.phone}
                  </a>
                </li>
                <li>
                  <a href={`mailto:${COMPANY.email}`}>
                    <FiMail aria-hidden="true" /> {COMPANY.email}
                  </a>
                </li>
                <li>
                  <Link href="/orders">
                    <FiPackage aria-hidden="true" /> Status porudžbine
                  </Link>
                </li>
              </ul>
              {SOCIAL_LINKS.length > 0 && (
                <div className={styles.social} aria-label="Društvene mreže">
                  {SOCIAL_LINKS.map((link) => {
                    const Icon = SOCIAL_ICONS[link.key] ?? PiInstagramLogo;
                    return (
                      <a
                        key={link.key}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer me"
                        className={styles.socialLink}
                        aria-label={`Atelier Dekant na mreži ${link.label}`}
                        title={link.label}
                      >
                        <Icon aria-hidden="true" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.bottom}>
          <div className={styles.bottomIn}>
            <div className={styles.bottomLinks} aria-label="Pravne informacije">
              {legalLinks.map((link) => (
                <Link key={link.label} href={link.href}>
                  {link.label}
                </Link>
              ))}
              {analyticsEnabled && (
                <button type="button" className={styles.cookieSettings} onClick={reopenCookieBanner}>
                  Podešavanja kolačića
                </button>
              )}
            </div>

            <div className={styles.bottomLeft}>
              © {currentYear} Atelier Dekant. Sva prava zadržana.
              {COMPANY.legalName && <span className={styles.seller}>{sellerLine()}</span>}
            </div>
          </div>
        </div>
      </footer>

      {profileOpen && (
        <button
          type="button"
          className={styles.mobileProfileBackdrop}
          aria-label="Zatvori profil meni"
          onClick={() => setProfileOpen(false)}
        />
      )}

      {profileOpen && (
        <div className={styles.mobileProfileSheetWrap}>
          <div
            className={styles.mobileProfileSheet}
            role="dialog"
            aria-modal="true"
            aria-label="Profil meni"
          >
            <div className={styles.mobileProfileHeader}>
              <span className={styles.mobileProfileAvatar} aria-hidden="true">
                <UserAvatar
                  src={userAvatarUrl}
                  alt={userDisplayName}
                  size={52}
                  className={styles.mobileProfileAvatarImage}
                  fallback={
                    authUser ? (
                      <span className={styles.mobileProfileInitials}>
                        {userInitials}
                      </span>
                    ) : (
                      <FiUser className={styles.mobileProfileAvatarIcon} />
                    )
                  }
                />
              </span>

              <div className={styles.mobileProfileHeaderText}>
                <div className={styles.mobileProfileTitle}>
                  {authUser ? userDisplayName : "Dobrodošli"}
                </div>

                <div className={styles.mobileProfileSubtitle}>
                  {authUser
                    ? authUser.email || "Ulogovani korisnik"
                    : isSupabaseConfigured
                      ? "Prijavi se ili napravi nalog za bržu kupovinu."
                      : supabaseSetupMessage}
                </div>

                {authUser && (
                  <div className={styles.mobileProfileBadge}>
                    Član Atelier Dekant
                  </div>
                )}
              </div>
            </div>

            <div className={styles.mobileProfileDivider} />

            {authUser ? (
              <>
                <div className={styles.mobileProfileList}>
                  <Link
                    href="/account"
                    className={styles.mobileProfileItem}
                    onClick={() => setProfileOpen(false)}
                  >
                    <span className={styles.mobileProfileItemLeft}>
                      <FiUser />
                      <span>Moj nalog</span>
                    </span>
                    <FiChevronRight className={styles.mobileProfileArrow} />
                  </Link>

                  <Link
                    href="/orders"
                    className={styles.mobileProfileItem}
                    onClick={() => setProfileOpen(false)}
                  >
                    <span className={styles.mobileProfileItemLeft}>
                      <FiPackage />
                      <span>Porudžbine</span>
                    </span>
                    <FiChevronRight className={styles.mobileProfileArrow} />
                  </Link>

                  <Link
                    href="/wishlist"
                    className={styles.mobileProfileItem}
                    onClick={() => setProfileOpen(false)}
                  >
                    <span className={styles.mobileProfileItemLeft}>
                      <FiHeart />
                      <span>Omiljeni</span>
                    </span>
                    <FiChevronRight className={styles.mobileProfileArrow} />
                  </Link>

                  <Link
                    href="/addresses"
                    className={styles.mobileProfileItem}
                    onClick={() => setProfileOpen(false)}
                  >
                    <span className={styles.mobileProfileItemLeft}>
                      <FiMapPin />
                      <span>Adrese</span>
                    </span>
                    <FiChevronRight className={styles.mobileProfileArrow} />
                  </Link>

                  <Link
                    href="/settings"
                    className={styles.mobileProfileItem}
                    onClick={() => setProfileOpen(false)}
                  >
                    <span className={styles.mobileProfileItemLeft}>
                      <FiSettings />
                      <span>Podešavanja</span>
                    </span>
                    <FiChevronRight className={styles.mobileProfileArrow} />
                  </Link>
                </div>

                <div className={styles.mobileProfileDivider} />

                <button
                  type="button"
                  className={`${styles.mobileProfileItem} ${styles.mobileProfileDanger}`}
                  onClick={logout}
                >
                  <span className={styles.mobileProfileItemLeft}>
                    <FiLogOut />
                    <span>Odjavi se</span>
                  </span>
                </button>
              </>
            ) : (
              <div className={styles.mobileGuestActions}>
                <Link
                  href="/login"
                  className={styles.mobileProfilePrimaryLink}
                  onClick={() => setProfileOpen(false)}
                >
                  <FiLogIn />
                  <span>Prijavi se</span>
                </Link>

                <Link
                  href="/register"
                  className={styles.mobileProfileGhostLink}
                  onClick={() => setProfileOpen(false)}
                >
                  <FiUserPlus />
                  <span>Registruj se</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      <nav
        className={`${styles.mobileBottomNav} ${
          isShopPage ? styles.mobileBottomNavSix : styles.mobileBottomNavFive
        }`}
        aria-label="Mobilna navigacija"
      >
        <Link
          href="/shop"
          className={`${styles.mobileBottomItem} ${
            pathname?.startsWith("/shop") ? styles.mobileBottomItemActive : ""
          }`}
        >
          <FiShoppingBag />
          <span>Shop</span>
        </Link>

        {isShopPage && (
          <button
            type="button"
            className={`${styles.mobileBottomItem} ${
              areShopFiltersActive ? styles.mobileBottomItemActive : ""
            }`}
            onClick={openFilters}
            aria-label="Otvori filtere"
            aria-pressed={areShopFiltersActive}
          >
            <FiSliders />
            <span>Filteri</span>
          </button>
        )}

        <Link
          href="/wishlist"
          className={`${styles.mobileBottomItem} ${
            pathname?.startsWith("/wishlist")
              ? styles.mobileBottomItemActive
              : ""
          }`}
        >
          <FiHeart />
          <span>Wishlist</span>
        </Link>

        <button
          type="button"
          className={`${styles.mobileBottomItem} ${
            cartOpen ? styles.mobileBottomItemActive : ""
          }`}
          onClick={openCart}
          aria-label="Otvori ili zatvori korpu"
          aria-pressed={cartOpen}
        >
          <span className={styles.mobileBottomCartIcon}>
            <FiShoppingCart />
            {cartCount > 0 && (
              <span className={styles.mobileBottomBadge}>{cartCount}</span>
            )}
          </span>
          <span>Korpa</span>
        </button>

        <Link
          href="/orders"
          className={`${styles.mobileBottomItem} ${
            isOrdersPage ? styles.mobileBottomItemActive : ""
          }`}
        >
          <FiPackage />
          <span>Porudžbine</span>
        </Link>

        <button
          type="button"
          className={`${styles.mobileBottomItem} ${
            profileOpen || isProfilePage ? styles.mobileBottomItemActive : ""
          }`}
          onClick={() => setProfileOpen((prev) => !prev)}
          aria-label="Otvori profil meni"
          aria-expanded={profileOpen}
        >
          <FiUser />
          <span>Profil</span>
        </button>
      </nav>
    </>
  );
}
