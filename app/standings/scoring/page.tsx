import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import StandingsFilterForm from "@/components/StandingsFilterForm";
import { getPlacementScoringRules, getScoringConfig } from "@/lib/scoring";
import { resolveStandingsScope } from "@/lib/standings";

const standingsCards = [
  {
    title: "Player standings",
    href: "/standings/players",
    description: "Player leaderboard",
  },
  {
    title: "Team standings",
    href: "/standings/teams",
    description: "Team leaderboard",
  },
  {
    title: "School standings",
    href: "/standings/schools",
    description: "School leaderboard",
  },
  {
    title: "Scoring rules",
    href: "/standings/scoring",
    description: "Season scoring rules",
  },
];

export default async function ScoringRulesPage({
  searchParams,
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const scope = await resolveStandingsScope(searchParams);
  const { season, seasons, events, matches, selectedEventId, selectedMatchId } = scope;

  if (!season) {
    return (
      <main className="min-h-screen bg-[#1f1f1f] px-4 py-8 text-white md:px-8">
        <div className="mx-auto max-w-7xl">
          <EmptyState
            title="No season available"
            message="There isn't a season configured yet. Add a season before checking scoring rules."
            actionLabel="Manage seasons"
            actionHref="/admin/seasons"
          />
        </div>
      </main>
    );
  }

  const [scoringConfig, placementRules] = await Promise.all([
    getScoringConfig(season.id),
    getPlacementScoringRules(season.id),
  ]);
  console.log(season.id);

  const placementTable = placementRules.length > 0 ? placementRules : scoringConfig.placementRules;

  return (
    <main className="min-h-screen bg-[#1f1f1f] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 text-center">
          <h1 className="text-5xl leading-none text-[#f3f3f3] md:text-6xl">
            MSEA Fortnite Standings
          </h1>
          <p className="mt-3 text-lg text-[#d9d9d9]">{season.name}</p>
        </header>

        <div className="mb-8 grid gap-4 md:grid-cols-4">
          {standingsCards.map((card) => {
            const isActive = card.href === "/standings/scoring";
            return (
              <Link
                key={card.title}
                href={card.href}
                className={`rounded-2xl border p-4 transition ${
                  isActive
                    ? "border-[#d1c905] bg-[#d1c905] text-[#111111] shadow-lg shadow-[#d1c905]/20"
                    : "border-[#2b2b2b] bg-[#1b1b1b] text-white hover:border-[#d1c905]/80 hover:bg-[#232323]"
                }`}
              >
                <h2 className="text-2xl leading-none">{card.title}</h2>
              </Link>
            );
          })}
        </div>

        <StandingsFilterForm
          seasons={seasons}
          events={events}
          matches={matches}
          selectedSeasonId={season.id}
          selectedEventId={selectedEventId}
          selectedMatchId={selectedMatchId}
        />

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[#2b2b2b] bg-[#171717] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#d1c905]">Season</div>
            <div className="mt-2 text-2xl font-bold text-white">{season.name}</div>
          </div>
          <div className="rounded-2xl border border-[#2b2b2b] bg-[#171717] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#d1c905]">Elimination points</div>
            <div className="mt-2 text-2xl font-bold text-white">{scoringConfig.eliminationPoints}</div>
          </div>
          <div className="rounded-2xl border border-[#2b2b2b] bg-[#171717] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#d1c905]">Team scoring</div>
            <div className="mt-2 text-2xl font-bold text-white">Top {scoringConfig.teamPointsCount} players</div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#2b2b2b] bg-[#171717]">
          <table className="standings-table">
            <thead>
              <tr>
                <th>Min place</th>
                <th>Max place</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {placementTable.length > 0 ? (
                placementTable.map((rule) => (
                  <tr key={`${rule.min_place}-${rule.max_place}-${rule.points}`}>
                    <td>{rule.min_place}</td>
                    <td>{rule.max_place}</td>
                    <td>{rule.points}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-[#d9d9d9]">
                    No placement rules are configured for this season.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
