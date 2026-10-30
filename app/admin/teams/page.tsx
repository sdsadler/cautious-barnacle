"use client";

import { useEffect, useState } from "react";
import AdminCreateDialog from "@/app/admin/components/AdminCreateDialog";
import AdminStatusBanner from "@/app/admin/components/AdminStatusBanner";
import { resolveCurrentSeasonFromDate } from "@/lib/standings";
import { supabase } from "@/lib/supabase";

type Season = {
  id: number;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
};

type TeamRecord = {
  id: number;
  season_id: number;
  school: string;
  team_name: string;
  player_count: number;
};

export default function AdminTeamsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [editSchool, setEditSchool] = useState("");
  const [editTeamName, setEditTeamName] = useState("");
  const [newSchool, setNewSchool] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "success" | "error">("info");

  const setStatus = (nextMessage: string, type: "info" | "success" | "error" = "info") => {
    setMessage(nextMessage);
    setMessageType(type);
  };

  const loadSeasons = async () => {
    const { data, error } = await supabase
      .from("seasons")
      .select("id, name, start_date, end_date")
      .order("name", { ascending: true });

    if (error) {
      setStatus(error.message, "error");
      return;
    }

    const seasonList = data ?? [];
    setSeasons(seasonList);

    const currentSeason = resolveCurrentSeasonFromDate(
      seasonList.map((season) => ({
        id: season.id,
        name: season.name,
        active: false,
        start_date: season.start_date ?? null,
        end_date: season.end_date ?? null,
      })),
    );

    const nextSeason = currentSeason?.id ?? seasonList[0]?.id ?? "";
    setSelectedSeason(String(nextSeason));
  };

  const loadTeams = async (seasonId: string) => {
    if (!seasonId) {
      setTeams([]);
      return;
    }

    const numericSeasonId = Number(seasonId);

    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .select("id, season_id, school, team_name")
      .eq("season_id", numericSeasonId)
      .order("school", { ascending: true })
      .order("team_name", { ascending: true });

    if (teamError) {
      setStatus(teamError.message, "error");
      return;
    }

    const { data: registrationData, error: registrationError } = await supabase
      .from("player_registrations")
      .select("team_id")
      .eq("season_id", numericSeasonId)
      .not("team_id", "is", null);

    if (registrationError) {
      setStatus(registrationError.message, "error");
      return;
    }

    const counts = new Map<number, number>();
    for (const registration of registrationData ?? []) {
      const teamId = registration.team_id;
      if (teamId === null) {
        continue;
      }
      counts.set(teamId, (counts.get(teamId) ?? 0) + 1);
    }

    const nextTeams = (teamData ?? []).map((team) => ({
      ...team,
      player_count: counts.get(team.id) ?? 0,
    }));

    setTeams(nextTeams);
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
      const fallbackSeason = resolveCurrentSeasonFromDate(
        seasons.map((season) => ({
          id: season.id,
          name: season.name,
          active: false,
          start_date: season.start_date ?? null,
          end_date: season.end_date ?? null,
        })),
      )?.id ?? seasons[0]?.id ?? "";

      setSelectedSeason(String(fallbackSeason));
    }
  }, [seasons, selectedSeason]);

  useEffect(() => {
    if (selectedSeason) {
      void loadTeams(selectedSeason);
    } else {
      setTeams([]);
    }
  }, [selectedSeason]);

  const startEditTeam = (team: TeamRecord) => {
    setEditingTeamId(team.id);
    setEditSchool(team.school);
    setEditTeamName(team.team_name);
    setStatus("");
  };

  const cancelEditTeam = () => {
    setEditingTeamId(null);
    setEditSchool("");
    setEditTeamName("");
    setStatus("");
  };

  const saveTeamEdits = async () => {
    if (editingTeamId === null) {
      return;
    }

    const nextTeamName = editTeamName.trim();
    const nextSchool = editSchool.trim();

    if (!nextTeamName || !nextSchool) {
      setStatus("Team name and school are both required.", "error");
      return;
    }

    try {
      const { error } = await supabase
        .from("teams")
        .update({
          school: nextSchool,
          team_name: nextTeamName,
        })
        .eq("id", editingTeamId);

      if (error) {
        throw error;
      }

      setStatus("Team updated successfully.", "success");
      cancelEditTeam();
      if (selectedSeason) {
        await loadTeams(selectedSeason);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to update team.", "error");
    }
  };

  const createTeam = async () => {
    const trimmedSchool = newSchool.trim();
    const trimmedTeamName = newTeamName.trim();

    if (!selectedSeason) {
      setStatus("Select a season before creating a team.", "error");
      return;
    }

    if (!trimmedSchool || !trimmedTeamName) {
      setStatus("School and team name are required to create a team.", "error");
      return;
    }

    try {
      const { data: existingTeam, error: lookupError } = await supabase
        .from("teams")
        .select("id")
        .eq("season_id", Number(selectedSeason))
        .eq("school", trimmedSchool)
        .eq("team_name", trimmedTeamName)
        .maybeSingle();

      if (lookupError) {
        throw lookupError;
      }

      if (existingTeam) {
        setStatus("A team with this school and name already exists for the selected season.", "error");
        return;
      }

      const { error } = await supabase
        .from("teams")
        .insert({
          season_id: Number(selectedSeason),
          school: trimmedSchool,
          team_name: trimmedTeamName,
        });

      if (error) {
        throw error;
      }

      setNewSchool("");
      setNewTeamName("");
      setStatus("Team created successfully.", "success");
      await loadTeams(selectedSeason);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to create team.", "error");
    }
  };

  const deleteTeam = async (teamId: number) => {
    const team = teams.find((entry) => entry.id === teamId);
    if (!team) {
      return;
    }

    const playerSummary = team.player_count > 0
      ? ` This team has ${team.player_count} player registration(s). Deleting it will unassign those players from the team while keeping their season records intact.`
      : "";

    if (!window.confirm(`Delete ${team.school} — ${team.team_name}?${playerSummary}`)) {
      return;
    }

    try {
      const { error: unassignError } = await supabase
        .from("player_registrations")
        .update({ team_id: null })
        .eq("season_id", Number(selectedSeason))
        .eq("team_id", teamId);

      if (unassignError) {
        throw unassignError;
      }

      const { error } = await supabase.from("teams").delete().eq("id", teamId);
      if (error) {
        throw error;
      }

      setStatus("Team deleted. Team-linked registrations were unassigned safely.", "success");
      if (selectedSeason) {
        await loadTeams(selectedSeason);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to delete team.", "error");
    }
  };

  return (
    <div className="p-6">
      <h1 className="mb-6 text-3xl font-bold">Team Management</h1>

      <div className="mb-6 rounded border p-4">
        <label className="mr-2 font-medium">Season</label>
        <select
          value={selectedSeason}
          onChange={(event) => setSelectedSeason(event.target.value)}
          className="border p-2"
        >
          <option value="">Select a season</option>
          {seasons.map((season) => (
            <option key={season.id} value={String(season.id)}>
              {season.name}
            </option>
          ))}
        </select>
      </div>

      <AdminStatusBanner message={message} type={messageType} />

      {selectedSeason && (
        <div>
          <div className="mb-6 rounded border p-4">
            <h2 className="mb-3 text-xl font-semibold">Create team</h2>
            <div className="flex flex-wrap gap-3">
              <input
                value={newSchool}
                onChange={(event) => setNewSchool(event.target.value)}
                placeholder="School"
                className="border p-2"
              />
              <input
                value={newTeamName}
                onChange={(event) => setNewTeamName(event.target.value)}
                placeholder="Team name"
                className="border p-2"
              />
              <button type="button" onClick={createTeam} className="rounded bg-blue-600 px-4 py-2 text-white">
                Add team
              </button>
            </div>
          </div>

          <div className="mb-4 rounded border border-dashed p-4 text-slate-600">
            {teams.length === 0 ? "No teams are registered for this season yet." : `${teams.length} team(s) found.`}
          </div>

          <table className="w-full border-collapse border">
            <thead>
              <tr>
                <th className="border p-2 text-left">School</th>
                <th className="border p-2 text-left">Team</th>
                <th className="border p-2 text-left">Players</th>
                <th className="border p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id}>
                  <td className="border p-2">{team.school}</td>
                  <td className="border p-2">{team.team_name}</td>
                  <td className="border p-2">{team.player_count}</td>
                  <td className="border p-2">
                   <div className="flex gap-2">
                     <button
                       type="button"
                       onClick={() => startEditTeam(team)}
                       className="rounded bg-yellow-500 px-3 py-1 text-white"
                     >
                       Edit
                     </button>
                     <button
                       type="button"
                       onClick={() => deleteTeam(team.id)}
                       className="rounded bg-red-600 px-3 py-1 text-white"
                     >
                       Delete
                     </button>
                   </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <AdminCreateDialog open={editingTeamId !== null} title="Edit Team" onClose={cancelEditTeam}>
            <div className="mb-3">
              <label className="mr-2 font-medium">School</label>
              <input
                value={editSchool}
                onChange={(event) => setEditSchool(event.target.value)}
                className="border p-2"
              />
            </div>

            <div className="mb-3">
              <label className="mr-2 font-medium">Team name</label>
              <input
                value={editTeamName}
                onChange={(event) => setEditTeamName(event.target.value)}
                className="border p-2"
              />
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={saveTeamEdits} className="rounded bg-green-600 px-4 py-2 text-white">
                Save changes
              </button>
              <button type="button" onClick={cancelEditTeam} className="rounded bg-gray-500 px-4 py-2 text-white">
                Cancel
              </button>
            </div>
          </AdminCreateDialog>
        </div>
      )}
    </div>
  );
}
