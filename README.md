# PushNDeliver admin workspace

Next.js hosts the existing React operations UI and a server-side proxy to the Go/PostgreSQL API.

## Run locally

```sh
npm install
# Set BASE_URL in .env using .env.example as a reference.
npm run dev
```

`BASE_URL` is server-only. Do not prefix proxy variables with `NEXT_` and do not expose them in Next.js config. Browsers call `/api/proxy/v2/auth/...` and allowlisted `/api/proxy/v1/...` routes; session credentials stay in HttpOnly cookies. Production requires an HTTPS API origin.

```sh
npm run typecheck
npm run build
npm start
```

Webpack is selected for both dev and build so the project works in environments that restrict Turbopack's helper process ports. React Router preserves existing workspace URLs inside a browser-only Next client boundary.

## Tests

```sh
npx playwright install chromium
npm test
```

Tests use an isolated mock API on port 4319 and Next.js on port 4320. Their private `ADMIN_TEST_BUILD=1` flag selects `.next-verification` so a normal dev preview can keep running. They exercise the native authentication contract, credential privacy, context headers, refresh recovery, logout, removed password-change controls, missing/non-admin membership, all four admin roles and the new dashboard workflows. Historical standalone fixtures are excluded from the native test run.

## API and deployment

- [Current native admin endpoint reference](../pnd-backend/docs/admin-api-update-reference.md)
- [Historical standalone endpoint reference](admin-endpoints-reference.md)
- [Upload lifecycle contract](uploads.md)
- [Migration mapping, missing endpoints and deployment notes](docs/api-migration.md)
- [Membership access](ADMIN_TYPES.md)
- [Design context](DESIGN.md)

Vercel must use the Next.js framework preset with no old `dist` output override. Configure `BASE_URL` separately for each environment. Firebase, Clerk and browser-side provider secrets are no longer used.

## Native runtime correction

Authentication now uses `/v2/auth/login`, `/session`, `/refresh` and `/logout`, with user account context and server-only opaque tokens. Password recovery uses the native reset-token contract. The signed-in change-password feature and its proxy routes have been removed; account security retains session sign-out controls.

The updated native session contract now supplies administrator membership. The dashboard uses `isAdmin` and `adminType` from `/v2/auth/session`, with fail-closed handling for older or inconsistent responses. The new native reference is integrated for release settings (both apps/platforms), all four admin roles, coupon campaigns/codes/signup processing, signup wallet funding, and support conversations. The 3 November update also integrates native account directories/details/exports, admin rides, fee and shipping catalogues, tariff child records, audit history, report coverage/rebuilds, and mobile settings creation/repair.

Optional Google administrator sign-in uses the native nonce challenge and token exchange. Configure server-only `GOOGLE_CLIENT_ID` (no NEXT_ prefix), authorize the dashboard origin in Google and allow the same audience in backend `GOOGLE_CLIENT_IDS`. Only the public OAuth audience is returned by `/api/auth/options`; BASE_URL and session credentials remain private.

For production, edit the **Web application** OAuth client in Google Cloud → Google Auth Platform → Clients and add `https://admin.pushndeliver.com` under **Authorized JavaScript origins**. For local development, also add `http://localhost` and `http://localhost:3000`. Use origins only, without `/login` or another path. The client must match `GOOGLE_CLIENT_ID`; adding a redirect URI alone does not authorize the JavaScript origin. Google's `The given origin is not allowed for the given client ID` error requires this provider setting. See [Google's setup guide](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

The first Google action loads the official Google button. Restart reloads the page so the SDK initializes once with a fresh nonce challenge; it does not replace an existing Google configuration in the same document.

Native reports, referrals/export, jobs/replay, shipment reads, manual withdrawals and asset uploads remain integrated. The login forgot-password option and signed-in change-password feature remain removed. See [remaining deployment and contract gaps](docs/api-migration.md#remaining-gaps-and-blockers) for shipment actions, historical screen reconciliation, attachment limitations and deployed verification. No private management key is exposed or used.
