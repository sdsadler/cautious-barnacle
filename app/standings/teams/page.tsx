import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import StandingsFilterForm from "@/components/StandingsFilterForm";
import { getTeamPointsCount } from "@/lib/scoring";
import {
  getTeamStandingsForSeason,
  resolveStandingsScope,
} from "@/lib/standings";

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

export default async function TeamStandingsPage({
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
            message="There isn't a season configured yet. Add a season before checking standings."
            actionLabel="Manage seasons"
            actionHref="/admin/seasons"
          />
        </div>
      </main>
    );
  }

  const [standings, teamPointsCount] = await Promise.all([
    getTeamStandingsForSeason(season.id, selectedEventId, selectedMatchId),
    getTeamPointsCount(season.id),
  ]);

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
            const isActive = card.href === "/standings/teams";
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

        <div className="mb-4 text-sm text-[#d9d9d9]">
          Team points are based on the top {teamPointsCount} players on each team.
        </div>

        {standings.length === 0 ? (
          <EmptyState
            title="No team standings yet"
            message="This season has no teams with results for the active filters. Upload players and match results to get the table started."
            actionLabel="Upload players"
            actionHref="/admin/upload-players"
          />
        ) : (
          <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-[#2b2b2b] bg-[#171717]">
            <table className="standings-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>School</th>
                  <th>Team</th>
                  <th>Players</th>
                  <th>Points</th>
                </tr>
              </thead>

              <tbody>
                {standings.map((team) => (
                  <tr key={team.id}>
                    <td>{team.rank}</td>
                    <td>{team.school}</td>
                    <td>
                      <Link
                        href={`/standings/teams/${team.id}?season=${season.id}${selectedEventId ? `&event=${selectedEventId}` : ""}${selectedMatchId ? `&match=${selectedMatchId}` : ""}`}
                        className="font-medium text-[#d1c905] transition hover:text-[#f2ec80]"
                      >
                        {team.teamName}
                      </Link>
                    </td>
                    <td>{team.playerCount ?? 0}</td>
                    <td>{team.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
