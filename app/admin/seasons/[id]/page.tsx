import Link from "next/link";
import { notFound } from "next/navigation";
import {
  activateSeasonAction,
  deleteSeasonDetailAction,
} from "@/app/admin/seasons/actions";
import { getSeasonDetail, getSeasonDependencySummary } from "@/lib/seasons";

export default async function SeasonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const seasonId = Number(id);

  if (!Number.isFinite(seasonId) || seasonId <= 0) {
    notFound();
  }

  const seasonDetail = await getSeasonDetail(seasonId);
  const dependencySummary = await getSeasonDependencySummary(seasonId);

  return (
    <main className="p-6">
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <Link href="/admin/seasons" className="text-blue-600 underline">
          ← Back to seasons
        </Link>
        <Link href="/admin" className="text-blue-600 underline">
          Admin dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-2">{seasonDetail.season.name}</h1>
      <p className="mb-6 text-slate-600">
        {seasonDetail.season.active ? "Active season" : "Inactive season"}
      </p>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 mb-8">
        <div className="border rounded-lg p-4 bg-white shadow-sm">
          <p className="text-sm text-slate-500">Start date</p>
          <p className="text-lg font-semibold">{seasonDetail.season.start_date ?? "—"}</p>
        </div>
        <div className="border rounded-lg p-4 bg-white shadow-sm">
          <p className="text-sm text-slate-500">End date</p>
          <p className="text-lg font-semibold">{seasonDetail.season.end_date ?? "—"}</p>
        </div>
        <div className="border rounded-lg p-4 bg-white shadow-sm">
          <p className="text-sm text-slate-500">Event count</p>
          <p className="text-lg font-semibold">{dependencySummary.eventCount}</p>
        </div>
        <div className="border rounded-lg p-4 bg-white shadow-sm">
          <p className="text-sm text-slate-500">Match count</p>
          <p className="text-lg font-semibold">{dependencySummary.matchCount}</p>
        </div>
      </div>

      <div className="mb-8 border rounded-lg p-4 bg-white shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Season actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href={`/admin/seasons?edit=${seasonId}`} className="border rounded px-3 py-2 text-sm">
            Edit season
          </Link>
          {!seasonDetail.season.active && (
            <form action={activateSeasonAction}>
              <input type="hidden" name="seasonId" value={seasonId} />
              <button type="submit" className="border rounded px-3 py-2 text-sm bg-slate-900 text-white">
                Set as active
              </button>
            </form>
          )}
          <form action={deleteSeasonDetailAction}>
            <input type="hidden" name="seasonId" value={seasonId} />
            <button type="submit" className="border rounded px-3 py-2 text-sm text-red-700 border-red-200 bg-red-50">
              Delete season
            </button>
          </form>
        </div>
      </div>

      <section className="border rounded-lg p-4 bg-white shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Event summary</h2>

        {seasonDetail.eventSummaries.length === 0 ? (
          <p className="text-slate-600">No events have been created for this season yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border p-2 text-left">Event</th>
                  <th className="border p-2 text-left">Date</th>
                  <th className="border p-2 text-left">Matches</th>
                  <th className="border p-2 text-left">Results</th>
                </tr>
              </thead>
              <tbody>
                {seasonDetail.eventSummaries.map((event) => (
                  <tr key={event.id}>
                    <td className="border p-2">
                      <Link href={`/admin/events/${event.id}`} className="text-blue-600 underline">
                        {event.eventName}
                      </Link>
                    </td>
                    <td className="border p-2">{event.eventDate ?? "—"}</td>
                    <td className="border p-2">{event.matchCount}</td>
                    <td className="border p-2">{event.resultCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
