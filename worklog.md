Worklog - Strict Rules

1. NEVER IMPLEMENT A TEMPORARY CONFIGURATIONS, ALWAYS PRODUCTION READY
2. NEVER REPLY WITH TOO MUCH EXPLANATIONS; RESPONSES MUST CONTAIN ONLY IMPORTANT MATTER IN POINTS, MAX 2 POINTS, AND MAX 250 CHARACTERS
3. NEVER USE LOCAL STORAGE; USE DATABASE ONLY EVERYWHERE
4. ALWAYS USE MINIMAL TOKENS; RESPONSES MUST BE TOKEN-EFFICIENT
5. NO ASSUMPTIONS: ALWAYS VERIFY WITH CODEBASE, DB, FUNCTIONS, AND CONFIG — ONLY HARD TRUTHS
6. READ `/workspaces/MALLU-CUPID/DOCUMENTATION.md` BEFORE EVERY TASK
7. UPDATE `/workspaces/MALLU-CUPID/DOCUMENTATION.md` AFTER EVERY CHANGE WITH VERY SHORT POINTS
8. READ AND FOLLOW THESE STRICT RULES BEFORE EVERY SINGLE TASK (COMPULSORY)

---
Notes:
- Worklog file must be consulted at task start.
- Any agent or collaborator must follow these rules exactly.

---
Task: 2026-08-11 — Cloudflare migration + secrets + RLS review + 3D home redesign + backend deploy

Changes:
- Frontend hosting switched from AWS Amplify to Cloudflare Pages (build: `npm run build`, output: `dist`).
- Supabase secrets set server-side: `AUTH_ADMIN_SECRET` (new, strong random), `AUTH_PUBLIC_APP_URL`, `AUTH_CORS_ORIGIN` (now `https://www.mallucupid.com,https://mallucupid.com`). All 11 other secrets already present.
- RLS: all 23 user-data tables already have RLS enabled across migrations 004–025; `anon`/`authenticated` PostgREST grants revoked on sensitive tables. No new migration added.
- Home page (`/`) redesigned with 3D / glassmorphism: `src/index.css` (perspective, glass, mesh, keyframes), `Hero`, `HowItWorks`, `CommunityCTA`, `SeoSection`, `Header`, `Footer`. Content unchanged.
- DB migrations: `supabase db push --linked --yes` — remote already up to date.
- Edge function `auth` redeployed. Smoke test: `GET /session` → 200; CORS preflight from `https://www.mallucupid.com` → 204 with credentials.
- `DOCUMENTATION.md` §1 expanded (Cloudflare env vars, full secrets table, ops commands); §9 RLS coverage list added; new §11 documents the 3D system.
- `README.md` rewritten for Cloudflare + current env-var list.

Frontend env vars required on Cloudflare Pages: `VITE_AUTH_API_URL`, `NODE_VERSION`.

---
Task: 2026-08-11 — Watermark identity fix (email -> username) + anti-debug hardening

Changes:
- Backend (`supabase/functions/auth/index.ts`): added `getProfileUsername(userId)` that fetches `profiles.username` for creators; `userWithRole()` now injects `username` into `user_metadata` (creators get profile username, fans get empty string and fall back to `name`).
- Frontend watermark source changed from `user?.email || user?.id` to `user?.user_metadata?.username || user?.user_metadata?.name || "MalluCupid"` in `MediaViewerPage.tsx`, `ChatPage.tsx`, `ExclusiveMediaViewerPage.tsx`.
- `ExclusiveMediaViewerPage.tsx` upgraded: was using raw `<img>`/`<video>` with no watermark; now uses `SecureImage`/`SecureVideo` + `CaptureShield` + `useCaptureDeterrent` like the other viewers.
- New file `src/lib/antiDebug.tsx` exporting `useAntiDebug()` hook + `DevtoolsBlocker` overlay. Layers: context-menu block (except inputs), F12/Ctrl+Shift+I/J/C/Cmd+Opt+I/J/C/Ctrl+U block, `debugger;` trap (1.5s interval), devtools detection via window-size delta + console.log timing, console.log/info/debug/trace neuter, app-wide user-select + image-drag lock, beforeunload on `view-source:`/`javascript:`. Active only in production (`import.meta.env.PROD`).
- `App.tsx` wraps the route tree in `AntiDebugShell` which calls `useAntiDebug()` and renders `<DevtoolsBlocker open={devtoolsOpen} />` at z-9999.
- Edge function `auth` redeployed.
- `DOCUMENTATION.md` §9 expanded: new §9.1 (watermark identity) and §9.2 (anti-debug).

---
Task: 2026-08-11 — 3% platform-fee payment dialog + Razorpay live streaming end-to-end

Root cause of "failed to start payment, try again":
- handlePostCheckout fires that error when RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET
  Supabase secrets are missing (503) or Razorpay rejects the order (502).
- Both secrets are now set server-side + a webhook secret is configured.

Changes:
- migrations 027 (platform-fee cols on post_purchases + exclusive_room_subscriptions),
  028 (live_streams, live_stream_bookings, live_stream_gift_catalog seeded with 16 gifts,
       live_stream_gifts, live_stream_viewers, live_stream_chat), 029 (backfill fix).
- backend: computePlatformFeeBreakdown() — server-side only. handlePostCheckout,
  handleExclusiveRoomCheckout return full breakdown. 16 new /live-stream* endpoints.
  Webhook now recovers live_stream_bookings + live_stream_gifts orders.
- frontend: PaymentDialog (content type / name / amount / 3% platform charge /
  final amount / Pay Now → Razorpay), PaymentResultScreen (success/failed + retry),
  ScheduleStreamModal, LiveStreamPage (mute, comments on/off, camera flip, gifts via
  Razorpay, chat, viewer heartbeat, more-panel for creators).
- DashboardPage: Live button next to New post → dropdown (Start Live Now / Schedule My Live).
- App.tsx: registered /live/:publicId route.
- supabase/.temp/ added to .gitignore.

Deployments:
- DB migrations pushed (`supabase db push --linked --yes`).
- Razorpay secrets set via Supabase Management API (HTTP 201):
  RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET.
- Edge Function `auth` redeployed. Smoke tests: /session 200, /live-stream/gift-catalog
  returns 16 gifts, CORS preflight 204, unknown route 404, auth route 401 without cookie.
- Git: pushed to origin/main (commit 494e210).

Razorpay webhook (still to be registered manually on Razorpay dashboard):
  URL:    https://rytulzgsuzgicmpvrrxn.supabase.co/functions/v1/auth/razorpay-webhook
  Secret: mc_3a356e74d967c5f277dcb9d750cc4c175f7d407e2bef790f
  Events: payment.captured, payment.failed, order.paid, refund.processed
