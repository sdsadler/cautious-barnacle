import { supabase } from "@/lib/supabase";

type UnmatchedResultRecord = {
  id: number;
  match_id: number;
  username: string;
  placement: number;
  eliminations: number;
  points: number;
  resolved: boolean;
  player_id: number | null;
};

type UnmatchedResultIdentity = {
  matchId: number;
  username: string;
  placement: number;
  eliminations: number;
  points: number;
};

function buildIdentityKey(entry: {
  match_id: number;
  username: string;
  placement: number;
  eliminations: number;
  points: number;
}) {
  return `${entry.match_id}|${entry.username}|${entry.placement}|${entry.eliminations}|${entry.points}`;
}

export async function upsertUnmatchedResult(identity: UnmatchedResultIdentity) {
  const { data: existingRows, error: fetchError } = await supabase
    .from("unmatched_results")
    .select("id, resolved, player_id")
    .eq("match_id", identity.matchId)
    .eq("username", identity.username)
    .eq("placement", identity.placement)
    .eq("eliminations", identity.eliminations)
    .eq("points", identity.points)
    .order("id", { ascending: true });

  if (fetchError) {
    throw fetchError;
  }

  if (!existingRows || existingRows.length === 0) {
    const { error: insertError } = await supabase.from("unmatched_results").insert({
      match_id: identity.matchId,
      username: identity.username,
      placement: identity.placement,
      eliminations: identity.eliminations,
      points: identity.points,
      resolved: false,
      player_id: null,
    });

    if (insertError) {
      throw insertError;
    }

    return;
  }

  const keepId = existingRows[0].id;
  const duplicateIds = existingRows.slice(1).map((row) => row.id);

  const { error: reopenError } = await supabase
    .from("unmatched_results")
    .update({ resolved: false, player_id: null })
    .eq("id", keepId);

  if (reopenError) {
    throw reopenError;
  }

  if (duplicateIds.length > 0) {
    const { error: deleteDuplicatesError } = await supabase
      .from("unmatched_results")
      .delete()
      .in("id", duplicateIds);

    if (deleteDuplicatesError) {
      throw deleteDuplicatesError;
    }
  }
}

export async function reopenUnmatchedResultsForAlias(aliasName: string) {
  const { data: rows, error: fetchError } = await supabase
    .from("unmatched_results")
    .select("id, match_id, username, placement, eliminations, points, resolved, player_id")
    .eq("username", aliasName)
    .order("id", { ascending: true });

  if (fetchError) {
    throw fetchError;
  }

  const groupedKeepIds = new Map<string, number>();
  const duplicateIds: number[] = [];

  for (const row of (rows ?? []) as UnmatchedResultRecord[]) {
    const key = buildIdentityKey(row);

    if (!groupedKeepIds.has(key)) {
      groupedKeepIds.set(key, row.id);
      continue;
    }

    duplicateIds.push(row.id);
  }

  const keepIds = Array.from(groupedKeepIds.values());

  if (keepIds.length > 0) {
    const { error: reopenError } = await supabase
      .from("unmatched_results")
      .update({ resolved: false, player_id: null })
      .in("id", keepIds);

    if (reopenError) {
      throw reopenError;
    }
  }

  if (duplicateIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("unmatched_results")
      .delete()
      .in("id", duplicateIds);

    if (deleteError) {
      throw deleteError;
    }
  }
}
