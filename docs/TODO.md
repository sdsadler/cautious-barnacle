# Project Roadmap and Status

## Current status

The project has moved beyond the initial MVP baseline and now includes core league operations, protected admin workflows, season-aware standings logic, and a working browser admin auth flow.

## Completed

- Admin authentication and authorization flow
  - Supabase Auth login is implemented for admin pages.
  - Admin routes are protected using the authenticated user and `user_profiles.is_admin` checks.
  - Unauthorized access redirects to the admin access flow.
- Season aware filtering for admin pages
  - Event and match administration pages default to the current season based on the season date range.
  - If no season contains today, the closest season is selected.
  - Filtering is applied in the admin queries for season-scoped views.
- Event drilldown support
  - Event names link to a detail page showing only matches for that event.
  - Event date and season are displayed with breadcrumb navigation back to Events.
- Match management improvements
  - Admin match views are season-filtered by default.
  - Match ID column removed in favor of event-aware and season-aware columns.
  - Match list now shows match name, event name, event date, season, and actions.
- Shared admin patterns and safety checks
  - Status banners remain standardized across admin pages.
  - Dependency checks are reused before destructive operations.
- Player management page
  - Dedicated admin player management screen exists.
  - Players are filtered by the selected season.
  - Alias editing and assignment flows are supported.
- Scoring configuration support
  - A scoring admin page exists to surface current rule values for the app.
- Standings and season centralization
  - Season selection and fallback logic are centralized in shared helpers.
  - Public standings pages remain season-aware and default to the current season.
- Data and schema documentation updates
  - The project documentation reflects the current access model and live schema realities.

## Current priority

The project is in a stable operational state. The core feature set is complete and the remaining work is optional refinement rather than required product delivery.

### Current roadmap status

All previously planned roadmap items are complete.

- Team drilldown and school drilldown pages are implemented.
- Player, team, and school standings include season, event, and match filtering.
- Player counts, roster metrics, and empty-state handling are in place.
- Route stability and stale admin-selection safeguards have been completed.

### Optional follow-ups

These items are not blockers for the app's current functionality, but they are worth considering if the team continues to mature the system:

1. Formalize schema migration tooling and a documented safe migration workflow.
2. Centralize remaining page-local business logic into repository/service utilities.
3. Add stronger server-side auth and RLS enforcement for production deployment.
4. Expand historical analytics and tie-aware ranking support if the league grows.

## Execution checklist

- [x] 1. Add a season selector to the admin results upload page and default it to the season nearest today.
  - [x] Confirm the active season logic matches the shared season resolver used elsewhere in the app.
  - [x] Validate the selected season is persisted through the result import flow.
  - [x] Confirm result uploads are scoped to the selected season context, not the currently active season by accident.

- [x] 2. Add the no-player warning to the results upload page.
  - [x] Check whether the selected season has any player registrations before allowing the upload flow to continue.
  - [x] If there are no players, show a clear admin warning telling them to import players first.
  - [x] Keep the warning non-blocking only if the admin intentionally chooses to proceed.

- [x] 3. Implement default generic team handling on the player upload page.
  - [x] Detect blank team values in uploaded rows.
  - [x] Use `Fortnite Team` as the fallback team name and ensure it is season-scoped and stored correctly.
  - [x] Surface a warning in the UI clarifying that the row was normalized.

- [x] 4. Add unmatched-result auto-resolution during player uploads.
  - [x] After a player or alias is imported, look for unmatched results matching the imported player name or alias.
  - [x] Resolve those unmatched rows automatically.
  - [x] Show a notification that includes how many unmatched results were resolved.

- [x] 5. Improve player import reporting.
  - [x] Count newly created players.
  - [x] Count players that already existed.
  - [x] Count alias rows added during the import.
  - [x] Display the summary in the page after the import completes.

- [x] 6. Audit the data model for unassigned players.
  - [x] Confirm whether players can exist in the current season without a school assignment.
  - [x] Check whether the registration schema already prevents that condition.
  - [x] Add a dedicated admin audit entry for unassigned registrations when the condition is present.

- [x] 7. Add player standings metrics.
  - [x] Add `matches played` to the standings players view.
  - [x] Add `average placement` and `total eliminations` columns.
  - [x] Filter the player list to only display players with `matches played > 0`.
  - [x] Reuse the active season/event/match filters exactly as the existing standings logic does.

- [x] 8. Add the matches played column and username sorting to the admin players page.
  - [x] Include `matches played` in the admin roster table.
  - [x] Sort rows by username in the selected season.
  - [x] Keep the admin view scoped to the active season filter and avoid cross-season drift.

- [x] 9. Build team drilldown standings.
  - [x] Allow clicking a team name from the standings/teams page to open a detail page.
  - [x] Include all team members, even players with zero matches played.
  - [x] Show points, average placement, total eliminations, and matches played.
  - [x] Keep the drilldown filterable by season, event, and match.

- [x] 10. Build school drilldown standings.
   - [x] Allow clicking a school name from the schools standings page.
   - [x] Group players by team when multiple teams are present for the school.
   - [x] Include all players on the school, even those with zero matches played, when drilling into the detail page.
   - [x] Show points, average placement, total eliminations, and matches played.
   - [x] Keep the school summary visible regardless of team count, but only show grouped team rows when the school has multiple teams.
   - [x] Keep the drilldown filterable by season, event, and match.

- [x] 11. Add player counts to the standings pages.
   - [x] Add player counts to the team standings page summaries.
   - [x] Add player counts to the school standings page summaries.
   - [x] Keep the counts scoped to the current season, event, and match filters.

- [x] 12. Review unmatched-result fuzzy matching improvements.
   - [x] Evaluate whether false positives are likely if fuzzy matching is added.
   - [x] Confirm whether alias-first matching is sufficient for the current domain.
   - [x] Decide that a conservative alias-first approach is safer than broad fuzzy matching for now.

- [x] 13. Harden standings routes and filter handling.
   - [x] Remove stale event/match params from drilldown URLs when they no longer apply.
   - [x] Normalize school/team path resolution to avoid broken detail-page routing.
   - [x] Keep standings pages valid for real-world season and naming variations.

- [x] 14. Fix stale season and form state across admin pages.
   - [x] Ensure season/event choices are refreshed or cleared when the set of valid options changes.
   - [x] Prevent stale values from persisting after reloads or invalid selections.
   - [x] Keep admin selection state aligned with the active season and filter model.

## Technical debt and follow-ups

- The data structure should continue to treat season registrations as the authoritative relationship layer between players, schools, and teams.
- The app should avoid silently accepting incomplete import data when a safer fallback is possible.
- Standing metrics should continue to be derived from the same canonical match/result records used elsewhere in the app.
- Unmatched-result reconciliation and fuzzy name logic should remain conservative enough to avoid incorrect resolves.

## Roadmap summary

The product is now ready to move from foundational feature completion into deeper operational polish. The next items are focused on making imports safer, standings richer, and the admin workflow more useful with real season data.
