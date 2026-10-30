import { supabase } from "@/lib/supabase";

export type PlayerRegistrationRow = {
  id: number;
  player_id: number;
  season_id: number;
  team_id: number | null;
  school: string | null;
  player_name?: string | null;
};

export type TeamRow = {
  id: number;
  season_id: number;
  school: string;
  team_name: string;
};

export type AliasRow = {
  id: number;
  player_id: number;
  alias_name: string;
};

export type DuplicateRegistrationIssue = {
  player_id: number;
  player_name: string | null;
  season_id: number;
  count: number;
  registration_ids: number[];
};

export type DuplicateTeamIssue = {
  season_id: number;
  school: string;
  team_name: string;
  count: number;
  team_ids: number[];
};

export type InvalidTeamLinkIssue = {
  registration_id: number;
  player_id: number;
  player_name: string | null;
  season_id: number;
  team_id: number | null;
  team_season_id?: number | null;
  school: string | null;
};

export type OrphanAliasIssue = {
  id: number;
  player_id: number;
  alias_name: string;
};

export type UnassignedPlayerIssue = {
  registration_id: number;
  player_id: number;
  player_name: string | null;
  season_id: number;
  team_id: number | null;
  school: string | null;
};

export type DataIntegrityReport = {
  duplicatePlayerRegistrations: DuplicateRegistrationIssue[];
  duplicateTeams: DuplicateTeamIssue[];
  invalidTeamLinks: InvalidTeamLinkIssue[];
  orphanAliases: OrphanAliasIssue[];
  unassignedPlayers: UnassignedPlayerIssue[];
  totalIssues: number;
};

export async function getDataIntegrityReport(): Promise<DataIntegrityReport> {
  const [registrationResponse, teamResponse, aliasResponse, playerResponse] = await Promise.all([
    supabase
      .from("player_registrations")
      .select("id, player_id, season_id, team_id, school, players:players (player_name)")
      .order("player_id", { ascending: true })
      .order("season_id", { ascending: true }),
    supabase
      .from("teams")
      .select("id, season_id, school, team_name")
      .order("season_id", { ascending: true })
      .order("school", { ascending: true })
      .order("team_name", { ascending: true }),
    supabase
      .from("player_aliases")
      .select("id, player_id, alias_name")
      .order("player_id", { ascending: true })
      .order("alias_name", { ascending: true }),
    supabase.from("players").select("id"),
  ]);

  if (registrationResponse.error) {
    throw registrationResponse.error;
  }

  if (teamResponse.error) {
    throw teamResponse.error;
  }

  if (aliasResponse.error) {
    throw aliasResponse.error;
  }

  if (playerResponse.error) {
    throw playerResponse.error;
  }

  const registrations = (registrationResponse.data ?? []) as Array<{
    id: number;
    player_id: number;
    season_id: number;
    team_id: number | null;
    school: string | null;
    players?: { player_name?: string | null } | { player_name?: string | null }[] | null;
  }>;

  const teams = (teamResponse.data ?? []) as TeamRow[];
  const aliases = (aliasResponse.data ?? []) as AliasRow[];
  const validPlayerIds = new Set((playerResponse.data ?? []).map((player) => player.id));
  const teamLookup = new Map<number, TeamRow>();
  for (const team of teams) {
    teamLookup.set(team.id, team);
  }

  const duplicateRegistrationGroups = new Map<string, { player_id: number; season_id: number; registrationIds: number[]; player_name: string | null }>();
  for (const registration of registrations) {
    const key = `${registration.player_id}:${registration.season_id}`;
    const current = duplicateRegistrationGroups.get(key) ?? {
      player_id: registration.player_id,
      season_id: registration.season_id,
      registrationIds: [],
      player_name: null,
    };

    current.registrationIds.push(registration.id);

    if (Array.isArray(registration.players)) {
      current.player_name = registration.players[0]?.player_name ?? current.player_name ?? null;
    } else if (registration.players) {
      current.player_name = registration.players.player_name ?? current.player_name ?? null;
    }

    duplicateRegistrationGroups.set(key, current);
  }

  const duplicatePlayerRegistrations = Array.from(duplicateRegistrationGroups.values())
    .filter((entry) => entry.registrationIds.length > 1)
    .map((entry) => ({
      player_id: entry.player_id,
      player_name: entry.player_name,
      season_id: entry.season_id,
      count: entry.registrationIds.length,
      registration_ids: entry.registrationIds,
    }));

  const duplicateTeamGroups = new Map<string, { season_id: number; school: string; team_name: string; team_ids: number[] }>();
  for (const team of teams) {
    const key = `${team.season_id}:${team.school.toLowerCase()}:${team.team_name.toLowerCase()}`;
    const current = duplicateTeamGroups.get(key) ?? {
      season_id: team.season_id,
      school: team.school,
      team_name: team.team_name,
      team_ids: [],
    };

    current.team_ids.push(team.id);
    duplicateTeamGroups.set(key, current);
  }

  const duplicateTeams = Array.from(duplicateTeamGroups.values())
    .filter((entry) => entry.team_ids.length > 1)
    .map((entry) => ({
      season_id: entry.season_id,
      school: entry.school,
      team_name: entry.team_name,
      count: entry.team_ids.length,
      team_ids: entry.team_ids,
    }));

  const orphanAliases = aliases
    .filter((alias) => !validPlayerIds.has(alias.player_id))
    .map((alias) => ({
      id: alias.id,
      player_id: alias.player_id,
      alias_name: alias.alias_name,
    }));

  const unassignedPlayers = registrations
    .filter((registration) => registration.school === null || registration.school?.trim() === "")
    .map((registration) => ({
      registration_id: registration.id,
      player_id: registration.player_id,
      player_name: Array.isArray(registration.players)
        ? registration.players[0]?.player_name ?? null
        : registration.players?.player_name ?? null,
      season_id: registration.season_id,
      team_id: registration.team_id,
      school: registration.school,
    }));

  const invalidTeamLinks = registrations
    .filter((registration) => registration.team_id !== null)
    .filter((registration) => {
      const team = teamLookup.get(registration.team_id!);
      if (!team) {
        return true;
      }
      return team.season_id !== registration.season_id;
    })
    .map((registration) => ({
      registration_id: registration.id,
      player_id: registration.player_id,
      player_name: Array.isArray(registration.players)
        ? registration.players[0]?.player_name ?? null
        : registration.players?.player_name ?? null,
      season_id: registration.season_id,
      team_id: registration.team_id,
      team_season_id: registration.team_id ? teamLookup.get(registration.team_id)?.season_id ?? null : null,
      school: registration.school,
    }));

  const totalIssues =
    duplicatePlayerRegistrations.length +
    duplicateTeams.length +
    invalidTeamLinks.length +
    orphanAliases.length +
    unassignedPlayers.length;

  return {
    duplicatePlayerRegistrations,
    duplicateTeams,
    invalidTeamLinks,
    orphanAliases,
    unassignedPlayers,
    totalIssues,
  };
}
