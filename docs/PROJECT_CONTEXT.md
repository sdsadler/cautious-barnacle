# Esports League Management System

## Purpose

This application manages an inter-school esports league for season-based play, event tracking, player registrations, and public standings.

The system tracks schools, teams, players, seasons, events, matches, results, imports, and admin workflows used to keep the league operational.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase PostgreSQL
- React

## Core Hierarchy

Season
└── Event
    └── Match
        └── Results

School
└── Team
    └── Player

## Current state

The project is now in a stable operational phase. The app supports the complete working loop for a league season:

- season-aware standings for players, teams, and schools
- team and school drilldown pages with roster detail and metric summaries
- season, event, and match filtering in public standings
- admin team, event, and player management screens
- CSV import workflows for players and results
- alias resolution and unmatched-result handling
- dependency-safe delete protections and admin status feedback
- empty states and route/filter hardening for real-world data

## Features Implemented

- Player standings with matches played, average placement, and eliminations
- Team standings with player counts and drilldown detail pages
- School standings with grouped team details and drilldown pages
- CSV result imports with season context and validation
- CSV player imports with aliases and generic team fallback handling
- Alias management through the admin player page
- Unmatched results workflow with conservative auto-resolution
- Event and match management with dependency checks
- Admin safety banners and validation flows
- Route stability and stale filter state management

## Design Philosophy

- Keep the database normalized where possible.
- Prefer reusable logic over page-local duplicate calculations.
- Treat season registrations and team metadata as the canonical relationship layer.
- Keep admin destructive actions guarded and explicit.
- Type safety and explicit query contracts are important.
- Favor maintainability and data integrity over purely cosmetic UI improvements.

## Long-Term Goals

- Playoffs and championship progression
- Historical seasons and richer analytics
- Team and school dashboards
- Awards and MVP tracking
- More advanced reporting and tie-aware ranking support
- Stronger production auth, RLS, and migration tooling

## Agent Instructions

Before making significant changes:

1. Review DATABASE_SCHEMA.md.
2. Review STANDINGS_RULES.md.
3. Review TODO.md.
4. Reuse existing patterns whenever possible.
5. Avoid introducing duplicate business logic.

## Current maturity and follow-ups

The app is functionally complete for its current league-management workflow. The remaining work is mostly optional hardening and maturity work rather than product blockers:

- centralize any remaining page-local business logic into shared services
- document and script schema migrations for production changes
- strengthen admin auth and database-level RLS for deployment
- add historical analytics and tie-aware ranking if the league expands
- evaluate whether additional reporting dashboards are worth the maintenance cost

The project is no longer in a pre-UX hardening phase in the strict sense; the core operational functionality is now present and stable enough to support real season use.
