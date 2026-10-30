"use client";

import { useEffect, useState } from "react";
import Fuse from "fuse.js";
import AdminStatusBanner from "@/app/admin/components/AdminStatusBanner";
import { supabase } from "@/lib/supabase";

type UnmatchedResult = {
  id: number;
  username: string;
  placement: number;
  eliminations: number;
  points: number;
  match_id: number;
  match_name: string;
  event_name: string;
};

type Player = {
  id: number;
  player_name: string;
};

type Alias = {
  id: number;
  player_id: number;
  alias_name: string;
};

type UnmatchedResultRow = {
  id: number;
  username: string;
  placement: number;
  eliminations: number;
  points: number;
  match_id: number;
  matches?:
    | {
        match_name?: string | null;
        events?:
          | {
              event_name?: string | null;
            }
          | {
              event_name?: string | null;
            }[]
          | null;
      }
    | {
        match_name?: string | null;
        events?:
          | {
              event_name?: string | null;
            }
          | {
              event_name?: string | null;
            }[]
          | null;
      }[]
    | null;
};

export default function UnmatchedResultsPage() {
  const [unmatchedResults, setUnmatchedResults] =
    useState<UnmatchedResult[]>([]);

  const [players, setPlayers] =
    useState<Player[]>([]);

  const [aliases, setAliases] =
    useState<Alias[]>([]);

  const [selectedPlayers,
    setSelectedPlayers] =
    useState<Record<number, string>>({});

  const [message, setMessage] =
    useState("");
  const [messageType, setMessageType] = useState<"info" | "success" | "error">("info");

  const setStatus = (nextMessage: string, type: "info" | "success" | "error" = "info") => {
    setMessage(nextMessage);
    setMessageType(type);
  };

  const loadData = async () => {
    const { data: unmatched, error: unmatchedError } =
      await supabase
        .from("unmatched_results")
        .select(`
          id,
          username,
          placement,
          eliminations,
          points,
          match_id,
          matches:matches (
            match_name,
            events:events (
              event_name
            )
          )
        `)
        .eq("resolved", false)
        .order("id");

    if (unmatchedError) {
      setStatus(unmatchedError.message, "error");
      return;
    }

    const { data: playerData } =
      await supabase
        .from("players")
        .select("*")
        .order("player_name");

    const { data: aliasData } =
      await supabase
        .from("player_aliases")
        .select("*");

    const normalizedUnmatched = (unmatched ?? []).map((entry: UnmatchedResultRow) => {
      const matchData = Array.isArray(entry.matches) ? entry.matches[0] : entry.matches;
      const eventData = Array.isArray(matchData?.events) ? matchData.events[0] : matchData?.events;

      return {
        id: entry.id,
        username: entry.username,
        placement: entry.placement,
        eliminations: entry.eliminations,
        points: entry.points,
        match_id: entry.match_id,
        match_name: matchData?.match_name ?? "Unknown match",
        event_name: eventData?.event_name ?? "Unknown event",
      };
    });

    setUnmatchedResults(normalizedUnmatched);
    setPlayers(playerData ?? []);
    setAliases(aliasData ?? []);
  };

  const resolveResult = async (result: UnmatchedResult) => {
    const selectedValue = selectedPlayers[result.id];

    if (selectedValue === undefined || selectedValue === null || selectedValue === "") {
      alert("Select a player first.");
      return;
    }

    const selectedPlayerId = Number(selectedValue);

    if (!Number.isFinite(selectedPlayerId) || !players.some((player) => player.id === selectedPlayerId)) {
      alert("The selected player is no longer valid. Please choose a different player.");
      return;
    }

    try {
      const { error: aliasError } = await supabase
        .from("player_aliases")
        .insert({
          player_id: selectedPlayerId,
          alias_name: result.username,
        });

      if (aliasError && !aliasError.message.includes("unique")) {
        throw aliasError;
      }

      const { error: resultError } = await supabase
        .from("results")
        .upsert(
          {
            match_id: result.match_id,
            player_id: selectedPlayerId,
            placement: result.placement,
            eliminations: result.eliminations,
            points: result.points,
          },
          { onConflict: "match_id,player_id" }
        );

      if (resultError) {
        throw resultError;
      }

      const { error: updateError } = await supabase
        .from("unmatched_results")
        .update({ resolved: true, player_id: selectedPlayerId })
        .eq("id", result.id);

      if (updateError) {
        throw updateError;
      }

      setSelectedPlayers((prev) => {
        const next = { ...prev };
        delete next[result.id];
        return next;
      });

      setStatus(`Resolved ${result.username}`, "success");
      await loadData();
    } catch (error) {
      console.error("Failed to resolve unmatched result:", error);
      setStatus("Failed to resolve result.", "error");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getAliasCount =
    (playerId: number) =>
      aliases.filter(
        (a) =>
          a.player_id === playerId
      ).length;

  const normalizeName = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const getSuggestedPlayers = (
    username: string
  ) => {
    if (!players.length) {
      return [];
    }

    const query = normalizeName(username);
    const aliasMatches = aliases.filter((alias) => {
      const aliasValue = normalizeName(alias.alias_name);
      if (!aliasValue || !query) {
        return false;
      }

      return (
        aliasValue === query ||
        aliasValue.includes(query) ||
        query.includes(aliasValue) ||
        aliasValue.startsWith(query) ||
        query.startsWith(aliasValue)
      );
    });

    const aliasPlayerIds = new Set(aliasMatches.map((alias) => alias.player_id));
    const exactMatches = players.filter((player) => {
      const playerName = normalizeName(player.player_name);
      return (
        playerName === query ||
        aliasPlayerIds.has(player.id) ||
        playerName.startsWith(query) ||
        query.startsWith(playerName)
      );
    });

    if (exactMatches.length > 0) {
      return exactMatches.slice(0, 5);
    }

    const fuse = new Fuse(players, {
      keys: ["player_name"],
      threshold: 0.25,
      includeScore: true,
    });

    const fuzzyMatches = fuse
      .search(username)
      .filter((result) => (result.score ?? 1) <= 0.25)
      .map((result) => result.item)
      .slice(0, 5);

    return fuzzyMatches;
  };


  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">
        Unmatched Results
      </h1>

      <AdminStatusBanner message={message} type={messageType} />

      {unmatchedResults.length === 0 ? (
        <div>
          No unmatched results.
        </div>
      ) : (
        <table className="border-collapse border w-full">
          <thead>
            <tr>
              <th className="border p-2">
                Username
              </th>

              <th className="border p-2">
                Event
              </th>

              <th className="border p-2">
                Match
              </th>

              <th className="border p-2">
                Placement
              </th>

              <th className="border p-2">
                Eliminations
              </th>

              <th className="border p-2">
                Points
              </th>

              <th className="border p-2">
                Suggestions
              </th>

              <th className="border p-2">
                Assign Player
              </th>

              <th className="border p-2">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {unmatchedResults.map(
              (result) => {
                const suggestions =
                  getSuggestedPlayers(
                    result.username
                  );

                return (
                  <tr
                    key={result.id}
                  >
                    <td className="border p-2">
                      {
                        result.username
                      }
                    </td>

                    <td className="border p-2">
                      {
                        result.event_name
                      }
                    </td>

                    <td className="border p-2">
                      {
                        result.match_name
                      }
                    </td>

                    <td className="border p-2">
                      {
                        result.placement
                      }
                    </td>

                    <td className="border p-2">
                      {
                        result.eliminations
                      }
                    </td>

                    <td className="border p-2">
                      {
                        result.points
                      }
                    </td>

                    <td className="border p-2 align-top">
                      {suggestions.length ===
                      0 ? (
                        <span className="text-gray-500">
                          No suggestions
                        </span>
                      ) : (
                        suggestions.map(
                          (
                            player
                          ) => (
                            <div
                              key={
                                player.id
                              }
                              className="mb-2"
                            >
                              <button
                                className="text-blue-600 underline text-sm"
                                onClick={() =>
                                  setSelectedPlayers(
                                    (
                                      prev
                                    ) => ({
                                      ...prev,
                                      [
                                        result.id
                                      ]:
                                        String(
                                          player.id
                                        ),
                                    })
                                  )
                                }
                              >
                                {
                                  player.player_name
                                }
                              </button>

                              <span className="ml-2 text-xs text-gray-500">
                                (
                                {getAliasCount(
                                  player.id
                                )}{" "}
                                aliases)
                              </span>
                            </div>
                          )
                        )
                      )}
                    </td>

                    <td className="border p-2">
                      <select
                        className="border p-1 w-full"
                        value={
                          selectedPlayers[
                            result.id
                          ] ?? ""
                        }
                        onChange={(
                          e
                        ) =>
                          setSelectedPlayers(
                            (
                              prev
                            ) => ({
                              ...prev,
                              [
                                result.id
                              ]:
                                e.target
                                  .value,
                            })
                          )
                        }
                      >
                        <option value="">
                          Select Player
                        </option>

                        {players.map(
                          (
                            player
                          ) => (
                            <option
                              key={
                                player.id
                              }
                              value={
                                player.id
                              }
                            >
                              {
                                player.player_name
                              }
                            </option>
                          )
                        )}
                      </select>
                    </td>

                    <td className="border p-2">
                      <button
                        className="bg-green-600 text-white px-3 py-1 rounded"
                        onClick={() =>
                          resolveResult(
                            result
                          )
                        }
                      >
                        Resolve
                      </button>
                    </td>
                  </tr>
                );
              }
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}