# SQL and Database Conventions

## Purpose

This document establishes the SQL and database conventions expected for the esports league application. It is based on the current project documentation and the patterns already visible in the codebase, especially the normalized season/event/match/result hierarchy and the season-scoped player registration model.

The application is designed around PostgreSQL/Supabase, and the architecture goals emphasize normalized data, reuse, and maintainability.

## Naming standards

### Tables

Use singular or domain-style names consistent with the current model:

- `seasons`
- `events`
- `matches`
- `players`
- `teams`
- `schools`
- `results`
- `player_registrations`
- `player_aliases`
- `unmatched_results`
- `placement_scoring`

Standards:

- Prefer lowercase snake_case.
- Use descriptive names that map directly to business concepts.
- Avoid ambiguous names like `data`, `records`, or `table1`.
- Prefer noun-based naming conventions for entities.

### Columns

Use lowercase snake_case and make the column names specific enough to be self-documenting.

Examples:

- `season_id`
- `event_id`
- `match_id`
- `player_id`
- `team_id`
- `school_id` (if later introduced)
- `player_name`
- `team_name`
- `event_name`
- `match_name`
- `event_date`
- `points`
- `placement`
- `eliminations`
- `active`
- `created_at`
- `updated_at`

Standards:

- Use `_id` suffix for foreign keys.
- Prefer domain terms over generic names (`placement` instead of `rank`, `points` instead of `score` when score is a computed value, etc.).
- Keep names stable across tables when representing the same concept.
- Use `*_name` for name fields and `*_date` for date fields.

### Constraints and uniqueness

Use explicit and deliberate uniqueness constraints for the business keys in the app.

Examples already implied by code:

- `player_registrations`: unique on `(player_id, season_id)`
- `player_aliases`: unique alias names per player or globally, depending on the final rule
- `matches` and `events`: natural business name plus event linkage, if required by the admin workflow

Standards:

- Model business uniqueness as database constraints rather than relying on application code alone.
- If a row should only exist once per parent context, enforce it at the database level.
- Avoid duplicate semantic records caused by application-side deduplication alone.

## Foreign key standards

### General rules

Foreign keys should be explicit and consistent across the schema.

- Every relationship should use an integer or UUID primary key reference.
- The child table should always include the parent key as a foreign key field.
- Use `ON DELETE` behavior that matches the intended data lifecycle.

### Current relationship conventions

The code and docs imply the following relationship structure:

- `events.season_id` -> `seasons.id`
- `matches.event_id` -> `events.id`
- `results.match_id` -> `matches.id`
- `results.player_id` -> `players.id`
- `teams.season_id` -> `seasons.id`
- `player_registrations.player_id` -> `players.id`
- `player_registrations.team_id` -> `teams.id`
- `player_registrations.season_id` -> `seasons.id`
- `player_aliases.player_id` -> `players.id`

Standards:

- Use foreign keys even when the app currently queries by a denormalized field.
- Prefer one canonical source of truth for school/team assignment, especially in registrations.
- Keep tables normalized: do not store a derived school or team name in the results table when it can be resolved from registration or team metadata.

### Referential integrity policies

- Do not allow orphaned child rows by default.
- If a record is intentionally removable, define the business rule clearly in the schema and application logic.
- For deactivation rather than deletion, prefer `active` or `archived` flags over silently removing rows.

## Indexing guidelines

### Primary index rules

- Every primary key should be a surrogate key (`id`) with a default integer/bigint identity column.
- All foreign key columns should be indexed.
- Join and filter columns used frequently in queries should be indexed.

### High-priority indexes for this project

At minimum, the app should expect these indexes:

- `seasons(active)`
- `events(season_id)`
- `events(event_date)`
- `matches(event_id)`
- `results(player_id)`
- `results(match_id)`
- `results(points)` only if used in analytical queries or reporting
- `teams(season_id)`
- `teams(season_id, school, team_name)`
- `players(player_name)`
- `player_registrations(season_id)`
- `player_registrations(player_id, season_id)`
- `player_registrations(team_id)`
- `player_aliases(player_id)`
- `player_aliases(alias_name)`
- `unmatched_results(resolved)`
- `unmatched_results(match_id)`
- `placement_scoring(min_place, max_place)` or a stable range lookup pattern

### Composite index guidance

Use composite indexes when the app filters on multiple fields together:

- `(player_id, season_id)` for registration uniqueness and lookup
- `(season_id, school, team_name)` for team discovery
- `(event_id, match_name)` if a match name is expected to be unique within an event
- `(resolved, match_id)` for unmatched-result workflows

### Performance notes

- Indexes should support current query shapes, especially season-scoped reads and team/player lookups.
- Avoid excessive indexing on derived or mostly static fields unless they are queried often.
- Monitor usage growth as historical seasons, awards, and analytics are added.

## Data integrity conventions

### Nullability

- Required fields should be explicitly non-null.
- Use `NOT NULL` for critical foreign keys and business identifiers.
- Use nullable columns only when the business rule allows missing or unknown values.

### Domain validation

The app already validates critical imported data such as:

- placement must be numeric and within a valid range
- eliminations must be numeric and non-negative
- usernames are required
- season and event identifiers must be valid

Database constraints should align with these rules when possible:

- restrict placement to sensible range if the domain rules are fixed
- enforce non-negative elimination counts if allowed by the schema
- enforce presence of required names for players, teams, seasons, and events

### Business key rules

- Prefer natural keys and unique constraints when the business identity is stable.
- For records that must be unique per season, encode that uniqueness in the schema.
- Keep the app and database consistent on matching rules for aliases, player identity, and registration records.

## Migration and schema change discipline

The project documentation states that schema changes should:

1. update the schema document
2. create migration scripts
3. update affected queries
4. review standings calculations

This should also apply to SQL conventions:

- every schema change must be reviewed for downstream queries
- every changed column or relationship must be checked against standings logic
- if a field is renamed, update related queries and documentation in the same change set

## Recommended future patterns

As the application matures, these additional conventions should be adopted:

- explicit `CHECK` constraints for scoring and placement rules
- generated columns or views for leaderboard summaries when performance becomes an issue
- materialized views for standings if historical or repeated aggregation becomes heavy
- naming conventions that remain consistent across application code and database schema

## Summary

The project’s SQL conventions should stay grounded in the current design principles:

- normalized data
- explicit relationships
- stable naming
- season-scoped ownership
- cross-table consistency
- query patterns built around the app’s real usage

The schema should remain easy to reason about, easy to audit, and safe to scale as the league grows into historical seasons, analytics, and more advanced standings logic.

## Pre-UX schema cleanup checklist

The app has reached a stage where UX improvements should not outrun the schema discipline. The following should be treated as pre-UX work:

- keep all relationship names and foreign keys consistent across the app and docs
- standardize seasonal filters and query defaults across every standings and admin page
- preserve a single source of truth for scoring rules and keep imports aligned with that contract
- document and enforce cleanup rules for results, alias changes, and unresolved rows before adding more user-facing complexity
- add migration verification steps for every schema or data-model change

If these rules are kept intact, the UI can be refined without creating hidden data integrity risk.
