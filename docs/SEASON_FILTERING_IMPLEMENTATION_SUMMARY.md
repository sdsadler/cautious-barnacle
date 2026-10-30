# Season Filtering Implementation Summary

## Overview

Season filtering was implemented across the standings pages using a shared service layer in [lib/standings.ts](../lib/standings.ts). The standings pages now resolve the selected season from the query string, fall back to the active season, and render standings for that season without duplicating query logic.

## Included changes

- Added a shared season selection helper that reads `?season=` from the URL and resolves the season to use.
- Added shared standings retrieval functions for:
  - player standings
  - team standings
  - school standings
- Updated the standings pages to use the shared implementation.
- Added a season selector to each standings page so users can switch between all available seasons and the current active season.

## Files updated

- [lib/standings.ts](../lib/standings.ts)
- [app/standings/page.tsx](../app/standings/page.tsx)
- [app/standings/teams/page.tsx](../app/standings/teams/page.tsx)
- [app/standings/schools/page.tsx](../app/standings/schools/page.tsx)

## Behavior

- If a season is selected in the URL, that season is used.
- If no season is selected, the app falls back to the active season.
- If there is no active season, it falls back to the first available season.
- If no seasons exist, the page renders a no-season state.

## Notes

This is a shared implementation designed to support current and historical season views while avoiding duplicated query and selection logic across the standings pages.

## Pre-UX debt note

Season filtering is a meaningful improvement, but the underlying technical debt still remains: the app should keep filter defaults, scoring logic, and season selection rules centralized before further UX work. Otherwise, UI refinements will continue to expose disagreement between pages and between public and admin views.
