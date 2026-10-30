"use client";

import { useState, type ChangeEvent } from "react";

type StandingsFilterFormProps = {
  seasons: { id: number; name: string }[];
  events: { id: number; event_name: string }[];
  matches: { id: number; match_name: string }[];
  selectedSeasonId: number;
  selectedEventId: number | null;
  selectedMatchId: number | null;
};

export default function StandingsFilterForm({
  seasons,
  events,
  matches,
  selectedSeasonId,
  selectedEventId,
  selectedMatchId,
}: StandingsFilterFormProps) {
  const [isOpen, setIsOpen] = useState(false);

  const submitOnChange = (event: ChangeEvent<HTMLSelectElement>) => {
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <form method="get" className="mb-8 w-full max-w-4xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          aria-expanded={isOpen}
          className="inline-flex items-center justify-center rounded-lg border border-[#d1c905] bg-[#d1c905] px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-[#111111] transition hover:brightness-110"
        >
          Filters
        </button>
      </div>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="rounded-2xl border border-[#2b2b2b] bg-[#181818] p-4 shadow-xl shadow-black/20">
          <div className="flex flex-col flex-wrap gap-4 md:flex-row md:items-end">
            <div className="flex min-w-[180px] flex-1 flex-col gap-2">
              <label htmlFor="season" className="text-xs font-semibold uppercase tracking-[0.12em] text-[#d1c905]">
                Season
              </label>
              <select
                id="season"
                name="season"
                defaultValue={String(selectedSeasonId)}
                className="rounded-md border border-[#3a3a3a] bg-[#101010] px-3 py-2.5 text-sm text-white outline-none ring-0 transition focus:border-[#d1c905]"
                onChange={submitOnChange}
              >
                {seasons.map((option) => (
                  <option key={option.id} value={String(option.id)}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex min-w-[180px] flex-1 flex-col gap-2">
              <label htmlFor="event" className="text-xs font-semibold uppercase tracking-[0.12em] text-[#d1c905]">
                Event
              </label>
              <select
                id="event"
                name="event"
                defaultValue={selectedEventId ? String(selectedEventId) : "all"}
                className="rounded-md border border-[#3a3a3a] bg-[#101010] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#d1c905]"
                onChange={submitOnChange}
              >
                <option value="all">All events</option>
                {events.map((event) => (
                  <option key={event.id} value={String(event.id)}>
                    {event.event_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex min-w-[180px] flex-1 flex-col gap-2">
              <label htmlFor="match" className="text-xs font-semibold uppercase tracking-[0.12em] text-[#d1c905]">
                Match
              </label>
              <select
                id="match"
                name="match"
                defaultValue={selectedMatchId ? String(selectedMatchId) : "all"}
                className="rounded-md border border-[#3a3a3a] bg-[#101010] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#d1c905]"
                onChange={submitOnChange}
              >
                <option value="all">All matches</option>
                {matches.map((match) => (
                  <option key={match.id} value={String(match.id)}>
                    {match.match_name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="rounded-md bg-[#d1c905] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-[#111111] transition hover:brightness-110"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
