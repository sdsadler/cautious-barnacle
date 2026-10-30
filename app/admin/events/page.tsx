"use client";

import { useEffect, useState } from "react";
import AdminCreateDialog from "@/app/admin/components/AdminCreateDialog";
import AdminStatusBanner from "@/app/admin/components/AdminStatusBanner";
import {
  buildDependencyBlockedMessage,
  getEventDependencySummary,
  hasDependentRecords,
} from "@/lib/admin-dependency-guards";
import { fetchAdminEventsForSeason, fetchAdminSeasons, resolveDefaultAdminSeasonId } from "@/lib/admin-page-helpers";
import { type SeasonOption } from "@/lib/standings";
import { supabase } from "@/lib/supabase";

type Season = SeasonOption;

type EventRecord = {
  id: number;
  season_id: number;
  event_name: string;
  event_date: string;
  matches?: { id: number }[];
};

export default function EventsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("");

  const [eventName, setEventName] =
    useState("");

  const [eventDate, setEventDate] =
    useState("");

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingEventId, setEditingEventId] =
    useState<number | null>(null);

  const [editSeasonId, setEditSeasonId] =
    useState("");

  const [editEventName, setEditEventName] =
    useState("");

  const [editEventDate, setEditEventDate] =
    useState("");

  const [message, setMessage] =
    useState("");
  const [messageType, setMessageType] = useState<"info" | "success" | "error">("info");

  const setStatus = (nextMessage: string, type: "info" | "success" | "error" = "info") => {
    setMessage(nextMessage);
    setMessageType(type);
  };

  const loadData = async (nextSelectedSeason?: string) => {
    const normalizedSeasons = await fetchAdminSeasons();
    setSeasons(normalizedSeasons);

    const defaultSeasonId = nextSelectedSeason ?? resolveDefaultAdminSeasonId(normalizedSeasons);
    if (defaultSeasonId) {
      setSelectedSeason(defaultSeasonId);
    }

    const eventData = await fetchAdminEventsForSeason(defaultSeasonId || nextSelectedSeason || selectedSeason);
    setEvents(eventData ?? []);
  };

  useEffect(() => {
    void loadData();
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

  const createEvent = async () => {
    setStatus("");

    if (
      !selectedSeason ||
      !eventName ||
      !eventDate
    ) {
      setStatus(
        "All fields are required.",
        "error"
      );
      return;
    }

    const seasonId =
      Number(selectedSeason);

    if (
      !Number.isFinite(seasonId) ||
      !seasons.some(
        (season) =>
          season.id === seasonId
      )
    ) {
      setStatus(
        "The selected season is no longer valid. Please choose a different season.",
        "error"
      );
      return;
    }

    const { error } = await supabase
      .from("events")
      .insert({
        season_id: seasonId,
        event_name: eventName,
        event_date: eventDate,
      });

    if (error) {
      setStatus(error.message, "error");
      return;
    }

    setStatus(
      "Event created successfully.",
      "success"
    );

    setEventName("");
    setEventDate("");
    setIsCreateDialogOpen(false);

    await loadData();
  };

  const getSeasonName = (
    seasonId: number
  ) => {
    const season = seasons.find(
      (s) => s.id === seasonId
    );

    return season?.name ?? "Unknown";
  };

  const selectedSeasonName = selectedSeason ? getSeasonName(Number(selectedSeason)) : "No season selected";
  const totalMatches = events.reduce((sum, event) => sum + (event.matches?.length ?? 0), 0);

  const formatEventDate = (value: string) => {
    if (!value) {
      return "—";
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return value;
    }

    return parsedDate.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const startEditEvent = (
    event: EventRecord
  ) => {
    setEditingEventId(event.id);
    setEditSeasonId(String(event.season_id));
    setEditEventName(event.event_name);
    setEditEventDate(event.event_date);
    setStatus("");
  };

  const cancelEditEvent = () => {
    setEditingEventId(null);
    setEditSeasonId("");
    setEditEventName("");
    setEditEventDate("");
    setStatus("");
  };

  const closeCreateDialog = () => {
    setIsCreateDialogOpen(false);
    setEventName("");
    setEventDate("");
    setStatus("");
  };

  const updateEvent = async () => {
    if (
      editingEventId === null ||
      !editEventName.trim() ||
      !editEventDate
    ) {
      setStatus(
        "Event name and date are required.",
        "error"
      );
      return;
    }

    const seasonId = Number(editSeasonId);

    if (
      !Number.isFinite(seasonId) ||
      !seasons.some(
        (season) => season.id === seasonId
      )
    ) {
      setStatus(
        "The selected season is no longer valid. Please choose a different season.",
        "error"
      );
      return;
    }

    const { error } = await supabase
      .from("events")
      .update({
        season_id: seasonId,
        event_name: editEventName.trim(),
        event_date: editEventDate,
      })
      .eq("id", editingEventId);

    if (error) {
      setStatus(error.message, "error");
      return;
    }

    setStatus("Event updated successfully.", "success");
    cancelEditEvent();
    await loadData();
  };

  const deleteEvent = async (
    eventId: number
  ) => {
    const eventToDelete = events.find((event) => event.id === eventId);
    const eventLabel = eventToDelete?.event_name ?? "this event";

    if (
      !window.confirm(
        `Delete "${eventLabel}"? This cannot be undone. This will also remove the event from the season and may affect related matches, results, and unmatched-result records tied to this event.`
      )
    ) {
      return;
    }

    try {
      const dependencies = await getEventDependencySummary(eventId);

      if (hasDependentRecords(dependencies)) {
        setStatus(buildDependencyBlockedMessage("event", dependencies), "error");
        return;
      }

      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", eventId);

      if (error) {
        setStatus(error.message, "error");
        return;
      }

      setStatus("Event deleted successfully.", "success");
      if (editingEventId === eventId) {
        cancelEditEvent();
      }
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to delete event.", "error");
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Event Management</h1>
        <button
          type="button"
          onClick={() => {
            setEventName("");
            setEventDate("");
            setIsCreateDialogOpen(true);
          }}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          + Create Event
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
            <span className="rounded border border-slate-200 bg-white px-2 py-1">Matches: {totalMatches}</span>
          </div>
        </div>
      </div>

      <AdminCreateDialog
        open={isCreateDialogOpen}
        title="Create Event"
        onClose={closeCreateDialog}
      >
        <div className="mb-3 flex items-center gap-3">
          <label className="font-medium">Season</label>
          <select
            className="border p-2"
            value={selectedSeason}
            onChange={(e) => {
              const nextSeason = e.target.value;
              setSelectedSeason(nextSeason);
              void loadData(nextSeason);
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

        <div className="mb-3">
          <input
            type="text"
            placeholder="Event Name"
            className="border p-2 w-full"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
          />
        </div>

        <div className="mb-3">
          <input
            type="date"
            className="border p-2"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={createEvent}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Create Event
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

      <div>
        <h2 className="text-xl font-semibold mb-4">
          Existing Events
        </h2>

        <AdminCreateDialog open={editingEventId !== null} title="Edit Event" onClose={cancelEditEvent}>
          <div className="mb-3">
            <label className="mr-2">Season</label>
            <select
              className="border p-2"
              value={editSeasonId}
              onChange={(e) => setEditSeasonId(e.target.value)}
            >
              <option value="">Select Season</option>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <input
              type="text"
              placeholder="Event Name"
              className="border p-2 w-full"
              value={editEventName}
              onChange={(e) => setEditEventName(e.target.value)}
            />
          </div>

          <div className="mb-3">
            <input
              type="date"
              className="border p-2"
              value={editEventDate}
              onChange={(e) => setEditEventDate(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={updateEvent}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              Save Changes
            </button>

            <button
              onClick={cancelEditEvent}
              className="bg-gray-500 text-white px-4 py-2 rounded"
            >
              Cancel
            </button>
          </div>
        </AdminCreateDialog>

        {events.length === 0 ? (
          <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-600">
            No events found for {selectedSeasonName}. Create one above to get started.
          </div>
        ) : (
          <table className="border-collapse border w-full">
            <thead>
              <tr>
                <th className="border p-2">
                  Season
                </th>

                <th className="border p-2">
                  Event
                </th>

                <th className="border p-2">
                  Date
                </th>

                <th className="border p-2">
                  Matches
                </th>

                <th className="border p-2">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="border p-2">
                    {getSeasonName(
                      event.season_id
                    )}
                  </td>

                  <td className="border p-2">
                    <a href={`/admin/events/${event.id}`} className="text-blue-600 underline">
                      {event.event_name}
                    </a>
                  </td>

                  <td className="border p-2">
                    {formatEventDate(event.event_date)}
                  </td>

                  <td className="border p-2 text-center">
                    <span className="rounded bg-slate-100 px-2 py-1 text-sm font-medium">
                      {event.matches?.length ?? 0}
                    </span>
                  </td>

                  <td className="border p-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          startEditEvent(event)
                        }
                        className="bg-yellow-500 text-white px-3 py-1 rounded"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() =>
                          deleteEvent(event.id)
                        }
                        className="bg-red-600 text-white px-3 py-1 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
