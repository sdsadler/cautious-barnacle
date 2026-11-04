"use client";

import { useEffect, useState } from "react";
import AdminStatusBanner from "@/app/admin/components/AdminStatusBanner";
import { getSeasons, resolveCurrentSeasonFromDate } from "@/lib/standings";
import {
  getScoringConfig,
  saveScoringConfig,
  type PlacementScoringRule,
} from "@/lib/scoring";

export default function AdminScoringPage() {
  const [rules, setRules] = useState<PlacementScoringRule[]>([]);
  const [seasons, setSeasons] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [eliminationPoints, setEliminationPoints] = useState(0);
  const [teamPointsCount, setTeamPointsCount] = useState(4);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "success" | "error">("info");

  const appendPlacementRule = () => {
    setRules((current) => {
      const nextMinPlace = current.length === 0 ? 1 : (current[current.length - 1]?.max_place ?? 1) + 1;
      const nextMaxPlace = nextMinPlace;
      return [
        ...current,
        {
          id: `temp-${Date.now()}-${Math.random().toString(16).slice(2)}` as unknown as number,
          min_place: nextMinPlace,
          max_place: nextMaxPlace,
          points: 0,
        },
      ];
    });
  };

  const setStatus = (nextMessage: string, type: "info" | "success" | "error" = "info") => {
    setMessage(nextMessage);
    setMessageType(type);
  };

  useEffect(() => {
    const loadSeasons = async () => {
      try {
        const seasonList = await getSeasons();
        setSeasons(seasonList);
        const activeSeason = resolveCurrentSeasonFromDate(seasonList) ?? seasonList[0] ?? null;
        setSelectedSeasonId(activeSeason?.id ?? null);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Unable to load seasons.", "error");
      }
    };

    void loadSeasons();
  }, []);

  const loadScoring = async (seasonId: number | null) => {
    try {
      const scoringConfig = await getScoringConfig(seasonId);
      console.log(seasonId);
      setRules(scoringConfig.placementRules);
      setEliminationPoints(scoringConfig.eliminationPoints);
      setTeamPointsCount(scoringConfig.teamPointsCount || 4);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load scoring configuration.", "error");
    }
  };

  useEffect(() => {
    if (selectedSeasonId === null) {
      return;
    }

    void loadScoring(selectedSeasonId);
  }, [selectedSeasonId]);

  const saveScoring = async () => {
    try {
      if (!rules.length) {
        setStatus("No placement scoring rules are available to update.", "error");
        return;
      }

      if (selectedSeasonId === null) {
        setStatus("Select a season before saving scoring rules.", "error");
        return;
      }

      await saveScoringConfig({
        seasonId: selectedSeasonId,
        eliminationPoints,
        teamPointsCount,
        placementRules: rules,
      });

      setStatus("Scoring configuration saved.", "success");
      await loadScoring(selectedSeasonId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save scoring configuration.", "error");
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Scoring Configuration</h1>

      <AdminStatusBanner message={message} type={messageType} />

      <div className="mb-6 flex flex-col gap-4 border p-4 rounded">
        <div>
          <label className="mr-2 font-medium">Season</label>
          <select
            value={selectedSeasonId ?? ""}
            onChange={(event) => setSelectedSeasonId(Number(event.target.value) || null)}
            className="border p-2"
            disabled={seasons.length === 0}
          >
            {seasons.length === 0 ? <option value="">No seasons available</option> : null}
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mr-2 font-medium">Points per elimination</label>
          <input
            type="number"
            value={eliminationPoints}
            onChange={(event) => setEliminationPoints(Number(event.target.value))}
            className="border p-2"
          />
        </div>
        <div>
          <label className="mr-2 font-medium">Top scorers counted for team points</label>
          <input
            type="number"
            min={1}
            value={teamPointsCount}
            onChange={(event) => setTeamPointsCount(Math.max(1, Number(event.target.value) || 1))}
            className="border p-2"
          />
        </div>
      </div>

      <div className="border p-4 rounded">
        <h2 className="text-xl font-semibold mb-4">Placement points</h2>
        <table className="border-collapse border w-full">
          <thead>
            <tr>
              <th className="border p-2">Min</th>
              <th className="border p-2">Max</th>
              <th className="border p-2">Points</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule, index) => (
              <tr key={rule.id}>
                <td className="border p-2">
                  <input
                    type="number"
                    min={1}
                    value={rule.min_place}
                    onChange={(event) => {
                      const nextMin = Number(event.target.value) || 1;
                      setRules((current) =>
                        current.map((entry, entryIndex) =>
                          entryIndex === index
                            ? {
                                ...entry,
                                min_place: nextMin,
                                max_place: Math.max(nextMin, entry.max_place),
                              }
                            : entry,
                        ),
                      );
                    }}
                    className="w-full border p-1"
                  />
                </td>
                <td className="border p-2">
                  <input
                    type="number"
                    min={1}
                    value={rule.max_place}
                    onChange={(event) => {
                      const nextMax = Number(event.target.value) || rule.min_place;
                      setRules((current) =>
                        current.map((entry, entryIndex) =>
                          entryIndex === index
                            ? {
                                ...entry,
                                max_place: Math.max(entry.min_place, nextMax),
                              }
                            : entry,
                        ),
                      );
                    }}
                    className="w-full border p-1"
                  />
                </td>
                <td className="border p-2">
                  <input
                    type="number"
                    value={rule.points}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value);
                      setRules((current) =>
                        current.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, points: nextValue } : entry,
                        ),
                      );
                    }}
                    className="w-full border p-1"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={appendPlacementRule}
            className="inline-flex cursor-pointer items-center rounded bg-slate-900 px-4 py-2 font-medium text-white shadow-sm transition hover:bg-slate-700"
          >
            + New line
          </button>
          <button
            type="button"
            onClick={saveScoring}
            className="inline-flex cursor-pointer items-center rounded bg-blue-600 px-4 py-2 font-medium text-white shadow-sm transition hover:bg-blue-700"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
