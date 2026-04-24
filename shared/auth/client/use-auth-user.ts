"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/shared/supabase/supabase-client";
import {
  getSupabaseSetupMessage,
  hasSupabasePublicEnv,
} from "@/shared/supabase/env";
import type { AuthUser, UserProfile } from "./auth-user";
import { AUTH_PROFILE_UPDATED_EVENT } from "./profile-sync";

export function useSupabaseBrowser() {
  const isSupabaseConfigured = useMemo(() => hasSupabasePublicEnv(), []);
  const supabase = useMemo(
    () => (isSupabaseConfigured ? createClient() : null),
    [isSupabaseConfigured]
  );
  const supabaseSetupMessage = useMemo(() => getSupabaseSetupMessage(), []);

  return {
    isSupabaseConfigured,
    supabase,
    supabaseSetupMessage,
  };
}

async function loadUserProfile(
  supabase: NonNullable<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Greška pri učitavanju korisničkog profila:", error);
    return null;
  }

  return (data as UserProfile | null) ?? null;
}

export function useAuthUser(options?: {
  enabled?: boolean;
  initialLoading?: boolean;
}) {
  const enabled = options?.enabled ?? true;
  const initialLoading = options?.initialLoading ?? false;
  const { isSupabaseConfigured, supabase, supabaseSetupMessage } = useSupabaseBrowser();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(
    initialLoading || (enabled && isSupabaseConfigured)
  );

  useEffect(() => {
    if (!enabled) {
      queueMicrotask(() => {
        setAuthUser(null);
        setProfile(null);
        setLoading(false);
      });
      return;
    }

    if (!supabase) {
      queueMicrotask(() => {
        setAuthUser(null);
        setProfile(null);
        setLoading(false);
      });
      return;
    }

    const client = supabase;
    let active = true;

    async function hydrateUser(user: AuthUser | null) {
      if (!active) return;

      setAuthUser(user);

      if (!user?.id) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const nextProfile = await loadUserProfile(client, user.id);

      if (!active) return;

      setProfile(nextProfile);
      setLoading(false);
    }

    async function loadUser() {
      const {
        data: { user },
      } = await client.auth.getUser();

      await hydrateUser((user as AuthUser | null) ?? null);
    }

    void loadUser();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setLoading(true);
      void hydrateUser((session?.user as AuthUser | null) ?? null);
    });

    const onProfileUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ profile?: UserProfile | null }>).detail;
      const nextProfile = detail?.profile ?? null;

      setProfile((prev) => {
        if (!nextProfile) {
          return prev;
        }

        return {
          ...(prev ?? {}),
          ...nextProfile,
        };
      });
      setLoading(false);
    };

    window.addEventListener(AUTH_PROFILE_UPDATED_EVENT, onProfileUpdated as EventListener);

    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener(
        AUTH_PROFILE_UPDATED_EVENT,
        onProfileUpdated as EventListener
      );
    };
  }, [enabled, supabase]);

  return {
    authUser,
    profile,
    isSupabaseConfigured,
    loading,
    supabase,
    supabaseSetupMessage,
  };
}
