import { supabase } from "@/lib/supabase";

export type DependencyCounts = {
  eventCount: number;
  matchCount: number;
  resultCount: number;
  teamCount: number;
  playerRegistrationCount: number;
  scoringRuleCount: number;
  placementRuleCount: number;
};

export function hasDependentRecords(counts: DependencyCounts): boolean {
  return (
    counts.eventCount > 0 ||
    counts.matchCount > 0 ||
    counts.resultCount > 0 ||
    counts.teamCount > 0 ||
    counts.playerRegistrationCount > 0
  );
}

export function buildDependencyBlockedMessage(
  entityName: string,
  counts: DependencyCounts,
): string {
  const details: string[] = [];

  if (counts.eventCount > 0) {
    details.push(`${counts.eventCount} event(s)`);
  }

  if (counts.matchCount > 0) {
    details.push(`${counts.matchCount} match(es)`);
  }

  if (counts.resultCount > 0) {
    details.push(`${counts.resultCount} result(s)`);
  }

  if (counts.teamCount > 0) {
    details.push(`${counts.teamCount} team(s)`);
  }

  if (counts.playerRegistrationCount > 0) {
    details.push(`${counts.playerRegistrationCount} player registration(s)`);
  }

  return `Cannot delete this ${entityName} because it still has ${details.join(", ")}.`;
}

export function formatDependencyCounts(counts: DependencyCounts): string {
  return `${counts.eventCount} events • ${counts.matchCount} matches • ${counts.resultCount} results • ${counts.teamCount} teams • ${counts.playerRegistrationCount} player registrations`;
}

export type MatchDependencySummary = {
  resultCount: number;
  unmatchedResultCount: number;
};

export function buildMatchDeleteMessage(
  matchName: string,
  summary: MatchDependencySummary,
): string {
  const details: string[] = [];

  if (summary.resultCount > 0) {
    details.push(`${summary.resultCount} result${summary.resultCount === 1 ? "" : "s"}`);
  }

  if (summary.unmatchedResultCount > 0) {
    details.push(
      `${summary.unmatchedResultCount} unmatched-result row${summary.unmatchedResultCount === 1 ? "" : "s"}`,
    );
  }

  if (details.length === 0) {
    return `Delete "${matchName}"? This will remove the match record and any related historical data.`;
  }

  return `Delete "${matchName}"? This will also remove ${details.join(" and ")} associated with this match.`;
}

export async function getMatchDependencySummary(matchId: number): Promise<MatchDependencySummary> {
  const [{ data: resultRows, error: resultError }, { data: unmatchedRows, error: unmatchedError }] =
    await Promise.all([
      supabase.from("results").select("id").eq("match_id", matchId),
      supabase.from("unmatched_results").select("id").eq("match_id", matchId),
    ]);

  if (resultError) {
    throw resultError;
  }

  if (unmatchedError) {
    throw unmatchedError;
  }

  return {
    resultCount: resultRows?.length ?? 0,
    unmatchedResultCount: unmatchedRows?.length ?? 0,
  };
}

export async function deleteMatchIfAllowed(matchId: number): Promise<
  { ok: true } | { ok: false; message: string }
> {
  try {
    const [{ error: resultError }, { error: unmatchedError }, { error: matchError }] = await Promise.all([
      supabase.from("results").delete().eq("match_id", matchId),
      supabase.from("unmatched_results").delete().eq("match_id", matchId),
      supabase.from("matches").delete().eq("id", matchId),
    ]);

    if (resultError) {
      return { ok: false, message: resultError.message };
    }

    if (unmatchedError) {
      return { ok: false, message: unmatchedError.message };
    }

    if (matchError) {
      return { ok: false, message: matchError.message };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to delete match.",
    };
  }
}

export async function getEventDependencySummary(eventId: number): Promise<DependencyCounts> {
  const { data: matchRows, error: matchError } = await supabase
    .from("matches")
    .select("id")
    .eq("event_id", eventId);

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

  return {
    eventCount: 0,
    matchCount: matchIds.length,
    resultCount,
    teamCount: 0,
    playerRegistrationCount: 0,
    scoringRuleCount: 0,
    placementRuleCount: 0,
  };
}
