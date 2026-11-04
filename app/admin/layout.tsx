import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentAdminUser } from "@/lib/admin-auth";
import { AdminAuthControls } from "@/components/AdminAuthControls";

const adminNavItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/seasons", label: "Seasons" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/matches", label: "Matches" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/integrity", label: "Data Integrity" },
  { href: "/admin/scoring", label: "Scoring" },
  { href: "/admin/unmatched-results", label: "Unmatched Results" },
  { href: "/admin/upload-results", label: "Upload Results" },
  { href: "/admin/upload-players", label: "Upload Players" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const adminUser = await getCurrentAdminUser();

  if (!adminUser) {
    redirect("/not-authorized");
  }

  return (
    <div className="admin-shell min-h-screen bg-[#1f1f1f] text-white">
      <header className="border-b border-[#383838] bg-[#262626] shadow-lg shadow-black/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm font-medium text-[#d1c905] underline">
              Home
            </Link>
            <Link href="/standings" className="text-sm font-medium text-[#d1c905] underline">
              Standings
            </Link>
            <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#d9d9d9]">
              Admin
            </span>
          </div>

          <AdminAuthControls />
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <aside className="admin-sidebar hidden w-72 shrink-0 rounded-2xl border border-[#383838] bg-[#262626] p-4 shadow-lg shadow-black/10 lg:block">
          <div className="mb-4 border-b border-[#383838] pb-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#d1c905]">Navigation</p>
          </div>
          <nav className="space-y-1">
            {adminNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="admin-nav-link block rounded-md px-3 py-2 text-sm font-medium text-[#f5f5f5] transition hover:bg-[#303030] hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="admin-main min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
