# Database Schema

This project uses Supabase as the source of truth for league data. The live schema currently reflects the operational application needs for events, match results, season management, player registrations, and public standings.

## Core tables

### seasons

Represents a league season and defines the active date window for standings and event activity.

Common fields:

- id
- name
- start_date
- end_date
- active
- created_at
- updated_at

Notes:

- `current_season` is treated as a view in the live database rather than a stored table.
- The app resolves the current season by date range and falls back to the closest season when needed.
- Season selection and validation are centralized in the shared standings helpers and admin helper layer.

### events

Represents an event or competition day within a season.

Common fields:

- id
- season_id
- event_name
- event_date
- created_at
- updated_at

Relationships:

- belongs to `seasons`
- has many `matches`

### matches

Represents an individual match within an event.

Common fields:

- id
- event_id
- match_name
- created_at
- updated_at

Relationships:

- belongs to `events`
- has many `results`
- may have related `unmatched_results` rows if an imported result cannot yet be assigned

### results

Stores the validated player result for a match.

Common fields:

- id
- match_id
- player_id
- placement
- eliminations
- points
- created_at
- updated_at

Relationships:

- belongs to `matches`
- belongs to `players`
- must be considered when deleting a match
- forms the canonical basis for standings calculations

### players

Represents a player in the system.

Common fields:

- id
- player_name
- school
- team_id
- created_at
- updated_at

Notes:

- The current schema does not define a separate `schools` table as the canonical source of school records.
- School data is represented in the app through team and registration data.
- The app continues to keep the legacy `players.school` and `players.team` fields in place for compatibility, even though the normalized source of truth is `teams` and `player_registrations`.

### teams

Represents a competitive team.

Common fields:

- id
- season_id
- school
- team_name
- created_at
- updated_at

Relationships:

- belongs to a season
- may be associated with player registrations per season
- is the canonical source of team/school membership when calculating standings

### player_registrations

Represents a player registering for a team within a given season.

Common fields:

- id
- player_id
- season_id
- team_id
- school
- created_at
- updated_at

Notes:

- This is the main relationship table that ties a player to a team for a season.
- A player may appear in multiple seasons with different registrations.
- Registration rows are the operational source of truth for season team assignments.

### player_aliases

Stores alternate or historical names that should resolve to the same player.

Common fields:

- id
- player_id
- alias_name
- created_at
- updated_at

Notes:

- Alias entries are important during CSV imports and unmatched-result resolution.
- The app uses alias matching to suggest the correct player when a result name is ambiguous.
- Matching is conservative and alias-first rather than broad fuzzy matching by default.

### unmatched_results

Stores imported result rows that do not yet map to a known player.

Common fields:

- id
- match_id
- username
- placement
- eliminations
- points
- resolved
- player_id
- created_at
- updated_at

Notes:

- These rows are created during import flow and then resolved by admin actions.
- They must be cleared or resolved during match deletion processes when appropriate.
- The app supports both manual resolution and automatic alias-based resolution during upload.

### user_profiles

Stores user identity and role metadata for admin access.

Common fields:

- id
- email
- is_admin
- created_at
- updated_at

Notes:

- The project uses Supabase Auth as the login mechanism.
- The app authorizes admin access by matching the authenticated user ID to a profile row with `is_admin = true`.

### scoring_rules

Stores the rule configuration used for point calculations.

Common fields:

- id
- elimination_points
- placement_points
- season_id
- created_at
- updated_at

Notes:

- The app treats this table as the canonical source for scoring configuration.
- Standings calculations should read rule values from this source instead of hardcoded values.

## Schema realities and assumptions

- There is no `schools` table in the current live schema; school information is represented in team and registration data.
- `current_season` is a view, not a table.
- Season selection logic is date-based but centralized through shared helper functions.
- Match deletion must account for both `results` and `unmatched_results` before removing the parent row.
- Team and school membership are intentionally season-scoped.
- The app is intentionally conservative about removing redundant legacy columns until a migration plan is approved.

## Operational guidance

Whenever schema changes are made:

1. Update this document.
2. Add or update migration SQL.
3. Verify the affected admin and standings queries.
4. Confirm the scoring logic and season selection logic still match the data model.
5. Review any delete or cascade assumptions before making destructive changes.

## Delete and cleanup assumptions

The current application and schema assume that destructive admin actions are explicit and protected by validation rather than relying on automatic database cascade behavior.

### Event deletion assumptions

When deleting an event, the app should treat the event as the parent record and check for dependent data before removing it. In practice the project assumes the following:

- event records may have many related `matches`
- each `match` may have many `results`
- imported `unmatched_results` can belong to a match or be associated with the broader event context during imports
- event deletion must be blocked or explicitly validated when dependent rows still exist

This is why the admin flow uses dependency summaries before delete and reports a clear message when the event still has related records.

### Match deletion assumptions

When deleting a match, the system should handle the full parent-child cleanup chain. The current project assumptions are:

- `results` rows must be removed before or as part of match deletion
- `unmatched_results` linked to the match should be removed or re-assigned
- any row tied to the match via child foreign keys should be checked before delete
- destructive action should be transactional if the database supports it, and the user should be informed that removing the match also removes its result history

The effective operational rule is: a match deletion is not just a single-row delete; it is a cleanup of all result data associated with that match.

### Result and unmatched-result cleanup policy

The project follows a defensive cleanup model:

- no implicit row deletion without validation
- no destructive action without an admin confirmation step
- no delete that silently removes result history without user awareness
- any table-level dependency that is not enforced automatically should be handled in app logic or migration plans

## Current documentation status

This schema document reflects the implemented system as of the current release, including the normalized team/registration model, season-scoped admin filtering, and route/data hardening work that has already shipped.

## Pre-UX technical debt and sequencing

The schema is serviceable for current league operations, but the existing shape still has a few high-value cleanup items before broader UX work should continue:

1. Keep the scoring source of truth in a central rules table and avoid drifting logic between imports, admin pages, and standings computations.
2. Preserve a canonical season/event/match filter contract across all admin and public pages so no page re-implements its own default scope.
3. Continue standardizing relationship rules for aliases, registrations, and unresolved rows to avoid duplicate or orphaned records.
4. Make destructive actions explicit and auditable. Match and event deletion should be paired with result and unmatched-result cleanup logic and clearly documented admin confirmation.
5. Add migration and validation documentation for every future schema edit so UX changes do not hide data-model drift.

These changes are more important than visual refinements because they protect correctness and keep the app maintainable as the feature set grows.

This should remain the default operational policy until a formal cascade or archival strategy is added.
