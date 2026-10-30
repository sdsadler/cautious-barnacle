#  Fortnite Standings

 Fortnite Standings is a full-stack esports league management application built for tracking public standings, season results, team and player performance, and administrative operations for a Fortnite competition structure.

The app combines a modern Next.js frontend with a Supabase PostgreSQL data layer to support a complete season workflow: schools and teams register players, events and matches are recorded, results are imported and validated, and public leaderboard pages show live standings for players, teams, and schools.

## Project purpose

This project exists to help manage a school-based Fortnite league from both the public and administrative sides:

- public-facing standings pages for players, teams, and schools
- season, event, and match filtering for leaderboard views
- drilldown pages for detailed team, school, and player summaries
- admin tools for managing seasons, events, matches, players, and scoring configuration
- CSV import workflows for bulk player and results data
- data integrity checks for unmatched results, alias resolution, and safer admin actions

## Core domain model

The application is organized around the core esports hierarchy:

- Season
  - Event
    - Match
      - Results
- School
  - Team
    - Player

This structure keeps standings and import workflows tied to the right seasonal context while preserving normalized relationships between schools, teams, and players.

## Key features

- Player, team, and school standings with season-aware rankings
- Drilldown views that show roster and performance details
- Filtered standings across season, event, and match scope
- CSV imports for player records and match results
- Alias and unmatched-result handling for cleaner result reconciliation
- Admin dashboard and management screens for league operations
- Route and state stability for public and admin workflows
- Dark-themed, league-branded presentation for standings pages and management experiences

## Technology stack

- Next.js App Router
- TypeScript
- React 19
- Tailwind CSS
- Supabase PostgreSQL
- ESLint and project-based validation tooling

## Repository structure

- app/ - Next.js App Router pages and layouts
- components/ - UI components shared across standings and admin pages
- lib/ - data access, helpers, and shared logic
- docs/ - project documentation, schema notes, standings rules, and architecture guidance
- supabase/ - database-related SQL and migration context when applicable

## Local development

Install dependencies:

```bash
npm install
```

Start the app in development mode:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Production build

```bash
npm run build
```

## Documentation

The repository includes supporting documentation for the league system and app architecture:

- docs/PROJECT_CONTEXT.md
- docs/DATABASE_SCHEMA.md
- docs/STANDINGS_RULES.md
- docs/TODO.md
- docs/ARCHITECTURE_REVIEW.md
- docs/API_PATTERNS.md
- docs/SQL_CONVENTIONS.md
- docs/CHANGELOG.md
- docs/STANDINGS_ARCHITECTURE.md

These documents are intended to be reviewed before making changes so that the standings logic, database model, and business rules remain consistent.

## Design and business philosophy

The project emphasizes:

- normalized database relationships and clean schema design
- centralized standings and scoring logic instead of duplicated page-level calculations
- safe admin workflows with explicit validation and protection against destructive actions
- maintainability, data integrity, and predictable behavior over cosmetic-only changes

## Status

This project is operating as a functional esports management platform and is designed to support real league season workflows, not just a static leaderboard mockup.
