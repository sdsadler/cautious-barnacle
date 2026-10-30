import Link from "next/link";

const adminCards = [
  {
    title: "Seasons",
    description: "Manage league seasons, activate the current season, and control season lifecycle data.",
    href: "/admin/seasons",
    accent: "from-sky-500 to-sky-700",
  },
  {
    title: "Events",
    description: "Create, review, and update league events and their seasonal grouping.",
    href: "/admin/events",
    accent: "from-blue-500 to-blue-700",
  },
  {
    title: "Matches",
    description: "Manage match records and assign them to the appropriate event.",
    href: "/admin/matches",
    accent: "from-violet-500 to-violet-700",
  },
  {
    title: "Scoring",
    description: "Review the current points system and update elimination and placement scoring rules.",
    href: "/admin/scoring",
    accent: "from-fuchsia-500 to-fuchsia-700",
  },
  {
    title: "Players",
    description: "Review season rosters, update player schools, and manage aliases and registrations.",
    href: "/admin/players",
    accent: "from-indigo-500 to-indigo-700",
  },
  {
    title: "Teams",
    description: "Review teams for the season, see player counts, and update a team's school and name.",
    href: "/admin/teams",
    accent: "from-cyan-500 to-cyan-700",
  },
  {
    title: "Data Integrity",
    description: "Audit duplicates, invalid team links, and stale alias or registration data before standings are rebuilt.",
    href: "/admin/integrity",
    accent: "from-red-500 to-red-700",
  },
  {
    title: "Upload players",
    description: "Import roster data from CSV and keep player records aligned with the season.",
    href: "/admin/upload-players",
    accent: "from-emerald-500 to-emerald-700",
  },
  {
    title: "Upload results",
    description: "Load match results from CSV and calculate standings-ready performance data.",
    href: "/admin/upload-results",
    accent: "from-amber-500 to-amber-700",
  },
  {
    title: "Unmatched results",
    description: "Review unresolved imports, resolve unknown players, and finalize result matching.",
    href: "/admin/unmatched-results",
    accent: "from-rose-500 to-rose-700",
  },
];

export default function AdminDashboardPage() {
  return (
    <main className="p-6">
      <div className="mb-8 flex flex-wrap items-center gap-3 text-sm text-[#d9d9d9]">
        <Link href="/" className="text-[#d1c905] underline">
          Home
        </Link>
        <span>•</span>
        <Link href="/standings" className="text-[#d1c905] underline">
          Standings
        </Link>
        <span>•</span>
        <span className="font-medium text-white">Admin</span>
      </div>

      <div className="mb-8">
        <p className="mb-2 text-sm font-medium uppercase tracking-[0.12em] text-[#d1c905]">
          Operations dashboard
        </p>
        <h1 className="text-5xl leading-none text-white">Admin</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {adminCards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="group block overflow-hidden rounded-2xl border border-[#2b2b2b] bg-[#171717] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:border-[#d1c905]/80 hover:bg-[#1d1d1d]"
          >
            <div className="h-2 bg-[#d1c905]" />
            <div className="p-5">
              <h2 className="mb-2 text-2xl text-white">{card.title}</h2>
              <p className="mb-4 text-sm leading-6 text-[#d9d9d9]">{card.description}</p>
              <span className="inline-flex items-center text-sm font-medium text-[#d1c905] group-hover:text-[#f2ec80]">
                Open section →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
