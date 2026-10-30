# RLS Plan

## Scope and current-state findings

This repository uses a single Supabase client created from the public anon key in `lib/supabase.ts`:

- `createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)`

There is no app-level auth guard, no server-side role check, and no page-level redirect logic protecting admin routes. In practice, every page that uses `supabase.from(...)` is currently operating with anonymous access unless a future auth layer or database RLS policy is added.

This document is therefore a recommended RLS/access plan based on current repository usage, not a change to application code or database structure.

## Pre-UX hardening note

This plan is still valuable, but there is a higher-priority technical debt layer before broad UX work: the app needs stable auth boundaries, clearer data ownership, and consistent query contracts for admin and public pages. The RLS strategy should be implemented alongside service-layer cleanup so the UI does not become the only place enforcing access and data safety.

## 1) All Supabase queries grouped by table

### `seasons`

Read operations
- `app/admin/test/page.tsx`: select all seasons for debugging.
- `lib/playerImport.ts`: read the active season (`eq("active", true).single()`).
- `lib/seasons.ts`: `getSeasons()` selects all seasons ordered by name.
- `lib/seasons.ts`: `resolveSeasonSelection()` reads all seasons and picks the active season or explicit query param value.
- `lib/seasons.ts`: `getSeasonDetail()` reads a single season by id.
- `lib/standings.ts`: `resolveSeasonSelection()` and season-based standings queries read season metadata.
- `app/admin/seasons/page.tsx`: loads all seasons for the admin management list.
- `app/admin/events/page.tsx`: loads season options for event creation/editing.
- `app/admin/upload-players/page.tsx`: reads the active season before importing roster data.

Write operations
- `lib/seasons.ts`: `createSeason()` inserts a new season.
- `lib/seasons.ts`: `updateSeason()` updates season fields.
- `lib/seasons.ts`: `setSeasonActiveState()` updates `active` status and deactivates other seasons when activating a season.
- `lib/seasons.ts`: `deleteSeasonIfAllowed()` deletes a season after dependency checks pass.
- `app/admin/seasons/actions.ts`: server action wrappers for create, update, activate, deactivate, delete.

### `events`

Read operations
- `app/admin/events/page.tsx`: reads all events plus nested matches for the event list.
- `app/admin/upload-results/page.tsx`: reads all events ordered by date for CSV import selection.
- `lib/seasons.ts`: dependency checks count events for a season.
- `lib/standings.ts`: `getSeasonResultMetrics()` reads event ids for a season before loading matches/results.
- `lib/standings.ts`: `getPlayerSeasonHistory()` reads event ids and event names.

Write operations
- `app/admin/events/page.tsx`: create new event, update event, delete event.
- `lib/seasons.ts`: deletion dependency checks do not write, but season deletion is blocked when events exist.

### `matches`

Read operations
- `app/admin/matches/page.tsx`: reads matches by selected event id.
- `app/admin/upload-results/page.tsx`: reads all matches for the selected event and optionally creates a new match.
- `lib/admin-dependency-guards.ts`: reads matches for an event when checking event dependency safety.
- `lib/seasons.ts`: counts match records associated with an event/season.
- `lib/standings.ts`: `getSeasonResultMetrics()` reads match ids for events in a season.
- `lib/standings.ts`: `getPlayerSeasonHistory()` reads matches and their event ids within a season.

Write operations
- `app/admin/matches/page.tsx`: create match, update match.
- `app/admin/upload-results/page.tsx`: creates a match automatically when an import is assigned to a new match.
- `lib/seasons.ts`: delete guard logic only reads; no direct match delete write exists in this code path.

### `players`

Read operations
- `app/admin/aliases/page.tsx`: list players for alias management.
- `app/admin/unmatched-results/page.tsx`: list players for fuzzy matching and suggestion UI.
- `app/admin/upload-results/page.tsx`: look up players to match CSV names to result entries.
- `lib/standings.ts`: `getPlayerProfile()` selects a single player by id.
- `lib/standings.ts`: `getPlayerStandingsForSeason()` reads players included in season registrations.
- `lib/standings.ts`: `getPlayerPerformanceMetrics()` does not select from players directly; it reads results keyed by player id.
- `app/admin/upload-players/page.tsx`: finds existing players by exact `player_name` before inserting new records.

Write operations
- `app/admin/upload-players/page.tsx`: creates a player row when a roster entry does not already exist.
- `app/admin/unmatched-results/page.tsx`: on resolution, it does not write to players directly; it writes to `results`, `player_aliases`, and `unmatched_results`.

### `player_aliases`

Read operations
- `app/admin/aliases/page.tsx`: reads all aliases.
- `app/admin/unmatched-results/page.tsx`: reads aliases to estimate alias counts and build player suggestions.
- `app/admin/upload-results/page.tsx`: resolves username lookups via alias matching.
- `lib/standings.ts`: `getPlayerProfile()` reads alias names for a player.

Write operations
- `app/admin/aliases/page.tsx`: insert new alias and delete alias.
- `app/admin/unmatched-results/page.tsx`: when resolving unmatched results, inserts a new alias entry and marks the unmatched record resolved.
- `app/admin/upload-results/page.tsx`: alias lookup is read-only; no alias insert occurs here.

### `teams`

Read operations
- `lib/standings.ts`: reads teams for a season while generating player/team/school standings.
- `lib/standings.ts`: reads team metadata to map `team_id` to school and team name.
- `app/admin/upload-players/page.tsx`: checks whether a team already exists for the active season before creating one.

Write operations
- `app/admin/upload-players/page.tsx`: inserts a new team row when a season/school/team combination does not already exist.

### `player_registrations`

Read operations
- `lib/standings.ts`: `getPlayerProfile()` reads the most recent registration by player id to find team and season context.
- `lib/standings.ts`: `getPlayerStandingsForSeason()` reads registrations for a season.
- `lib/standings.ts`: `getSchoolStandingsForSeason()` reads registrations for a season.
- `lib/standings.ts`: `getTeamStandingsForSeason()` reads registrations for a season.
- `app/admin/upload-players/page.tsx`: checks if a player is already registered for the active season and avoids duplicate inserts.

Write operations
- `app/admin/upload-players/page.tsx`: upserts a player registration for a player + season.

### `results`

Read operations
- `lib/standings.ts`: `getPlayerPerformanceMetrics()` reads all result rows for a specific player.
- `lib/standings.ts`: `getSeasonResultMetrics()` reads all result rows for a season by aggregating across event and match ids.
- `lib/standings.ts`: `getPlayerSeasonHistory()` reads result rows plus related match and event metadata for a player within a season.
- `app/admin/unmatched-results/page.tsx`: reads all unmatched results flagged as unresolved.

Write operations
- `app/admin/upload-results/page.tsx`: imports match results and upserts rows with `onConflict: "match_id,player_id"`.
- `app/admin/unmatched-results/page.tsx`: resolves an unmatched row by upserting the corresponding result and then marking the unmatched row resolved.
- `lib/seasons.ts`: dependency checks count result rows for a season before allowing deletion.

### `unmatched_results`

Read operations
- `app/admin/unmatched-results/page.tsx`: reads unresolved rows ordered by id.

Write operations
- `app/admin/upload-results/page.tsx`: inserts unmatched rows when a username does not match any player or alias.
- `app/admin/unmatched-results/page.tsx`: updates a row to `resolved = true` and associates a selected player.

### `placement_scoring`

Read operations
- `app/admin/upload-results/page.tsx`: reads the whole scoring table to determine placement points for a given placement.

Write operations
- None in the current repository.

### `test_connection`

Read operations
- `app/page.tsx`: reads the table as a basic health-check / connectivity test.

Write operations
- None in the current repository.

## 2) Read operations

These are the repository’s read-heavy operations by category:

Public / read-friendly pages
- `app/page.tsx` reads `test_connection` to verify connectivity.
- `app/standings/page.tsx` is static navigation only and does not read from Supabase.
- `app/standings/players/page.tsx`: reads seasons and player standings by season.
- `app/standings/teams/page.tsx`: reads seasons and team standings by season.
- `app/standings/schools/page.tsx`: reads seasons and school standings by season.
- `app/players/[id]/page.tsx`: reads player profile, performance metrics, and season history.

Shared service reads
- `lib/standings.ts` is the bulk of the read-access layer for standings, player profiles, season history, team data, and school summaries.
- `lib/seasons.ts` handles season metadata, validation, and dependency summaries used by admin workflows.

Admin read pages
- `app/admin/seasons/page.tsx`: reads all seasons and dependency counts.
- `app/admin/seasons/[id]/page.tsx`: reads one season and event summaries.
- `app/admin/events/page.tsx`: reads season and event data.
- `app/admin/matches/page.tsx`: reads events and matches.
- `app/admin/aliases/page.tsx`: reads players and aliases.
- `app/admin/unmatched-results/page.tsx`: reads unmatched results and player suggestions.
- `app/admin/upload-results/page.tsx`: reads events, matches, scoring rules, and player/alias lookup data.
- `app/admin/upload-players/page.tsx`: reads active season and existing player/team registrations for import decisions.

## 3) Write operations

These are the mutation paths in the current repository:

- `app/admin/seasons/page.tsx` + `app/admin/seasons/actions.ts`
  - create season
  - update season
  - activate/deactivate season
  - delete season

- `app/admin/events/page.tsx`
  - create event
  - update event
  - delete event

- `app/admin/matches/page.tsx`
  - create match
  - update match

- `app/admin/aliases/page.tsx`
  - create alias
  - delete alias

- `app/admin/upload-players/page.tsx`
  - create player if missing
  - create team if missing
  - upsert player registration

- `app/admin/upload-results/page.tsx`
  - create auto-generated match when needed
  - upsert result rows
  - insert unmatched_result rows for unresolved players

- `app/admin/unmatched-results/page.tsx`
  - upsert resolved result
  - insert alias for a matched player
  - update unmatched_result row to resolved

- `lib/seasons.ts`
  - all season writes are centralized there, including activation logic and the single-active-season rule

## 4) Pages requiring anonymous access

Based on the current application structure and code, the pages that are designed to be public are:

- `/` — homepage health-check page (`app/page.tsx`)
- `/standings` — standings landing page (`app/standings/page.tsx`)
- `/standings/players` — player standings (`app/standings/players/page.tsx`)
- `/standings/teams` — team standings (`app/standings/teams/page.tsx`)
- `/standings/schools` — school standings (`app/standings/schools/page.tsx`)
- `/players/[id]` — player profile/detail page (`app/players/[id]/page.tsx`)

These pages are expected to be readable without sign-in and are intended to show standings and league information to the public.

Important note: Because the app currently creates a Supabase client using the anon key, these pages are accessible as anonymous reads today. The code does not include a public/private split beyond route design.

## 5) Pages that should be admin-only

The following pages should be restricted to authenticated administrators and/or a role-checking policy:

- `/admin` — admin dashboard (`app/admin/page.tsx`)
- `/admin/seasons` — season admin (`app/admin/seasons/page.tsx`)
- `/admin/seasons/[id]` — season details (`app/admin/seasons/[id]/page.tsx`)
- `/admin/events` — event management (`app/admin/events/page.tsx`)
- `/admin/matches` — match management (`app/admin/matches/page.tsx`)
- `/admin/aliases` — alias management (`app/admin/aliases/page.tsx`)
- `/admin/upload-players` — roster import (`app/admin/upload-players/page.tsx`)
- `/admin/upload-results` — CSV result import (`app/admin/upload-results/page.tsx`)
- `/admin/unmatched-results` — result resolution (`app/admin/unmatched-results/page.tsx`)
- `/admin/test` — debug/testing page (`app/admin/test/page.tsx`)

These routes are the data mutation and administrative management surfaces for seasons, events, players, aliases, and results. They should not be accessible to anonymous users.

## Recommended RLS policy direction

1. Public read rules
   - `seasons`, `events`, `matches`, `players`, `teams`, `player_aliases`, `player_registrations`, `results`, and related standings views should allow read access to anonymous users if the app is intentionally public.
   - This matches the current standings/public-profile design.

2. Admin-write rules
   - All insert/update/delete operations on admin-controlled tables should require an authenticated admin session.
   - The recommended role check is a dedicated `admin` or `is_admin` boolean in auth metadata or a user role table.

3. Write restrictions by table
   - `seasons`: admin-only insert/update/delete.
   - `events`: admin-only insert/update/delete.
   - `matches`: admin-only insert/update/delete.
   - `players`: admin-only insert/update; user-facing reads can remain public.
   - `player_aliases`: admin-only insert/delete.
   - `teams`: admin-only insert/update/delete.
   - `player_registrations`: admin-only insert/update/delete.
   - `results`: admin-only insert/update/delete; public reads only if the league data is intentionally public.
   - `unmatched_results`: admin-only read/write access.
   - `placement_scoring`: admin-only read/write if editable, otherwise read-only admin-managed config.
   - `test_connection`: internal-only / remove from production usage.

4. Rule-of-thumb for this repo
   - If a page is public-facing and read-only, allow read access via RLS.
   - If a page performs admin mutation or imports data, require `auth.role() = 'authenticated'` plus `is_admin = true`.

5. Key risk in the current app
   - Because the repository uses the anon client everywhere, the current admin pages are effectively exposed. This should be considered a security gap until RLS and auth protections are added.

## Final assessment

The current codebase is structured as a public standings app with a separate internal admin layer. The repository is not yet split cleanly by auth tier, but the intended split is clear:

- Public content: standings, player profile pages, league info
- Admin-only content: import, cleanup, season management, and result mutation pages

The repo is therefore a good candidate for a two-layer policy:

- read access for public pages
- admin-only write access for all mutation workflows

No code or database structure was changed as part of this plan.
