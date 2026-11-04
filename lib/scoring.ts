import { supabase } from "@/lib/supabase";

export type PlacementScoringRule = {
  id: number;
  min_place: number;
  max_place: number;
  points: number;
};

export type ScoringConfig = {
  seasonId?: number | null;
  eliminationPoints: number;
  teamPointsCount: number;
  placementRules: PlacementScoringRule[];
};

export async function getScoringRuleRow(seasonId?: number | null) {
  if (seasonId === undefined || seasonId === null) {
    return null;
  }

  const { data, error } = await supabase
    .from("scoring_rules")
    .select("id, elimination_points, team_points_count, season_id")
    .eq("season_id", seasonId)
    .order("id", { ascending: true })
    .limit(1);

  if (error) {
    throw error;
  }

  return (data ?? [])[0] ?? null;
}

export async function getPlacementScoringRules(seasonId?: number | null): Promise<PlacementScoringRule[]> {
  if (seasonId === undefined || seasonId === null) {
    return [];
  }

  const { data, error } = await supabase
    .from("placement_scoring")
    .select("id, min_place, max_place, points, season_id")
    .eq("season_id", seasonId)
    .order("min_place", { ascending: true });

  if (error) {
    throw error;
  }
  return (data ?? []) as PlacementScoringRule[];
}

export async function getEliminationPoints(seasonId?: number | null): Promise<number> {
  const row = await getScoringRuleRow(seasonId);

  return Number(row?.elimination_points ?? 0);
}

export async function getTeamPointsCount(seasonId?: number | null): Promise<number> {
  const row = await getScoringRuleRow(seasonId);

  return Number(row?.team_points_count ?? 0);
}

export async function getScoringConfig(seasonId?: number | null): Promise<ScoringConfig> {
  const [placementRules, eliminationPoints, teamPointsCount] = await Promise.all([
    getPlacementScoringRules(seasonId),
    getEliminationPoints(seasonId),
    getTeamPointsCount(seasonId),
  ]);

  return {
    seasonId: seasonId ?? null,
    eliminationPoints,
    teamPointsCount,
    placementRules,
  };
}

export async function getPlacementPointsForPlacement(placement: number, seasonId?: number | null): Promise<number> {
  const rules = await getPlacementScoringRules(seasonId);
  const rule = rules.find(
    (entry) => placement >= entry.min_place && placement <= entry.max_place,
  );

  return rule?.points ?? 0;
}

export async function saveScoringConfig({ seasonId, eliminationPoints, teamPointsCount, placementRules }: ScoringConfig): Promise<void> {
  if (seasonId === undefined || seasonId === null) {
    throw new Error("A season must be selected before saving scoring rules.");
  }

  const normalizedTeamPointsCount = Math.max(1, Number.isFinite(teamPointsCount) ? Math.trunc(teamPointsCount) : 4);
  const existingRule = await getScoringRuleRow(seasonId);

  const scoringPayload = {
    season_id: seasonId,
    elimination_points: Number(eliminationPoints),
    team_points_count: normalizedTeamPointsCount,
  };

  if (existingRule) {
    const { error } = await supabase
      .from("scoring_rules")
      .update(scoringPayload)
      .eq("id", existingRule.id);

    if (error) {
      throw error;
    }
  } else {
    const { error } = await supabase.from("scoring_rules").insert(scoringPayload);

    if (error) {
      throw error;
    }
  }

  const { error: deleteError } = await supabase
    .from("placement_scoring")
    .delete()
    .eq("season_id", seasonId);

  if (deleteError) {
    throw deleteError;
  }

  if (placementRules.length === 0) {
    return;
  }

  const { error: insertError } = await supabase
    .from("placement_scoring")
    .insert(
      placementRules.map((rule) => ({
        season_id: seasonId,
        min_place: rule.min_place,
        max_place: rule.max_place,
        points: rule.points,
      })),
    );

  if (insertError) {
    throw insertError;
  }
}
