"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiChevronRight,
  FiHeart,
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

import { useCartState } from "@/features/cart/client/use-cart-state";
import {
  getAvatarUrl,
  getUserDisplayName,
  getUserInitials,
} from "@/shared/auth/client/auth-user";
import { useAuthUser } from "@/shared/auth/client/use-auth-user";

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

  const isShopPage = useMemo(() => pathname?.startsWith("/shop"), [pathname]);

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

  useEffect(() => {
    if (!isShopPage) {
      setShopFiltersOpen(false);
    }
  }, [isShopPage]);

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
            <div className={`${styles.block} ${styles.brandBlock}`}>
              <div className={styles.eyebrow}>Dekanti originalnih parfema</div>
              <div className={styles.brand}>ATELIER DEKANT</div>
              <p className={styles.text}>
                Pažljivo pripremljeni dekanti originalnih dizajnerskih i niche
                parfema, za sve koji žele da miris upoznaju pre kupovine cele
                bočice.
              </p>
            </div>

            <div className={`${styles.block} ${styles.panel}`}>
              <div className={styles.title}>Kontakt</div>

              <div className={styles.contactList}>
                <a className={styles.contactItem} href="tel:+381628030775">
                  <span className={styles.icon}>📞</span>
                  <span>+381 62 803 0775</span>
                </a>

                <a
                  className={styles.contactItem}
                  href="mailto:info@atelierdekant.rs"
                >
                  <span className={styles.icon}>✉️</span>
                  <span>info@atelierdekant.rs</span>
                </a>
              </div>

              <div className={styles.socialWrap}>
                <div className={styles.socialLabel}>Brze stranice</div>

                <div className={styles.social}>
                  <Link
                    className={styles.sbtn}
                    href="/contact"
                    aria-label="Kontakt"
                  >
                    <span>✉️</span>
                  </Link>
                  <Link
                    className={styles.sbtn}
                    href="/orders"
                    aria-label="Porudžbine"
                  >
                    <span>📦</span>
                  </Link>
                  <Link className={styles.sbtn} href="/shop" aria-label="Shop">
                    <span>🛍️</span>
                  </Link>
                </div>
              </div>
            </div>

            <div className={`${styles.block} ${styles.panel}`}>
              <div className={styles.title}>Korisne stranice</div>
              <div className={styles.links}>
                {supportLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className={styles.link}
                  >
                    <span>{link.label}</span>
                    <span className={styles.arrow}>→</span>
                  </Link>
                ))}
              </div>
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
            </div>

            <div className={styles.bottomLeft}>
              © {currentYear} Atelier Dekant. Sva prava zadržana.
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
                {userAvatarUrl ? (
                  <img
                    src={userAvatarUrl}
                    alt={userDisplayName}
                    width={52}
                    height={52}
                    className={styles.mobileProfileAvatarImage}
                  />
                ) : authUser ? (
                  <span className={styles.mobileProfileInitials}>
                    {userInitials}
                  </span>
                ) : (
                  <FiUser className={styles.mobileProfileAvatarIcon} />
                )}
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
              shopFiltersOpen ? styles.mobileBottomItemActive : ""
            }`}
            onClick={openFilters}
            aria-label="Otvori filtere"
            aria-pressed={shopFiltersOpen}
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