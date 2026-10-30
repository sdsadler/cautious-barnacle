import { resolveCurrentSeasonFromDate, type SeasonOption } from "@/lib/standings";
import { supabase } from "@/lib/supabase";

export type AdminSeason = {
  id: number;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  active: boolean;
};

export type AdminEvent = {
  id: number;
  event_name: string;
  event_date: string;
  season_id: number;
  matches?: { id: number }[];
};

export function resolveDefaultAdminSeasonId(seasons: SeasonOption[]) {
  const currentSeason = resolveCurrentSeasonFromDate(seasons) ?? seasons[0] ?? null;
  return currentSeason ? String(currentSeason.id) : "";
}

export async function fetchAdminSeasons(): Promise<AdminSeason[]> {
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as AdminSeason[];
}

export async function fetchAdminEventsForSeason(seasonId?: string | number): Promise<AdminEvent[]> {
  if (seasonId === undefined || seasonId === null || seasonId === "") {
    return [];
  }

  const { data, error } = await supabase
    .from("events")
    .select("*, matches (id)")
    .eq("season_id", Number(seasonId))
    .order("event_date", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as AdminEvent[];
}
