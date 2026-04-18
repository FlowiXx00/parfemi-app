import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/shared/supabase/supabase-server";
import { supabaseAdmin } from "@/shared/supabase/supabase-admin";
import Footer from "@/shared/ui/footer/footer";
import Header from "@/widgets/site-header/site-header";
import AdminHeader from "@/features/admin/layout/header/header";
import styles from "./layout.module.css";

type RoleJoin = { name: string };
type RoleRow = { roles: RoleJoin | RoleJoin[] | null };

type ProfileRow = {
  first_name: string | null;
  last_name: string | null;
  username: string | null;
};

function getDisplayName(profile: ProfileRow | null, email: string | null) {
  const first = profile?.first_name?.trim() ?? "";
  const last = profile?.last_name?.trim() ?? "";
  const username = profile?.username?.trim() ?? "";
  const fullName = `${first} ${last}`.trim();

  if (fullName) return fullName;
  if (username) return username;
  if (email) return email;
  return "admin";
}

async function getAdminContext() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login?next=/admin");
  }

  const { data, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", user.id)
    .is("revoked_at", null);

  if (roleError) {
    redirect("/");
  }

  const roleNames =
    (data as RoleRow[] | null)
      ?.flatMap((row) => {
        const r = row.roles;
        if (!r) return [];
        return Array.isArray(r) ? r.map((x) => x.name) : [r.name];
      }) ?? [];

  if (!Array.from(new Set(roleNames)).includes("admin")) {
    redirect("/");
  }

  const { data: profileData } = await supabaseAdmin
    .from("profiles")
    .select("first_name, last_name, username")
    .eq("id", user.id)
    .maybeSingle();

  const profile = (profileData as ProfileRow | null) ?? null;

  return {
    displayName: getDisplayName(profile, user.email ?? ""),
  };
}

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const admin = await getAdminContext();

  return (
    <>
      <Header />
      <div className="siteShell">
        <div className={styles.page}>
          <div className={styles.container}>
            <AdminHeader displayName={admin.displayName} />
            {children}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
