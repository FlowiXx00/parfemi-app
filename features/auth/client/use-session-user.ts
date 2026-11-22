"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/db/clients/browser";
import { hasSupabasePublicEnv } from "@/db/clients/env";

/**
 * Lightweight hook: is the user signed in?
 * Reads the session locally from the cookie (no network call, no database query),
 * so it's suitable for high-traffic public pages.
 * For the profile (name, avatar) use useAuthUser.
 */
export function useSessionUser() {
  const [user, setUser] = useState<User | null>(null);
  // Without Supabase configured there's nothing to wait for: the user is a guest.
  const [ready, setReady] = useState(() => !hasSupabasePublicEnv());

  useEffect(() => {
    const supabase = createClient();

    if (!supabase) return;

    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, isLoggedIn: Boolean(user), ready };
}
