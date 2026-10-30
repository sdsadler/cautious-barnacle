# API and Data Access Patterns

## Purpose

This document captures the project’s current Supabase data access conventions, query patterns, and server/client component standards. It reflects the existing code patterns in the repository and should act as the baseline reference for future work.

This project uses:

- Next.js App Router
- TypeScript
- Supabase client for database access
- Server components for primary reads in the standings pages
- Client components for admin workflows and interactive forms

## Supabase client usage

The app centralizes database access through a single client instance in [lib/supabase.ts](../lib/supabase.ts):

```ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

Current conventions:

- Import the singleton as `supabase` from `@/lib/supabase`.
- Use `supabase.from(table).select(...).eq(...).order(...)` for standard reads.
- Use `.single()` when a query is expected to return exactly one record.
- Use `.upsert(...)` when a record may already exist, especially for season registrations.
- Always check `error` in the result object before using returned data.
- Handle missing data explicitly when an active season or selected entity is not present.

## Query patterns currently used

### 1. Read the active season

Used in standings pages and imports.

```ts
const { data: activeSeason } = await supabase
  .from("seasons")
  .select("*")
  .eq("active", true)
  .single();
```

Patterns:

- Query by boolean status (`active = true`) for current season selection.
- Use a single record fetch when the business rule requires one active season.
- Treat the result as a precondition for downstream calculations.

### 2. Fetch filtered records for a season

```ts
const { data: registrations } = await supabase
  .from("player_registrations")
  .select(`
    player_id,
    team_id,
    players (
      player_name
    )
  `)
  .eq("season_id", activeSeason.id);
```

Patterns:

- Use `.eq("season_id", id)` to scope queries to the current season.
- Use nested selects with relational data when needed for joins.
- Prefer explicit field selection over `select("*")` for performance and clarity.

### 3. Fetch related records and nested data

```ts
const { data: eventData } = await supabase
  .from("events")
  .select(`
    *,
    matches (
      id
    )
  `)
  .order("event_date", { ascending: false });
```

Patterns:

- Use nested selects when the route needs parent/child records together.
- Keep nested related selects small and explicit.
- Avoid loading deep, unnecessary object graphs in page components.

### 4. Aggregate results with in-memory maps

Examples from the standings pages aggregate a result set into a `Map` before rendering.

```ts
const pointsMap = new Map<number, number>();

results?.forEach((result) => {
  const current = pointsMap.get(result.player_id) ?? 0;
  pointsMap.set(result.player_id, current + result.points);
});
```

Patterns:

- Use in-memory aggregation for route-level calculations when data volumes are modest.
- Keep this logic centralized in a dedicated service when complexity grows.
- Do not duplicate aggregation logic across standings pages.

### 5. Client-side data loading with `useEffect`

Admin pages use `useEffect` to fetch refreshable data.

```ts
useEffect(() => {
  loadData();
}, []);
```

Patterns:

- Use `useEffect` for interactive admin workflows with local UI state.
- Keep state transitions explicit and avoid hidden side effects.
- Reload dependent data after mutations with a dedicated refresh function.

### 6. Mutation and insert workflows

```ts
const { error } = await supabase
  .from("events")
  .insert({
    season_id: Number(selectedSeason),
    event_name: eventName,
    event_date: eventDate,
  });
```

Patterns:

- Validate input before insert.
- Keep mutation code near the UI for current MVP pages.
- Show meaningful message states for success or failure.
- Prefer server-side or service-layer orchestration once the app grows beyond the MVP.

### 7. Upsert for stable identity reconciliation

```ts
await supabase
  .from("player_registrations")
  .upsert(
    {
      player_id: playerId,
      season_id: season.id,
      school,
      team,
      team_id: teamId,
    },
    {
      onConflict: "player_id,season_id",
    }
  );
```

Patterns:

- Use upsert to avoid duplicate registration records for the same player/season.
- Prefer natural key conflict definitions for uniqueness when the domain is clear.
- Keep relational ids aligned with the normalized schema.

## Data fetching conventions

### Current conventions

1. Route-level pages perform direct data reads using Supabase.
2. Most page files are server components unless they require browser state or event handlers.
3. Client pages keep local state (`useState`) for forms and tables.
4. Error states are usually rendered inline in the UI.
5. Data is loaded on-demand with a mix of initial fetches and reload logic.

### Recommended conventions going forward

- Centralize data access behind reusable query helpers or repository functions.
- Separate fetch logic from rendering logic.
- Prefer typed result shapes for query responses.
- Avoid `any` when model shapes are known.
- Keep database-specific field names and join semantics in a single layer.

## Server component standards

The project includes server components such as the standings pages and the utility wrapper around active season lookup. Examples:

- [app/standings/page.tsx](../app/standings/page.tsx)
- [app/standings/teams/page.tsx](../app/standings/teams/page.tsx)
- [app/standings/schools/page.tsx](../app/standings/schools/page.tsx)
- [lib/getActiveSeason.ts](../lib/getActiveSeason.ts) (if present in the project structure)

### Server component expectations

- Use `async function Page()` for server-rendered data fetching.
- Fetch required data at the top of the component.
- Return early with explicit empty-state or error-state UI blocks when requirements are not met.
- Default to server-side fetches for read-heavy pages and internal admin dashboards.

### Example pattern

```ts
export default async function StandingsPage() {
  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("*")
    .eq("active", true)
    .single();

  if (!activeSeason) {
    return <div>No active season found.</div>;
  }

  const { data } = await supabase
    .from("results")
    .select("player_id, points")
    .eq("season_id", activeSeason.id);

  return <div>{/* render */}</div>;
}
```

### Standards for future implementation

- Keep server components focused on data composition and presentation.
- Move business logic to service modules as the project grows.
- Use a common model of `data`, `error`, and `empty` states.
- Do not mix database-fetch orchestration and unrelated UI concerns into a single route file.

## Error handling conventions

Current patterns in the app include:

- UI rendering of `error.message` for user-facing failures
- `console.error(error)` for import and mutation failures
- `alert("Select a player first.")` for some interactive decisions
- `throw new Error("No active season found.")` in import flows

Recommended practices for ongoing work:

- Fail fast on essential preconditions such as missing active season.
- Centralize errors into stable message strings or typed domain errors.
- Keep user-facing error messages actionable rather than raw database messages whenever possible.
- Log server-side exceptions consistently.

## Architectural guidance

The current app still follows an MVP page-centric structure. That is acceptable for a small app, but the project documentation consistently calls for cleaner boundaries and a single source of truth for standings.

## Pre-UX hardening checklist

Before investing heavily in UX or a broader admin shell refresh, the project should complete the following:

- Move shared query logic into reusable data-access helpers and reduce direct table access from page components.
- Keep scoring logic and filter defaults centralized so the public and admin views stay consistent.
- Add stronger validation around match deletion, alias deletion, and unmatched-result resolution.
- Ensure all relevant table writes are covered by a clear migration and audit trail.
- Treat the service layer as the business gatekeeper, not the page.

This is the best way to avoid introducing a more polished UI on top of inconsistent data logic.

The future target architecture should look like this:

- UI pages: component rendering and user interaction
- Services or repositories: data fetching and mutation orchestration
- Domain logic: standings, validation, matching, and import workflows
- Supabase access: one stable client and explicit query wrappers

This keeps the current patterns usable while reducing drift and improving maintainability.

## Summary

The repository’s current API conventions are straightforward and consistent with the MVP stage of the project:

- direct Supabase access from pages and utilities
- server-side reads for page data
- client-side interactive workflows for form-heavy admin tasks
- in-memory aggregation for standings logic
- explicit status and error handling

The guiding principle for all future work should be: keep database access, business rules, and UI responsibilities separate enough that the app remains maintainable as the league grows.
