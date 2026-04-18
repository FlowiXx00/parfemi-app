"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

import CartDrawer from "@/features/cart/components/cart-drawer/cart-drawer";
import type { CartItem } from "@/features/cart/types";
import {
  decCartItem,
  incCartItem,
  readCart,
  removeCartItem,
} from "@/features/cart/client/cart.storage";
import HeaderSearch from "@/features/shop/components/product-search/product-search";
import { createClient } from "@/shared/supabase/supabase-client";
import {
  getSupabaseSetupMessage,
  hasSupabasePublicEnv,
} from "@/shared/supabase/env";

type SearchProduct = {
  id: string;
  name: string;
  brand: string;
  imageUrl: string;
  variants: { ml: number; priceRsd: number; inStock: boolean }[];
};

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
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const [searchProducts, setSearchProducts] = useState<SearchProduct[]>([]);

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.qty, 0),
    [cartItems]
  );

  const userDisplayName = useMemo(
    () => getUserDisplayName(authUser),
    [authUser]
  );
  const userInitials = useMemo(() => getUserInitials(authUser), [authUser]);
  const userAvatarUrl = useMemo(() => getAvatarUrl(authUser), [authUser]);

  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const refreshCart = useCallback(() => {
    setCartItems(readCart());
  }, []);

  useEffect(() => {
    refreshCart();

    window.addEventListener("focus", refreshCart);
    window.addEventListener("storage", refreshCart);

    return () => {
      window.removeEventListener("focus", refreshCart);
      window.removeEventListener("storage", refreshCart);
    };
  }, [refreshCart]);

  useEffect(() => {
    const onCartUpdated = () => {
      refreshCart();
    };

    const onCartOpen = () => {
      refreshCart();
      setCartOpen(true);
    };

    const onCartToggle = () => {
      refreshCart();
      setCartOpen((prev) => !prev);
    };

    window.addEventListener("cart:updated", onCartUpdated);
    window.addEventListener("cart:open", onCartOpen);
    window.addEventListener("cart:toggle", onCartToggle);

    return () => {
      window.removeEventListener("cart:updated", onCartUpdated);
      window.removeEventListener("cart:open", onCartOpen);
      window.removeEventListener("cart:toggle", onCartToggle);
    };
  }, [refreshCart]);


  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("cart:state", {
        detail: { open: cartOpen },
      })
    );
  }, [cartOpen]);

  useEffect(() => {
    let cancelled = false;

    async function loadSearchProducts() {
      if (!supabase) {
        setSearchProducts([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("perfumes")
          .select(`
            id,
            name,
            brand,
            image_url,
            variants:perfume_variants (
              ml,
              price_rsd,
              in_stock
            )
          `)
          .order("votes", { ascending: false })
          .order("rating", { ascending: false })
          .limit(300);

        if (cancelled) return;

        if (error) {
          console.error("Greška pri učitavanju proizvoda za search:", error);
          setSearchProducts([]);
          return;
        }

        const mapped: SearchProduct[] = (data ?? []).map((p) => {
          const perfume = p as {
            id: string;
            name: string | null;
            brand: string | null;
            image_url: string | null;
            variants?: Array<{
              ml: number;
              price_rsd: number;
              in_stock: boolean;
            }> | null;
          };

          return {
            id: perfume.id,
            name: perfume.name ?? "",
            brand: perfume.brand ?? "",
            imageUrl:
              perfume.image_url ?? "https://placehold.co/120x120?text=No+Image",
            variants: (perfume.variants ?? []).map((v) => ({
              ml: Number(v.ml),
              priceRsd: Number(v.price_rsd),
              inStock: Boolean(v.in_stock),
            })),
          };
        });

        setSearchProducts(mapped);
      } catch (err) {
        console.error("Search loading exception:", err);
        if (!cancelled) {
          setSearchProducts([]);
        }
      }
    }

    loadSearchProducts();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      if (!supabase) {
        setAuthUser(null);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;
      setAuthUser((user as AuthUser | null) ?? null);
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
              priority
              className={`${styles.logoImage} ${styles.logoLight}`}
            />

            <Image
              src="/images/logo-white.PNG"
              alt="Atelier Dekant"
              width={260}
              height={48}
              priority
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
            products={searchProducts}
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
              refreshCart();
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
                {userAvatarUrl ? (
                  <img
                    src={userAvatarUrl}
                    alt={userDisplayName}
                    width={36}
                    height={36}
                    className={styles.accountAvatarImage}
                  />
                ) : authUser ? (
                  <span className={styles.accountInitials}>{userInitials}</span>
                ) : (
                  <FiUser className={styles.accountIcon} />
                )}
              </span>
            </button>

            {userMenuOpen && (
              <div className={styles.accountMenu} role="menu">
                <div className={styles.accountMenuCard}>
                  <div className={styles.accountMenuHeader}>
                    <span className={styles.accountMenuAvatar} aria-hidden="true">
                      {userAvatarUrl ? (
                        <img
                          src={userAvatarUrl}
                          alt={userDisplayName}
                          width={44}
                          height={44}
                          className={styles.accountAvatarImage}
                        />
                      ) : authUser ? (
                        <span className={styles.accountInitialsLarge}>
                          {userInitials}
                        </span>
                      ) : (
                        <FiUser className={styles.accountIconLarge} />
                      )}
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
            products={searchProducts}
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
        onInc={(id, ml) => {
          incCartItem(id, ml);
          refreshCart();
        }}
        onDec={(id, ml) => {
          decCartItem(id, ml);
          refreshCart();
        }}
        onRemove={(id, ml) => {
          removeCartItem(id, ml);
          refreshCart();
        }}
      />
    </header>
  );
}