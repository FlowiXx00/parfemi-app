"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiChevronRight,
  FiHeart,
  FiLogIn,
  FiLogOut,
  FiMapPin,
  FiPackage,
  FiSettings,
  FiUser,
  FiUserPlus,
  FiShoppingCart
} from "react-icons/fi";
import styles from "./site-header.module.css";
import UserAvatar from "@/components/ui/user-avatar";

import CartDrawer from "@/features/cart/components/cart-drawer/cart-drawer";
import {
  changeCartItemMl,
  decCartItem,
  incCartItem,
  removeCartItem,
} from "@/features/cart/client/cart.storage";
import { useCartState } from "@/features/cart/client/use-cart-state";
import HeaderSearch from "@/features/shop/components/product-search/product-search";
import { createClient } from "@/db/clients/browser";
import {
  getSupabaseSetupMessage,
  hasSupabasePublicEnv,
} from "@/db/clients/env";

type AuthUser = {
  email?: string | null;
  user_metadata?: {
    full_name?: string | null;
    given_name?: string | null;
    family_name?: string | null;
    avatar_url?: string | null;
  } | null;
};

function getUserDisplayName(user: AuthUser | null) {
  if (!user) return "Gost";

  const fullName = user.user_metadata?.full_name?.trim();
  const givenName = user.user_metadata?.given_name?.trim();
  const familyName = user.user_metadata?.family_name?.trim();
  const composedName = `${givenName ?? ""} ${familyName ?? ""}`.trim();
  const emailName = user.email?.split("@")[0]?.trim();

  return fullName || composedName || givenName || emailName || "Korisnik";
}

function getUserInitials(user: AuthUser | null) {
  const name = getUserDisplayName(user)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return name || "AD";
}

function getAvatarUrl(user: AuthUser | null) {
  return user?.user_metadata?.avatar_url?.trim() || null;
}

const NAV_ITEMS = [
  { href: "/shop", label: "SHOP" },
  { href: "/paketi", label: "PAKETI" },
  { href: "/kviz", label: "KVIZ" },
  { href: "/wishlist", label: "WISHLIST" },
  { href: "/orders", label: "PORUDŽBINE" },
  { href: "/about", label: "O NAMA" },
] as const;

function TopMarquee({ msg }: { msg: string }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    const text = textRef.current;
    if (!viewport || !text) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;

    const speed = 170;
    const gapPx = 40;
    const direction: "rtl" | "ltr" = "rtl";

    let raf = 0;
    let last = performance.now();

    let viewportW = 0;
    let textW = 0;

    const measure = () => {
      viewportW = viewport.getBoundingClientRect().width;
      textW = text.scrollWidth;
    };

    const xRef = { x: 0 };

    const resetOutside = () => {
      xRef.x = direction === "rtl" ? viewportW + gapPx : -textW - gapPx;
      text.style.transform = `translateX(${xRef.x}px)`;
    };

    measure();
    resetOutside();

    const ro = new ResizeObserver(() => {
      measure();
      resetOutside();
    });
    ro.observe(viewport);

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;

      const dirMul = direction === "rtl" ? -1 : 1;
      xRef.x += speed * dt * dirMul;

      if (direction === "rtl") {
        if (xRef.x < -textW - gapPx) xRef.x = viewportW + gapPx;
      } else {
        if (xRef.x > viewportW + gapPx) xRef.x = -textW - gapPx;
      }

      text.style.transform = `translateX(${xRef.x}px)`;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className={styles.top}>
      <div ref={viewportRef} className={styles.viewport}>
        <span ref={textRef} className={styles.text}>
          {msg}
        </span>
      </div>
    </div>
  );
}

export default function Header() {
  const isSupabaseConfigured = useMemo(() => hasSupabasePublicEnv(), []);
  const supabase = useMemo(
    () => (isSupabaseConfigured ? createClient() : null),
    [isSupabaseConfigured]
  );
  const router = useRouter();

  const msg =
    "Sigurnost i reputacija na prvom mestu. Hvala na ukazanom poverenju!";
  const supabaseSetupMessage = useMemo(() => getSupabaseSetupMessage(), []);

  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  const [cartOpen, setCartOpen] = useState(false);
  // SSR-safe cart (no "Hydration failed" error caused by the cart badge).
  const { cartItems, cartCount } = useCartState();

  const userDisplayName = useMemo(
    () => getUserDisplayName(authUser),
    [authUser]
  );
  const userInitials = useMemo(() => getUserInitials(authUser), [authUser]);
  const userAvatarUrl = useMemo(() => getAvatarUrl(authUser), [authUser]);

  const userMenuRef = useRef<HTMLDivElement | null>(null);

  // Opens the cart drawer from elsewhere (e.g. after "Add to cart"). Cart contents refresh on their own.
  useEffect(() => {
    const onCartOpen = () => setCartOpen(true);
    const onCartToggle = () => setCartOpen((prev) => !prev);

    window.addEventListener("cart:open", onCartOpen);
    window.addEventListener("cart:toggle", onCartToggle);

    return () => {
      window.removeEventListener("cart:open", onCartOpen);
      window.removeEventListener("cart:toggle", onCartToggle);
    };
  }, []);


  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("cart:state", {
        detail: { open: cartOpen },
      })
    );
  }, [cartOpen]);

  useEffect(() => {
    let active = true;

    // getSession reads the session locally (no network call); the header is on every page.
    async function loadUser() {
      if (!supabase) {
        setAuthUser(null);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;
      setAuthUser((session?.user as AuthUser | null) ?? null);
    }

    loadUser();

    if (!supabase) {
      return () => {
        active = false;
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser((session?.user as AuthUser | null) ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 861px)");

    const onChange = () => {
      if (mq.matches) setMenuOpen(false);
    };

    onChange();
    mq.addEventListener?.("change", onChange);

    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setUserMenuOpen(false);
        setCartOpen(false);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!userMenuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (!userMenuRef.current?.contains(target)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [userMenuOpen]);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  async function logout() {
    setUserMenuOpen(false);

    if (!supabase) {
      router.replace("/login");
      return;
    }

    await supabase.auth.signOut();
    router.refresh();
    router.replace("/");
  }

  return (
    <header className={styles.header}>
      <TopMarquee msg={msg} />

      <div className={styles.main}>
        <div className={styles.mobileLeft}>
          <button
            className={`${styles.iconBtn} ${styles.menuToggle}`}
            aria-label={menuOpen ? "Zatvori meni" : "Otvori meni"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => {
              setUserMenuOpen(false);
              setMenuOpen((v) => !v);
            }}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>

        <div className={styles.left}>
          <Link
            href="/"
            className={styles.logo}
            aria-label="Atelier Dekant - Početna"
          >
            <Image
              src="/images/logo-dark.PNG"
              alt="Atelier Dekant"
              width={260}
              height={48}
              preload
              className={`${styles.logoImage} ${styles.logoLight}`}
            />

            <Image
              src="/images/logo-white.png"
              alt="Atelier Dekant"
              width={260}
              height={48}
              preload
              className={`${styles.logoImage} ${styles.logoDark}`}
            />
          </Link>
        </div>

        <nav className={styles.navDesktop} aria-label="Glavna navigacija">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className={styles.navLink}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.right}>
          <HeaderSearch
            onNavigate={() => {
              setMenuOpen(false);
              setUserMenuOpen(false);
            }}
          />

          <button
            id="cart-button"
            className={`${styles.iconBtn} ${styles.mobileHideHeaderAction}`}
            aria-label="Korpa"
            data-cart-icon
            onClick={() => {
              setUserMenuOpen(false);
              setCartOpen(true);
            }}
          >
            <FiShoppingCart size={20} aria-hidden="true" />
            {cartCount > 0 && (
              <span className={styles.badge} aria-label={`${cartCount} artikala u korpi`}>
                {cartCount}
              </span>
            )}
          </button>

          <div
            className={`${styles.accountWrap} ${styles.mobileHideHeaderAction}`}
            ref={userMenuRef}
          >
            <button
              className={`${styles.iconBtn} ${styles.accountBtn} ${userMenuOpen ? styles.accountBtnOpen : ""
                }`}
              aria-label={
                authUser
                  ? "Otvori korisnički meni"
                  : "Otvori meni za prijavu"
              }
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              onClick={() => {
                setMenuOpen(false);
                setUserMenuOpen((prev) => !prev);
              }}
            >
              <span className={styles.accountAvatar} aria-hidden="true">
                <UserAvatar
                  src={userAvatarUrl}
                  alt={userDisplayName}
                  size={36}
                  className={styles.accountAvatarImage}
                  fallback={
                    authUser ? (
                      <span className={styles.accountInitials}>{userInitials}</span>
                    ) : (
                      <FiUser className={styles.accountIcon} />
                    )
                  }
                />
              </span>
            </button>

            {userMenuOpen && (
              <div className={styles.accountMenu} role="menu">
                <div className={styles.accountMenuCard}>
                  <div className={styles.accountMenuHeader}>
                    <span className={styles.accountMenuAvatar} aria-hidden="true">
                      <UserAvatar
                        src={userAvatarUrl}
                        alt={userDisplayName}
                        size={44}
                        className={styles.accountAvatarImage}
                        fallback={
                          authUser ? (
                            <span className={styles.accountInitialsLarge}>
                              {userInitials}
                            </span>
                          ) : (
                            <FiUser className={styles.accountIconLarge} />
                          )
                        }
                      />
                    </span>

                    <div className={styles.accountMenuText}>
                      <div className={styles.accountMenuTitle}>
                        {authUser ? userDisplayName : "Dobrodošli"}
                      </div>

                      <div className={styles.accountMenuSubtitle}>
                        {authUser
                          ? authUser.email || "Ulogovani korisnik"
                          : isSupabaseConfigured
                            ? "Prijavi se ili kreiraj nalog za brži checkout."
                            : supabaseSetupMessage}
                      </div>

                      {authUser && (
                        <div className={styles.accountMenuBadge}>
                          Član Atelier Dekant
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.accountMenuDivider} />

                  {authUser ? (
                    <>
                      <div className={styles.accountMenuList}>
                        <Link
                          href="/account"
                          className={styles.accountMenuItem}
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <span className={styles.accountMenuItemLeft}>
                            <FiUser />
                            <span>Moj nalog</span>
                          </span>
                          <FiChevronRight className={styles.accountMenuArrow} />
                        </Link>

                        <Link
                          href="/orders"
                          className={styles.accountMenuItem}
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <span className={styles.accountMenuItemLeft}>
                            <FiPackage />
                            <span>Porudžbine</span>
                          </span>
                          <FiChevronRight className={styles.accountMenuArrow} />
                        </Link>

                        <Link
                          href="/wishlist"
                          className={styles.accountMenuItem}
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <span className={styles.accountMenuItemLeft}>
                            <FiHeart />
                            <span>Omiljeni</span>
                          </span>
                          <FiChevronRight className={styles.accountMenuArrow} />
                        </Link>

                        <Link
                          href="/addresses"
                          className={styles.accountMenuItem}
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <span className={styles.accountMenuItemLeft}>
                            <FiMapPin />
                            <span>Adrese</span>
                          </span>
                          <FiChevronRight className={styles.accountMenuArrow} />
                        </Link>

                        <Link
                          href="/settings"
                          className={styles.accountMenuItem}
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <span className={styles.accountMenuItemLeft}>
                            <FiSettings />
                            <span>Podešavanja</span>
                          </span>
                          <FiChevronRight className={styles.accountMenuArrow} />
                        </Link>
                      </div>

                      <div className={styles.accountMenuDivider} />

                      <button
                        className={`${styles.accountMenuItem} ${styles.accountMenuDangerItem}`}
                        onClick={logout}
                        role="menuitem"
                        type="button"
                      >
                        <span className={styles.accountMenuItemLeft}>
                          <FiLogOut />
                          <span>Odjavi se</span>
                        </span>
                      </button>
                    </>
                  ) : (
                    <div className={styles.accountGuestActions}>
                      <Link
                        href="/login"
                        className={styles.accountPrimaryLink}
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <FiLogIn aria-hidden="true" />
                        <span>Prijavi se</span>
                      </Link>

                      <Link
                        href="/register"
                        className={styles.accountGhostLink}
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <FiUserPlus aria-hidden="true" />
                        <span>Registruj se</span>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.mobileRight}>
          <HeaderSearch
            onNavigate={() => {
              setMenuOpen(false);
              setUserMenuOpen(false);
            }}
          />
        </div>
      </div>

      <div
        id="mobile-menu"
        className={`${styles.mobilePanel} ${menuOpen ? styles.mobileOpen : ""}`}
      >
        <nav className={styles.navMobile} aria-label="Mobilna navigacija">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={styles.mobileLink}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {menuOpen && (
        <button
          className={styles.backdrop}
          onClick={() => {
            setMenuOpen(false);
            setUserMenuOpen(false);
          }}
          aria-label="Zatvori navigaciju"
        />
      )}

      <CartDrawer
        open={cartOpen}
        items={cartItems}
        onClose={() => setCartOpen(false)}
        // Cart functions announce changes themselves (cart:updated), so the view refreshes on its own.
        onInc={incCartItem}
        onDec={decCartItem}
        onRemove={removeCartItem}
        onChangeMl={changeCartItemMl}
      />
    </header>
  );
}
