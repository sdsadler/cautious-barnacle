"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  createSeason,
  getSeasons,
  type SeasonRecord,
  updateSeason,
  validateSeasonInput,
  getSeasonDependencySummary,
} from "@/lib/seasons";
import {
  activateSeasonAction,
  deactivateSeasonAction,
  deleteSeasonAction,
} from "@/app/admin/seasons/actions";
import AdminCreateDialog from "@/app/admin/components/AdminCreateDialog";
import AdminStatusBanner from "@/app/admin/components/AdminStatusBanner";

export default function SeasonsPage() {
  const router = useRouter();
  const [seasons, setSeasons] = useState<SeasonRecord[]>([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "success" | "error">("info");
  const [editingSeasonId, setEditingSeasonId] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [active, setActive] = useState(true);
  const [dependencySummary, setDependencySummary] = useState<
    Record<number, { eventCount: number; matchCount: number; resultCount: number }>
  >({});

  const setStatus = (nextMessage: string, type: "info" | "success" | "error" = "info") => {
    setMessage(nextMessage);
    setMessageType(type);
  };

  const loadSeasons = async () => {
    const data = await getSeasons();
    setSeasons(data);

    const summaries: Record<
      number,
      { eventCount: number; matchCount: number; resultCount: number }
    > = {};

    for (const season of data) {
      summaries[season.id] = await getSeasonDependencySummary(season.id);
    }

    setDependencySummary(summaries);
  };

  useEffect(() => {
    loadSeasons();
  }, []);

  const resetForm = () => {
    setEditingSeasonId(null);
    setName("");
    setStartDate("");
    setEndDate("");
    setActive(true);
    setIsDialogOpen(false);
  };

  const handleCreateSeason = async () => {
    setStatus("");

    const validation = validateSeasonInput({
      name,
      startDate: startDate || null,
      endDate: endDate || null,
    });

    if (!validation.valid) {
      setStatus(validation.message, "error");
      return;
    }

    try {
      await createSeason({
        name,
        startDate: startDate || null,
        endDate: endDate || null,
        active,
      });

      setStatus("Season created successfully.", "success");
      resetForm();
      await loadSeasons();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to create season.", "error");
    }
  };

  const startEditSeason = (season: SeasonRecord) => {
    setEditingSeasonId(season.id);
    setName(season.name);
    setStartDate(season.start_date ?? "");
    setEndDate(season.end_date ?? "");
    setActive(Boolean(season.active));
    setIsDialogOpen(true);
    setStatus("");
  };

  const handleUpdateSeason = async () => {
    if (editingSeasonId === null) {
      return;
    }

    const validation = validateSeasonInput({
      name,
      startDate: startDate || null,
      endDate: endDate || null,
      currentSeasonId: editingSeasonId,
    });

    if (!validation.valid) {
      setStatus(validation.message, "error");
      return;
    }

    try {
      await updateSeason(editingSeasonId, {
        name,
        startDate: startDate || null,
        endDate: endDate || null,
        active,
      });

      setStatus("Season updated successfully.", "success");
      resetForm();
      await loadSeasons();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to update season.", "error");
    }
  };

  const handleActivateSeason = async (seasonId: number) => {
    try {
      await activateSeasonAction(seasonId);
      setStatus("Season activated successfully.", "success");
      await loadSeasons();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to activate season.", "error");
    }
  };

  const handleDeactivateSeason = async (seasonId: number) => {
    if (!window.confirm("Deactivate this season? This will leave no active season selected until another season is activated.")) {
      return;
    }

    try {
      await deactivateSeasonAction(seasonId);
      setStatus("Season deactivated successfully.", "success");
      await loadSeasons();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to deactivate season.", "error");
    }
  };

  const handleDeleteSeason = async (seasonId: number) => {
    if (!window.confirm("Delete this season? This action is only allowed when no linked events, matches, or results exist.")) {
      return;
    }

    try {
      const result = await deleteSeasonAction(seasonId);

      if (!result.ok) {
        setStatus(result.message, "error");
        return;
      }

      setStatus("Season deleted successfully.", "success");
      if (editingSeasonId === seasonId) {
        resetForm();
      }
      await loadSeasons();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to delete season.", "error");
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <a href="/admin" className="text-blue-600 underline">
          ← Back to admin dashboard
        </a>
      </div>

      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Season Management</h1>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          + Create Season
        </button>
      </div>

      <AdminCreateDialog
        open={isDialogOpen}
        title={editingSeasonId === null ? "Create Season" : "Edit Season"}
        onClose={() => {
          resetForm();
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block font-medium">Name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="border p-2 w-full"
              placeholder="e.g. 2027 Spring"
            />
          </div>

          <div className="flex items-center gap-3 pt-8">
            <input
              id="season-active"
              type="checkbox"
              checked={active}
              onChange={() => setActive((value) => !value)}
            />
            <label htmlFor="season-active" className="font-medium">
              Active season
            </label>
          </div>

          <div>
            <label className="mb-1 block font-medium">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="border p-2 w-full"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium">End date</label>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="border p-2 w-full"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={editingSeasonId === null ? handleCreateSeason : handleUpdateSeason}
            className="border rounded px-4 py-2 bg-slate-900 text-white"
          >
            {editingSeasonId === null ? "Create Season" : "Save Changes"}
          </button>

          <button
            type="button"
            onClick={resetForm}
            className="border rounded px-4 py-2"
          >
            Cancel
          </button>
        </div>
      </AdminCreateDialog>

      <AdminStatusBanner message={message} type={messageType} />

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="bg-slate-100">
            <tr>
              <th className="border p-3 text-left">Season</th>
              <th className="border p-3 text-left">Start Date</th>
              <th className="border p-3 text-left">End Date</th>
              <th className="border p-3 text-left">Active</th>
              <th className="border p-3 text-left">Event Count</th>
              <th className="border p-3 text-left">Match Count</th>
              <th className="border p-3 text-left">Actions</th>
            </tr>
          </thead>

          <tbody>{seasons.map((season) => (
            <tr key={season.id} className="align-top hover:bg-slate-50">
              <td className="border p-3">
                <button
                  type="button"
                  onClick={() => router.push(`/admin/seasons/${season.id}`)}
                  className="text-left text-blue-600 underline"
                >
                  {season.name}
                </button>
              </td>

              <td className="border p-3">{season.start_date ?? "—"}</td>
              <td className="border p-3">{season.end_date ?? "—"}</td>
              <td className="border p-3">{season.active ? "Yes" : "No"}</td>
              <td className="border p-3">
                {dependencySummary[season.id]?.eventCount ?? "—"}
              </td>
              <td className="border p-3">
                {dependencySummary[season.id]?.matchCount ?? "—"}
              </td>
              <td className="border p-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      startEditSeason(season);
                    }}
                    className="border rounded px-2 py-1"
                  >
                    Edit
                  </button>
                  {!season.active ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleActivateSeason(season.id);
                      }}
                      className="border rounded px-2 py-1"
                    >
                      Set active
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDeactivateSeason(season.id);
                      }}
                      className="border rounded px-2 py-1"
                    >
                      Deactivate
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleDeleteSeason(season.id);
                    }}
                    className="border rounded px-2 py-1 text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
