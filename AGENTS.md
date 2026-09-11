# AGENTS.md

## Stack & layout

- TanStack Start (React 19) SSR app — **not** Next.js/Remix. Vite, Tailwind v4, shadcn/ui (new-york), Supabase, TanStack Query.
- Package manager is **bun** (`bun.lock`, `bunfig.toml`); ignore README's `npm i` boilerplate.
- App name: "SchoolPurse" — a PWA for school fee billing + parent communication. Money is Ghana cedis.
- `src/lib/school.server.ts`, `paystack.functions.ts`, `school.functions.ts` are the backend logic; `supabase/migrations/` is the DB schema.

## Commands

```sh
bun install
bun run dev        # vite dev server
bun run build      # production build
bun run lint       # eslint .
bun run format     # prettier --write .
```

- No `test` or `typecheck` script exists. `bun run build` does not typecheck; use `bunx tsc --noEmit` to verify types (tsconfig has `noEmit`).
- `bunfig.toml` sets a 24h supply-chain guard: packages published <24h ago are skipped.

## Routing (TanStack Start file-based)

- Routes live in `src/routes/`. `routeTree.gen.ts` is **generated — never edit it**.
- The only root layout is `src/routes/__root.tsx`; preserve its `<Outlet />`.
- Do NOT create `src/pages/`, `app/layout.tsx`, or `_app/` — Next.js/Remix conventions. Splat params are read via `_splat`, dynamic segments are bare `$id` (no curly braces). See `src/routes/README.md`.
- Public API routes use `Route = createFileRoute("...")` with a `server.handlers` block (e.g. `src/routes/api/public/paystack-webhook.ts`).

## Server vs client code

- `*.server.ts` modules are server-only (importable server-side only).
- `*.functions.ts` (`createServerFn`) **ship to the client bundle** — so dynamic-import server-only modules *inside* the handler (`await import("@/lib/school.server")`, `await import("@/integrations/supabase/client.server")`), never top-level.
- `supabaseAdmin` (service role, bypasses RLS) is server-only; load it with `await import(...)`. `supabase` (from `@/integrations/supabase/client`) is the RLS-scoped client.
- ESLint forbids importing `server-only`; use `.server.ts` naming or `@tanstack/react-start/server-only`.

## Auth

- Server functions use `createServerFn(...).middleware([requireSupabaseAuth])`; context exposes `context.supabase`, `context.userId`, `context.claims`.
- `attachSupabaseAuth` (registered in `src/start.ts`) attaches the bearer token to serverFn calls — don't remove it or RPC auth breaks.
- Roles (`admin` | `parent`) come from the `user_roles` table, not the profile. Admin checks go through `assertAdmin` / `has_role()` RPC. `useAuth()` in `src/hooks/useAuth.ts` reads role client-side.

## Do-not-edit (auto-generated)

- `src/integrations/supabase/types.ts`
- `src/routeTree.gen.ts`

## Conventions & gotchas

- **Money is integer pesewas** (GHS minor units) — never floats. Use `formatGhs` / `toPesewas` from `src/lib/money.ts`.
- Paystack: checkout is created server-side (`paystack.functions.ts`); the webhook (`api/public/paystack-webhook.ts`) is what marks invoices paid via HMAC-SHA512 signature, never the browser redirect.
- `vite.config.ts` wires TanStack Start manually — the `tanstackStart()` plugin (from `@tanstack/react-start/plugin/vite`) must come before `@vitejs/plugin-react`.
- Supabase env: client uses `VITE_SUPABASE_*` (`import.meta.env`), server uses `process.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY`).
- tsconfig is `strict` with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` — index access may be `undefined`.
