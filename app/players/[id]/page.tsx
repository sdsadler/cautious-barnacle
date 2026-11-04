import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPlayerPerformanceMetrics,
  getPlayerProfile,
  getPlayerSeasonHistory,
} from "@/lib/standings";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const playerId = Number(id);

  if (!Number.isFinite(playerId) || playerId <= 0) {
    notFound();
  }

  let profile: Awaited<ReturnType<typeof getPlayerProfile>>;
  let performance: Awaited<ReturnType<typeof getPlayerPerformanceMetrics>>;
  let history: Awaited<ReturnType<typeof getPlayerSeasonHistory>>;

  try {
    [profile, performance, history] = await Promise.all([
      getPlayerProfile(playerId),
      getPlayerPerformanceMetrics(playerId),
      getPlayerSeasonHistory(playerId),
    ]);
  } catch (error) {
    console.error("Failed to load player page", error);
    notFound();
    return null;
  }

  const recentResults = history
    .flatMap((season) =>
      season.recentResults.map((result) => ({
        ...result,
        seasonName: season.seasonName,
      }))
    )
    .slice(0, 10);

  const formatAverage = (value: number) =>
    Number.isFinite(value) ? value.toFixed(2) : "N/A";

  return (
    <main className="min-h-screen bg-[#1f1f1f] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link
            href="/standings/players"
            className="rounded-md border border-[#d1c905] bg-[#d1c905] px-3 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-[#111111] transition hover:brightness-110"
          >
            ← Back to standings
          </Link>
        </div>

        <header className="mb-8 text-center">
          <h1 className="text-5xl leading-none text-[#f3f3f3] md:text-6xl">
            {profile.playerName}
          </h1>
        </header>

        <div className="mb-8 grid gap-5 md:grid-cols-2">
          <section className="rounded-2xl border border-[#2b2b2b] bg-[#171717] p-5">
            <h2 className="mb-4 text-3xl text-[#d1c905]">Overview</h2>
            <dl className="grid gap-3 text-sm md:grid-cols-[140px_1fr]">
              <dt className="font-semibold text-[#d9d9d9]">Username</dt>
              <dd>{profile.playerName}</dd>

              <dt className="font-semibold text-[#d9d9d9]">Team</dt>
              <dd>{profile.team}</dd>

              <dt className="font-semibold text-[#d9d9d9]">School</dt>
              <dd>{profile.school}</dd>

              <dt className="font-semibold text-[#d9d9d9]">Aliases</dt>
              <dd>{profile.aliases.length > 0 ? profile.aliases.join(", ") : "None"}</dd>
            </dl>
          </section>

          <section className="rounded-2xl border border-[#2b2b2b] bg-[#171717] p-5">
            <h2 className="mb-4 text-3xl text-[#d1c905]">Season Statistics</h2>
            <dl className="grid gap-3 text-sm md:grid-cols-[180px_1fr]">
              <dt className="font-semibold text-[#d9d9d9]">Total score</dt>
              <dd>{performance.totalPoints}</dd>

              <dt className="font-semibold text-[#d9d9d9]">Total eliminations</dt>
              <dd>{performance.totalEliminations}</dd>

              <dt className="font-semibold text-[#d9d9d9]">Matches played</dt>
              <dd>{performance.matchesPlayed}</dd>

              <dt className="font-semibold text-[#d9d9d9]">Average score per match</dt>
              <dd>{formatAverage(performance.averageScorePerMatch)}</dd>

              <dt className="font-semibold text-[#d9d9d9]">Average placement</dt>
              <dd>{formatAverage(performance.averagePlacement)}</dd>
            </dl>
          </section>
        </div>

        <section className="mb-8 rounded-2xl border border-[#2b2b2b] bg-[#171717] p-5">
          <h2 className="mb-4 text-3xl text-[#d1c905]">Recent Results</h2>

          {recentResults.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-[#2b2b2b]">
              <table className="standings-table">
                <thead>
                  <tr>
                    <th>Match</th>
                    <th>Event</th>
                    <th>Placement</th>
                    <th>Elims</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {recentResults.map((result) => (
                    <tr key={`${result.matchId}-${result.eventId}`}>
                      <td>{result.matchName}</td>
                      <td>{result.eventName}</td>
                      <td>{result.placement}</td>
                      <td>{result.eliminations}</td>
                      <td>{result.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[#d9d9d9]">No recent results available.</p>
          )}
        </section>

        <section className="rounded-2xl border border-[#2b2b2b] bg-[#171717] p-5">
          <h2 className="mb-4 text-3xl text-[#d1c905]">Season History</h2>

          {history.length > 0 ? (
            <div className="space-y-6">
              {history.map((season) => (
                <div key={season.seasonId} className="rounded-xl border border-[#2b2b2b] bg-[#1d1d1d] p-4">
                  <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <h3 className="text-2xl text-white">{season.seasonName}</h3>
                    <div className="text-sm text-[#d9d9d9]">
                      {season.matchesPlayed} matches • {season.totalPoints} points • Avg placement {formatAverage(season.averagePlacement)}
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-[#2b2b2b]">
                    <table className="standings-table">
                      <thead>
                        <tr>
                          <th>Match</th>
                          <th>Event</th>
                          <th>Placement</th>
                          <th>Elims</th>
                          <th>Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {season.recentResults.map((result) => (
                          <tr key={`${season.seasonId}-${result.matchId}`}>
                            <td>{result.matchName}</td>
                            <td>{result.eventName}</td>
                            <td>{result.placement}</td>
                            <td>{result.eliminations}</td>
                            <td>{result.score}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#d9d9d9]">No season history available.</p>
          )}
        </section>
      </div>
    </main>
  );
}
