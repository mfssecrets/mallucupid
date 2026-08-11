# MalluCupid

Creator platform for free/paid posts, messaging, and Razorpay unlocks.

**Live:** https://www.mallucupid.com  
**Stack:** React (Vite) + Supabase (Postgres, Edge Functions, Storage) + Razorpay + Resend  
**Frontend hosting:** Cloudflare Pages

## Local development

1. `npm install`
2. Create `.env.local` (not committed) with:
   - `VITE_AUTH_API_URL` → `https://rytulzgsuzgicmpvrrxn.supabase.co/functions/v1/auth` (no trailing slash)
   - Optional parity: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
3. `npm run dev` → http://localhost:3000

## Cloudflare Pages (production)

Required environment variables (Settings → Environment variables, Production + Preview):

| Variable | Value |
|---|---|
| `VITE_AUTH_API_URL` | `https://rytulzgsuzgicmpvrrxn.supabase.co/functions/v1/auth` |
| `NODE_VERSION` | `20` |

Optional parity (frontend never imports them, but mirrors old Amplify setup):
- `VITE_SUPABASE_URL` → `https://rytulzgsuzgicmpvrrxn.supabase.co`
- `VITE_SUPABASE_ANON_KEY` → Supabase anon key

Build: `npm run build` · Output: `dist`

## Backend (Supabase)

- Linked project: `rytulzgsuzgicmpvrrxn`
- Migrations: `npx supabase db push --linked --yes`
- Deploy API: `npx supabase functions deploy auth --no-verify-jwt --project-ref rytulzgsuzgicmpvrrxn`
- Server-side secrets set via `supabase secrets set` (see [DOCUMENTATION.md](./DOCUMENTATION.md) §1)
- Docs: [DOCUMENTATION.md](./DOCUMENTATION.md)

## Server-side secrets (Supabase Edge Function)

Set on Supabase Dashboard → Edge Functions → Secrets, NOT on Cloudflare:
`AUTH_SUPABASE_URL`, `AUTH_SERVICE_ROLE_KEY`, `AUTH_ANON_KEY`, `AUTH_RESEND_API_KEY`, `AUTH_EMAIL_FROM`, `AUTH_CORS_ORIGIN`, `AUTH_PUBLIC_APP_URL`, `AUTH_ADMIN_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.

## Roles

- **Creators** — `/login`, dashboard under `/:username`
- **Fans** — `/userlogin`, public pages `/:username#####`, inbox `/user-inbox`
- **Admins** — `/adminlogin`, dashboard `/admin{uuid}`
