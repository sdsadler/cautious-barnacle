# Architecture Review

## Scope

This review was prepared using the project context and policy documents in this repository, including [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md), [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md), [STANDINGS_RULES.md](STANDINGS_RULES.md), [TODO.md](TODO.md), [DEVELOPMENT_GUIDELINES.md](DEVELOPMENT_GUIDELINES.md), and [ai/lead-dev.md](../ai/lead-dev.md). It also reflects the code structure and implementation patterns in the app itself, especially the route-level pages under [app](../app) and the shared data access utilities in [lib](../lib).

## Executive Summary

The application is a lightweight, data-driven Next.js app built around a Supabase/PostgreSQL data layer and a set of page-level admin and standings workflows. The system already covers the core league lifecycle: seasons, events, matches, schools, teams, players, rankings, CSV result imports, alias handling, and unmatched-result resolution.

The project is directionally strong: the domain is clear, the data model is normalized in spirit, and the stated goals closely match the implemented workflows. However, the current implementation is still early-stage and structurally brittle. Business logic is embedded directly in route components, standings logic is duplicated across multiple pages, and the codebase does not yet have a formal domain/service layer, migration strategy, or consistent database documentation beyond the high-level docs.

The biggest architectural risks are not missing features; they are duplication, lack of centralization, and the absence of a stable data-access contract.

## Pre-UX hardening recommendations

The application is ready for polish in a limited sense, but before the team adds more UX work it should complete several operational tasks that reduce long-term cost:

- Centralize standings calculation and season selection logic so every page uses the same business rules.
- Standardize admin and public filters by season, event, and match.
- Move import, scoring, and alias resolution logic into shared services instead of route-level flows.
- Hard-code fewer assumptions about scoring and season defaults; use the data model and shared helpers as the source of truth.
- Document migration, validation, and cleanup expectations before major UI changes are layered on top.

This is the point where the app should improve maintainability, not only appearance.

## Architecture Review

### 1. Overall structure

The app uses the Next.js App Router and a Supabase client created in [lib/supabase.ts](../lib/supabase.ts). Route-level pages are used for both presentation and business logic. Examples include:

- [app/page.tsx](../app/page.tsx)
- [app/standings/page.tsx](../app/standings/page.tsx)
- [app/standings/teams/page.tsx](../app/standings/teams/page.tsx)
- [app/standings/schools/page.tsx](../app/standings/schools/page.tsx)
- [app/admin/events/page.tsx](../app/admin/events/page.tsx)
- [app/admin/matches/page.tsx](../app/admin/matches/page.tsx)
- [app/admin/upload-results/page.tsx](../app/admin/upload-results/page.tsx)
- [app/admin/aliases/page.tsx](../app/admin/aliases/page.tsx)
- [app/admin/unmatched-results/page.tsx](../app/admin/unmatched-results/page.tsx)

This is a workable MVP pattern, but it causes business rules to spread across the UI layer. The app is functionally complete enough to operate as a tool, but not yet robust enough to scale safely without centralizing domain logic.

### 2. Strengths

- Clear business domain: seasons, events, matches, schools, teams, players, and standings are easy to understand.
- Strong alignment with written project goals: the docs and implementation match on feature direction.
- Supabase-backed data model fits an operational league admin workflow well.
- CSV import validation is already present and more mature than a typical MVP.
- The unmatched-results workflow is a useful operational safeguard, especially for messy player aliases and imported data quality issues.
- The project already documents a desired single-source-of-truth rule for standings, which is an excellent design principle to preserve.

### 3. Architectural issues and risks

#### A. Standings logic is duplicated across pages

The player, team, and school standings pages each compute totals from raw data using ad hoc aggregation code. The pattern is repeated in multiple files:

- [app/standings/page.tsx](../app/standings/page.tsx)
- [app/standings/teams/page.tsx](../app/standings/teams/page.tsx)
- [app/standings/schools/page.tsx](../app/standings/schools/page.tsx)

This violates the explicit guidance in [STANDINGS_RULES.md](STANDINGS_RULES.md) and the project note that standings calculations should be centralized. It creates hidden drift risk: one page may update differently from another, and formula changes (tie logic, season filtering, historical queries, or scoring adjustments) will need to be applied in three places.

Recommendation: create a shared standings service or query layer that computes player, team, and school standings from a canonical dataset and return a typed result model to pages.

#### B. Business logic is embedded in UI components

The admin pages are doing data fetching, validation, import orchestration, relationship lookups, and mutation logic directly inside page components. This is apparent in [app/admin/upload-results/page.tsx](../app/admin/upload-results/page.tsx) and [app/admin/upload-players/page.tsx](../app/admin/upload-players/page.tsx).

This is acceptable for a small internal tool, but it makes testing, auditing, and reuse harder. Any change in business rules requires editing UI code directly. There is no clear separation between transport logic, domain logic, and presentation.

Recommendation: introduce a small domain/service layer for league operations, import handling, standings calculations, and player resolution. Keep page components focused on user interaction and rendering.

#### C. Missing central query and data contract layer

There is a unified Supabase client in [lib/supabase.ts](../lib/supabase.ts), but there is no consistent query helper layer or typed database access contract. The code directly reaches into tables like `seasons`, `events`, `matches`, `results`, `players`, `player_aliases`, and `unmatched_results` from many pages.

That means database field names, assumptions about join shapes, and business semantics are spread through the app. This increases the chance of subtle breakage when schema changes occur.

Recommendation: add a single layer of repository/query utilities and strongly typed models for the most important entities.

#### D. The system has an MVP architecture but not yet a durable operational architecture

The current app handles the admin workflow, but it does not yet include a documented lifecycle for:

- schema evolution and migrations
- role-based access control
- import audit trails
- error logging and operational monitoring
- data cleanup workflows
- season-specific and historical queries

The project docs mention migration responsibilities and future priorities, but the repository does not show a real migration folder or operational conventions yet.

Recommendation: formalize the data lifecycle and deployment model while the app is still relatively small.

### 4. Data and domain model fit

The current domain model aligns well with the stated league structure:

- Season -> Event -> Match -> Results
- School -> Team -> Player

The relationship design is mostly sensible, particularly the use of a registration layer for season team membership (`player_registrations`) and the ability to track multiple aliases (`player_aliases`) for player matching. This is fundamentally a good approach for a normalized league system.

The code also demonstrates realistic operational patterns, such as:

- CSV-based import with row validation
- unmatched result triage
- manual alias resolution
- season-scoped dataset selection

These characteristics show the app is solving real workflow problems instead of only rendering static standings.

## Current Feature Inventory

### Implemented features observed in code

1. Active-season player standings page
   - Reads the current season from `seasons` and displays aggregated player totals.
   - Files: [app/standings/page.tsx](../app/standings/page.tsx)

2. Active-season team standings page
   - Sums player contributions by registered team membership.
   - Files: [app/standings/teams/page.tsx](../app/standings/teams/page.tsx)

3. Active-season school standings page
   - Aggregates team scores into school totals.
   - Files: [app/standings/schools/page.tsx](../app/standings/schools/page.tsx)

4. Event management
   - Create event entries and display events grouped by date/season.
   - Files: [app/admin/events/page.tsx](../app/admin/events/page.tsx)

5. Match management
   - Create match records tied to an event.
   - Files: [app/admin/matches/page.tsx](../app/admin/matches/page.tsx)

6. CSV player import workflow
   - Reads players, resolves or creates player/team records, and upserts season registrations.
   - Files: [app/admin/upload-players/page.tsx](../app/admin/upload-players/page.tsx)

7. CSV result import workflow
   - Validates CSV columns and numeric values, calculates points using placement scoring, and inserts results.
   - Files: [app/admin/upload-results/page.tsx](../app/admin/upload-results/page.tsx)

8. Alias management
   - Add and remove aliases for players.
   - Files: [app/admin/aliases/page.tsx](../app/admin/aliases/page.tsx)

9. Unmatched result resolution
   - Loads unresolved rows, suggests candidate players with fuzzy matching, and resolves to a player record.
   - Files: [app/admin/unmatched-results/page.tsx](../app/admin/unmatched-results/page.tsx)

10. Database connection smoke check
   - The home page checks `test_connection` for connectivity.
   - Files: [app/page.tsx](../app/page.tsx)

### Features documented but not yet fully implemented

The project docs explicitly list additional planned work such as:

- tie-aware rankings
- season filtering across historical data
- event edit/delete operations
- match edit/delete operations
- school and team admin screens
- richer import reporting
- playoffs, historical standings, and analytics

This is consistent with the codebase: the app is already a functioning operational MVP, but it is not yet a fully matured league platform.

## Missing Documentation

The repo has strong high-level business documentation, but several important implementation gaps remain:

1. Canonical database schema document
   - The file [docs/DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) describes entities at a conceptual level, but it does not document exact table names, required columns, foreign key rules, constraints, or sample values.
   - The application logic clearly depends on actual Supabase table structures like `player_registrations`, `player_aliases`, `placement_scoring`, and `unmatched_results`, but these are not fully captured as authoritative schema documentation.

2. Migration workflow and migration history
   - The docs describe schema changes requiring migration scripts, but there is no visible migration directory or database change history in the repository.

3. Architecture and service boundaries
   - There is no document that explains how the app is intended to layer UI, domain logic, and data access.
   - The current code structure suggests a fast MVP, not a formal architecture contract.

4. Import specification and CSV format documentation
   - The app accepts CSV uploads, but the exact required columns, expected rows, duplicate handling rules, and scoring derivation are not recorded in a single authoritative spec.

5. Security and access policy documentation
   - There is no explicit documentation for Supabase row-level security, authorization model, or admin-only access expectations.

6. Testing and QA strategy
   - There is no visible functional test suite, regression strategy, or acceptance checklist for standings, imports, or alias resolution.

7. Operational runbook
   - There is no guidance for environment setup, local Supabase configuration, secrets management, or troubleshooting workflows.

## Next 5 Recommended Tasks in Priority Order

### 1. Centralize standings calculations into a shared service

Why first: This directly addresses the repository’s stated moral priority in [STANDINGS_RULES.md](STANDINGS_RULES.md) and removes duplication across player, team, and school pages.

Deliverables:
- create shared standings query/service logic
- unify player/team/school aggregation
- add season-aware and aggregate-safe result contracts
- prepare for tie-aware ranking and historical season support

### 2. Add canonical schema documentation plus actual migration standards

Why second: The project explicitly states that schema changes must update the database docs and create migration scripts. The codebase currently has the intent but not the operational enforcement.

Deliverables:
- authoritative table/column/constraint reference
- migration folder and naming standards
- cross-check against actual Supabase usage patterns
- data integrity rules for registrations, aliases, and results

### 3. Introduce a small domain/service layer for admin workflows

Why third: The import and resolution flows are currently too UI-heavy and difficult to reuse or test.

Deliverables:
- repositories or services for standings, import validation, alias resolution, and unmatched result management
- typed domain models for entities and import payloads
- standardized error handling and validation responses

### 4. Implement tie-aware ranking and season filtering support

Why fourth: These are explicitly listed as immediate priorities in [TODO.md](TODO.md) and [ai/lead-dev.md](../ai/lead-dev.md).

Deliverables:
- tie-aware ranking logic without breaking current pages
- query support for active season, selected season, and historical seasons
- UI selectors for season context
- consistent ranking behavior across player, team, and school pages

### 5. Complete event and match management lifecycle improvements

Why fifth: The product documentation names edit/delete functionality as a priority, and the existing code only covers create workflows.

Deliverables:
- edit event and match operations
- delete flows with validation safeguards
- audit-friendly admin UX
- consistency with the rest of the league workflow

## Conclusion

The project is well-scoped and directionally strong, with a clear domain model and a practical MVP implementation. The main issue is not a lack of product vision; it is a lack of centralization and enforcement. The app already has operational value, but it needs to convert from a set of page-level scripts into a more deliberate service-oriented architecture that matches the project’s own design philosophy.

If the team executes the next five priority tasks in order, the project will move from a workable internal tool into a maintainable, scalable esports league platform that better matches the documentation in [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md), [STANDINGS_RULES.md](STANDINGS_RULES.md), and the lead developer guidance in [ai/lead-dev.md](../ai/lead-dev.md).
