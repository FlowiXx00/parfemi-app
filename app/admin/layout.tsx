import type { Metadata } from "next";
import type { ReactNode } from "react";
import AdminShell from "@/features/admin/layout/shell/admin-shell";
import { getAdminContext } from "@/features/admin/server/admin-context";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin — Atelier Dekant" },
  robots: { index: false, follow: false },
};

/** The admin has its own shell (sidebar) without the store header/footer. Always dark theme. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await getAdminContext();

  return (
    <>
      {/* Set the dark theme before first paint (avoids a light flash on devices in light mode). */}
      <script dangerouslySetInnerHTML={{ __html: `document.documentElement.setAttribute("data-theme","dark")` }} />
      <AdminShell displayName={admin.displayName} pendingCount={admin.pendingCount} isDemo={admin.isDemo}>
        {children}
      </AdminShell>
    </>
  );
}
