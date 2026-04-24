"use client";

import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import NextImage from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiBell,
  FiCheckCircle,
  FiEye,
  FiEyeOff,
  FiLock,
  FiMail,
  FiMaximize2,
  FiShield,
  FiTrash2,
  FiUser,
  FiX,
} from "react-icons/fi";
import { createClient } from "@/shared/supabase/supabase-client";
import { dispatchAuthProfileUpdated } from "@/shared/auth/client/profile-sync";
import styles from "./settings-page.module.css";

type ProfileForm = {
  fullName: string;
  email: string;
  phone: string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type PreferencesForm = {
  orderEmails: boolean;
  promoEmails: boolean;
  wishlistBackInStock: boolean;
};

type AuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: {
    full_name?: string | null;
    given_name?: string | null;
    family_name?: string | null;
    avatar_url?: string | null;
    phone?: string | null;
  } | null;
};

type ProfileRow = {
  id?: string;
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
};

type SupabaseBrowserClient = NonNullable<ReturnType<typeof createClient>>;

const PREFERENCES_STORAGE_KEY = "atelier-dekant:account-preferences";
const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024;
const AVATAR_OUTPUT_SIZE = 256;

const defaultPreferences: PreferencesForm = {
  orderEmails: true,
  promoEmails: false,
  wishlistBackInStock: true,
};

function getDisplayName(user: AuthUser | null, profile?: ProfileRow | null) {
  const profileName = profile?.full_name?.trim();

  if (profileName) {
    return profileName;
  }

  if (!user) return "";

  const fullName = user.user_metadata?.full_name?.trim();
  const givenName = user.user_metadata?.given_name?.trim();
  const familyName = user.user_metadata?.family_name?.trim();
  const composedName = `${givenName ?? ""} ${familyName ?? ""}`.trim();

  return fullName || composedName || "";
}

function getProfileInitials(fullName: string, email: string) {
  const value = (fullName || email)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return value || "AD";
}

function loadImageFromObjectUrl(objectUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Nismo uspeli da učitamo izabranu sliku."));
    image.src = objectUrl;
  });
}

async function buildAvatarDataUrl(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Izaberi sliku u JPG, PNG, WebP ili sličnom formatu.");
  }

  if (file.size > MAX_AVATAR_FILE_SIZE) {
    throw new Error("Avatar može imati najviše 5 MB.");
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageFromObjectUrl(objectUrl);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_OUTPUT_SIZE;
    canvas.height = AVATAR_OUTPUT_SIZE;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Preglednik trenutno ne podržava obradu slike.");
    }

    const cropSize = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = Math.max(0, (image.naturalWidth - cropSize) / 2);
    const sourceY = Math.max(0, (image.naturalHeight - cropSize) / 2);

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      image,
      sourceX,
      sourceY,
      cropSize,
      cropSize,
      0,
      0,
      AVATAR_OUTPUT_SIZE,
      AVATAR_OUTPUT_SIZE
    );

    return canvas.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function normalizeAvatarUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("data:image/")) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error();
    }

    return parsed.toString();
  } catch {
    throw new Error("Avatar mora biti ispravan http(s) link do slike.");
  }
}

async function loadProfileRow(client: SupabaseBrowserClient, userId: string) {
  const { data, error } = await client
    .from("profiles")
    .select("id, email, full_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Greška pri učitavanju profila:", error);
    return null;
  }

  return (data as ProfileRow | null) ?? null;
}

async function saveProfileRow(
  client: SupabaseBrowserClient,
  payload: {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string | null;
  }
) {
  const updatePayload = {
    email: payload.email,
    full_name: payload.full_name,
    avatar_url: payload.avatar_url,
  };

  const { data: updatedRow, error: updateError } = await client
    .from("profiles")
    .update(updatePayload)
    .eq("id", payload.id)
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }

  if (updatedRow?.id) {
    return updatedRow;
  }

  const { data: insertedRow, error: insertError } = await client
    .from("profiles")
    .insert({
      id: payload.id,
      ...updatePayload,
    })
    .select("id")
    .single();

  if (insertError) {
    throw insertError;
  }

  return insertedRow;
}

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [profile, setProfile] = useState<ProfileForm>({
    fullName: "",
    email: "",
    phone: "",
  });

  const [password, setPassword] = useState<PasswordForm>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [preferences, setPreferences] = useState<PreferencesForm>(
    defaultPreferences
  );

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [profileSaved, setProfileSaved] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [prefsMessage, setPrefsMessage] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarInputKey, setAvatarInputKey] = useState(0);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const flashTimeoutsRef = useRef<number[]>([]);

  const passwordMismatch = useMemo(() => {
    if (!password.confirmPassword) return false;
    return password.newPassword !== password.confirmPassword;
  }, [password.newPassword, password.confirmPassword]);

  const profileInitials = useMemo(
    () => getProfileInitials(profile.fullName, profile.email),
    [profile.email, profile.fullName]
  );

  useEffect(() => {
    if (!supabase) {
      setLoadingProfile(false);
      return;
    }

    const client = supabase;
    let active = true;

    async function syncUser(user: AuthUser | null) {
      const parsedPrefs = readPreferencesFromStorage();
      const profileRow = user?.id ? await loadProfileRow(client, user.id) : null;

      if (!active) return;

      setCurrentUserId(user?.id ?? null);
      setProfile({
        fullName: getDisplayName(user, profileRow),
        email: user?.email ?? profileRow?.email ?? "",
        phone: user?.user_metadata?.phone?.trim() ?? "",
      });
      setAvatarUrl(profileRow?.avatar_url?.trim() ?? null);
      setPreferences(parsedPrefs);
      setLoadingProfile(false);
    }

    async function loadUser() {
      try {
        setLoadingProfile(true);

        const {
          data: { user },
        } = await client.auth.getUser();

        await syncUser((user as AuthUser | null) ?? null);
      } finally {
        if (active) {
          setLoadingProfile(false);
        }
      }
    }

    void loadUser();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setLoadingProfile(true);
      void syncUser((session?.user as AuthUser | null) ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!isAvatarModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setIsAvatarModalOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isAvatarModalOpen]);

  useEffect(() => {
    return () => {
      flashTimeoutsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      flashTimeoutsRef.current = [];
    };
  }, []);

  function flashSaved(setter: (value: boolean) => void) {
    setter(true);

    const timeoutId = window.setTimeout(() => {
      setter(false);
      flashTimeoutsRef.current = flashTimeoutsRef.current.filter(
        (storedId) => storedId !== timeoutId
      );
    }, 1800);

    flashTimeoutsRef.current.push(timeoutId);
  }

  async function handleProfileSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const fullName = profile.fullName.trim();
    const email = profile.email.trim().toLowerCase();
    const phone = profile.phone.trim();

    if (!fullName) {
      setProfileMessage("Ime i prezime je obavezno.");
      return;
    }

    if (!email) {
      setProfileMessage("Email adresa je obavezna.");
      return;
    }

    if (!supabase) {
      setProfileMessage("Supabase nije podešen.");
      return;
    }

    if (!currentUserId) {
      setProfileMessage("Korisnik nije učitan. Osveži stranicu i pokušaj ponovo.");
      return;
    }

    try {
      setSavingProfile(true);
      setProfileMessage("");

      const normalizedAvatarUrl = normalizeAvatarUrl(avatarUrl ?? "");

      const { error: authError } = await supabase.auth.updateUser({
        email,
        data: {
          full_name: fullName,
          phone,
        },
      });

      if (authError) {
        throw authError;
      }

      await saveProfileRow(supabase, {
        id: currentUserId,
        email,
        full_name: fullName,
        avatar_url: normalizedAvatarUrl,
      });

      setAvatarUrl(normalizedAvatarUrl);
      setProfile({ fullName, email, phone });
      dispatchAuthProfileUpdated({
        id: currentUserId,
        email,
        full_name: fullName,
        avatar_url: normalizedAvatarUrl,
      });
      flashSaved(setProfileSaved);
      setProfileMessage(
        "Profil je uspešno ažuriran. Avatar se sada čita iz profiles tabele. Ako ste menjali email adresu, proverite inbox radi potvrde."
      );
    } catch (error) {
      setProfileMessage(
        error instanceof Error
          ? error.message
          : "Došlo je do greške pri čuvanju profila."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAvatarSave() {
    if (!supabase) {
      setProfileMessage("Supabase nije podešen.");
      return;
    }

    if (!currentUserId) {
      setProfileMessage("Korisnik nije učitan. Osveži stranicu i pokušaj ponovo.");
      return;
    }

    try {
      setSavingProfile(true);
      setProfileMessage("");

      const normalizedAvatarUrl = normalizeAvatarUrl(avatarUrl ?? "");
      const fullName = profile.fullName.trim();
      const email = profile.email.trim().toLowerCase();

      await saveProfileRow(supabase, {
        id: currentUserId,
        email,
        full_name: fullName,
        avatar_url: normalizedAvatarUrl,
      });

      setAvatarUrl(normalizedAvatarUrl);
      dispatchAuthProfileUpdated({
        id: currentUserId,
        email,
        full_name: fullName,
        avatar_url: normalizedAvatarUrl,
      });
      flashSaved(setProfileSaved);
      setProfileMessage("Avatar je uspešno sačuvan u profiles tabeli.");
    } catch (error) {
      setProfileMessage(
        error instanceof Error
          ? error.message
          : "Došlo je do greške pri čuvanju avatara."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setAvatarUploading(true);
      setProfileMessage("");

      const nextAvatarUrl = await buildAvatarDataUrl(file);
      setAvatarUrl(nextAvatarUrl);
      flashSaved(setProfileSaved);
      setProfileMessage(
        "Avatar je pripremljen. Klikni na 'Sačuvaj avatar' da bi bio upisan u profiles tabelu."
      );
    } catch (error) {
      setProfileMessage(
        error instanceof Error
          ? error.message
          : "Došlo je do greške pri obradi avatara."
      );
    } finally {
      setAvatarUploading(false);
      setAvatarInputKey((prev) => prev + 1);
    }
  }

  async function handleRemoveAvatar() {
    setAvatarUrl(null);
    setIsAvatarModalOpen(false);
    flashSaved(setProfileSaved);
    setProfileMessage("Avatar je uklonjen iz forme. Klikni na 'Sačuvaj avatar' da bi promena bila upisana u profiles tabelu.");
    setAvatarInputKey((prev) => prev + 1);
  }

  function handleAvatarPreviewKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsAvatarModalOpen(true);
    }
  }

  async function handlePasswordSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!password.newPassword) {
      setPasswordMessage("Unesite novu lozinku.");
      return;
    }

    if (password.newPassword.length < 8) {
      setPasswordMessage("Nova lozinka mora imati najmanje 8 karaktera.");
      return;
    }

    if (password.newPassword !== password.confirmPassword) {
      setPasswordMessage("Potvrda lozinke se ne poklapa.");
      return;
    }

    if (!supabase) {
      setPasswordMessage("Supabase nije podešen.");
      return;
    }

    try {
      setSavingPassword(true);
      setPasswordMessage("");

      const { error } = await supabase.auth.updateUser({
        password: password.newPassword,
      });

      if (error) {
        throw error;
      }

      setPassword({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      flashSaved(setPasswordSaved);
      setPasswordMessage("Lozinka je uspešno promenjena.");
    } catch (error) {
      setPasswordMessage(
        error instanceof Error
          ? error.message
          : "Došlo je do greške pri promeni lozinke."
      );
    } finally {
      setSavingPassword(false);
    }
  }

  function handlePreferencesSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      setSavingPrefs(true);
      window.localStorage.setItem(
        PREFERENCES_STORAGE_KEY,
        JSON.stringify(preferences)
      );
      flashSaved(setPrefsSaved);
      setPrefsMessage("Podešavanja su sačuvana lokalno na ovom uređaju.");
    } catch {
      setPrefsMessage("Nismo uspeli da sačuvamo podešavanja obaveštenja.");
    } finally {
      setSavingPrefs(false);
    }
  }

  if (loadingProfile) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <section className={styles.hero}>
            <div>
              <div className={styles.kicker}>Moj nalog</div>
              <h1 className={styles.title}>Podešavanja</h1>
              <p className={styles.subtitle}>Učitavanje podataka naloga...</p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <section className={styles.hero}>
          <div>
            <div className={styles.kicker}>Moj nalog</div>
            <h1 className={styles.title}>Podešavanja</h1>
            <p className={styles.subtitle}>
              Upravljaj podacima svog naloga, lozinkom i obaveštenjima na jednom
              mestu.
            </p>
          </div>

          <div className={styles.heroBadge}>
            <FiShield />
            <span>Bezbednost naloga</span>
          </div>
        </section>

        <div className={styles.layout}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>
                <FiUser />
              </div>

              <div>
                <div className={styles.cardKicker}>Profil</div>
                <h2 className={styles.cardTitle}>Lični podaci</h2>
                <p className={styles.cardText}>
                  Ažuriraj osnovne informacije koje koristimo za tvoj nalog i
                  komunikaciju.
                </p>
              </div>
            </div>

            <form className={styles.form} onSubmit={handleProfileSubmit}>
              <div className={styles.avatarSection}>
                {avatarUrl ? (
                  <button
                    type="button"
                    className={`${styles.avatarPreview} ${styles.avatarPreviewButton}`}
                    onClick={() => setIsAvatarModalOpen(true)}
                    onKeyDown={handleAvatarPreviewKeyDown}
                    aria-label="Prikaži avatar u većem prikazu"
                    title="Klikni za veći prikaz"
                  >
                    <NextImage
                      src={avatarUrl}
                      alt={profile.fullName || profile.email || "Avatar korisnika"}
                      width={256}
                      height={256}
                      unoptimized
                      className={styles.avatarImage}
                    />
                    <span className={styles.avatarPreviewOverlay}>
                      <FiMaximize2 />
                    </span>
                  </button>
                ) : (
                  <div className={styles.avatarPreview}>
                    <span className={styles.avatarFallback}>{profileInitials}</span>
                  </div>
                )}

                <div className={styles.avatarContent}>
                  <div className={styles.avatarTitle}>Avatar profila</div>
                  <div className={styles.avatarText}>
                    Avatar se sada čuva u <strong>profiles</strong> tabeli. Možeš da
                    nalepiš direktan URL slike sa interneta ili da izabereš fajl pa
                    zatim sačuvaš profil.
                  </div>

                  <label className={`${styles.field} ${styles.fieldFull}`}>
                    <span>URL avatara</span>
                    <input
                      type="url"
                      value={avatarUrl ?? ""}
                      onChange={(e) => setAvatarUrl(e.target.value || null)}
                      placeholder="https://example.com/avatar.jpg"
                      disabled={avatarUploading || savingProfile}
                    />
                  </label>

                  <div className={styles.avatarActions}>
                    <label className={styles.secondaryBtn}>
                      <input
                        key={avatarInputKey}
                        type="file"
                        accept="image/*"
                        className={styles.visuallyHidden}
                        onChange={(event) => void handleAvatarChange(event)}
                        disabled={avatarUploading || savingProfile}
                      />
                      <span>
                        {avatarUploading
                          ? "Obrada slike..."
                          : avatarUrl
                            ? "Izaberi drugu sliku"
                            : "Dodaj sliku sa uređaja"}
                      </span>
                    </label>

                    {avatarUrl ? (
                      <button
                        type="button"
                        className={styles.ghostBtn}
                        onClick={() => void handleRemoveAvatar()}
                        disabled={avatarUploading || savingProfile}
                      >
                        Ukloni avatar
                      </button>
                    ) : null}

                    <button
                      type="button"
                      className={styles.primaryBtn}
                      onClick={() => void handleAvatarSave()}
                      disabled={avatarUploading || savingProfile}
                    >
                      {savingProfile ? "Čuvanje..." : "Sačuvaj avatar"}
                    </button>
                  </div>

                  <div className={styles.helperText}>
                    Podržan je direktan http(s) link do slike ili upload sa uređaja.
                    Za upload se slika automatski prilagođava. Klikni na „Sačuvaj avatar”
                    da bi link ili upload bio upisan u profiles.
                  </div>
                </div>
              </div>

              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Ime i prezime</span>
                  <input
                    value={profile.fullName}
                    onChange={(e) =>
                      setProfile((prev) => ({
                        ...prev,
                        fullName: e.target.value,
                      }))
                    }
                    placeholder="Unesi ime i prezime"
                    required
                  />
                </label>

                <label className={styles.field}>
                  <span>Email adresa</span>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) =>
                      setProfile((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    placeholder="ime@email.com"
                    required
                  />
                </label>

                <label className={`${styles.field} ${styles.fieldFull}`}>
                  <span>Telefon</span>
                  <input
                    value={profile.phone}
                    onChange={(e) =>
                      setProfile((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                    placeholder="+381 6x xxx xx xx"
                  />
                </label>
              </div>

              {profileMessage && (
                <div className={styles.helperText}>{profileMessage}</div>
              )}

              <div className={styles.actions}>
                {profileSaved && (
                  <div className={styles.successInline}>
                    <FiCheckCircle />
                    <span>Podaci su sačuvani.</span>
                  </div>
                )}

                <button
                  type="submit"
                  className={styles.primaryBtn}
                  disabled={savingProfile}
                >
                  {savingProfile ? "Čuvanje..." : "Sačuvaj izmene"}
                </button>
              </div>
            </form>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>
                <FiLock />
              </div>

              <div>
                <div className={styles.cardKicker}>Prijava</div>
                <h2 className={styles.cardTitle}>Promena lozinke</h2>
                <p className={styles.cardText}>
                  Koristi jaku lozinku od najmanje 8 karaktera radi veće
                  bezbednosti.
                </p>
              </div>
            </div>

            <form className={styles.form} onSubmit={handlePasswordSubmit}>
              <div className={styles.stack}>
                <label className={styles.field}>
                  <span>Trenutna lozinka</span>
                  <div className={styles.passwordWrap}>
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={password.currentPassword}
                      onChange={(e) =>
                        setPassword((prev) => ({
                          ...prev,
                          currentPassword: e.target.value,
                        }))
                      }
                      placeholder="Unesi trenutnu lozinku"
                    />
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => setShowCurrentPassword((prev) => !prev)}
                      aria-label={
                        showCurrentPassword
                          ? "Sakrij lozinku"
                          : "Prikaži lozinku"
                      }
                    >
                      {showCurrentPassword ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                </label>

                <label className={styles.field}>
                  <span>Nova lozinka</span>
                  <div className={styles.passwordWrap}>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={password.newPassword}
                      onChange={(e) =>
                        setPassword((prev) => ({
                          ...prev,
                          newPassword: e.target.value,
                        }))
                      }
                      placeholder="Unesi novu lozinku"
                      required
                    />
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      aria-label={
                        showNewPassword
                          ? "Sakrij lozinku"
                          : "Prikaži lozinku"
                      }
                    >
                      {showNewPassword ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                </label>

                <label className={styles.field}>
                  <span>Potvrdi novu lozinku</span>
                  <div className={styles.passwordWrap}>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={password.confirmPassword}
                      onChange={(e) =>
                        setPassword((prev) => ({
                          ...prev,
                          confirmPassword: e.target.value,
                        }))
                      }
                      placeholder="Ponovo unesi novu lozinku"
                      required
                    />
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={
                        showConfirmPassword
                          ? "Sakrij lozinku"
                          : "Prikaži lozinku"
                      }
                    >
                      {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                </label>
              </div>

              <div className={styles.passwordMeta}>
                <div className={styles.helperText}>
                  Polje trenutne lozinke služi kao dodatni podsetnik korisniku,
                  dok promenu tehnički potvrđuje nova lozinka koju uneseš.
                </div>
                {passwordMismatch && (
                  <div className={styles.errorText}>
                    Lozinke se ne poklapaju.
                  </div>
                )}
                {passwordMessage && (
                  <div
                    className={
                      passwordSaved ? styles.successInline : styles.helperText
                    }
                  >
                    {passwordSaved && <FiCheckCircle />}
                    <span>{passwordMessage}</span>
                  </div>
                )}
              </div>

              <div className={styles.actions}>
                {passwordSaved && (
                  <div className={styles.successInline}>
                    <FiCheckCircle />
                    <span>Lozinka je sačuvana.</span>
                  </div>
                )}

                <button
                  type="submit"
                  className={styles.primaryBtn}
                  disabled={savingPassword || passwordMismatch}
                >
                  {savingPassword ? "Čuvanje..." : "Promeni lozinku"}
                </button>
              </div>
            </form>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>
                <FiBell />
              </div>

              <div>
                <div className={styles.cardKicker}>Obaveštenja</div>
                <h2 className={styles.cardTitle}>Obaveštenja na ovom uređaju</h2>
                <p className={styles.cardText}>
                  Ova podešavanja trenutno služe kao lokalna preferenca u pregledaču dok se ne povežu sa backend obaveštenjima.
                </p>
              </div>
            </div>

            <form className={styles.form} onSubmit={handlePreferencesSubmit}>
              <div className={styles.preferenceList}>
                <PreferenceRow
                  title="Obaveštenja o porudžbini"
                  text="Potvrda porudžbine i osnovna statusna obaveštenja."
                  checked={preferences.orderEmails}
                  onChange={(checked) =>
                    setPreferences((prev) => ({
                      ...prev,
                      orderEmails: checked,
                    }))
                  }
                />

                <PreferenceRow
                  title="Promotivne poruke"
                  text="Povremene novosti, akcije i obaveštenja o novim parfemima."
                  checked={preferences.promoEmails}
                  onChange={(checked) =>
                    setPreferences((prev) => ({
                      ...prev,
                      promoEmails: checked,
                    }))
                  }
                />

                <PreferenceRow
                  title="Wishlist i dostupnost"
                  text="Podsetnik kada se vrati proizvod koji te zanima."
                  checked={preferences.wishlistBackInStock}
                  onChange={(checked) =>
                    setPreferences((prev) => ({
                      ...prev,
                      wishlistBackInStock: checked,
                    }))
                  }
                />
              </div>

              {prefsMessage && <div className={styles.helperText}>{prefsMessage}</div>}

              <div className={styles.actions}>
                {prefsSaved && (
                  <div className={styles.successInline}>
                    <FiCheckCircle />
                    <span>Lokalna podešavanja su sačuvana.</span>
                  </div>
                )}

                <button
                  type="submit"
                  className={styles.primaryBtn}
                  disabled={savingPrefs}
                >
                  {savingPrefs ? "Čuvanje..." : "Sačuvaj podešavanja"}
                </button>
              </div>
            </form>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>
                <FiMail />
              </div>

              <div>
                <div className={styles.cardKicker}>Bezbednost</div>
                <h2 className={styles.cardTitle}>Saveti za nalog</h2>
                <p className={styles.cardText}>
                  Nekoliko brzih preporuka koje odmah povećavaju bezbednost i
                  stabilnost naloga.
                </p>
              </div>
            </div>

            <div className={styles.infoStrip}>
              <div className={styles.infoItem}>
                <FiShield />
                <span>Koristi jedinstvenu lozinku i menjaj je periodično.</span>
              </div>
              <div className={styles.infoItem}>
                <FiMail />
                <span>
                  Proveri da li je email adresa aktuelna kako bi mogao da pratiš
                  potvrde porudžbina.
                </span>
              </div>
            </div>
          </section>

          <section className={`${styles.card} ${styles.dangerCard}`}>
            <div className={styles.cardHeader}>
              <div className={`${styles.cardIcon} ${styles.dangerIcon}`}>
                <FiTrash2 />
              </div>

              <div>
                <div className={styles.cardKicker}>Nalog</div>
                <h2 className={styles.cardTitle}>Brisanje naloga</h2>
                <p className={styles.cardText}>
                  Ako želiš trajno uklanjanje naloga, pošalji zahtev podršci.
                  Ovo je ručni proces: prvo proveravamo aktivne porudžbine i
                  zakonske obaveze čuvanja podataka, pa tek onda potvrđujemo
                  brisanje naloga.
                </p>
              </div>
            </div>

            <div className={styles.dangerActions}>
              <a href="mailto:info@atelierdekant.rs" className={styles.dangerBtn}>
                Kontaktiraj podršku
              </a>
            </div>
          </section>
        </div>
      </div>

      {isAvatarModalOpen && avatarUrl ? (
        <div
          className={styles.avatarModalBackdrop}
          role="presentation"
          onClick={() => setIsAvatarModalOpen(false)}
        >
          <div
            className={styles.avatarModal}
            role="dialog"
            aria-modal="true"
            aria-label="Veći prikaz avatara"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.avatarModalClose}
              onClick={() => setIsAvatarModalOpen(false)}
              aria-label="Zatvori prikaz avatara"
            >
              <FiX />
            </button>

            <NextImage
              src={avatarUrl}
              alt={profile.fullName || profile.email || "Avatar korisnika"}
              width={512}
              height={512}
              unoptimized
              className={styles.avatarModalImage}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}

function readPreferencesFromStorage(): PreferencesForm {
  if (typeof window === "undefined") {
    return defaultPreferences;
  }

  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return defaultPreferences;

    const parsed = JSON.parse(raw) as Partial<PreferencesForm>;

    return {
      orderEmails:
        typeof parsed.orderEmails === "boolean"
          ? parsed.orderEmails
          : defaultPreferences.orderEmails,
      promoEmails:
        typeof parsed.promoEmails === "boolean"
          ? parsed.promoEmails
          : defaultPreferences.promoEmails,
      wishlistBackInStock:
        typeof parsed.wishlistBackInStock === "boolean"
          ? parsed.wishlistBackInStock
          : defaultPreferences.wishlistBackInStock,
    };
  } catch {
    return defaultPreferences;
  }
}

function PreferenceRow({
  title,
  text,
  checked,
  onChange,
}: {
  title: string;
  text: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={styles.preferenceRow}>
      <div>
        <div className={styles.preferenceTitle}>{title}</div>
        <div className={styles.preferenceText}>{text}</div>
      </div>

      <input
        className={styles.switch}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
