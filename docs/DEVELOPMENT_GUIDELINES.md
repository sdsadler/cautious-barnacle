# Development Guidelines

## General

- Use TypeScript.
- Use existing project patterns.
- Favor maintainability.
- Prefer explicit code over clever code.

## Pages

When updating page.tsx files:

- Return complete files.
- Ensure imports are updated.
- Verify server/client component requirements.

## Database Changes

When modifying schema:

- Generate migration SQL.
- Update DATABASE_SCHEMA.md.
- Consider impact on imports.
- Consider impact on standings.

## UI

- Preserve current styling.
- Reuse existing components.
- Avoid introducing unnecessary dependencies.

## Imports

CSV imports should:

- Validate data.
- Report errors clearly.
- Prevent duplicate imports.
- Preserve unmatched data.

## Bug Fixing

Before implementing a fix:

1. Explain root cause.
2. Implement correction.
3. Review related code paths.

## Pre-UX hardening gate

Before making large UX changes, complete the following operational checks:

- confirm the business logic has a single documented source of truth
- verify query and filter defaults match across the app
- ensure destructive actions are guarded and documented
- review migrations and import safety before broad interface work begins

If these checks are not complete, a visual redesign can hide real correctness problems.
