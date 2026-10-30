# Standings Rules

## Player Standings

Player score is calculated as:

SUM(all result scores)

Players are ranked by descending score.

## Team Standings

Team score is calculated as:

SUM(all player scores on team)

Teams are ranked by descending score.

## School Standings

School score is calculated as:

SUM(all team scores at school)

Schools are ranked by descending score.

## Future Improvements

### Tie Aware Ranking

Example:

1. Team A
1. Team B
3. Team C

### Season Filtering

All standings should support:

- Current season
- Specific season
- Historical seasons

## Single Source Of Truth

Standings calculations should be centralized.

Do not duplicate standings logic across pages.

## Pre-UX readiness gate

Before spending time on UI redesign or admin UX polish, the project should complete the following hardening steps:

- Centralize standings and season filtering logic in one service layer, with consistent defaults for current season and all relevant events/matches.
- Treat scoring rules as the canonical source for points and placement logic instead of re-implementing formulas in multiple pages.
- Ensure ranking rules can support tie-aware behavior without rework across every standings page.
- Keep all page-level filters aligned with the same season/event/match selection contract.
- Avoid visual improvements that hide inconsistent business logic or duplicate calculations.

The app can ship a more polished interface only after these correctness and data-model issues are addressed.
