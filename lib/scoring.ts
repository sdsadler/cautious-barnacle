import { supabase } from "@/lib/supabase";

export type PlacementScoringRule = {
  id: number;
  min_place: number;
  max_place: number;
  points: number;
};

export type ScoringConfig = {
  eliminationPoints: number;
  placementRules: PlacementScoringRule[];
};

export async function getPlacementScoringRules(): Promise<PlacementScoringRule[]> {
  const { data, error } = await supabase
    .from("placement_scoring")
    .select("id, min_place, max_place, points")
    .order("min_place", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as PlacementScoringRule[];
}

export async function getEliminationPoints(): Promise<number> {
  const { data, error } = await supabase
    .from("scoring_rules")
    .select("id, elimination_points")
    .order("id", { ascending: true })
    .limit(1);

  if (error) {
    throw error;
  }

  return Number(data?.[0]?.elimination_points ?? 0);
}

export async function getScoringConfig(): Promise<ScoringConfig> {
  const [placementRules, eliminationPoints] = await Promise.all([
    getPlacementScoringRules(),
    getEliminationPoints(),
  ]);

  return {
    eliminationPoints,
    placementRules,
  };
}

export async function getPlacementPointsForPlacement(placement: number): Promise<number> {
  const rules = await getPlacementScoringRules();
  const rule = rules.find(
    (entry) => placement >= entry.min_place && placement <= entry.max_place,
  );

  return rule?.points ?? 0;
}

export async function saveScoringConfig({ eliminationPoints, placementRules }: ScoringConfig): Promise<void> {
  const { data: existingRules, error: lookupError } = await supabase
    .from("scoring_rules")
    .select("id, elimination_points")
    .order("id", { ascending: true })
    .limit(1);

  if (lookupError) {
    throw lookupError;
  }

  if ((existingRules ?? []).length > 0) {
    const { error } = await supabase
      .from("scoring_rules")
      .update({ elimination_points: eliminationPoints })
      .eq("id", existingRules[0].id);

    if (error) {
      throw error;
    }
  } else {
    const { error } = await supabase
      .from("scoring_rules")
      .insert({ elimination_points: eliminationPoints });

    if (error) {
      throw error;
    }
  }

  if (placementRules.length === 0) {
    return;
  }

  const results = await Promise.all(
    placementRules.map((rule) =>
      supabase
        .from("placement_scoring")
        .update({ points: rule.points })
        .eq("id", rule.id),
    ),
  );

  const failedResult = results.find((result) => result.error);
  if (failedResult?.error) {
    throw failedResult.error;
  }
}
