# School Connect Pro

SchoolPurse — a PWA for school administrators to manage students, send fee invoices, and communicate with parents via in-app notifications. Parents view balances, pay via mobile money (Paystack), and receive announcements.

## Stack

- TanStack Start (React 19) SSR app
- Vite + Tailwind CSS v4 + shadcn/ui
- Supabase (Postgres, Auth, RLS)
- TanStack Query

## Development

Requires [Bun](https://bun.sh).

```sh
bun install
bun run dev
```

Other commands:

```sh
bun run build      # production build
bun run lint       # eslint .
bun run format     # prettier --write .
```
