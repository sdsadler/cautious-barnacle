# Standings Architecture

## Purpose

This document maps every place in the codebase where standings are calculated or materially influenced, documents the current calculation logic, identifies duplication, and recommends a shared architecture that matches the project’s design principles and roadmap.

It is based on the repository's project documentation and current implementation patterns, particularly:

- [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)
- [STANDINGS_RULES.md](STANDINGS_RULES.md)
- [TODO.md](TODO.md)
- [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md)
- [API_PATTERNS.md](API_PATTERNS.md)
- [SQL_CONVENTIONS.md](SQL_CONVENTIONS.md)
- [ai/lead-dev.md](../ai/lead-dev.md)

## Canonical standings definition

The project’s stated rule set is intentionally simple and centralized in [STANDINGS_RULES.md](STANDINGS_RULES.md):

- Player score = SUM(all result scores)
- Team score = SUM(all player scores on team)
- School score = SUM(all team scores at school)
- Rankings are sorted by descending score
- Standings calculations should be centralized and not duplicated across pages

The actual implementation follows that rule in spirit, but it does so in multiple page-specific implementations rather than a shared service or query layer.

## Standings-related pages and their role

### 1. Player standings page

File:
- [app/standings/page.tsx](../app/standings/page.tsx)

Role:
- Displays the current player leaderboard for the active season.

Current calculation flow:

1. Read the active season from `seasons` where `active = true`.
2. Fetch `player_registrations` for the active season, selecting:
   - `player_id`
   - `team_id`
   - nested `players.player_name`
3. Fetch `teams` for the active season.
4. Fetch all `results` and aggregate them by `player_id` into a `Map<number, number>` named `pointsMap`.
5. Build a `teamLookup` map keyed by team ID to capture school and team name.
6. Map each registration to a final row with:
   - player name
   - school
   - team
   - points from `pointsMap` or `0`
7. Sort the resulting standings by `points` descending.
8. Render the table using the index as the displayed rank.

Important characteristics:

- This is the primary player standings calculation.
- It does not account for current tie-aware ranking rules.
- Ranking is simply `index + 1` after sorting.
- The logic is page-local and not reusable elsewhere.

### 2. Team standings page

File:
- [app/standings/teams/page.tsx](../app/standings/teams/page.tsx)

Role:
- Displays school/team leaderboard derived from player totals.

Current calculation flow:

1. Read the active season from `seasons` where `active = true`.
2. Fetch all `teams` for the active season.
3. Fetch all `player_registrations` for the active season.
4. Fetch all `results` and aggregate totals by `player_id` into `playerPoints`.
5. Iterate registrations and sum each player's total into a `teamPoints` map keyed by `team_id`.
6. Build standings rows from the `teams` table and map each team to its aggregated score.
7. Sort standings by descending total points.
8. Render table rows with rank as `index + 1`.

Important characteristics:

- This computes team score as the sum of all player totals in that team.
- The logic mirrors the player rankings approach but differs in implementation details.
- It repeats the same task of reading results and aggregating player totals, but in a different function body.

### 3. School standings page

File:
- [app/standings/schools/page.tsx](../app/standings/schools/page.tsx)

Role:
- Aggregates team totals into school totals and displays leaderboard by school.

Current calculation flow:

1. Read the active season from `seasons` where `active = true`.
2. Fetch all `teams` for the active season.
3. Fetch `player_registrations` for the active season.
4. Fetch all `results` and aggregate into `playerPoints`.
5. Aggregate registration data into `teamPoints` map keyed by team.
6. Build a `schoolMap` keyed by school name with:
   - `totalPoints`
   - `teams[]` metadata with team name and points
7. For each team, add its team score to the school’s total.
8. Convert `schoolMap.entries()` into standings rows.
9. Sort by `totalPoints` descending.
10. Render grouped school blocks listing teams and points.

Important characteristics:

- This is the school-level aggregation of the team scoring model.
- It duplicates the earlier aggregation logic for player totals and team totals.
- School score is effectively the sum of the team totals for that school.
- The ranking is again based on a simple sorted order with `index + 1` as rank.

### 4. Result scoring input that feeds standings

File:
- [app/admin/upload-results/page.tsx](../app/admin/upload-results/page.tsx)

Role:
- Determines the numeric `points` stored per result row, which then drives standings calculations.

Current calculation flow:

1. `calculatePlacementPoints(placement)` reads rows from `placement_scoring`.
2. It finds the matching range rule where:
   - `placement >= min_place`
   - `placement <= max_place`
3. Returns `rule.points` or `0`.
4. In the import loop, `totalPoints = placementPoints + eliminations`.
5. That value is written to `results.points`.

Important characteristics:

- This is not a standings page, but it is the upstream scoring source for all standings.
- It is also page-local logic and should conceptually belong to a central scoring domain or service.
- The project’s docs treat standings rules as a single-source-of-truth concept, but this score-generation step is another place where business logic is embedded in UI code.

## Standings-related data sources

The standings calculation logic depends on these main tables:

- `seasons`
- `teams`
- `players`
- `player_registrations`
- `results`
- `placement_scoring`

It additionally relies on derived join data and operational lookup tables such as:

- `player_aliases`
- `unmatched_results`

## Data flow by standings level

### Player standings data flow

`results` -> aggregated by `player_id` -> player standings rows -> displayed on [app/standings/page.tsx](../app/standings/page.tsx)

### Team standings data flow

`results` -> aggregated by `player_id` -> summed by `team_id` -> team standings rows -> displayed on [app/standings/teams/page.tsx](../app/standings/teams/page.tsx)

### School standings data flow

`results` -> aggregated by `player_id` -> summed by `team_id` -> summed by school -> school standings rows -> displayed on [app/standings/schools/page.tsx](../app/standings/schools/page.tsx)

This is the project’s current level-by-level aggregation model and is a good conceptual representation of the business rules, even though it is implemented separately in different pages.

## Areas of duplication

The code currently duplicates standings logic in multiple places. The duplication is not cosmetic; it creates real maintainability risk.

### 1. Repeated active season fetch pattern

Each standings page repeats:

- fetch `seasons` with `.eq("active", true)`
- check `if (!activeSeason) return ...`
- query season-scoped data for the same domain boundary

This occurs in:

- [app/standings/page.tsx](../app/standings/page.tsx)
- [app/standings/teams/page.tsx](../app/standings/teams/page.tsx)
- [app/standings/schools/page.tsx](../app/standings/schools/page.tsx)

### 2. Repeated raw result aggregation

Each page independently does a similar aggregation from `results`:

- build a `Map` keyed by `player_id`
- sum `points`
- use `undefined ?? 0` for missing values

This pattern exists in all three standings pages.

### 3. Repeated team-scoring composition

Team and school standings both compute team totals from player totals, but in separate code blocks and with different structures.

### 4. Repeated rank assignment

All ranking outputs use this pattern:

- sort descending by score
- render `index + 1` as the rank

This means tie-aware ranking, if implemented later, will need to be repeated in every page unless centralized.

### 5. Embedding business rules in UI pages

The scoring and standings rules are part of the business model, but they live directly in page code instead of a domain or service layer.

This violates the project’s own guidance in:

- [STANDINGS_RULES.md](STANDINGS_RULES.md)
- [ai/lead-dev.md](../ai/lead-dev.md)
- [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md)

## Current limitations of the architecture

### 1. No shared standings service

There is no module that owns the standings algorithm as a single source of truth.

### 2. No shared scoring service

`placement_scoring` logic is embedded in the upload page and is not reusable by other import or reporting screens.

### 3. No season-aware abstraction

The app only appears to support active season views in the current standings UI. The docs explicitly call for season filtering and historical seasons, but the current pages do not have a reusable abstraction for selecting among active, specific, or historical seasons.

### 4. No tie-aware rank model

The docs call out tie-aware ranking as a priority item, but the current pages do not calculate shared ranking metadata.

### 5. No domain-layer schema contract

The code assumes multiple table shapes and join structures without a centralized typed contract for standings results.

## Recommended shared service architecture

The recommended architecture is a small, layered service model that matches the repository standards and future roadmap.

### Target layer layout

- UI pages: render and interact with users
- standings service: business logic for all standings aggregations
- scoring service: placement and result-point calculation
- repository/query layer: Supabase access for seasons, teams, registrations, results, and score tables
- shared types: `Season`, `PlayerStanding`, `TeamStanding`, `SchoolStanding`, `RankRecord`

### Recommended service responsibilities

#### 1. `standingsService`

Responsibilities:

- `getActiveSeason()`
- `getPlayerStandings(seasonId)`
- `getTeamStandings(seasonId)`
- `getSchoolStandings(seasonId)`
- `getStandingsForSeason(seasonId, scope)`
- `applyTieAwareRanking(rows)`
- `filterBySeasonCriteria(...)`

Output models should be stable, typed, and page-independent, for example:

- `PlayerStanding`: `{ rank, playerId, playerName, school, team, points }`
- `TeamStanding`: `{ rank, teamId, school, teamName, points }`
- `SchoolStanding`: `{ rank, school, totalPoints, teams: [...]} `

#### 2. `scoringService`

Responsibilities:

- determine points from placement using `placement_scoring`
- apply elimination bonuses or other future scoring modifiers
- produce a single `resultPoints` value consistently for all imports

This service should replace the per-page `calculatePlacementPoints` function currently embedded in the result import screen.

#### 3. `leagueRepository` or `supabaseRepository`

Responsibilities:

- fetch active season
- fetch season registrations
- fetch teams by season
- fetch players and aliases
- fetch results by season or match range
- centralize joins and query shapes

This reduces repeated direct table access and makes schema changes more controlled.

## Recommended calculation flow for the shared service

### Unified player totals

The key shared calculation should be:

- get all results for a selected season or scope
- aggregate result points by `player_id`
- merge this with registrations to attach school and team metadata
- sort by descending score
- assign ranks with tie-aware logic

### Unified team totals

The shared team computation should be:

- take player totals for current scope
- sum by `team_id`
- enrich with school and team names
- sort

### Unified school totals

The shared school calculation should be:

- take team totals
- aggregate by school name or school ID
- sort
- include a nested list of teams

## Recommended ranking model

The project currently uses plain descending sort plus `index + 1` in the render layer. A shared architecture should support:

- standard dense ranking
- competition ranking
- standard competition ranking with ties
- future season and historical filters

The ranking function should be defined once and reused by all pages and reports:

- `assignRanking(rows, mode = 'dense')`
- `sortStandings(rows)`

This is a direct requirement from the project’s roadmap and the tie-aware ranking feature in [TODO.md](TODO.md).

## Recommended implementation principles

1. Keep standings math in one service, not in UI routes.
2. Create typed response models for every standings view.
3. Keep database access in query/repository functions.
4. Make season filtering an explicit parameter rather than hard-coded to `active = true` in every page.
5. Make scoring and standings logic separately testable.
6. Ensure all rankings are derived from the same logic across player, team, and school views.

## Summary

The standings architecture today is functional but fragmented:

- the logic is distributed across three route pages
- the score-generation root is embedded in the result import page
- rankings are not centralized
- season-specific behavior is hard-coded in each page
- the rules are duplicated and not reusable

The repository documents a clear future direction: a single-source-of-truth for standings, centralized calculation, and cleaner architecture. The most important next step is to move all standings and result-scoring logic into a shared service layer and consume it from page components instead of calculating in the UI.

This would align the actual code with the documented standards in [STANDINGS_RULES.md](STANDINGS_RULES.md) and the architectural guidance in [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md) and [ai/lead-dev.md](../ai/lead-dev.md).

## Pre-UX follow-up priorities

The UX work should not outrun the architecture work. The project should complete these items before broad interface polishing:

- centralize player/team/school standings calculations in one service
- standardize all season, event, and match filters around one shared contract
- move scoring and alias resolution logic into domain services instead of route-local logic
- stabilize tie-aware ranking and historical season support in the shared layer
- keep admin flows and public standings aligned to the same canonical rules

This is the technical debt that matters most before a broader UX pass.
