import { supabase } from "@/lib/supabase";

export type SeasonOption = {
  id: number;
  name: string;
  active: boolean;
  start_date?: string | null;
  end_date?: string | null;
};

export type SeasonSelection = {
  seasons: SeasonOption[];
  season: SeasonOption | null;
};

export type StandingsSearchParams = Record<string, string | string[] | undefined>;
export type StandingsSearchParamsInput =
  | StandingsSearchParams
  | Promise<StandingsSearchParams>
  | undefined;

export function getSingleParamValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export function normalizeLookupValue(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
}

export function matchNormalizedName(left: string | null | undefined, right: string | null | undefined): boolean {
  return normalizeLookupValue(left) === normalizeLookupValue(right);
}

export function seasonContainsDate(season: SeasonOption, date: Date): boolean {
  if (!season.start_date && !season.end_date) {
    return false;
  }

  const start = season.start_date ? new Date(season.start_date) : null;
  const end = season.end_date ? new Date(season.end_date) : null;

  if (start && end) {
    return date >= start && date <= end;
  }

  if (start) {
    return date >= start;
  }

  if (end) {
    return date <= end;
  }

  return false;
}

export function resolveCurrentSeasonFromDate(
  seasons: SeasonOption[],
  currentDate = new Date(),
): SeasonOption | null {
  const today = new Date(currentDate);
  today.setHours(0, 0, 0, 0);

  const inRange = seasons.filter((season) => seasonContainsDate(season, today));

  if (inRange.length > 0) {
    return inRange.sort((left, right) => {
      const leftStart = left.start_date ? new Date(left.start_date).getTime() : Number.NEGATIVE_INFINITY;
      const rightStart = right.start_date ? new Date(right.start_date).getTime() : Number.NEGATIVE_INFINITY;
      return rightStart - leftStart;
    })[0];
  }

  let closestSeason: SeasonOption | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const season of seasons) {
    const start = season.start_date ? new Date(season.start_date) : null;
    const end = season.end_date ? new Date(season.end_date) : null;

    if (!start && !end) {
      continue;
    }

    const candidateDates = [start, end].filter((entry): entry is Date => Boolean(entry));
    const distance = Math.min(
      ...candidateDates.map((candidate) => Math.abs(candidate.getTime() - today.getTime())),
    );

    if (distance < closestDistance) {
      closestDistance = distance;
      closestSeason = season;
    }
  }

  return closestSeason;
}

export async function getSeasons(): Promise<SeasonOption[]> {
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as SeasonOption[];
}

export async function resolveSeasonSelection(
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>
): Promise<SeasonSelection> {
  const seasons = await getSeasons();

  const resolvedSearchParams =
    searchParams && "then" in searchParams ? await searchParams : searchParams;

  const rawSeason = getSingleParamValue(resolvedSearchParams?.season);
  const requestedSeasonId = rawSeason ? Number(rawSeason) : NaN;

  const requestedSeason = Number.isFinite(requestedSeasonId)
    ? seasons.find((entry) => entry.id === requestedSeasonId) ?? null
    : null;

  const season =
    requestedSeason ??
    resolveCurrentSeasonFromDate(seasons) ??
    seasons.find((entry) => entry.active) ??
    seasons[0] ??
    null;

  return { seasons, season };
}

export async function getSeasonEvents(seasonId: number) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("season_id", seasonId)
    .order("event_date", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getSeasonMatches(seasonId: number, eventId?: number | null) {
  const { data: events, error: eventError } = await supabase
    .from("events")
    .select("id")
    .eq("season_id", seasonId);

  if (eventError) {
    throw eventError;
  }

  const eventIds = (events ?? []).map((event) => event.id);

  if (eventIds.length === 0) {
    return [];
  }

  let query = supabase
    .from("matches")
    .select("id, match_name, event_id")
    .in("event_id", eventIds)
    .order("match_name", { ascending: true });

  if (eventId) {
    query = query.eq("event_id", eventId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function resolveStandingsScope(searchParams?: StandingsSearchParamsInput) {
  const { season, seasons } = await resolveSeasonSelection(searchParams);

  const resolvedSearchParams =
    searchParams && "then" in searchParams ? await searchParams : searchParams;

  if (!season) {
    return {
      seasons,
      season: null,
      events: [],
      matches: [],
      selectedEventId: null,
      selectedMatchId: null,
    };
  }

  const eventParam = getSingleParamValue(resolvedSearchParams?.event);
  const matchParam = getSingleParamValue(resolvedSearchParams?.match);

  const events = await getSeasonEvents(season.id);

  const selectedEventIdFromParam = eventParam ? Number(eventParam) : NaN;
  let selectedEventId: number | null = Number.isFinite(selectedEventIdFromParam)
    ? events.some((event) => event.id === selectedEventIdFromParam)
      ? selectedEventIdFromParam
      : null
    : null;

  let matches = await getSeasonMatches(season.id, selectedEventId ?? undefined);

  const selectedMatchIdFromParam = matchParam ? Number(matchParam) : NaN;
  let selectedMatchId: number | null = Number.isFinite(selectedMatchIdFromParam)
    ? matches.some((match) => match.id === selectedMatchIdFromParam)
      ? selectedMatchIdFromParam
      : null
    : null;

  if (selectedMatchId !== null && selectedEventId === null) {
    const selectedMatch = matches.find((match) => match.id === selectedMatchId);
    if (selectedMatch) {
      const matchingEvent = events.find((event) => event.id === selectedMatch.event_id);
      if (matchingEvent) {
        selectedEventId = matchingEvent.id;
        matches = await getSeasonMatches(season.id, selectedEventId);
        selectedMatchId = matches.some((match) => match.id === selectedMatchIdFromParam)
          ? selectedMatchIdFromParam
          : null;
      }
    }
  }

  if (selectedEventId !== null && selectedMatchId !== null) {
    const matchStillValidForSelectedEvent = matches.some(
      (match) => match.id === selectedMatchId && match.event_id === selectedEventId,
    );

    if (!matchStillValidForSelectedEvent) {
      selectedMatchId = null;
    }
  }

  return {
    seasons,
    season,
    events,
    matches,
    selectedEventId,
    selectedMatchId,
  };
}

export async function getPlayerPerformanceMetrics(playerId: number): Promise<{
  totalPoints: number;
  totalEliminations: number;
  matchesPlayed: number;
  averageScorePerMatch: number;
  averagePlacement: number;
  placementTotal: number;
  placementCount: number;
}> {
  const { data: results, error } = await supabase
    .from("results")
    .select("points, eliminations, placement")
    .eq("player_id", playerId);

  if (error) {
    throw error;
  }

  const totalPoints = (results ?? []).reduce(
    (sum, result) => sum + (result.points ?? 0),
    0
  );
  const totalEliminations = (results ?? []).reduce(
    (sum, result) => sum + (result.eliminations ?? 0),
    0
  );
  const placementTotal = (results ?? []).reduce(
    (sum, result) => sum + (result.placement ?? 0),
    0
  );
  const matchesPlayed = results?.length ?? 0;

  return {
    totalPoints,
    totalEliminations,
    matchesPlayed,
    averageScorePerMatch: matchesPlayed > 0 ? totalPoints / matchesPlayed : 0,
    averagePlacement: matchesPlayed > 0 ? placementTotal / matchesPlayed : 0,
    placementTotal,
    placementCount: matchesPlayed,
  };
}

async function getSeasonResultMetrics(
  seasonId: number,
  eventId?: number | null,
  matchId?: number | null,
): Promise<
  Map<
    number,
    {
      totalPoints: number;
      totalEliminations: number;
      placementTotal: number;
      placementCount: number;
    }
  >
> {
  const { data: seasonEvents, error: eventError } = await supabase
    .from("events")
    .select("id")
    .eq("season_id", seasonId);

  if (eventError) {
    throw eventError;
  }

  let eventIds = (seasonEvents ?? []).map((event) => event.id);

  if (eventId) {
    eventIds = eventIds.filter((id) => id === eventId);
  }

  if (eventIds.length === 0) {
    return new Map<number, { totalPoints: number; totalEliminations: number; placementTotal: number; placementCount: number }>();
  }

  const { data: seasonMatches, error: matchError } = await supabase
    .from("matches")
    .select("id")
    .in("event_id", eventIds);

  if (matchError) {
    throw matchError;
  }

  let matchIds = (seasonMatches ?? []).map((match) => match.id);

  if (matchId) {
    matchIds = matchIds.filter((id) => id === matchId);
  }

  if (matchIds.length === 0) {
    return new Map<number, { totalPoints: number; totalEliminations: number; placementTotal: number; placementCount: number }>();
  }

  const { data: results, error: resultsError } = await supabase
    .from("results")
    .select("player_id, points, eliminations, placement")
    .in("match_id", matchIds);

  if (resultsError) {
    throw resultsError;
  }

  const totals = new Map<number, { totalPoints: number; totalEliminations: number; placementTotal: number; placementCount: number }>();

  for (const result of results ?? []) {
    const existing = totals.get(result.player_id) ?? {
      totalPoints: 0,
      totalEliminations: 0,
      placementTotal: 0,
      placementCount: 0,
    };

    totals.set(result.player_id, {
      totalPoints: existing.totalPoints + (result.points ?? 0),
      totalEliminations: existing.totalEliminations + (result.eliminations ?? 0),
      placementTotal: existing.placementTotal + (result.placement ?? 0),
      placementCount: existing.placementCount + 1,
    });
  }

  return totals;
}

export async function getPlayerProfile(playerId: number): Promise<{
  id: number;
  playerName: string;
  school: string;
  team: string;
  aliases: string[];
}> {
  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id, player_name")
    .eq("id", playerId)
    .single();

  if (playerError || !player) {
    throw playerError ?? new Error("Player not found.");
  }

  const { data: registration, error: registrationError } = await supabase
    .from("player_registrations")
    .select(`
      team_id,
      season_id,
      teams:teams (
        school,
        team_name
      )
    `)
    .eq("player_id", playerId)
    .order("season_id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (registrationError) {
    throw registrationError;
  }

  const { data: aliases, error: aliasError } = await supabase
    .from("player_aliases")
    .select("alias_name")
    .eq("player_id", playerId)
    .order("alias_name");

  if (aliasError) {
    throw aliasError;
  }

  const teamData = Array.isArray(registration?.teams)
    ? registration.teams[0]
    : registration?.teams;

  return {
    id: player.id,
    playerName: player.player_name,
    school: teamData?.school ?? "Unknown",
    team: teamData?.team_name ?? "Unknown",
    aliases: (aliases ?? []).map((entry) => entry.alias_name),
  };
}

export async function getPlayerStandingsForSeason(
  seasonId: number,
  eventId?: number | null,
  matchId?: number | null,
): Promise<
  {
    playerId: number;
    player: string;
    school: string;
    team: string;
  matchesPlayed: number;
  points: number;
  averagePlacement: number;
  totalEliminations: number;
  rank: number;
}[]
> {
  const { data: registrations, error: registrationError } = await supabase
    .from("player_registrations")
    .select(`
      player_id,
      team_id,
      players (
        player_name
      )
    `)
    .eq("season_id", seasonId);

  if (registrationError) {
    throw registrationError;
  }

  const { data: teams, error: teamError } = await supabase
    .from("teams")
    .select("id, school, team_name")
    .eq("season_id", seasonId);

  if (teamError) {
    throw teamError;
  }

  const teamLookup = new Map<number, { school: string; teamName: string }>();

  for (const team of teams ?? []) {
    teamLookup.set(team.id, {
      school: team.school,
      teamName: team.team_name,
    });
  }

  const playerMetrics = await getSeasonResultMetrics(seasonId, eventId, matchId);

  const standings = (registrations ?? []).map((registration: {
      team_id: number;
      player_id: number;
      players?: { player_name?: string | null } | { player_name?: string | null }[] | null;
    }) => {
      const teamInfo = teamLookup.get(registration.team_id) ?? {
        school: "Unknown",
        teamName: "Unknown",
      };

      const metrics = playerMetrics.get(registration.player_id) ?? {
        totalPoints: 0,
        totalEliminations: 0,
        placementTotal: 0,
        placementCount: 0,
      };

      const player = Array.isArray(registration.players)
        ? registration.players[0]
        : registration.players;

      return {
        playerId: registration.player_id,
        player: player?.player_name ?? "Unknown",
        school: teamInfo.school,
        team: teamInfo.teamName,
        matchesPlayed: metrics.placementCount,
        points: metrics.totalPoints,
        averagePlacement: metrics.placementCount > 0 ? metrics.placementTotal / metrics.placementCount : Number.POSITIVE_INFINITY,
        totalEliminations: metrics.totalEliminations,
        rank: 1,
      };
    }).filter((entry) => entry.matchesPlayed > 0);

  standings.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }

    if (a.averagePlacement !== b.averagePlacement) {
      return a.averagePlacement - b.averagePlacement;
    }

    return b.totalEliminations - a.totalEliminations;
  });

  for (let index = 0; index < standings.length; index += 1) {
    const current = standings[index];
    const previous = standings[index - 1];

    if (
      index > 0 &&
      previous &&
      previous.points === current.points &&
      previous.averagePlacement === current.averagePlacement &&
      previous.totalEliminations === current.totalEliminations
    ) {
      current.rank = previous.rank;
      continue;
    }

    current.rank = index + 1;
  }

  return standings;
}

export async function getTeamRosterForSeason(
  teamId: number,
  seasonId: number,
  eventId?: number | null,
  matchId?: number | null,
): Promise<
  {
    teamId: number;
    school: string;
    teamName: string;
    members: {
      playerId: number;
      playerName: string;
      matchesPlayed: number;
      points: number;
      averagePlacement: number;
      totalEliminations: number;
    }[];
    totalPoints: number;
    averagePlacement: number;
    totalEliminations: number;
    matchesPlayed: number;
    memberCount: number;
  }
> {
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, school, team_name")
    .eq("id", teamId)
    .eq("season_id", seasonId)
    .single();

  if (teamError || !team) {
    throw teamError ?? new Error("Team not found.");
  }

  const { data: registrations, error: registrationError } = await supabase
    .from("player_registrations")
    .select(`
      player_id,
      players:players (player_name)
    `)
    .eq("season_id", seasonId)
    .eq("team_id", teamId);

  if (registrationError) {
    throw registrationError;
  }

  const playerMetrics = await getSeasonResultMetrics(seasonId, eventId, matchId);
  const members = (registrations ?? []).map((registration: { player_id: number; players?: { player_name?: string | null } | { player_name?: string | null }[] | null }) => {
    const player = Array.isArray(registration.players) ? registration.players[0] : registration.players;
    const metrics = playerMetrics.get(registration.player_id) ?? {
      totalPoints: 0,
      totalEliminations: 0,
      placementTotal: 0,
      placementCount: 0,
    };

    return {
      playerId: registration.player_id,
      playerName: player?.player_name ?? "Unknown",
      matchesPlayed: metrics.placementCount,
      points: metrics.totalPoints,
      averagePlacement: metrics.placementCount > 0 ? metrics.placementTotal / metrics.placementCount : 0,
      totalEliminations: metrics.totalEliminations,
    };
  });

  const totalPoints = members.reduce((sum, member) => sum + member.points, 0);
  const totalEliminations = members.reduce((sum, member) => sum + member.totalEliminations, 0);
  const matchesPlayed = members.reduce((sum, member) => sum + member.matchesPlayed, 0);
  const placementTotal = members.reduce((sum, member) => sum + (member.averagePlacement * member.matchesPlayed), 0);

  return {
    teamId: team.id,
    school: team.school,
    teamName: team.team_name,
    members: members.sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points;
      }
      if (right.totalEliminations !== left.totalEliminations) {
        return right.totalEliminations - left.totalEliminations;
      }
      return left.playerName.localeCompare(right.playerName);
    }),
    totalPoints,
    averagePlacement: matchesPlayed > 0 ? placementTotal / matchesPlayed : 0,
    totalEliminations,
    matchesPlayed,
    memberCount: members.length,
  };
}

export async function getTeamStandingsForSeason(
  seasonId: number,
  eventId?: number | null,
  matchId?: number | null,
): Promise<
  {
    id: number;
    school: string;
    teamName: string;
    points: number;
    averagePlacement: number;
    totalEliminations: number;
    playerCount: number;
    rank: number;
  }[]
> {
  const { data: teams, error: teamError } = await supabase
    .from("teams")
    .select("id, school, team_name")
    .eq("season_id", seasonId);

  if (teamError) {
    throw teamError;
  }

  const { data: registrations, error: registrationError } = await supabase
    .from("player_registrations")
    .select("player_id, team_id")
    .eq("season_id", seasonId);

  if (registrationError) {
    throw registrationError;
  }

  const playerMetrics = await getSeasonResultMetrics(seasonId, eventId, matchId);

  const teamPoints = new Map<number, number>();
  const teamElims = new Map<number, number>();
  const teamPlacementTotal = new Map<number, number>();
  const teamPlacementCount = new Map<number, number>();

  for (const registration of registrations ?? []) {
    if (!registration.team_id) {
      continue;
    }

    const metrics = playerMetrics.get(registration.player_id) ?? {
      totalPoints: 0,
      totalEliminations: 0,
      placementTotal: 0,
      placementCount: 0,
    };

    const teamId = registration.team_id;
    teamPoints.set(teamId, (teamPoints.get(teamId) ?? 0) + metrics.totalPoints);
    teamElims.set(teamId, (teamElims.get(teamId) ?? 0) + metrics.totalEliminations);
    teamPlacementTotal.set(teamId, (teamPlacementTotal.get(teamId) ?? 0) + metrics.placementTotal);
    teamPlacementCount.set(teamId, (teamPlacementCount.get(teamId) ?? 0) + metrics.placementCount);
  }

  const teamPlayerCounts = new Map<number, number>();
  for (const registration of registrations ?? []) {
    if (!registration.team_id) {
      continue;
    }
    teamPlayerCounts.set(registration.team_id, (teamPlayerCounts.get(registration.team_id) ?? 0) + 1);
  }

  const standings = (teams ?? []).map(
    (team: {
      id: number;
      school: string;
      team_name: string;
    }) => {
      const points = teamPoints.get(team.id) ?? 0;
      const placementCount = teamPlacementCount.get(team.id) ?? 0;

      return {
        id: team.id,
        school: team.school,
        teamName: team.team_name,
        points,
        averagePlacement:
          placementCount > 0
            ? (teamPlacementTotal.get(team.id) ?? 0) / placementCount
            : Number.POSITIVE_INFINITY,
        totalEliminations: teamElims.get(team.id) ?? 0,
        playerCount: teamPlayerCounts.get(team.id) ?? 0,
        rank: 1,
      };
    },
  );

  standings.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }

    if (a.averagePlacement !== b.averagePlacement) {
      return a.averagePlacement - b.averagePlacement;
    }

    return b.totalEliminations - a.totalEliminations;
  });

  for (let index = 0; index < standings.length; index += 1) {
    const current = standings[index];
    const previous = standings[index - 1];

    if (
      index > 0 &&
      previous &&
      previous.points === current.points &&
      previous.averagePlacement === current.averagePlacement &&
      previous.totalEliminations === current.totalEliminations
    ) {
      current.rank = previous.rank;
      continue;
    }

    current.rank = index + 1;
  }

  return standings;
}

export async function getPlayerSeasonHistory(playerId: number): Promise<
  {
    seasonId: number;
    seasonName: string;
    totalPoints: number;
    totalEliminations: number;
    matchesPlayed: number;
    averageScorePerMatch: number;
    averagePlacement: number;
    recentResults: {
      matchName: string;
      eventName: string;
      placement: number;
      eliminations: number;
      score: number;
      matchId: number;
      eventId: number;
      playedAt: string | null;
    }[];
  }[]
> {
  const { data: seasons, error: seasonError } = await supabase
    .from("seasons")
    .select("id, name")
    .order("name", { ascending: false });

  if (seasonError) {
    throw seasonError;
  }

  const history: {
    seasonId: number;
    seasonName: string;
    totalPoints: number;
    totalEliminations: number;
    matchesPlayed: number;
    averageScorePerMatch: number;
    averagePlacement: number;
    recentResults: {
      matchName: string;
      eventName: string;
      placement: number;
      eliminations: number;
      score: number;
      matchId: number;
      eventId: number;
      playedAt: string | null;
    }[];
  }[] = [];

  for (const season of seasons ?? []) {
    const { data: seasonEvents, error: eventError } = await supabase
      .from("events")
      .select("id, event_name")
      .eq("season_id", season.id);

    if (eventError) {
      throw eventError;
    }

    const eventIds = (seasonEvents ?? []).map((event) => event.id);

    if (eventIds.length === 0) {
      continue;
    }

    const { data: seasonMatches, error: matchError } = await supabase
      .from("matches")
      .select("id, match_name, event_id")
      .in("event_id", eventIds);

    if (matchError) {
      throw matchError;
    }

    const matchIds = (seasonMatches ?? []).map((match) => match.id);

    if (matchIds.length === 0) {
      continue;
    }

    const { data: results, error: resultError } = await supabase
      .from("results")
      .select(`
        match_id,
        placement,
        eliminations,
        points,
        matches:matches (
          match_name,
          event_id,
          events:events (
            event_name
          )
        )
      `)
      .eq("player_id", playerId)
      .in("match_id", matchIds)
      .order("id", { ascending: false });

    if (resultError) {
      throw resultError;
    }

    if (!results || results.length === 0) {
      continue;
    }

    const totalPoints = results.reduce((sum, result) => sum + (result.points ?? 0), 0);
    const totalEliminations = results.reduce(
      (sum, result) => sum + (result.eliminations ?? 0),
      0
    );
    const averagePlacement =
      results.reduce((sum, result) => sum + (result.placement ?? 0), 0) / results.length;

    const normalizedResults = (results ?? []).map((result) => {
      const matchData = Array.isArray(result.matches)
        ? result.matches[0]
        : result.matches;
      const eventData = Array.isArray(matchData?.events)
        ? matchData.events[0]
        : matchData?.events;

      return {
        matchName: matchData?.match_name ?? "Unknown match",
        eventName: eventData?.event_name ?? "Unknown event",
        placement: result.placement ?? 0,
        eliminations: result.eliminations ?? 0,
        score: result.points ?? 0,
        matchId: result.match_id,
        eventId: matchData?.event_id ?? 0,
        playedAt: null,
      };
    });

    history.push({
      seasonId: season.id,
      seasonName: season.name,
      totalPoints,
      totalEliminations,
      matchesPlayed: results.length,
      averageScorePerMatch: totalPoints / results.length,
      averagePlacement,
      recentResults: normalizedResults,
    });
  }

  return history;
}

export async function getSchoolRosterForSeason(
  schoolName: string,
  seasonId: number,
  eventId?: number | null,
  matchId?: number | null,
): Promise<
  {
    school: string;
    totalPoints: number;
    averagePlacement: number;
    totalEliminations: number;
    matchesPlayed: number;
    teams: {
      id: number;
      teamName: string;
      totalPoints: number;
      averagePlacement: number;
      totalEliminations: number;
      matchesPlayed: number;
      members: {
        playerId: number;
        playerName: string;
        matchesPlayed: number;
        points: number;
        averagePlacement: number;
        totalEliminations: number;
      }[];
    }[];
  }
> {
  const { data: allTeams, error: teamError } = await supabase
    .from("teams")
    .select("id, school, team_name")
    .eq("season_id", seasonId);

  if (teamError) {
    throw teamError;
  }

  const normalizedSchoolName = normalizeLookupValue(schoolName);
  const teams = (allTeams ?? []).filter((team) =>
    matchNormalizedName(team.school, schoolName) || normalizeLookupValue(team.school) === normalizedSchoolName,
  );

  if (!teams || teams.length === 0) {
    throw new Error(`School not found: ${schoolName}`);
  }

  const teamIds = teams.map((team) => team.id);

  const { data: registrations, error: registrationError } = await supabase
    .from("player_registrations")
    .select(`
      player_id,
      team_id,
      players:players (player_name)
    `)
    .eq("season_id", seasonId)
    .in("team_id", teamIds);

  if (registrationError) {
    throw registrationError;
  }

  const playerMetrics = await getSeasonResultMetrics(seasonId, eventId, matchId);
  const teamsWithMembers = teams.map((team) => ({
    id: team.id,
    teamName: team.team_name,
    totalPoints: 0,
    totalEliminations: 0,
    matchesPlayed: 0,
    placementTotal: 0,
    placementCount: 0,
    members: [] as {
      playerId: number;
      playerName: string;
      matchesPlayed: number;
      points: number;
      averagePlacement: number;
      totalEliminations: number;
    }[],
  }));

  const teamLookup = new Map<number, (typeof teamsWithMembers)[number]>();
  for (const team of teamsWithMembers) {
    teamLookup.set(team.id, team);
  }

  for (const registration of registrations ?? []) {
    const teamInfo = teamLookup.get(registration.team_id);
    if (!teamInfo) {
      continue;
    }

    const player = Array.isArray(registration.players)
      ? registration.players[0]
      : registration.players;
    const playerName = player?.player_name ?? "Unknown";
    const metrics = playerMetrics.get(registration.player_id) ?? {
      totalPoints: 0,
      totalEliminations: 0,
      placementTotal: 0,
      placementCount: 0,
    };

    const memberData = {
      playerId: registration.player_id,
      playerName,
      matchesPlayed: metrics.placementCount,
      points: metrics.totalPoints,
      averagePlacement: metrics.placementCount > 0 ? metrics.placementTotal / metrics.placementCount : 0,
      totalEliminations: metrics.totalEliminations,
    };

    teamInfo.members.push(memberData);
    teamInfo.totalPoints += metrics.totalPoints;
    teamInfo.totalEliminations += metrics.totalEliminations;
    teamInfo.matchesPlayed += metrics.placementCount;
    teamInfo.placementTotal += metrics.placementTotal;
    teamInfo.placementCount += metrics.placementCount;
  }

  const orderedTeams = teamsWithMembers.map((team) => ({
    id: team.id,
    teamName: team.teamName,
    totalPoints: team.totalPoints,
    averagePlacement: team.placementCount > 0 ? team.placementTotal / team.placementCount : 0,
    totalEliminations: team.totalEliminations,
    matchesPlayed: team.matchesPlayed,
    members: team.members.sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points;
      }
      if (right.totalEliminations !== left.totalEliminations) {
        return right.totalEliminations - left.totalEliminations;
      }
      return left.playerName.localeCompare(right.playerName);
    }),
  })).sort((left, right) => {
    if (right.totalPoints !== left.totalPoints) {
      return right.totalPoints - left.totalPoints;
    }
    if (right.totalEliminations !== left.totalEliminations) {
      return right.totalEliminations - left.totalEliminations;
    }
    return left.teamName.localeCompare(right.teamName);
  });

  const totalPoints = orderedTeams.reduce((sum, team) => sum + team.totalPoints, 0);
  const totalEliminations = orderedTeams.reduce((sum, team) => sum + team.totalEliminations, 0);
  const matchesPlayed = orderedTeams.reduce((sum, team) => sum + team.matchesPlayed, 0);
  const placementTotal = orderedTeams.reduce(
    (sum, team) => sum + (team.averagePlacement * team.matchesPlayed),
    0,
  );

  return {
    school: schoolName,
    totalPoints,
    averagePlacement: matchesPlayed > 0 ? placementTotal / matchesPlayed : 0,
    totalEliminations,
    matchesPlayed,
    teams: orderedTeams,
  };
}

export async function getSchoolStandingsForSeason(
  seasonId: number,
  eventId?: number | null,
  matchId?: number | null,
): Promise<
  {
    school: string;
    totalPoints: number;
    averagePlacement: number;
    totalEliminations: number;
    playerCount: number;
    teams: { teamId: number; teamName: string; points: number }[];
    rank: number;
  }[]
> {
  const { data: teams, error: teamError } = await supabase
    .from("teams")
    .select("id, school, team_name")
    .eq("season_id", seasonId);

  if (teamError) {
    throw teamError;
  }

  const { data: registrations, error: registrationError } = await supabase
    .from("player_registrations")
    .select("player_id, team_id")
    .eq("season_id", seasonId);

  if (registrationError) {
    throw registrationError;
  }

  const playerMetrics = await getSeasonResultMetrics(seasonId, eventId, matchId);

  const teamPoints = new Map<number, number>();
  const teamElims = new Map<number, number>();
  const teamPlacementTotal = new Map<number, number>();
  const teamPlacementCount = new Map<number, number>();

  for (const registration of registrations ?? []) {
    if (!registration.team_id) {
      continue;
    }

    const metrics = playerMetrics.get(registration.player_id) ?? {
      totalPoints: 0,
      totalEliminations: 0,
      placementTotal: 0,
      placementCount: 0,
    };

    const teamId = registration.team_id;
    teamPoints.set(teamId, (teamPoints.get(teamId) ?? 0) + metrics.totalPoints);
    teamElims.set(teamId, (teamElims.get(teamId) ?? 0) + metrics.totalEliminations);
    teamPlacementTotal.set(teamId, (teamPlacementTotal.get(teamId) ?? 0) + metrics.placementTotal);
    teamPlacementCount.set(teamId, (teamPlacementCount.get(teamId) ?? 0) + metrics.placementCount);
  }

  const schoolMap = new Map<
    string,
    {
      totalPoints: number;
      totalEliminations: number;
      placementTotal: number;
      placementCount: number;
      playerCount: number;
      teams: { teamId: number; teamName: string; points: number }[];
    }
  >();

  const schoolPlayerCounts = new Map<string, number>();
  for (const registration of registrations ?? []) {
    if (!registration.team_id) {
      continue;
    }

    const teamInfo = teams?.find((candidate) => candidate.id === registration.team_id);
    if (!teamInfo) {
      continue;
    }

    schoolPlayerCounts.set(
      teamInfo.school,
      (schoolPlayerCounts.get(teamInfo.school) ?? 0) + 1,
    );
  }

  for (const team of teams ?? []) {
    const teamScore = teamPoints.get(team.id) ?? 0;
    const school = schoolMap.get(team.school);

    if (school) {
      school.totalPoints += teamScore;
      school.totalEliminations += teamElims.get(team.id) ?? 0;
      school.placementTotal += teamPlacementTotal.get(team.id) ?? 0;
      school.placementCount += teamPlacementCount.get(team.id) ?? 0;
      school.playerCount = schoolPlayerCounts.get(team.school) ?? school.playerCount;
      school.teams.push({
        teamId: team.id,
        teamName: team.team_name,
        points: teamScore,
      });
    } else {
      schoolMap.set(team.school, {
        totalPoints: teamScore,
        totalEliminations: teamElims.get(team.id) ?? 0,
        placementTotal: teamPlacementTotal.get(team.id) ?? 0,
        placementCount: teamPlacementCount.get(team.id) ?? 0,
        playerCount: schoolPlayerCounts.get(team.school) ?? 0,
        teams: [{ teamId: team.id, teamName: team.team_name, points: teamScore }],
      });
    }
  }

  const standings = Array.from(schoolMap.entries())
    .map(([school, data]) => ({
      school,
      totalPoints: data.totalPoints,
      averagePlacement:
        data.placementCount > 0 ? data.placementTotal / data.placementCount : Number.POSITIVE_INFINITY,
      totalEliminations: data.totalEliminations,
      playerCount: data.playerCount,
      teams: data.teams.sort((a, b) => b.points - a.points),
      rank: 1,
    }))
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }

      if (a.averagePlacement !== b.averagePlacement) {
        return a.averagePlacement - b.averagePlacement;
      }

      return b.totalEliminations - a.totalEliminations;
    });

  for (let index = 0; index < standings.length; index += 1) {
    const current = standings[index];
    const previous = standings[index - 1];

    if (
      index > 0 &&
      previous &&
      previous.totalPoints === current.totalPoints &&
      previous.averagePlacement === current.averagePlacement &&
      previous.totalEliminations === current.totalEliminations
    ) {
      current.rank = previous.rank;
      continue;
    }

    current.rank = index + 1;
  }

  return standings;
}
