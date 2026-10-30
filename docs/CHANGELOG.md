# Changelog

## Current Milestone Summary

### Milestone: MVP league operations and standings foundation

This project is currently in its early operational MVP phase. The system already supports the basic league lifecycle needed to manage an inter-school esports season, including:

- seasons
- events
- matches
- schools and teams
- players and registrations
- standings pages
- CSV import workflows
- alias management
- unmatched-result resolution

This milestone reflects the product direction described in [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md), [STANDINGS_RULES.md](STANDINGS_RULES.md), and [ai/lead-dev.md](../ai/lead-dev.md). The codebase is functionally capable of supporting a small active season, but it still reflects the early-stage architecture described in [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md).

## Initial project history

### Initial phase: project setup

The project was created as a Next.js application using the App Router and TypeScript. The repository includes the standard base setup for a modern React and Next.js app, plus the custom project-specific league management domain.

Key characteristics of the initial setup:

- Next.js App Router structure
- TypeScript configuration
- Tailwind styling
- Supabase client integration
- App pages for standings and admin workflows

### Early operational build: league data workflows

The first major implementation cycle added operational features to support running a league:

- active-season standings pages for players, teams, and schools
- event creation/admin pages
- match creation/admin pages
- CSV import for player roster data
- CSV import for match results
- result validation and scoring logic
- alias management for matching alternate display names
- unmatched-result triage and resolution flow

This phase demonstrates that the project moved beyond a static dashboard and into an actual working league management tool.

## Current status

### Core features that exist

- Active-season player standings
- Active-season team standings
- Active-season school standings
- Player detail pages with overview, season statistics, recent results, and season history
- Event management
- Match management
- CSV player imports
- CSV result imports
- Alias resolution and match suggestions
- Unmatched-result workflow
- Data access via Supabase

### Current gaps and known issues

The architecture review identified a set of important gaps that are still unresolved:

- standings logic is duplicated across route files
- business logic is embedded in pages rather than centralized services
- schema documentation is high-level but not authoritative
- migration workflow is not yet codified in the repo
- no formal service/repository layer yet
- no full season filtering, tie-aware ranking, or historical data support yet
- event/match edit/delete lifecycle still incomplete

These gaps are consistent with the product roadmap captured in [TODO.md](TODO.md) and the lead-dev priorities in [ai/lead-dev.md](../ai/lead-dev.md).

## Planned milestone progression

### Near-term priorities

The repository already identifies the next work as:

1. tie-aware rankings
2. season filtering across standings
3. event management improvements
4. match management improvements

These represent the next major milestone after the current MVP baseline.

### Planned administrative workflow hardening

The next implementation focus is the event and match admin workflow. The goal is to improve the operational clarity of the admin pages without changing the underlying league model or data rules. Planned changes include:

- stronger event admin UX with season context, empty states, match count summaries, and clearer confirmation messaging on destructive actions
- a dedicated event drilldown page that shows event metadata, breadcrumb navigation, and only the matches associated with the selected event
- a refined match management page that emphasizes event/date context, keeps season filters consistent, and reduces unnecessary column noise
- shared event/season query logic so filter behavior stays consistent across the admin workflows
- explicit documentation of delete dependencies and the expected cleanup behavior for related results and unmatched-result records

This is a planned hardening phase intended to improve maintainability and administrative clarity before the next expansion cycle.

### Ordered implementation plan for remaining feature backlog

The remaining feature work should be executed in this order to minimize risk and keep the project stable while adding higher-impact governance and user-facing functionality:

1. Match deletion support
   - Add a confirmation dialog and ensure grouped cleanup of related results and child records before deleting a match.
   - This is the highest-priority operational safeguard due to its destructive footprint.

2. Admin scoring configuration page
   - Consolidate scoring values into a single admin-maintained source of truth.
   - This reduces hardcoding risk and ensures standings calculations continue to reflect live rules.

3. Standings filtering by season, event, and match
   - Default the public standings pages to the current season and include all matching events and matches.
   - The behavior should be centralized and shared across all standings views.

4. Admin player management page
   - Give admins the ability to view season players, update school assignments, and manage aliases in-place.
   - This is important operational functionality, but it is less risky than fixing delete safety and scoring configuration.

5. Season drilldown from the admin seasons page
   - Add navigation from a season to a detail view that matches the event drilldown experience.
   - This delivers admin UX improvement and consistency after the higher-risk procedural work is complete.

This ordering preserves the project’s architectural goals: protect data integrity first, centralize scoring and filtering logic next, and then improve UX and operational convenience.

### Medium-term priorities

- better alias fuzzy matching
- school and team administrative UIs
- more robust import reporting and validation
- centralize standings logic and reduce duplication

### Long-term priorities

- playoffs
- historical data and standings
- awards and MVP tracking
- detailed analytics and reporting
- school/team dashboards and historical pages

## Release note style summary

### v0.1.0 — Initial operational MVP

- Initial Next.js app and project setup
- Added Supabase-backed league data model support
- Added standings pages for players, teams, and schools
- Added event and match management tools
- Added CSV player and result import workflows
- Added alias management and unmatched-result resolution tools

### Planned next milestone

- Centralized standings logic
- Tie-aware ranking support
- Season filtering across active and historical seasons
- Event and match CRUD improvements

## Documentation history

This changelog complements the project documentation set:

- [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)
- [STANDINGS_RULES.md](STANDINGS_RULES.md)
- [TODO.md](TODO.md)
- [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md)
- [API_PATTERNS.md](API_PATTERNS.md)
- [SQL_CONVENTIONS.md](SQL_CONVENTIONS.md)

The repository’s intent is clear: the project is building toward a maintainable, normalized, scalable esports league platform while still being in the early phases of production maturity.

## Pre-UX hardening milestone

Before the team invests in major UX changes, the project should finish a stabilization pass focused on correctness and maintainability:

- centralize standings and season filtering logic
- confirm scoring configuration is consistent across imports and standings views
- harden admin destructive actions with explicit cleanup rules
- document migration expectations and import validation workflows
- reduce route-local business logic wherever it duplicates shared patterns

This milestone is less visible to users than a UI refresh, but it protects future feature growth and lowers the risk of expensive refactors later.
