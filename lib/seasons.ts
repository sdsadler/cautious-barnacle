import {
  buildDependencyBlockedMessage,
  hasDependentRecords,
  type DependencyCounts,
} from "@/lib/admin-dependency-guards";
import { supabase } from "@/lib/supabase";

type SeasonSupabaseClient = typeof supabase;

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
  teamCount: number;
  playerRegistrationCount: number;
  scoringRuleCount: number;
  placementRuleCount: number;
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
  client: SeasonSupabaseClient = supabase,
): Promise<SeasonDependencySummary> {
  const [
    { data: eventData, error: eventError },
    { data: teamData, error: teamError },
    { data: registrationData, error: registrationError },
    { data: scoringRuleData, error: scoringRuleError },
    { data: placementRuleData, error: placementRuleError },
  ] = await Promise.all([
    client.from("events").select("id").eq("season_id", seasonId),
    client.from("teams").select("id").eq("season_id", seasonId),
    client.from("player_registrations").select("id").eq("season_id", seasonId),
    client.from("scoring_rules").select("id").eq("season_id", seasonId),
    client.from("placement_scoring").select("id").eq("season_id", seasonId),
  ]);

  if (eventError) {
    throw eventError;
  }

  if (teamError) {
    throw teamError;
  }

  if (registrationError) {
    throw registrationError;
  }

  if (scoringRuleError) {
    throw scoringRuleError;
  }

  if (placementRuleError) {
    throw placementRuleError;
  }

  const eventIds = (eventData ?? []).map((event) => event.id);

  const { data: matchData, error: matchError } = await client
    .from("matches")
    .select("id, event_id")
    .in("event_id", eventIds.length > 0 ? eventIds : [0]);

  if (matchError) {
    throw matchError;
  }

  const matchIds = (matchData ?? []).map((match) => match.id);

  const { data: resultData, error: resultError } = await client
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
    teamCount: teamData?.length ?? 0,
    playerRegistrationCount: registrationData?.length ?? 0,
    scoringRuleCount: scoringRuleData?.length ?? 0,
    placementRuleCount: placementRuleData?.length ?? 0,
  };
}

export async function getSeasonDependencySummary(
  seasonId: number,
  client: SeasonSupabaseClient = supabase,
): Promise<SeasonDependencySummary> {
  return countDependentRecordsForSeason(seasonId, client);
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
  client: SeasonSupabaseClient = supabase,
): Promise<boolean> {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return false;
  }

  const { data, error } = await client
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

export async function activateSeason(
  seasonId: number,
  client: SeasonSupabaseClient = supabase,
): Promise<void> {
  const { error: deactivateError } = await client
    .from("seasons")
    .update({ active: false })
    .neq("id", seasonId);

  if (deactivateError) {
    throw deactivateError;
  }

  const { data: activatedRows, error: activateError } = await client
    .from("seasons")
    .update({ active: true })
    .eq("id", seasonId)
    .select("id");

  if (activateError) {
    throw activateError;
  }

  if (!activatedRows || activatedRows.length === 0) {
    throw new Error(`Unable to activate season with id ${seasonId}.`);
  }
}

export async function setSeasonActiveState(
  seasonId: number,
  active: boolean,
  client: SeasonSupabaseClient = supabase,
): Promise<void> {
  if (active) {
    await activateSeason(seasonId, client);
    return;
  }

  const { data: deactivatedRows, error } = await client
    .from("seasons")
    .update({ active: false })
    .eq("id", seasonId)
    .select("id");

  if (error) {
    throw error;
  }

  if (!deactivatedRows || deactivatedRows.length === 0) {
    throw new Error(`Unable to deactivate season with id ${seasonId}.`);
  }
}

const DEFAULT_SCORING_RULES = {
  eliminationPoints: 1,
  teamPointsCount: 4,
};

const DEFAULT_PLACEMENT_RULES = [
  { min_place: 1, max_place: 1, points: 10 },
  { min_place: 2, max_place: 10, points: 5 },
  { min_place: 11, max_place: 25, points: 2 },
  { min_place: 26, max_place: 50, points: 1 },
];

async function getCurrentSeasonScoringTemplate(client: SeasonSupabaseClient) {
  const { data: activeSeasonData, error: activeSeasonError } = await client
    .from("seasons")
    .select("id")
    .eq("active", true)
    .order("id", { ascending: false })
    .limit(1);

  if (activeSeasonError) {
    throw activeSeasonError;
  }

  let sourceSeasonId = activeSeasonData?.[0]?.id ?? null;

  if (!sourceSeasonId) {
    const { data: latestSeasonData, error: latestSeasonError } = await client
      .from("seasons")
      .select("id")
      .order("start_date", { ascending: false })
      .limit(1);

    if (latestSeasonError) {
      throw latestSeasonError;
    }

    sourceSeasonId = latestSeasonData?.[0]?.id ?? null;
  }

  const defaultTemplate = {
    scoringRules: [{
      elimination_points: DEFAULT_SCORING_RULES.eliminationPoints,
      team_points_count: DEFAULT_SCORING_RULES.teamPointsCount,
    }],
    placementRules: DEFAULT_PLACEMENT_RULES,
  };

  if (!sourceSeasonId) {
    return defaultTemplate;
  }

  const [{ data: scoringRows, error: scoringError }, { data: placementRows, error: placementError }] = await Promise.all([
    client
      .from("scoring_rules")
      .select("elimination_points, team_points_count")
      .eq("season_id", sourceSeasonId)
      .order("id", { ascending: true }),
    client
      .from("placement_scoring")
      .select("min_place, max_place, points")
      .eq("season_id", sourceSeasonId)
      .order("min_place", { ascending: true }),
  ]);

  if (scoringError) {
    throw scoringError;
  }

  if (placementError) {
    throw placementError;
  }

  return {
    scoringRules: scoringRows && scoringRows.length > 0 ? scoringRows : defaultTemplate.scoringRules,
    placementRules: placementRows && placementRows.length > 0 ? placementRows : defaultTemplate.placementRules,
  };
}

export async function createSeason(input: {
  name: string;
  startDate: string | null;
  endDate: string | null;
  active: boolean;
}, client: SeasonSupabaseClient = supabase): Promise<SeasonRecord> {
  const validation = validateSeasonInput({
    name: input.name,
    startDate: input.startDate,
    endDate: input.endDate,
  });

  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const unique = await ensureSeasonNameIsUnique(input.name, undefined, client);
  if (!unique) {
    throw new Error("A season with this name already exists.");
  }

  const { data, error } = await client
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

  if (data?.id) {
    const template = await getCurrentSeasonScoringTemplate(client);

    const { error: scoringInsertError } = await client.from("scoring_rules").insert({
      season_id: data.id,
      elimination_points: Number(template.scoringRules[0]?.elimination_points ?? DEFAULT_SCORING_RULES.eliminationPoints),
      team_points_count: Number(template.scoringRules[0]?.team_points_count ?? DEFAULT_SCORING_RULES.teamPointsCount),
    });

    if (scoringInsertError) {
      throw scoringInsertError;
    }

    const { error: placementInsertError } = await client.from("placement_scoring").insert(
      (template.placementRules.length > 0 ? template.placementRules : DEFAULT_PLACEMENT_RULES).map((rule) => ({
        season_id: data.id,
        min_place: rule.min_place,
        max_place: rule.max_place,
        points: rule.points,
      })),
    );

    if (placementInsertError) {
      throw placementInsertError;
    }
  }

  if (Boolean(input.active) && data?.id) {
    await activateSeason(data.id, client);
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
  client: SeasonSupabaseClient = supabase,
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

  const unique = await ensureSeasonNameIsUnique(input.name, seasonId, client);
  if (!unique) {
    throw new Error("A season with this name already exists.");
  }

  const { data, error } = await client
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
    await activateSeason(data.id, client);
  }

  return data as SeasonRecord;
}

export async function deleteSeasonIfAllowed(
  seasonId: number,
  client: SeasonSupabaseClient = supabase,
): Promise<{
  ok: true;
} | { ok: false; message: string }> {
  const [{ data: seasonRows, error: seasonLookupError }, dependencies] = await Promise.all([
    client.from("seasons").select("id").eq("id", seasonId).limit(1),
    getSeasonDependencySummary(seasonId, client),
  ]);

  if (seasonLookupError) {
    throw seasonLookupError;
  }

  if (!seasonRows || seasonRows.length === 0) {
    return {
      ok: false,
      message: `No season was found with id ${seasonId}.`,
    };
  }

  if (hasDependentRecords(dependencies)) {
    return {
      ok: false,
      message: buildDependencyBlockedMessage("season", dependencies as DependencyCounts),
    };
  }

  const [{ error: scoringError }, { error: placementError }] = await Promise.all([
    client.from("scoring_rules").delete().eq("season_id", seasonId),
    client.from("placement_scoring").delete().eq("season_id", seasonId),
  ]);

  if (scoringError) {
    throw scoringError;
  }

  if (placementError) {
    throw placementError;
  }


  const { data: deletedSeasonRows, error } = await client
    .from("seasons")
    .delete()
    .eq("id", seasonId)
    .select("id");

  if (error) {
    throw error;
  }


  if (!deletedSeasonRows || deletedSeasonRows.length === 0) {
    return {
      ok: false,
      message: `Unable to delete season with id ${seasonId}.`,
    };
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
