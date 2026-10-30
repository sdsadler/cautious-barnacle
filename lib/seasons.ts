import {
  buildDependencyBlockedMessage,
  hasDependentRecords,
  type DependencyCounts,
} from "@/lib/admin-dependency-guards";
import { supabase } from "@/lib/supabase";

export type SeasonRecord = {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  active: boolean;
  created_at?: string;
};

export type SeasonDependencySummary = {
  eventCount: number;
  matchCount: number;
  resultCount: number;
};

export type SeasonEventSummary = {
  id: number;
  eventName: string;
  eventDate: string | null;
  matchCount: number;
  resultCount: number;
};

export function validateSeasonInput(input: {
  name: string;
  startDate: string | null;
  endDate: string | null;
  currentSeasonId?: number | null;
}): { valid: true } | { valid: false; message: string } {
  const name = input.name.trim();

  if (!name) {
    return { valid: false, message: "Season name is required." };
  }

  if (input.startDate && input.endDate) {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);

    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end < start) {
      return {
        valid: false,
        message: "End date cannot be before the start date.",
      };
    }
  }

  return { valid: true };
}

export async function countDependentRecordsForSeason(
  seasonId: number,
): Promise<SeasonDependencySummary> {
  const { data: eventData, error: eventError } = await supabase
    .from("events")
    .select("id")
    .eq("season_id", seasonId);

  if (eventError) {
    throw eventError;
  }

  const eventIds = (eventData ?? []).map((event) => event.id);

  const { data: matchData, error: matchError } = await supabase
    .from("matches")
    .select("id, event_id")
    .in("event_id", eventIds.length > 0 ? eventIds : [0]);

  if (matchError) {
    throw matchError;
  }

  const matchIds = (matchData ?? []).map((match) => match.id);

  const { data: resultData, error: resultError } = await supabase
    .from("results")
    .select("id")
    .in("match_id", matchIds.length > 0 ? matchIds : [0]);

  if (resultError) {
    throw resultError;
  }

  return {
    eventCount: eventIds.length,
    matchCount: matchIds.length,
    resultCount: resultData?.length ?? 0,
  };
}

export async function getSeasonDependencySummary(seasonId: number): Promise<SeasonDependencySummary> {
  return countDependentRecordsForSeason(seasonId);
}

export async function getSeasons(): Promise<SeasonRecord[]> {
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as SeasonRecord[];
}

export async function ensureSeasonNameIsUnique(
  name: string,
  currentSeasonId?: number | null,
): Promise<boolean> {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return false;
  }

  const { data, error } = await supabase
    .from("seasons")
    .select("id")
    .ilike("name", trimmedName)
    .limit(1);

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    return true;
  }

  if (!currentSeasonId) {
    return false;
  }

  return data.every((season) => season.id === currentSeasonId);
}

export async function activateSeason(seasonId: number): Promise<void> {
  const { error: deactivateError } = await supabase
    .from("seasons")
    .update({ active: false })
    .neq("id", seasonId);

  if (deactivateError) {
    throw deactivateError;
  }

  const { error: activateError } = await supabase
    .from("seasons")
    .update({ active: true })
    .eq("id", seasonId);

  if (activateError) {
    throw activateError;
  }
}

export async function setSeasonActiveState(seasonId: number, active: boolean): Promise<void> {
  if (active) {
    await activateSeason(seasonId);
    return;
  }

  const { error } = await supabase
    .from("seasons")
    .update({ active: false })
    .eq("id", seasonId);

  if (error) {
    throw error;
  }
}

export async function createSeason(input: {
  name: string;
  startDate: string | null;
  endDate: string | null;
  active: boolean;
}): Promise<SeasonRecord> {
  const validation = validateSeasonInput({
    name: input.name,
    startDate: input.startDate,
    endDate: input.endDate,
  });

  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const unique = await ensureSeasonNameIsUnique(input.name);
  if (!unique) {
    throw new Error("A season with this name already exists.");
  }

  const { data, error } = await supabase
    .from("seasons")
    .insert({
      name: input.name.trim(),
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      active: Boolean(input.active),
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (Boolean(input.active) && data?.id) {
    await activateSeason(data.id);
  }

  return data as SeasonRecord;
}

export async function updateSeason(
  seasonId: number,
  input: {
    name: string;
    startDate: string | null;
    endDate: string | null;
    active: boolean;
  },
): Promise<SeasonRecord> {
  const validation = validateSeasonInput({
    name: input.name,
    startDate: input.startDate,
    endDate: input.endDate,
    currentSeasonId: seasonId,
  });

  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const unique = await ensureSeasonNameIsUnique(input.name, seasonId);
  if (!unique) {
    throw new Error("A season with this name already exists.");
  }

  const { data, error } = await supabase
    .from("seasons")
    .update({
      name: input.name.trim(),
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      active: Boolean(input.active),
    })
    .eq("id", seasonId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (Boolean(input.active) && data?.id) {
    await activateSeason(data.id);
  }

  return data as SeasonRecord;
}

export async function deleteSeasonIfAllowed(seasonId: number): Promise<{
  ok: true;
} | { ok: false; message: string }> {
  const dependencies = await getSeasonDependencySummary(seasonId);

  if (hasDependentRecords(dependencies)) {
    return {
      ok: false,
      message: buildDependencyBlockedMessage("season", dependencies as DependencyCounts),
    };
  }

  const { error } = await supabase.from("seasons").delete().eq("id", seasonId);

  if (error) {
    throw error;
  }

  return { ok: true };
}

export async function getSeasonDetail(seasonId: number): Promise<{
  season: SeasonRecord;
  dependencySummary: SeasonDependencySummary;
  eventSummaries: SeasonEventSummary[];
}> {
  const { data: season, error: seasonError } = await supabase
    .from("seasons")
    .select("*")
    .eq("id", seasonId)
    .single();

  if (seasonError) {
    throw seasonError;
  }

  const dependencySummary = await countDependentRecordsForSeason(seasonId);

  const { data: eventRows, error: eventError } = await supabase
    .from("events")
    .select("id, event_name, event_date")
    .eq("season_id", seasonId)
    .order("event_date", { ascending: false });

  if (eventError) {
    throw eventError;
  }

  const eventSummaries: SeasonEventSummary[] = [];

  for (const eventRow of eventRows ?? []) {
    const { data: matchRows, error: matchError } = await supabase
      .from("matches")
      .select("id")
      .eq("event_id", eventRow.id);

    if (matchError) {
      throw matchError;
    }

    const matchIds = (matchRows ?? []).map((match) => match.id);

    let resultCount = 0;

    if (matchIds.length > 0) {
      const { data: resultRows, error: resultError } = await supabase
        .from("results")
        .select("id")
        .in("match_id", matchIds);

      if (resultError) {
        throw resultError;
      }

      resultCount = resultRows?.length ?? 0;
    }

    eventSummaries.push({
      id: eventRow.id,
      eventName: eventRow.event_name,
      eventDate: eventRow.event_date,
      matchCount: matchIds.length,
      resultCount,
    });
  }

  return {
    season: season as SeasonRecord,
    dependencySummary,
    eventSummaries,
  };
}
