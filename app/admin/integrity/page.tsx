"use client";

import { useEffect, useState } from "react";
import AdminStatusBanner from "@/app/admin/components/AdminStatusBanner";
import { getDataIntegrityReport, type DataIntegrityReport } from "@/lib/admin-data-integrity";

const emptyReport: DataIntegrityReport = {
  duplicatePlayerRegistrations: [],
  duplicateTeams: [],
  invalidTeamLinks: [],
  orphanAliases: [],
  unassignedPlayers: [],
  totalIssues: 0,
};

export default function AdminDataIntegrityPage() {
  const [report, setReport] = useState<DataIntegrityReport>(emptyReport);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "success" | "error">("info");

  const setStatus = (nextMessage: string, type: "info" | "success" | "error" = "info") => {
    setMessage(nextMessage);
    setMessageType(type);
  };

  const loadAudit = async () => {
    try {
      const nextReport = await getDataIntegrityReport();
      setReport(nextReport);
      setStatus(nextReport.totalIssues === 0 ? "No integrity issues detected." : `Found ${nextReport.totalIssues} integrity issue(s).`, "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load data integrity audit.", "error");
    }
  };

  useEffect(() => {
    void loadAudit();
  }, []);

  const summaryCards = [
    { label: "Duplicate registrations", value: report.duplicatePlayerRegistrations.length },
    { label: "Duplicate teams", value: report.duplicateTeams.length },
    { label: "Invalid team links", value: report.invalidTeamLinks.length },
    { label: "Orphan aliases", value: report.orphanAliases.length },
    { label: "Unassigned players", value: report.unassignedPlayers.length },
  ];

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Data Integrity Audit</h1>
        <button
          type="button"
          onClick={() => void loadAudit()}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Refresh audit
        </button>
      </div>

      <AdminStatusBanner message={message} type={messageType} />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        <section className="rounded border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold">Duplicate player registrations</h2>
          {report.duplicatePlayerRegistrations.length === 0 ? (
            <p className="text-slate-600">No duplicate player registrations found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border">
                <thead>
                  <tr>
                    <th className="border p-2 text-left">Player</th>
                    <th className="border p-2 text-left">Season</th>
                    <th className="border p-2 text-left">Count</th>
                    <th className="border p-2 text-left">Registration IDs</th>
                  </tr>
                </thead>
                <tbody>
                  {report.duplicatePlayerRegistrations.map((entry) => (
                    <tr key={`${entry.player_id}:${entry.season_id}`}>
                      <td className="border p-2">{entry.player_name ?? `#${entry.player_id}`}</td>
                      <td className="border p-2">{entry.season_id}</td>
                      <td className="border p-2">{entry.count}</td>
                      <td className="border p-2">{entry.registration_ids.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold">Duplicate teams</h2>
          {report.duplicateTeams.length === 0 ? (
            <p className="text-slate-600">No duplicate team definitions found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border">
                <thead>
                  <tr>
                    <th className="border p-2 text-left">Season</th>
                    <th className="border p-2 text-left">School</th>
                    <th className="border p-2 text-left">Team</th>
                    <th className="border p-2 text-left">Count</th>
                    <th className="border p-2 text-left">Team IDs</th>
                  </tr>
                </thead>
                <tbody>
                  {report.duplicateTeams.map((entry) => (
                    <tr key={`${entry.season_id}:${entry.school}:${entry.team_name}`}>
                      <td className="border p-2">{entry.season_id}</td>
                      <td className="border p-2">{entry.school}</td>
                      <td className="border p-2">{entry.team_name}</td>
                      <td className="border p-2">{entry.count}</td>
                      <td className="border p-2">{entry.team_ids.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold">Invalid team links</h2>
          {report.invalidTeamLinks.length === 0 ? (
            <p className="text-slate-600">No registrations point to missing or mismatched teams.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border">
                <thead>
                  <tr>
                    <th className="border p-2 text-left">Registration</th>
                    <th className="border p-2 text-left">Player</th>
                    <th className="border p-2 text-left">Season</th>
                    <th className="border p-2 text-left">Team ID</th>
                    <th className="border p-2 text-left">Team season</th>
                    <th className="border p-2 text-left">School</th>
                  </tr>
                </thead>
                <tbody>
                  {report.invalidTeamLinks.map((entry) => (
                    <tr key={`${entry.registration_id}:${entry.player_id}`}>
                      <td className="border p-2">{entry.registration_id}</td>
                      <td className="border p-2">{entry.player_name ?? `#${entry.player_id}`}</td>
                      <td className="border p-2">{entry.season_id}</td>
                      <td className="border p-2">{entry.team_id ?? "—"}</td>
                      <td className="border p-2">{entry.team_season_id ?? "—"}</td>
                      <td className="border p-2">{entry.school ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold">Orphan aliases</h2>
          {report.orphanAliases.length === 0 ? (
            <p className="text-slate-600">No orphaned aliases found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border">
                <thead>
                  <tr>
                    <th className="border p-2 text-left">Alias ID</th>
                    <th className="border p-2 text-left">Player ID</th>
                    <th className="border p-2 text-left">Alias</th>
                  </tr>
                </thead>
                <tbody>
                  {report.orphanAliases.map((entry) => (
                    <tr key={entry.id}>
                      <td className="border p-2">{entry.id}</td>
                      <td className="border p-2">{entry.player_id}</td>
                      <td className="border p-2">{entry.alias_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold">Unassigned players</h2>
          {report.unassignedPlayers.length === 0 ? (
            <p className="text-slate-600">No player registrations are missing a school assignment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border">
                <thead>
                  <tr>
                    <th className="border p-2 text-left">Registration</th>
                    <th className="border p-2 text-left">Player</th>
                    <th className="border p-2 text-left">Season</th>
                    <th className="border p-2 text-left">Team ID</th>
                    <th className="border p-2 text-left">School</th>
                  </tr>
                </thead>
                <tbody>
                  {report.unassignedPlayers.map((entry) => (
                    <tr key={entry.registration_id}>
                      <td className="border p-2">{entry.registration_id}</td>
                      <td className="border p-2">{entry.player_name ?? `#${entry.player_id}`}</td>
                      <td className="border p-2">{entry.season_id}</td>
                      <td className="border p-2">{entry.team_id ?? "—"}</td>
                      <td className="border p-2">{entry.school ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
