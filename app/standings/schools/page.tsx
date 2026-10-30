import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import StandingsFilterForm from "@/components/StandingsFilterForm";
import {
  getSchoolStandingsForSeason,
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
];

export default async function SchoolStandingsPage({
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
      <main className="min-h-screen bg-[#121212] px-4 py-8 text-white md:px-8">
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

  const standings = await getSchoolStandingsForSeason(
    season.id,
    selectedEventId,
    selectedMatchId,
  );

  return (
    <main className="min-h-screen bg-[#121212] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 text-center">
          <h1 className="text-5xl leading-none text-[#f3f3f3] md:text-6xl">
            MSEA Fortnite Standings
          </h1>
          <p className="mt-3 text-lg text-[#d9d9d9]">{season.name}</p>
        </header>

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          {standingsCards.map((card) => {
            const isActive = card.href === "/standings/schools";
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

        {standings.length === 0 ? (
          <EmptyState
            title="No schools available"
            message="No school standings are available for the selected season and filters. Upload players and results to build the ranking."
            actionLabel="Upload players"
            actionHref="/admin/upload-players"
          />
        ) : (
          <div className="space-y-5">
            {standings.map((school) => (
              <div key={school.school} className="rounded-2xl border border-[#2b2b2b] bg-[#171717] p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-3xl text-white">
                    #{school.rank}{" "}
                    <Link
                      href={`/standings/schools/${encodeURIComponent(school.school)}?season=${season.id}${selectedEventId ? `&event=${selectedEventId}` : ""}${selectedMatchId ? `&match=${selectedMatchId}` : ""}`}
                      className="text-[#d1c905] transition hover:text-[#f2ec80]"
                    >
                      {school.school}
                    </Link>
                  </h2>
                  <div className="flex items-center gap-3 text-sm text-[#d9d9d9]">
                    <span>{school.playerCount} players</span>
                    <span className="text-lg font-semibold text-[#d1c905]">{school.totalPoints} pts</span>
                  </div>
                </div>

                {school.teams.length > 1 ? (
                  <div className="overflow-hidden rounded-xl border border-[#2b2b2b]">
                    <table className="standings-table">
                      <thead>
                        <tr>
                          <th>Team</th>
                          <th className="text-right">Points</th>
                        </tr>
                      </thead>

                      <tbody>
                        {school.teams.map((team) => (
                          <tr key={team.teamName}>
                            <td>
                              <Link
                                href={`/standings/teams/${team.teamId}?season=${season.id}${selectedEventId ? `&event=${selectedEventId}` : ""}${selectedMatchId ? `&match=${selectedMatchId}` : ""}`}
                                className="font-medium text-[#d1c905] transition hover:text-[#f2ec80]"
                              >
                                {team.teamName}
                              </Link>
                            </td>
                            <td className="text-right">{team.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#2b2b2b] bg-[#1d1d1d] p-4 text-[#f0f0f0]">
                    <span className="font-semibold text-[#d1c905]">
                      {school.teams[0]?.teamName ?? "No team assigned"}
                    </span>{": "}
                    {school.teams[0]?.points ?? 0} pts
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
