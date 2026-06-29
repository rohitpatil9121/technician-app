# Oasis Globe — Technician App

A mobile-first PWA for field technicians of the Oasis Globe service centre.
Built per [`SPEC.md`](SPEC.md); fits the wider platform in
[`../docs/PLATFORM_VISION.md`](../docs/PLATFORM_VISION.md).

> **Status:** **wired to the real backend.** Two modes:
> - **Live** — log in with a technician's phone + WhatsApp **OTP**. The app then
>   reads/writes real tickets via `/api/tech/*` (see `../backend/src/routes/tech.js`).
> - **Demo** — the **Demo Login** button runs on sample/mock data, no backend
>   needed (handy for showing the flow).

## One-time backend setup
1. Run the migration in the Supabase SQL Editor:
   [`../backend/db/phase4_technician_app.sql`](../backend/db/phase4_technician_app.sql)
   (adds `tickets.tech_work` JSONB + `users.is_online`).
2. Restart the backend so it picks up the new `/api/tech/*` routes.
3. Make sure there's a `users` row with `role = 'technician'` and a WhatsApp
   phone, with one or more tickets **assigned** to them (assign from the
   dashboard). Log in with that phone to see real jobs.

## Stack
React 18 · Vite · Tailwind CSS · React Router (plain JSX), matching `frontend/`.
Packaged as an Android app via **Capacitor**.

## Android APK
A ready-to-install debug APK is built at **`Oasis-Technician.apk`**.

**Install on a phone:** copy the APK to the phone (WhatsApp-to-self / Drive /
USB), open it, allow "install from unknown apps" if prompted, install, open.

- **Demo Login** works fully offline (mock data) — no backend needed.
- **Real jobs (live):** the APK is built to talk to the backend at the URL baked
  in via `VITE_API_BASE` (currently the dev PC's LAN IP `http://192.168.1.36:3000`).
  Keep the phone on the **same Wi-Fi**, run the backend on the PC, then log in
  with a real technician's phone (OTP arrives on their WhatsApp).

**Rebuild the APK** (after code changes or if the PC's IP changed):
```bash
bash technician-app/build-apk.sh                 # uses the default LAN IP
bash technician-app/build-apk.sh http://NEW-IP:3000
```
Requires the Android SDK at `C:/Android/Sdk` and JDK 17 at
`C:/Android/jdk17-tmp/...` (already set up). It's a **debug** APK (debug-signed) —
fine for sideloading/testing; a Play Store release needs a signed release build.

## Run it

```bash
cd technician-app
npm install
npm run dev
```

Open the **Local** URL (`http://localhost:5174`) in your browser.

### See it on your phone
The dev server is exposed on the local network (`host: true`). With your phone on
the **same Wi-Fi**, open the **Network** URL that Vite prints, e.g.
`http://192.168.1.36:5174`. For the real app feel, use the browser's
**"Add to Home screen"** — it installs as a standalone PWA (manifest + icon
included).

Tip: in Chrome desktop, open DevTools → device toolbar (phone icon) to preview at
phone width.

## What's implemented
- **Login** (mobile + OTP, plus **Demo Login** to jump straight in)
- **Home** — today's jobs in sections (pending / today / completed / repeat calls /
  escalations), stats, online toggle
- **Job detail** — the full **9-step workflow**:
  Accept → Travel → Arrive → Diagnose → Estimate → Approval → **Work Done** →
  Payment → Close, including the post-repair **final output TDS + new/old part
  photos**, split payments, and the close/incentive screen
- **My Reviews** — ratings, categories, recent feedback
- **Help** — contacts, issue guide, customer scripts

## Structure
```
src/
  data/mock.js          sample jobs, parts catalog, reviews, help content
  store/JobsContext.jsx  in-memory job state + workflow advancement
  lib/workflow.js        the 9-step definition + status mapping
  lib/format.js          currency/date helpers
  components/            ui.jsx (primitives, icons, stepper, nav), AppHeader, JobCard
  screens/               Login, Home, JobDetail, Reviews, Help
```

## How the backend integration works
- **Auth:** reuses the platform's WhatsApp OTP (`/api/auth/otp/*`). Technicians are
  `users` with `role = technician`.
- **Jobs:** `GET /api/tech/jobs` returns the logged-in technician's assigned
  tickets (bucketed). Each workflow step is `POST /api/tech/jobs/:id/step`
  `{ action, work }`; the server stamps `tech_work`, advances the coarse status,
  and the dashboard reflects it live.
- **Minimal customer messaging (owner rule):** only **3** WhatsApp messages —
  *on the way*, *estimate sent*, and *closed* (the platform's existing
  completion + rating message, reused). Other steps are internal.
- All the rich step data lives in the single `tickets.tech_work` JSONB column.

Frontend integration points: `src/lib/api.js` (client), `src/store/JobsContext.jsx`
(live/demo modes). Backend: `backend/src/routes/tech.js` +
`backend/src/services/techJobs.js`.
