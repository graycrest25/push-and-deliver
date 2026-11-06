# Repository guide

PushNDeliver is a Next.js admin workspace backed by the documented Go/PostgreSQL API. Preserve the existing design context in PRODUCT.md and DESIGN.md.

- `npm run dev`, `npm run build`, `npm start`: Next.js, with webpack for builds/dev.
- `npm run typecheck`: TypeScript.
- `npm test`: Playwright with an isolated mock backend; no live mutations.
- `app/api/proxy/[...path]/route.ts` and `src/server/`: server-only fixed-origin proxy and explicit method/path allowlist.
- `src/lib/api.ts`: same-origin requests, session refresh and error handling.
- `src/features/admin/`: endpoint-specific screens and shared data/forms.
- `src/components/`, `src/index.css`: existing design system and workspace shell.
- `src/contexts/UserContext.tsx`: native session/profile identity and authoritative session isAdmin/adminType; fail closed when membership is missing or inconsistent.
- `src/router/`: preserved React Router URLs within the Next.js client boundary.

Never expose BASE_URL or session tokens in browser code. No proxy variable may use a NEXT_ prefix. Do not restore Firebase, Clerk, direct provider secrets or legacy Cloud Function contracts. Use docs/api-migration.md for current native support and gaps. admin-endpoints-reference.md describes the superseded standalone runtime; do not treat it as the native inventory. Monetary payloads use integer minor units; pagination is endpoint-specific. Keep mutation idempotency keys stable across unchanged retries.
