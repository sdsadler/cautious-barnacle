"use client";

import { useEffect, useState } from "react";
import AdminStatusBanner from "@/app/admin/components/AdminStatusBanner";
import {
  getScoringConfig,
  saveScoringConfig,
  type PlacementScoringRule,
} from "@/lib/scoring";

export default function AdminScoringPage() {
  const [rules, setRules] = useState<PlacementScoringRule[]>([]);
  const [eliminationPoints, setEliminationPoints] = useState(0);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "success" | "error">("info");

  const setStatus = (nextMessage: string, type: "info" | "success" | "error" = "info") => {
    setMessage(nextMessage);
    setMessageType(type);
  };

  const loadScoring = async () => {
    try {
      const scoringConfig = await getScoringConfig();
      setRules(scoringConfig.placementRules);
      setEliminationPoints(scoringConfig.eliminationPoints);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load scoring configuration.", "error");
    }
  };

  useEffect(() => {
    void loadScoring();
  }, []);

  const saveScoring = async () => {
    try {
      if (!rules.length) {
        setStatus("No placement scoring rules are available to update.", "error");
        return;
      }

      await saveScoringConfig({
        eliminationPoints,
        placementRules: rules,
      });

      setStatus("Scoring configuration saved.", "success");
      await loadScoring();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save scoring configuration.", "error");
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Scoring Configuration</h1>

      <AdminStatusBanner message={message} type={messageType} />

      <div className="mb-6 border p-4 rounded">
        <label className="mr-2 font-medium">Points per elimination</label>
        <input
          type="number"
          value={eliminationPoints}
          onChange={(event) => setEliminationPoints(Number(event.target.value))}
          className="border p-2"
        />
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
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td className="border p-2">{rule.min_place}</td>
                <td className="border p-2">{rule.max_place}</td>
                <td className="border p-2">
                  <input
                    type="number"
                    value={rule.points}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value);
                      setRules((current) =>
                        current.map((entry) =>
                          entry.id === rule.id ? { ...entry, points: nextValue } : entry,
                        ),
                      );
                    }}
                    className="border p-1"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button type="button" onClick={saveScoring} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded">
          Save changes
        </button>
      </div>
    </div>
  );
}
