"use client";

import { useEffect, useState } from "react";
import Papa from "papaparse";
import AdminStatusBanner from "@/app/admin/components/AdminStatusBanner";
import {
  getEliminationPoints,
  getPlacementScoringRules,
  getScoringRuleRow,
} from "@/lib/scoring";
import { resolveCurrentSeasonFromDate } from "@/lib/standings";
import { supabase } from "@/lib/supabase";
import { upsertUnmatchedResult } from "@/lib/unmatched-results";

type ResultRow = {
  username: string;
  placement: string;
  eliminations: string;
};

type EventRecord = {
  id: number;
  event_name: string;
};

type MatchRecord = {
  id: number;
  match_name: string;
};

type SeasonRecord = {
  id: number;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  active?: boolean | null;
};

export default function UploadResultsPage() {
  const [seasons, setSeasons] = useState<SeasonRecord[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [selectedMatch, setSelectedMatch] = useState("");

  const [results, setResults] =
    useState<ResultRow[]>([]);
  const [selectedFileName, setSelectedFileName] = useState("");

  const [message, setMessage] =
    useState("");
  const [messageType, setMessageType] = useState<"info" | "success" | "error">("info");
  const [seasonPlayerWarning, setSeasonPlayerWarning] = useState("");

  const setStatus = (nextMessage: string, type: "info" | "success" | "error" = "info") => {
    setMessage(nextMessage);
    setMessageType(type);
  };

  const [isImporting, setIsImporting] =
    useState(false);

  const [validationErrors,
    setValidationErrors] =
    useState<string[]>([]);

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

    const nextSeasonId = String(defaultSeason?.id ?? seasonList[0]?.id ?? "");
    setSelectedSeason(nextSeasonId);
  };

  const checkSeasonPlayers = async (seasonId: string) => {
    if (!seasonId) {
      setSeasonPlayerWarning("");
      return;
    }

    const { data, error } = await supabase
      .from("player_registrations")
      .select("id")
      .eq("season_id", Number(seasonId))
      .limit(1);

    if (error) {
      setSeasonPlayerWarning("");
      setStatus(error.message, "error");
      return;
    }

    setSeasonPlayerWarning(
      data && data.length > 0
        ? ""
        : "No players have been uploaded for this season yet. Please upload players first before importing results."
    );
  };

  const loadEvents = async (seasonId: string) => {
    if (!seasonId) {
      setEvents([]);
      setSelectedEvent("");
      setSelectedMatch("");
      return;
    }

    await checkSeasonPlayers(seasonId);

    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("season_id", Number(seasonId))
      .order("event_date", { ascending: false });

    setEvents(data ?? []);
    setSelectedEvent("");
    setSelectedMatch("");
  };

  const loadMatches = async () => {
    if (!selectedEvent) {
      setMatches([]);
      return;
    }

    const { data } = await supabase
      .from("matches")
      .select("*")
      .eq("event_id", selectedEvent)
      .order("id");

    setMatches(data ?? []);
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

    void loadMatches();
  }, [selectedEvent, events]);

  useEffect(() => {
    if (selectedMatch && !matches.some((match) => String(match.id) === selectedMatch)) {
      setSelectedMatch("");
    }
  }, [matches, selectedMatch]);

  const validateResults = (
    rows: ResultRow[]
  ) => {
    const errors: string[] = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2;

      if (!row.username?.trim()) {
        errors.push(
          `Row ${rowNumber}: Username is required`
        );
      }

      const placement = Number(
        row.placement
      );

      if (
        Number.isNaN(placement)
      ) {
        errors.push(
          `Row ${rowNumber}: Placement must be numeric`
        );
      } else if (
        placement < 1 ||
        placement > 100
      ) {
        errors.push(
          `Row ${rowNumber}: Placement must be between 1 and 100`
        );
      }

      const eliminations =
        Number(row.eliminations);

      if (
        Number.isNaN(eliminations)
      ) {
        errors.push(
          `Row ${rowNumber}: Eliminations must be numeric`
        );
      } else if (
        eliminations < 0
      ) {
        errors.push(
          `Row ${rowNumber}: Eliminations cannot be negative`
        );
      }
    });

    return errors;
  };

  const parseResultCsv = async (
    file: File
  ): Promise<ResultRow[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const isUtf16 =
      (bytes[0] === 0xff && bytes[1] === 0xfe) ||
      (bytes[0] === 0xfe && bytes[1] === 0xff);

    const text = isUtf16
      ? new TextDecoder("utf-16le").decode(bytes).replace(/^\uFEFF/, "")
      : new TextDecoder("utf-8").decode(bytes);

    const parsed = Papa.parse<string[]>(text, {
      header: false,
      skipEmptyLines: true,
    });

    const rows = (parsed.data as Array<Array<string | undefined>>) ?? [];
    if (rows.length === 0) {
      return [];
    }

    const normalizedFirstRow = (rows[0] ?? []).map((value) =>
      String(value ?? "").trim().toLowerCase()
    );

    const hasHeaders = normalizedFirstRow.some(
      (header) =>
        header === "username" ||
        header === "placement" ||
        header === "eliminations"
    );

    const dataRows = hasHeaders ? rows.slice(1) : rows;

    return dataRows
      .filter((row) => row && row.length >= 3)
      .map((row) => ({
        username: String(row[0] ?? "").trim(),
        placement: String(row[1] ?? "").trim(),
        eliminations: String(row[2] ?? "").trim(),
      }));
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      setSelectedFileName("");
      return;
    }

    setSelectedFileName(file.name);

    try {
      const rows = await parseResultCsv(file);

      setResults(rows);
      setStatus("");

      const requiredColumns = [
        "username",
        "placement",
        "eliminations",
      ];

      const headers = Object.keys(rows[0] ?? {}).filter(Boolean);
      const missingColumns = requiredColumns.filter(
        (column) => !headers.includes(column)
      );

      const errors: string[] = [
        ...(missingColumns.length > 0
          ? [`Missing columns: ${missingColumns.join(", ")}`]
          : []),
        ...validateResults(rows),
      ];

      setValidationErrors(errors);
    } catch (error) {
      console.error(error);
      setStatus("Unable to parse the CSV file.", "error");
      setValidationErrors(["Unable to parse the CSV file."]);
    }
  };

  const calculatePlacementPoints =
    async (
      placement: number,
      seasonId?: number | null,
    ) => {
      if (seasonId === undefined || seasonId === null) {
        throw new Error("A valid season is required to calculate placement points.");
      }

      const scoringRules = await getPlacementScoringRules(seasonId);
      if (scoringRules.length === 0) {
        throw new Error(`No placement rules are configured for season ${seasonId}.`);
      }

      const scoringRule = scoringRules.find(
        (rule) => placement >= rule.min_place && placement <= rule.max_place,
      );

      if (!scoringRule) {
        throw new Error(`No placement points rule exists for placement ${placement} in season ${seasonId}.`);
      }

      return scoringRule.points;
    };

  const importResults = async () => {
    try {
      setIsImporting(true);
      setStatus("");

      if (
        validationErrors.length > 0
      ) {
        setStatus(
          "Cannot import while validation errors exist.",
          "error"
        );
        return;
      }

      if (!selectedSeason) {
        setStatus("Please select a season.", "error");
        return;
      }

      const seasonId = Number(selectedSeason);
      const scoringRule = await getScoringRuleRow(seasonId);
      if (!scoringRule) {
        throw new Error("No scoring rules are configured for the selected season.");
      }

      const placementRules = await getPlacementScoringRules(seasonId);
      if (placementRules.length === 0) {
        throw new Error("No placement rules are configured for the selected season.");
      }

      if (!selectedEvent) {
        setStatus(
          "Please select an event.",
          "error"
        );
        return;
      }

      const { data: existingPlayers, error: playerCheckError } = await supabase
        .from("player_registrations")
        .select("id")
        .eq("season_id", Number(selectedSeason))
        .limit(1);

      if (playerCheckError) {
        throw playerCheckError;
      }

      if (!existingPlayers || existingPlayers.length === 0) {
        setStatus(
          "No players have been uploaded for this season yet. Please upload players first.",
          "info"
        );
      }

      let matchId: number;

      if (!selectedMatch) {
        const {
          data: existingMatches,
        } = await supabase
          .from("matches")
          .select("id")
          .eq(
            "event_id",
            Number(selectedEvent)
          );

        const nextMatchNumber =
          (existingMatches?.length ?? 0) + 1;

        const {
          data: newMatch,
          error: matchError,
        } = await supabase
          .from("matches")
          .insert({
            event_id:
              Number(selectedEvent),
            match_name:
              `Match ${nextMatchNumber}`,
          })
          .select()
          .single();

        if (
          matchError ||
          !newMatch
        ) {
          throw new Error(
            "Failed to create match."
          );
        }

        matchId = newMatch.id;

        await loadMatches();
      } else {
        matchId =
          Number(selectedMatch);
      }

      let importedCount = 0;

      const missingPlayers: string[] =
        [];

      for (const row of results) {
        const username =
          row.username.trim();

        const placement =
          parseInt(
            row.placement
          );

        const eliminations =
          parseInt(
            row.eliminations
          );

        const placementPoints =
          await calculatePlacementPoints(
            placement,
            seasonId,
          );

        const eliminationPoints = await getEliminationPoints(seasonId);
        const totalPoints =
          placementPoints +
          eliminations * eliminationPoints;

        let player = null;

// Try direct player match first
        const {
          data: directPlayer,
        } = await supabase
          .from("players")
          .select("*")
          .ilike(
            "player_name",
            username
          )
          .single();

        if (directPlayer) {
          player = directPlayer;
        } else {
          // Try alias lookup
          const {
            data: alias,
          } = await supabase
            .from("player_aliases")
            .select(`
              player_id,
              players (
                id,
                player_name
              )
            `)
            .ilike(
              "alias_name",
              username
            )
            .single();

          if (
            alias &&
            alias.players
          ) {
            player = alias.players;
          }
        }
        if (!player) {
          missingPlayers.push(
            username
          );

          try {
            await upsertUnmatchedResult({
              matchId,
              username,
              placement,
              eliminations,
              points: totalPoints,
            });
          } catch (unmatchedError) {
            console.error(
              "UNMATCHED INSERT ERROR:",
              unmatchedError
            );
          }

          continue;
        }

        const { error } =
          await supabase
            .from("results")
            .upsert(
              {
                match_id:
                  matchId,
                player_id:
                  player.id,
                placement,
                eliminations,
                points:
                  totalPoints,
              },
              {
                onConflict:
                  "match_id,player_id",
              }
            );

        if (error) {
          console.error(error);
          continue;
        }

        importedCount++;
      }

      setStatus(
        `Import complete. Imported ${importedCount} results. Missing players: ${missingPlayers.length}${
          missingPlayers.length
            ? ` (${missingPlayers.join(
                ", "
              )})`
            : ""
        }`,
        missingPlayers.length > 0 ? "info" : "success"
      );
    } catch (error) {
      console.error(error);

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
      <h1 className="text-3xl font-bold mb-6">
        Upload Match Results
      </h1>

      <div className="mb-4">
        <label className="mr-2">
          Season
        </label>

        <select
          className="border p-2"
          value={selectedSeason}
          onChange={(event) => setSelectedSeason(event.target.value)}
        >
          <option value="">Select Season</option>
          {seasons.map((season) => (
            <option key={season.id} value={String(season.id)}>
              {season.name}
            </option>
          ))}
        </select>
      </div>

      {seasonPlayerWarning && (
        <AdminStatusBanner
          type="info"
          title="Season notice"
          message={seasonPlayerWarning}
        />
      )}

      {selectedSeason && (
        <div className="mb-4">
          <label className="mr-2">
            Event
          </label>

          <select
            className="border p-2"
            value={selectedEvent}
            onChange={(e) =>
              setSelectedEvent(
                e.target.value
              )
            }
          >
            <option value="">
              Select Event
            </option>

            {events.map((event) => (
              <option
                key={event.id}
                value={event.id}
              >
                {event.event_name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mb-4">
        <label className="mr-2">
          Match
        </label>

        <select
          className="border p-2"
          value={selectedMatch}
          onChange={(e) =>
            setSelectedMatch(
              e.target.value
            )
          }
        >
          <option value="">
            Create New Match Automatically
          </option>

          {matches.map((match) => (
            <option
              key={match.id}
              value={match.id}
            >
              {match.match_name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label
          htmlFor="upload-results-csv"
          className="inline-flex cursor-pointer items-center rounded bg-blue-600 px-4 py-2 font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          Browse CSV
        </label>
        <input
          id="upload-results-csv"
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="hidden"
        />
        <span className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {selectedFileName ? `Selected file: ${selectedFileName}` : "No file selected yet"}
        </span>
      </div>

      {validationErrors.length > 0 && (
        <div className="mt-4 border border-red-500 bg-red-50 p-4 rounded">
          <h3 className="font-bold text-red-700 mb-2">
            Validation Errors
          </h3>

          <ul className="list-disc pl-5 text-red-700">
            {validationErrors.map(
              (
                error,
                index
              ) => (
                <li key={index}>
                  {error}
                </li>
              )
            )}
          </ul>
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={
                importResults
              }
              disabled={
                isImporting ||
                validationErrors.length >
                  0
              }
              className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
            >
              {validationErrors.length >
              0
                ? "Fix Validation Errors"
                : isImporting
                ? "Importing..."
                : "Import Results"}
            </button>
            <span className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Ready to import {results.length} row(s)
            </span>
          </div>

          <h2 className="text-xl font-semibold mt-6">
            Preview
          </h2>

          <table className="border-collapse border mt-2">
            <thead>
              <tr>
                <th className="border p-2">
                  Username
                </th>

                <th className="border p-2">
                  Placement
                </th>

                <th className="border p-2">
                  Eliminations
                </th>
              </tr>
            </thead>

            <tbody>
              {results.map(
                (
                  row,
                  index
                ) => (
                  <tr
                    key={index}
                  >
                    <td className="border p-2">
                      {
                        row.username
                      }
                    </td>

                    <td className="border p-2">
                      {
                        row.placement
                      }
                    </td>

                    <td className="border p-2">
                      {
                        row.eliminations
                      }
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </>
      )}

      <AdminStatusBanner message={message} type={messageType} />
    </div>
  );
}