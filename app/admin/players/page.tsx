"use client";

import { useEffect, useState } from "react";
import AdminCreateDialog from "@/app/admin/components/AdminCreateDialog";
import AdminStatusBanner from "@/app/admin/components/AdminStatusBanner";
import { resolveCurrentSeasonFromDate } from "@/lib/standings";
import { supabase } from "@/lib/supabase";
import { reopenUnmatchedResultsForAlias } from "@/lib/unmatched-results";

type Season = {
  id: number;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
};

type PlayerRecord = {
  id: number;
  player_name: string;
  school: string;
  team_name: string;
  team_id: number | null;
  season_id: number;
  matchesPlayed: number;
  aliases: { id: number; alias_name: string }[];
};

export default function AdminPlayersPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [teams, setTeams] = useState<{ id: number; school: string; team_name: string }[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "success" | "error">("info");
  const [editingPlayerId, setEditingPlayerId] = useState<number | null>(null);
  const [editSchool, setEditSchool] = useState("");
  const [editTeamId, setEditTeamId] = useState("");
  const [editAliases, setEditAliases] = useState<string[]>([]);
  const [aliasDrafts, setAliasDrafts] = useState<Record<number, string>>({});

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

    const defaultSeasonId = currentSeason?.id ?? seasonList[0]?.id ?? "";
    setSelectedSeason(String(defaultSeasonId));
  };

  const loadTeams = async (seasonId: string) => {
    if (!seasonId) {
      setTeams([]);
      return;
    }

    const { data, error } = await supabase
      .from("teams")
      .select("id, school, team_name")
      .eq("season_id", Number(seasonId))
      .order("school", { ascending: true })
      .order("team_name", { ascending: true });

    if (error) {
      setStatus(error.message, "error");
      return;
    }

    setTeams(data ?? []);
  };

  const loadPlayers = async (seasonId: string) => {
    if (!seasonId) {
      setPlayers([]);
      return;
    }

    const { data: registrations, error: registrationError } = await supabase
      .from("player_registrations")
      .select(`
        player_id,
        season_id,
        team_id,
        players:players (id, player_name),
        teams:teams (id, school, team_name)
      `)
      .eq("season_id", Number(seasonId));

    if (registrationError) {
      setStatus(registrationError.message, "error");
      return;
    }

    const playerIds = [...new Set((registrations ?? []).map((registration) => registration.player_id))];

    const { data: aliasData, error: aliasError } = await supabase
      .from("player_aliases")
      .select("id, player_id, alias_name")
      .in("player_id", playerIds.length > 0 ? playerIds : [0]);

    if (aliasError) {
      setStatus(aliasError.message, "error");
      return;
    }

    const aliasLookup = new Map<number, { id: number; alias_name: string }[]>();
    for (const alias of aliasData ?? []) {
      const existing = aliasLookup.get(alias.player_id) ?? [];
      existing.push(alias);
      aliasLookup.set(alias.player_id, existing);
    }

    const { data: seasonEvents, error: seasonEventsError } = await supabase
      .from("events")
      .select("id")
      .eq("season_id", Number(seasonId));

    if (seasonEventsError) {
      setStatus(seasonEventsError.message, "error");
      return;
    }

    const eventIds = (seasonEvents ?? []).map((event) => event.id);
    const { data: seasonMatches, error: seasonMatchesError } = await supabase
      .from("matches")
      .select("id")
      .in("event_id", eventIds.length > 0 ? eventIds : [0]);

    if (seasonMatchesError) {
      setStatus(seasonMatchesError.message, "error");
      return;
    }

    const matchIds = (seasonMatches ?? []).map((match) => match.id);
    const { data: seasonResults, error: seasonResultsError } = await supabase
      .from("results")
      .select("player_id")
      .in("match_id", matchIds.length > 0 ? matchIds : [0]);

    if (seasonResultsError) {
      setStatus(seasonResultsError.message, "error");
      return;
    }

    const matchCounts = new Map<number, number>();
    for (const result of seasonResults ?? []) {
      const currentCount = matchCounts.get(result.player_id) ?? 0;
      matchCounts.set(result.player_id, currentCount + 1);
    }

    const nextPlayers = (registrations ?? [])
      .map((registration) => {
        const player = Array.isArray(registration.players) ? registration.players[0] : registration.players;
        const team = Array.isArray(registration.teams) ? registration.teams[0] : registration.teams;

        return {
          id: player?.id ?? registration.player_id,
          player_name: player?.player_name ?? "Unknown",
          school: team?.school ?? "Unknown",
          team_name: team?.team_name ?? "Unknown",
          team_id: registration.team_id ?? null,
          season_id: registration.season_id,
          matchesPlayed: matchCounts.get(registration.player_id) ?? 0,
          aliases: (aliasLookup.get(registration.player_id) ?? []).sort((left, right) => left.alias_name.localeCompare(right.alias_name)),
        };
      })
      .sort((left, right) => left.player_name.localeCompare(right.player_name));

    setPlayers(nextPlayers);
  };

  useEffect(() => {
    loadSeasons();
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
      loadTeams(selectedSeason);
      loadPlayers(selectedSeason);
    }
  }, [selectedSeason]);

  const filteredPlayers = schoolFilter === "all"
    ? players
    : players.filter((player) => player.school === schoolFilter);

  const startEditPlayer = (player: PlayerRecord) => {
    setEditingPlayerId(player.id);
    setEditSchool(player.school);
    setEditTeamId(player.team_id ? String(player.team_id) : "");
    setEditAliases(player.aliases.map((alias) => alias.alias_name));
    setStatus("");
  };

  const handleAliasDraftChange = (playerId: number, value: string) => {
    setAliasDrafts((current) => ({
      ...current,
      [playerId]: value,
    }));
  };

  const cancelEditPlayer = () => {
    setEditingPlayerId(null);
    setEditSchool("");
    setEditTeamId("");
    setEditAliases([]);
    setStatus("");
  };

  const upsertSeasonRegistration = async (playerId: number, seasonId: number, schoolName: string, teamId: number | null) => {
    const { data: existingRows, error: lookupError } = await supabase
      .from("player_registrations")
      .select("id, player_id, season_id, team_id, school")
      .eq("player_id", playerId)
      .eq("season_id", seasonId)
      .order("id", { ascending: true });

    if (lookupError) {
      throw lookupError;
    }

    const canonicalRow = (existingRows ?? [])[0];

    if (!canonicalRow) {
      const { error: insertError } = await supabase
        .from("player_registrations")
        .insert({
          player_id: playerId,
          season_id: seasonId,
          team_id: teamId,
          school: schoolName,
        });

      if (insertError) {
        throw insertError;
      }

      return;
    }

    const { error: updateError } = await supabase
      .from("player_registrations")
      .update({
        team_id: teamId,
        school: schoolName,
      })
      .eq("id", canonicalRow.id);

    if (updateError) {
      throw updateError;
    }

    const duplicateIds = (existingRows ?? [])
      .map((entry) => entry.id)
      .filter((id) => id !== undefined && id !== canonicalRow.id);

    if (duplicateIds.length > 0) {
      const { error: cleanupError } = await supabase
        .from("player_registrations")
        .delete()
        .in("id", duplicateIds);

      if (cleanupError) {
        throw cleanupError;
      }
    }
  };

  const savePlayerEdits = async () => {
    if (editingPlayerId === null) {
      return;
    }

    const trimmedSchool = editSchool.trim();
    const nextAliasNames = [...new Set(editAliases.map((alias) => alias.trim()).filter(Boolean))];

    if (!trimmedSchool && !editTeamId) {
      setStatus("School and team cannot both be blank for an edited player.", "error");
      return;
    }

    try {
      const selectedTeam = teams.find((team) => String(team.id) === editTeamId);
      const teamId = editTeamId ? Number(editTeamId) : null;
      const resolvedSchool = trimmedSchool || (selectedTeam ? selectedTeam.school : "");

      if (teamId !== null) {
        const { data: team, error: teamError } = await supabase
          .from("teams")
          .select("id, school, team_name")
          .eq("id", teamId)
          .single();

        if (teamError || !team) {
          setStatus("Selected team is no longer valid.", "error");
          return;
        }

        await upsertSeasonRegistration(
          editingPlayerId,
          Number(selectedSeason),
          trimmedSchool || team.school,
          teamId,
        );
      } else if (selectedTeam) {
        await upsertSeasonRegistration(
          editingPlayerId,
          Number(selectedSeason),
          resolvedSchool || selectedTeam.school,
          null,
        );
      } else {
        await upsertSeasonRegistration(
          editingPlayerId,
          Number(selectedSeason),
          resolvedSchool,
          null,
        );
      }

      const player = players.find((entry) => entry.id === editingPlayerId);
      if (!player) {
        return;
      }

      const aliasesToDelete = player.aliases.filter((alias) => !nextAliasNames.includes(alias.alias_name));
      for (const alias of aliasesToDelete) {
        const { error } = await supabase.from("player_aliases").delete().eq("id", alias.id);
        if (error) {
          throw error;
        }
      }

      for (const aliasName of nextAliasNames) {
        const existingAlias = player.aliases.find((alias) => alias.alias_name === aliasName);
        if (!existingAlias) {
          const { error } = await supabase.from("player_aliases").insert({ player_id: editingPlayerId, alias_name: aliasName });
          if (error && !error.message.toLowerCase().includes("duplicate")) {
            throw error;
          }
        }
      }

      setStatus("Player updated successfully.", "success");
      cancelEditPlayer();
      if (selectedSeason) {
        await loadPlayers(selectedSeason);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to update player.", "error");
    }
  };

  const deletePlayer = async (playerId: number) => {
    const match = players.find((entry) => entry.id === playerId);
    if (!match) {
      return;
    }

    if (!window.confirm(`Delete ${match.player_name}? Results will be preserved to keep historical standings intact.`)) {
      return;
    }

    try {
      const { error: aliasError } = await supabase.from("player_aliases").delete().eq("player_id", playerId);
      if (aliasError) {
        throw aliasError;
      }

      const { error: registrationError } = await supabase
        .from("player_registrations")
        .delete()
        .eq("player_id", playerId)
        .eq("season_id", Number(selectedSeason));

      if (registrationError) {
        throw registrationError;
      }

      setStatus("Player removed from the season.", "success");
      if (selectedSeason) {
        await loadPlayers(selectedSeason);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to delete player.", "error");
    }
  };

  const saveAliasChanges = async (playerId: number) => {
    const aliasValue = (aliasDrafts[playerId] ?? "").trim();
    if (!aliasValue) {
      return;
    }

    try {
      const { data: existingAliases, error: lookupError } = await supabase
        .from("player_aliases")
        .select("id, alias_name")
        .eq("player_id", playerId);

      if (lookupError) {
        throw lookupError;
      }

      const existingNames = new Set((existingAliases ?? []).map((alias) => alias.alias_name));
      if (!existingNames.has(aliasValue)) {
        const { error } = await supabase
          .from("player_aliases")
          .insert({ player_id: playerId, alias_name: aliasValue });

        if (error) {
          throw error;
        }
      }

      setAliasDrafts((current) => ({
        ...current,
        [playerId]: "",
      }));
      setStatus("Alias saved.", "success");
      if (selectedSeason) {
        await loadPlayers(selectedSeason);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save alias.", "error");
    }
  };

  const deleteAlias = async (playerId: number, aliasId: number) => {
    try {
      const { data: aliasRow, error: aliasLookupError } = await supabase
        .from("player_aliases")
        .select("alias_name")
        .eq("id", aliasId)
        .single();

      if (aliasLookupError) {
        throw aliasLookupError;
      }

      const { error: deleteError } = await supabase.from("player_aliases").delete().eq("id", aliasId);
      if (deleteError) {
        throw deleteError;
      }

      await reopenUnmatchedResultsForAlias(aliasRow.alias_name);

      setStatus("Alias deleted and related unmatched results were reopened.", "success");
      if (selectedSeason) {
        await loadPlayers(selectedSeason);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to delete alias.", "error");
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Player Management</h1>

      <div className="mb-6 border p-4 rounded">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="mr-2 font-medium">Season</label>
            <select
              value={selectedSeason}
              onChange={(event) => {
                setSelectedSeason(event.target.value);
                setSchoolFilter("all");
              }}
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

          {selectedSeason && (
            <div>
              <label className="mr-2 font-medium">School</label>
              <select
                value={schoolFilter}
                onChange={(event) => setSchoolFilter(event.target.value)}
                className="border p-2"
              >
                <option value="all">All schools</option>
                {[...new Set(players.map((player) => player.school))].sort().map((school) => (
                  <option key={school} value={school}>
                    {school}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <AdminStatusBanner message={message} type={messageType} />

      {selectedSeason && (
        <div>
      {filteredPlayers.length === 0 ? (
        <div className="mb-4 rounded border border-dashed p-4 text-slate-600">
          No players match the current season and school filter.
        </div>
      ) : null}
      <table className="border-collapse border w-full">
            <thead>
              <tr>
                <th className="border p-2">Username</th>
                <th className="border p-2">School</th>
                <th className="border p-2">Team</th>
                <th className="border p-2">Matches played</th>
                <th className="border p-2">Aliases</th>
                <th className="border p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map((player) => (
                <tr key={player.id}>
                  <td className="border p-2">{player.player_name}</td>
                  <td className="border p-2">{player.school}</td>
                  <td className="border p-2">{player.team_name}</td>
                  <td className="border p-2">{player.matchesPlayed}</td>
                  <td className="border p-2">
                    <div className="flex flex-wrap gap-2">
                      {player.aliases.length > 0 ? (
                        player.aliases.map((alias) => (
                          <span key={alias.id} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs">
                            {alias.alias_name}
                            <button
                              type="button"
                              className="text-red-600"
                              onClick={() => deleteAlias(player.id, alias.id)}
                            >
                              ×
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500">No aliases</span>
                      )}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        value={aliasDrafts[player.id] ?? ""}
                        onChange={(event) => handleAliasDraftChange(player.id, event.target.value)}
                        placeholder="New alias"
                        className="border p-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => saveAliasChanges(player.id)}
                        className="bg-blue-500 text-white px-2 py-1 rounded text-sm"
                      >
                        Add alias
                      </button>
                    </div>
                  </td>
                  <td className="border p-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEditPlayer(player)}
                        className="bg-yellow-500 text-white px-3 py-1 rounded"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePlayer(player.id)}
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

          <AdminCreateDialog open={editingPlayerId !== null} title="Edit Player" onClose={cancelEditPlayer}>
            <div className="mb-3">
              <label className="mr-2 font-medium">School</label>
              <input
                value={editSchool}
                onChange={(event) => setEditSchool(event.target.value)}
                className="border p-2"
              />
            </div>

            <div className="mb-3">
              <label className="mr-2 font-medium">Team</label>
              <select
                value={editTeamId}
                onChange={(event) => setEditTeamId(event.target.value)}
                className="border p-2"
              >
                <option value="">Unassigned</option>
                {teams.map((team) => (
                  <option key={team.id} value={String(team.id)}>
                    {team.school} — {team.team_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="mr-2 font-medium">Aliases</label>
              <div className="flex flex-wrap gap-2">
                {editAliases.map((alias, index) => (
                  <div key={`${alias}-${index}`} className="flex items-center gap-2 rounded bg-slate-100 px-2 py-1 text-sm">
                    <input
                      value={alias}
                      onChange={(event) => {
                        const nextAliases = [...editAliases];
                        nextAliases[index] = event.target.value;
                        setEditAliases(nextAliases);
                      }}
                      className="border bg-white p-1"
                    />
                    <button
                      type="button"
                      onClick={() => setEditAliases(editAliases.filter((_, itemIndex) => itemIndex !== index))}
                      className="text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditAliases((current) => [...current, ""])}
                  className="bg-gray-700 text-white px-3 py-1 rounded"
                >
                  Add alias row
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={savePlayerEdits} className="bg-green-600 text-white px-4 py-2 rounded">
                Save Changes
              </button>
              <button type="button" onClick={cancelEditPlayer} className="bg-gray-500 text-white px-4 py-2 rounded">
                Cancel
              </button>
            </div>
          </AdminCreateDialog>
        </div>
      )}
    </div>
  );
}
