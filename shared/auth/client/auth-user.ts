export type AuthUser = {
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

export type UserProfile = {
  id?: string;
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
};

export function getUserDisplayName(
  user: AuthUser | null,
  profile?: UserProfile | null
) {
  const profileName = profile?.full_name?.trim();

  if (profileName) {
    return profileName;
  }

  if (!user) return "Gost";

  const fullName = user.user_metadata?.full_name?.trim();
  const givenName = user.user_metadata?.given_name?.trim();
  const familyName = user.user_metadata?.family_name?.trim();
  const composedName = `${givenName ?? ""} ${familyName ?? ""}`.trim();
  const emailName = user.email?.split("@")[0]?.trim();

  return fullName || composedName || givenName || emailName || "Korisnik";
}

export function getUserInitials(
  user: AuthUser | null,
  profile?: UserProfile | null
) {
  const name = getUserDisplayName(user, profile)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return name || "AD";
}

export function getAvatarUrl(
  _user: AuthUser | null,
  profile?: UserProfile | null
) {
  return profile?.avatar_url?.trim() || null;
}
