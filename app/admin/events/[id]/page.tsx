import Link from "next/link";
import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const eventId = Number(id);

  if (!Number.isFinite(eventId) || eventId <= 0) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();

  const { data: event, error } = await supabase
    .from("events")
    .select("id, event_name, event_date, season_id")
    .eq("id", eventId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!event) {
    notFound();
  }

  const { data: season } = await supabase
    .from("seasons")
    .select("name")
    .eq("id", event.season_id)
    .maybeSingle();

  const { data: matches } = await supabase
    .from("matches")
    .select("id, match_name")
    .eq("event_id", event.id)
    .order("match_name", { ascending: true });

  return (
    <main className="p-6">
      <nav className="mb-6 text-sm text-slate-600">
        <Link href="/admin" className="text-blue-600 underline">
          Admin
        </Link>
        <span className="mx-2">/</span>
        <Link href="/admin/events" className="text-blue-600 underline">
          Events
        </Link>
        <span className="mx-2">/</span>
        <span>{event.event_name}</span>
      </nav>

      <div className="mb-6 rounded border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">Event details</p>
        <h1 className="mb-4 text-3xl font-bold">{event.event_name}</h1>

        <div className="grid gap-4 text-sm sm:grid-cols-3">
          <div className="rounded bg-slate-50 p-3">
            <div className="font-semibold text-slate-700">Event date</div>
            <div>{event.event_date || "—"}</div>
          </div>
          <div className="rounded bg-slate-50 p-3">
            <div className="font-semibold text-slate-700">Season</div>
            <div>{season?.name ?? "Unknown"}</div>
          </div>
          <div className="rounded bg-slate-50 p-3">
            <div className="font-semibold text-slate-700">Matches</div>
            <div>{matches?.length ?? 0}</div>
          </div>
        </div>
      </div>

      <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Match list</h2>
          <Link href="/admin/matches" className="text-sm text-blue-600 underline">
            Open match management
          </Link>
        </div>

        {(matches ?? []).length === 0 ? (
          <p className="text-slate-600">No matches found for this event.</p>
        ) : (
          <table className="w-full border-collapse border border-slate-200 text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 p-2">Match Name</th>
              </tr>
            </thead>
            <tbody>
              {(matches ?? []).map((match) => (
                <tr key={match.id}>
                  <td className="border border-slate-200 p-2">{match.match_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
