This is a Supabase-backed Next.js esports league management application for seasons, events, matches, standings, imports, and admin operations.

## Project documentation

Before making changes, review the project docs in this repository:

- [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md)
- [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)
- [docs/STANDINGS_RULES.md](docs/STANDINGS_RULES.md)
- [docs/TODO.md](docs/TODO.md)
- [docs/ARCHITECTURE_REVIEW.md](docs/ARCHITECTURE_REVIEW.md)
- [docs/API_PATTERNS.md](docs/API_PATTERNS.md)
- [docs/SQL_CONVENTIONS.md](docs/SQL_CONVENTIONS.md)
- [docs/CHANGELOG.md](docs/CHANGELOG.md)
- [docs/STANDINGS_ARCHITECTURE.md](docs/STANDINGS_ARCHITECTURE.md)

## Pre-UX technical debt summary

The project has reached a usable operational state, but the most important follow-up work is not a visual redesign. The team should finish the following before expanding the UI:

- centralize standings and season-selection logic
- keep scoring configuration as the source of truth across pages
- harden delete and cleanup workflows for matches and events
- reduce route-local duplication in admin and standings flows
- document schema and import changes before broad UX refinements

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
