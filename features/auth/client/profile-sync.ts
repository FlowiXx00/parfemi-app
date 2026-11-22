import type { UserProfile } from "./auth-user";

export const AUTH_PROFILE_UPDATED_EVENT = "auth:profile-updated";

export type AuthProfileUpdatedDetail = {
  profile: UserProfile | null;
};

export function dispatchAuthProfileUpdated(profile: UserProfile | null) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<AuthProfileUpdatedDetail>(AUTH_PROFILE_UPDATED_EVENT, {
      detail: { profile },
    })
  );
}
