"use client";

import { useEffect, useState } from "react";
import AdminCreateDialog from "@/app/admin/components/AdminCreateDialog";
import AdminStatusBanner from "@/app/admin/components/AdminStatusBanner";
import {
  buildMatchDeleteMessage,
  deleteMatchIfAllowed,
  getMatchDependencySummary,
} from "@/lib/admin-dependency-guards";
import { fetchAdminEventsForSeason, fetchAdminSeasons, resolveDefaultAdminSeasonId } from "@/lib/admin-page-helpers";
import { supabase } from "@/lib/supabase";

type Season = {
  id: number;
  name: string;
  active: boolean;
  start_date?: string | null;
  end_date?: string | null;
};

type EventRecord = {
  id: number;
  event_name: string;
  event_date: string;
  season_id: number;
};

type MatchRecord = {
  id: number;
  event_id: number;
  match_name: string;
  results?: { id: number }[];
  event?: { event_name?: string; event_date?: string; season_id?: number };
};

export default function MatchesPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("");

  const [matchName, setMatchName] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState<number | null>(null);
  const [editEventId, setEditEventId] = useState("");
  const [editMatchName, setEditMatchName] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "success" | "error">("info");

  const setStatus = (nextMessage: string, type: "info" | "success" | "error" = "info") => {
    setMessage(nextMessage);
    setMessageType(type);
  };

  const getSeasonName = (seasonId?: number) => {
    if (!seasonId) {
      return "Unknown";
    }
    return seasons.find((season) => season.id === seasonId)?.name ?? "Unknown";
  };

  const formatDate = (value?: string | null) => {
    if (!value) {
      return "Unknown";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const selectedSeasonName = selectedSeason ? getSeasonName(Number(selectedSeason)) : "No season selected";
  const selectedEventName = selectedEvent
    ? events.find((event) => String(event.id) === selectedEvent)?.event_name ?? "Selected event"
    : "All events";

  const loadSeasons = async () => {
    const nextSeasons = await fetchAdminSeasons();
    setSeasons(nextSeasons);

    const defaultSeasonId = resolveDefaultAdminSeasonId(nextSeasons);
    if (defaultSeasonId) {
      setSelectedSeason(defaultSeasonId);
    }
  };

  const loadEvents = async (seasonId?: string) => {
    const targetSeason = seasonId ?? selectedSeason;

    if (!targetSeason) {
      setEvents([]);
      setSelectedEvent("");
      setMatches([]);
      return;
    }

    const nextEvents = await fetchAdminEventsForSeason(targetSeason);
    setEvents(nextEvents);

    const nextSelectedEvent = nextEvents.some((event) => String(event.id) === selectedEvent)
      ? selectedEvent
      : "";
    setSelectedEvent(nextSelectedEvent);

    await loadMatches(targetSeason, nextSelectedEvent || undefined, nextEvents);
  };

  const loadMatches = async (seasonId?: string, eventId?: string, eventList: EventRecord[] = events) => {
    const targetSeason = seasonId ?? selectedSeason;
    if (!targetSeason) {
      setMatches([]);
      return;
    }

    const targetEvent = eventId ?? selectedEvent;
    const validEventIds = (eventList.length > 0 ? eventList : events).map((event) => event.id);

    if (validEventIds.length === 0) {
      setMatches([]);
      return;
    }

    let query = supabase
      .from("matches")
      .select("*, event:event_id (event_name, event_date, season_id), results (id)")
      .in("event_id", validEventIds)
      .order("match_name", { ascending: true });

    if (targetEvent) {
      query = query.eq("event_id", Number(targetEvent));
    }

    const { data } = await query;
    setMatches((data ?? []) as MatchRecord[]);
  };

  useEffect(() => {
    void loadSeasons();
  }, []);

  useEffect(() => {
    if (seasons.length === 0) {
      setSelectedSeason("");
      return;
    }

    if (!selectedSeason || !seasons.some((season) => String(season.id) === selectedSeason)) {
      setSelectedSeason(resolveDefaultAdminSeasonId(seasons));
    }
  }, [seasons, selectedSeason]);

  useEffect(() => {
    if (selectedSeason) {
      void loadEvents(selectedSeason);
    }
  }, [selectedSeason]);

  useEffect(() => {
    if (selectedEvent && !events.some((event) => String(event.id) === selectedEvent)) {
      setSelectedEvent("");
      return;
    }

    if (selectedSeason) {
      void loadMatches(selectedSeason, selectedEvent, events);
    }
  }, [selectedEvent, events, selectedSeason]);

  const createMatch = async () => {
    setStatus("");

    if (!selectedEvent || !matchName.trim()) {
      setStatus("Event and Match Name are required.", "error");
      return;
    }

    const eventId = Number(selectedEvent);

    if (!Number.isFinite(eventId) || !events.some((event) => event.id === eventId)) {
      setStatus("The selected event is no longer valid. Please choose a different event.", "error");
      return;
    }

    const { error } = await supabase
      .from("matches")
      .insert({
        event_id: eventId,
        match_name: matchName.trim(),
      });

    if (error) {
      setStatus(error.message, "error");
      return;
    }

    setMatchName("");
    setIsCreateDialogOpen(false);
    setStatus("Match created successfully.", "success");
    await loadMatches(selectedSeason, selectedEvent, events);
  };

  const startEditMatch = (match: MatchRecord) => {
    setEditingMatchId(match.id);
    setEditEventId(String(match.event_id));
    setEditMatchName(match.match_name);
    setStatus("");
  };

  const cancelEditMatch = () => {
    setEditingMatchId(null);
    setEditEventId("");
    setEditMatchName("");
    setStatus("");
  };

  const closeCreateDialog = () => {
    setIsCreateDialogOpen(false);
    setMatchName("");
    setStatus("");
  };

  const updateMatch = async () => {
    if (editingMatchId === null || !editEventId || !editMatchName.trim()) {
      setStatus("Event and Match Name are required.", "error");
      return;
    }

    const eventId = Number(editEventId);

    if (!Number.isFinite(eventId) || !events.some((event) => event.id === eventId)) {
      setStatus("The selected event is no longer valid. Please choose a different event.", "error");
      return;
    }

    const { error } = await supabase
      .from("matches")
      .update({
        event_id: eventId,
        match_name: editMatchName.trim(),
      })
      .eq("id", editingMatchId);

    if (error) {
      setStatus(error.message, "error");
      return;
    }

    setStatus("Match updated successfully.", "success");
    cancelEditMatch();
    await loadMatches(selectedSeason, selectedEvent, events);
  };

  const deleteMatch = async (matchId: number) => {
    const matchToDelete = matches.find((match) => match.id === matchId);

    try {
      const summary = await getMatchDependencySummary(matchId);
      const confirmationMessage = buildMatchDeleteMessage(
        matchToDelete?.match_name ?? "this match",
        summary,
      );

      if (!window.confirm(confirmationMessage)) {
        return;
      }

      const result = await deleteMatchIfAllowed(matchId);

      if (!result.ok) {
        setStatus(result.message, "error");
        return;
      }

      setStatus("Match deleted successfully.", "success");
      if (editingMatchId === matchId) {
        cancelEditMatch();
      }
      await loadMatches(selectedSeason, selectedEvent, events);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to delete match.", "error");
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Match Management</h1>
        <button
          type="button"
          onClick={() => {
            setMatchName("");
            setIsCreateDialogOpen(true);
          }}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          + Create Match
        </button>
      </div>

      <div className="mb-6 rounded border border-slate-200 bg-slate-50 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Season context</p>
            <h2 className="text-xl font-semibold text-slate-800">{selectedSeasonName}</h2>
          </div>
          <div className="flex gap-3 text-sm text-slate-600">
            <span className="rounded border border-slate-200 bg-white px-2 py-1">Events: {events.length}</span>
            <span className="rounded border border-slate-200 bg-white px-2 py-1">Matches: {matches.length}</span>
          </div>
        </div>
      </div>

      <AdminCreateDialog
        open={isCreateDialogOpen}
        title="Create Match"
        onClose={closeCreateDialog}
      >
        <div className="mb-4 flex items-center gap-3">
          <label className="font-medium">Season</label>
          <select
            className="border p-2"
            value={selectedSeason}
            onChange={(e) => {
              const nextSeason = e.target.value;
              setSelectedSeason(nextSeason);
              setSelectedEvent("");
            }}
          >
            <option value="">Select Season</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="mr-2">Event</label>
          <select
            className="border p-2"
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            disabled={!selectedSeason || events.length === 0}
          >
            <option value="">{selectedSeason ? "All events" : "Choose a season first"}</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.event_name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Match Name"
            className="border p-2 w-full"
            value={matchName}
            onChange={(e) => setMatchName(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={createMatch}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Create Match
          </button>
          <button
            type="button"
            onClick={closeCreateDialog}
            className="border rounded px-4 py-2"
          >
            Cancel
          </button>
        </div>

        <div className="mt-4">
          <AdminStatusBanner message={message} type={messageType} />
        </div>
      </AdminCreateDialog>

      {selectedSeason ? (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Existing Matches</h2>
            <span className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-600">
              Viewing: {selectedEventName}
            </span>
          </div>

          <AdminCreateDialog open={editingMatchId !== null} title="Edit Match" onClose={cancelEditMatch}>
            <div className="mb-3">
              <label className="mr-2">Event</label>
              <select
                className="border p-2"
                value={editEventId}
                onChange={(e) => setEditEventId(e.target.value)}
              >
                <option value="">Select Event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.event_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <input
                type="text"
                placeholder="Match Name"
                className="border p-2 w-full"
                value={editMatchName}
                onChange={(e) => setEditMatchName(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={updateMatch}
                className="bg-green-600 text-white px-4 py-2 rounded"
              >
                Save Changes
              </button>

              <button
                onClick={cancelEditMatch}
                className="bg-gray-500 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </AdminCreateDialog>

          {matches.length === 0 ? (
            <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-600">
              No matches found for {selectedEvent ? selectedEventName : selectedSeasonName}.
            </div>
          ) : (
            <table className="border-collapse border w-full">
              <thead>
                <tr>
                  <th className="border p-2">Match Name</th>
                  <th className="border p-2">Event Name</th>
                  <th className="border p-2">Event Date</th>
                  <th className="border p-2">Season</th>
                  <th className="border p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => {
                  const eventName = match.event?.event_name ?? "Unknown";
                  const eventDate = formatDate(match.event?.event_date);
                  const seasonName = getSeasonName(match.event?.season_id);
                  const resultCount = match.results?.length ?? 0;

                  return (
                    <tr key={match.id}>
                      <td className="border p-2">{match.match_name}</td>
                      <td className="border p-2">{eventName}</td>
                      <td className="border p-2">{eventDate}</td>
                      <td className="border p-2">{seasonName}</td>
                      <td className="border p-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <button
                            onClick={() => startEditMatch(match)}
                            className="bg-yellow-500 text-white px-3 py-1 rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteMatch(match.id)}
                            className="bg-red-600 text-white px-3 py-1 rounded"
                          >
                            Delete
                          </button>
                          <span className="text-xs text-slate-500">{resultCount} result{resultCount === 1 ? "" : "s"}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  );
}