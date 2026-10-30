"use client";

import { useEffect, useState } from "react";
import Papa from "papaparse";
import AdminStatusBanner from "@/app/admin/components/AdminStatusBanner";
import { resolveCurrentSeasonFromDate } from "@/lib/standings";
import { supabase } from "@/lib/supabase";

type PlayerRow = {
  player_name?: string;
  school?: string;
  team?: string;
  [key: string]: string | undefined;
};

const logKnownError = (error: unknown) => {
  if (error instanceof Error) {
    console.error(error);
    return;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      console.error(message);
    }
  }
};

const getAliasValues = (row: PlayerRow) => {
  const aliases = new Set<string>();

  for (const [key, value] of Object.entries(row)) {
    if (key === "player_name" || key === "school" || key === "team" || !key) {
      continue;
    }

    const alias = String(value ?? "").trim();
    if (alias) {
      aliases.add(alias);
    }
  }

  return [...aliases].sort((left, right) => left.localeCompare(right));
};

const matchUnmatchedResultsForPlayer = async (playerId: number, playerName: string, aliasNames: string[]) => {
  const candidateNames = [...new Set([playerName, ...aliasNames].map((entry) => entry.trim()).filter(Boolean))];
  if (candidateNames.length === 0) {
    return 0;
  }

  const { data: unmatchedRows, error } = await supabase
    .from("unmatched_results")
    .select("id")
    .in("username", candidateNames)
    .eq("resolved", false);

  if (error) {
    throw error;
  }

  const ids = (unmatchedRows ?? []).map((row) => row.id);
  if (ids.length === 0) {
    return 0;
  }

  const { error: updateError } = await supabase
    .from("unmatched_results")
    .update({ resolved: true, player_id: playerId })
    .in("id", ids);

  if (updateError) {
    throw updateError;
  }

  return ids.length;
};

type SeasonRecord = {
  id: number;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  active?: boolean | null;
};

export default function UploadPlayersPage() {
  const [seasons, setSeasons] = useState<SeasonRecord[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "success" | "error">("info");
  const [genericTeamWarning, setGenericTeamWarning] = useState("");

  const setStatus = (nextMessage: string, type: "info" | "success" | "error" = "info") => {
    setMessage(nextMessage);
    setMessageType(type);
  };

  const loadSeasons = async () => {
    const { data, error } = await supabase
      .from("seasons")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      setStatus(error.message, "error");
      return;
    }

    const seasonList = data ?? [];
    setSeasons(seasonList);

    const defaultSeason = resolveCurrentSeasonFromDate(
      seasonList.map((season) => ({
        id: season.id,
        name: season.name,
        active: season.active ?? false,
        start_date: season.start_date ?? null,
        end_date: season.end_date ?? null,
      })),
    );

    setSelectedSeason(String(defaultSeason?.id ?? seasonList[0]?.id ?? ""));
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
          active: season.active ?? false,
          start_date: season.start_date ?? null,
          end_date: season.end_date ?? null,
        })),
      )?.id ?? seasons[0]?.id ?? "";

      setSelectedSeason(String(fallbackSeason));
    }
  }, [seasons, selectedSeason]);

  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      setSelectedFileName("");
      return;
    }

    setSelectedFileName(file.name);

    Papa.parse<PlayerRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data.map((row) => ({
          ...row,
          team: row.team?.trim() ? row.team.trim() : "Fortnite Team",
        }));

        const missingTeamCount = results.data.filter((row) => !row.team?.trim()).length;
        setPlayers(rows);
        setGenericTeamWarning(
          missingTeamCount > 0
            ? `${missingTeamCount} row(s) were missing a team and were assigned to Fortnite Team.`
            : ""
        );
        setStatus("");
      },
    });
  };

  const importPlayers = async () => {
    try {
      setIsImporting(true);
      setStatus("");

      if (!selectedSeason) {
        throw new Error("Please select a season before importing players.");
      }

      const { data: season, error: seasonError } =
        await supabase
          .from("seasons")
          .select("*")
          .eq("id", Number(selectedSeason))
          .single();

      if (seasonError || !season) {
        throw new Error(
          "Selected season was not found."
        );
      }

      let importedCount = 0;
      let existingPlayersCount = 0;
      let newPlayersCount = 0;
      let aliasesAddedCount = 0;
      let genericTeamAssignments = 0;
      let matchedUnmatchedCount = 0;

      for (const player of players) {
        const playerName = player.player_name?.trim();
        const school = player.school?.trim();
        const rawTeam = player.team?.trim();
        const team = rawTeam || "Fortnite Team";
        const aliasNames = [...new Set(getAliasValues(player).map((alias) => alias.trim()).filter(Boolean))];

        if (!playerName || !school) {
          continue;
        }

        if (!rawTeam) {
          genericTeamAssignments += 1;
        }

        let playerId: number;

        const { data: existingPlayer } = await supabase
          .from("players")
          .select("*")
          .eq("player_name", playerName)
          .maybeSingle();

        if (existingPlayer) {
          existingPlayersCount += 1;
          playerId = existingPlayer.id;
        } else {
          newPlayersCount += 1;
          const { data: newPlayer, error: playerError } = await supabase
            .from("players")
            .insert({ player_name: playerName })
            .select()
            .single();

          if (playerError || !newPlayer) {
            console.error(playerError);
            continue;
          }

          playerId = newPlayer.id;
        }

        let teamId: number;

        const { data: existingTeam } = await supabase
          .from("teams")
          .select("*")
          .eq("season_id", season.id)
          .eq("school", school)
          .eq("team_name", team)
          .maybeSingle();

        if (existingTeam) {
          teamId = existingTeam.id;
        } else {
          const { data: newTeam, error: teamError } = await supabase
            .from("teams")
            .insert({
              season_id: season.id,
              school,
              team_name: team,
            })
            .select()
            .single();

          if (teamError || !newTeam) {
            logKnownError(teamError);
            continue;
          }

          teamId = newTeam.id;
        }

        const { error: registrationError } = await supabase
          .from("player_registrations")
          .upsert(
            {
              player_id: playerId,
              season_id: season.id,
              school,
              team,
              team_id: teamId,
            },
            { onConflict: "player_id,season_id" },
          );

        if (registrationError) {
          logKnownError(registrationError);
          continue;
        }

        const { data: existingAliases, error: aliasLookupError } = await supabase
          .from("player_aliases")
          .select("id, alias_name")
          .eq("player_id", playerId);

        if (aliasLookupError) {
          logKnownError(aliasLookupError);
          continue;
        }

        const existingAliasNames = new Set((existingAliases ?? []).map((alias) => alias.alias_name));

        for (const aliasName of aliasNames) {
          if (existingAliasNames.has(aliasName)) {
            continue;
          }

          const { error: aliasInsertError } = await supabase
            .from("player_aliases")
            .insert({ player_id: playerId, alias_name: aliasName });

          if (aliasInsertError) {
            logKnownError(aliasInsertError);
            continue;
          }

          existingAliasNames.add(aliasName);
          aliasesAddedCount += 1;
        }

        matchedUnmatchedCount += await matchUnmatchedResultsForPlayer(playerId, playerName, aliasNames);
        importedCount++;
      }

      const matchedMessage = matchedUnmatchedCount > 0
        ? ` ${matchedUnmatchedCount} unmatched result(s) were automatically matched to imported players.`
        : "";

      const summaryCounts = ` ${importedCount} registration(s) processed; ${existingPlayersCount} existing player(s), ${newPlayersCount} new player(s), and ${aliasesAddedCount} alias(es) added.`;

      const importSummary = genericTeamAssignments > 0
        ? `Import complete.${summaryCounts} ${genericTeamAssignments} row(s) were missing a team and were assigned to Fortnite Team.${matchedMessage}`
        : `Import complete.${summaryCounts}${matchedMessage}`;

      setStatus(importSummary, "success");
    } catch (error) {
      logKnownError(error);

      if (error instanceof Error) {
        setStatus(
          `Import failed: ${error.message}`,
          "error"
        );
      } else {
        setStatus(
          "Import failed.",
          "error"
        );
      }
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        Upload Players
      </h1>

      <div className="mb-4">
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

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label
          htmlFor="upload-players-csv"
          className="inline-flex cursor-pointer items-center rounded bg-blue-600 px-4 py-2 font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          Browse CSV
        </label>
        <input
          id="upload-players-csv"
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="hidden"
        />
        <span className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {selectedFileName ? `Selected file: ${selectedFileName}` : "No file selected yet"}
        </span>
      </div>

      {genericTeamWarning && (
        <AdminStatusBanner
          type="info"
          title="Import notice"
          message={genericTeamWarning}
        />
      )}

      {players.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={importPlayers}
              disabled={isImporting}
              className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
            >
              {isImporting
                ? "Importing..."
                : "Import Players"}
            </button>
            <span className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Ready to import {players.length} row(s)
            </span>
          </div>

          <h2 className="text-xl font-semibold mt-6">
            Preview
          </h2>

          <table className="border-collapse border mt-2">
            <thead>
              <tr>
                <th className="border px-3 py-2">Player</th>
                <th className="border px-3 py-2">School</th>
                <th className="border px-3 py-2">Team</th>
                <th className="border px-3 py-2">Aliases</th>
              </tr>
            </thead>

            <tbody>
              {players.map((player, index) => (
                <tr key={index}>
                  <td className="border px-3 py-2">{player.player_name}</td>
                  <td className="border px-3 py-2">{player.school}</td>
                  <td className="border px-3 py-2">{player.team}</td>
                  <td className="border px-3 py-2">
                    {getAliasValues(player).length > 0 ? getAliasValues(player).join(", ") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <AdminStatusBanner message={message} type={messageType} />
    </div>
  );
}