import Link from "next/link";
import { notFound } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import StandingsFilterForm from "@/components/StandingsFilterForm";
import { getTeamPointsCount } from "@/lib/scoring";
import { getSchoolRosterForSeason, resolveStandingsScope } from "@/lib/standings";

export default async function SchoolDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ schoolName: string }>;
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const resolvedParams = await params;
  const schoolName = decodeURIComponent(resolvedParams.schoolName ?? "");

  if (!schoolName) {
    notFound();
  }

  const scope = await resolveStandingsScope(searchParams);
  const { season, seasons, events, matches, selectedEventId, selectedMatchId } = scope;

  if (!season) {
    return (
      <main className="min-h-screen bg-[#1f1f1f] px-4 py-8 text-white md:px-8">
        <div className="mx-auto max-w-6xl">
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

  const [school, teamPointsCount] = await Promise.all([
    (async () => {
      try {
        return await getSchoolRosterForSeason(
          schoolName,
          season.id,
          selectedEventId,
          selectedMatchId,
        );
      } catch {
        notFound();
      }
    })(),
    getTeamPointsCount(season.id),
  ]);

  const filterQuery = `?season=${season.id}${selectedEventId ? `&event=${selectedEventId}` : ""}${selectedMatchId ? `&match=${selectedMatchId}` : ""}`;

  return (
    <main className="min-h-screen bg-[#1f1f1f] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link
            href={`/standings/schools${filterQuery}`}
            className="rounded-md border border-[#d1c905] bg-[#d1c905] px-3 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-[#111111] transition hover:brightness-110"
          >
            ← School standings
          </Link>
        </div>

        <header className="mb-8 text-center">
          <h1 className="text-5xl leading-none text-[#f3f3f3] md:text-6xl">
            {school.school}
          </h1>
        </header>

        <StandingsFilterForm
          seasons={seasons}
          events={events}
          matches={matches}
          selectedSeasonId={season.id}
          selectedEventId={selectedEventId}
          selectedMatchId={selectedMatchId}
        />

        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-[#2b2b2b] bg-[#171717] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#d1c905]">School points</div>
            <div className="mt-2 text-3xl font-bold text-white">{school.totalPoints}</div>
          </div>
          <div className="rounded-2xl border border-[#2b2b2b] bg-[#171717] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#d1c905]">Average placement</div>
            <div className="mt-2 text-3xl font-bold text-white">
              {school.matchesPlayed > 0 ? school.averagePlacement.toFixed(2) : "—"}
            </div>
          </div>
          <div className="rounded-2xl border border-[#2b2b2b] bg-[#171717] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#d1c905]">Total eliminations</div>
            <div className="mt-2 text-3xl font-bold text-white">{school.totalEliminations}</div>
          </div>
          <div className="rounded-2xl border border-[#2b2b2b] bg-[#171717] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#d1c905]">Matches played</div>
            <div className="mt-2 text-3xl font-bold text-white">{school.matchesPlayed}</div>
          </div>
        </div>

        {school.teams.map((team) => (
          <div key={team.id} className="mb-8 rounded-2xl border border-[#2b2b2b] bg-[#171717] p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-3xl text-white">{team.teamName}</h2>
              <div className="flex flex-wrap gap-4 text-sm text-[#d9d9d9]">
                <span>{team.totalPoints} pts</span>
                <span>{team.matchesPlayed} matches</span>
                <span>{team.totalEliminations} eliminations</span>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#2b2b2b]">
              <table className="standings-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th className="text-right">Matches</th>
                    <th className="text-right">Points</th>
                    <th className="text-right">Avg place</th>
                    <th className="text-right">Elims</th>
                  </tr>
                </thead>
 
                <tbody>
                  {team.members.map((member) => (
                    <tr key={member.playerId}>
                      <td>{member.playerName}</td>
                      <td className="text-right">{member.matchesPlayed}</td>
                      <td className="text-right">{member.points}</td>
                      <td className="text-right">
                        {member.matchesPlayed > 0 ? member.averagePlacement.toFixed(2) : "—"}
                      </td>
                      <td className="text-right">{member.totalEliminations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 text-sm text-[#d9d9d9]">
              Team points are based on the top {teamPointsCount} players on this team.
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
