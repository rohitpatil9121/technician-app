# Technician App — Build Spec

> A mobile-first field app for service technicians. It is the **third surface** of
> the Oasis Globe platform, alongside the **WhatsApp intake** (customer side) and the
> **Manager dashboard** (`frontend/`, manager side). The technician drives a job
> through its full on-site lifecycle here; every step fires the right WhatsApp
> message to the customer and keeps the office in sync.
>
> Reference prototype (Lovable): branded **"AquaFix — Technician App"**.
> Use the Oasis Globe brand when building; "AquaFix" is just the prototype label.

This document is the source of truth for building the app in this folder
(`technician-app/`). It is written from a thorough walkthrough of the prototype.

---

## 1. What this app is

A technician (e.g. *Ramesh Patil*) logs in on their phone and sees the jobs
assigned to them for the day. They open a job and walk it through a strict
**8-step workflow** — accept → travel → arrive → diagnose → estimate → get
approval → collect payment → close. At each step the system auto-notifies the
customer on WhatsApp and logs a timestamp. The app also gives the technician
their **ratings/reviews**, an **incentive** nudge, and a **help/playbook**
section.

**Domain:** RO / water-purifier service (filters, membranes, pumps, TDS, AMC,
warranty). The same business already runs WhatsApp intake + a manager dashboard;
this app is what the field staff use.

**Model — service centre, not a marketplace.** Technicians are **employees** of
the service centre; a **Service Manager** centrally **assigns** jobs and sets the
visit slot. Technicians do **not** browse or bid for jobs (not independent /
Urban-Company-marketplace) — they execute what's assigned. The product goal is
Urban-Company-level **trust and polish** at small scale, with a great experience
for the customer, the technician, the manager, and the owner. See the
cross-role picture in [`../docs/PLATFORM_VISION.md`](../docs/PLATFORM_VISION.md).

**Design intent (owner constraint):** keep customer messaging minimal and
non-duplicated. The app sends *one* clean system message per milestone — never
spam the customer.

### Platform
- **Mobile-first PWA**, fixed narrow column (~380–420px), designed for one-hand
  phone use. Large tap targets, bottom nav, sticky primary action button.
- Installable to home screen; works on a flaky field connection (offline-tolerant
  where feasible — see §11).

---

## 2. Where it fits (system context)

```
                        ┌─────────────────────────┐
  Customer (WhatsApp) ──┤  WhatsApp intake + bot   │
                        └───────────┬─────────────┘
                                    │ creates / updates ticket
                                    ▼
                        ┌─────────────────────────┐
                        │   Backend (Express +     │
   Manager (dashboard) ─┤   Supabase/Postgres)     │
                        └───────────┬─────────────┘
                                    │ assigns ticket to a technician
                                    ▼
                        ┌─────────────────────────┐
   Technician (THIS) ───┤   Technician App (PWA)   │
                        └─────────────────────────┘
```

- A **job** in this app == a **ticket** in the backend (`tickets` table) that has
  been assigned to the logged-in technician.
- Parts come from the existing **`stock_items`** catalog; parts used on a job are
  recorded against **`stock_issues` / `stock_issue_lines` / `stock_movements`**.
- Ratings map onto **`tickets.rating`** (already exists) plus per-category review
  data (new).
- The "Create a lead?" upsell relates to the existing **`lead_source`** stream.

> Reuse the backend that already exists. This app is mostly **new screens + new
> API endpoints + a few new columns/tables**, not a new system.

### 2.1 Linked to the existing website (hard requirement)

This app is **not standalone** — it is wired into the same running platform as the
existing website (manager dashboard + backend). One system, one database, one
source of truth.

- **Same backend & same Supabase/Postgres DB.** No separate datastore. A job here
  *is* a row in the existing `tickets` table; the app reads/writes the same data
  the dashboard and WhatsApp flows use.
- **Same auth.** Technicians are rows in the existing `users` table
  (`role = technician`); OTP login uses the platform's existing auth. No new
  user system.
- **Bidirectional, near-real-time sync:**
  - Manager **assigns** a ticket to a technician in the dashboard → it appears in
    that technician's **Today's Jobs** automatically.
  - Technician advances a step (accept/arrive/diagnose/estimate/pay/close) →
    the ticket status, timestamps, parts, payment and rating update on the
    **same record**, so the **dashboard reflects it live** and the audit/activity
    log (`ticket_events`) is appended.
  - The estimate-approval channel can hand off to the **Service Manager** on the
    dashboard, and a manager approval flows back into the technician's job.
- **Same notification outbox/worker.** Every milestone WhatsApp message goes
  through the platform's existing notifications pipeline (still exactly one
  message per milestone — no duplication).
- **Shared deployment / linking.** Ship under the same project (e.g. a
  `/tech` route or a `tech.` subdomain of the existing site) pointing at the
  **same API base**. The dashboard should link out to the technician app where
  relevant, and vice-versa. Keep CORS/auth config consistent so both surfaces
  use the same token.

> Net: building this app must **not** fork the data or the auth. It plugs into the
> existing website's backend and shares its tickets, users, parts, notifications
> and audit trail.

---

## 3. Users & roles

| Role | Uses this app? | Notes |
|---|---|---|
| **Technician** | ✅ primary | Sees only their own assigned jobs. |
| Service Manager | ➖ | Can approve estimates on the technician's behalf (channel in the app). Otherwise uses the dashboard. |
| Customer | ❌ | Interacts only via WhatsApp. |
| Owner | ❌ | Dashboard. |

Auth is **phone number + OTP** (matches the existing platform's OTP auth). A
**"Demo Login (Prototype)"** button bypasses auth for demos/testing.

---

## 4. Tech stack

Match the existing `frontend/`:
- **React + Vite + Tailwind CSS**, component primitives in the shadcn/ui style
  (the prototype is built this way).
- Client-side routing (React Router).
- Auth token (JWT) in storage; `Authorization: Bearer` on API calls.
- PWA manifest + service worker.
- State: lightweight (React Query for server state is a good fit given the
  job-status polling/refetch needs).

---

## 5. Design system

Pulled from the prototype; align with `docs/DESIGN.md` where it exists.

**Color**
- Primary brand **blue** gradient (hero banners, primary buttons) — approx
  `#1A8FE0 → #0E6FC4`.
- **Green** for positive/secondary actions and "free"/success states (e.g. the
  *Maps* button, "Free" visit charge, completion check, approved).
- **Red** for destructive/urgent (Reject, Rejected, Emergency, URGENT badge).
- **Amber/orange** for warnings & "needs attention" (high-priority, repeat,
  "Important" callouts, lower ratings).
- Neutral grey surfaces; white job cards with subtle borders/shadow.

**Status / tag color language**
- Lifecycle status pills (top-right of job detail): NEW, ACCEPTED, ON THE WAY,
  ARRIVED, DIAGNOSED, ESTIMATE SENT, VERIFIED, PAID, CLOSED — each a soft tinted
  pill.
- Job tags: `No AMC`, `AMC Active`, `Warranty`, `Warranty Active`, `High
  Priority`, `Urgent`, `Payment Pending`, `Repeat Complaint`, `Senior Citizen`,
  `Estimate Sent` — small rounded chips, color-coded by meaning (warranty/AMC =
  blue/green info; priority/urgent/repeat = amber/red).

**Type & layout**
- Bold section headers in ALL-CAPS small labels (`TODAY'S JOBS`, `WHAT CUSTOMERS
  RATED YOU ON`).
- Cards with rounded corners (~12–16px), generous padding.
- Sticky bottom **primary action** button per workflow step.
- **Bottom tab nav:** Home · (Reviews) · Help. (Reviews is reached from the
  job-close screen and/or a tab — see §6.5.)

---

## 6. Screens

### 6.1 Login
- Header: brand logo + "Technician App", title **"Technician Login"**,
  subtitle "Login with your registered mobile number".
- **Mobile Number** input (placeholder `98220 11223`).
- **Send OTP** primary button → OTP entry → verify → home.
- `OR` divider → **Demo Login (Prototype)** secondary button.
- Footer: "Need help? Call Service Manager: +91 90000 11222".

### 6.2 Home / Today (job list)
Top bar:
- Date (e.g. `Sun, 28 Jun`), technician name + ⭐rating (e.g. `Ramesh Patil ⭐4.7`).
- **Online/Offline toggle** (availability), wifi/connection indicator,
  **notification bell** (with unread dot).

Hero banner (blue gradient):
- Greeting `Namaste 🙏 Ramesh, ready for today? ⭐4.7`.
- Three stat tiles: **Pending**, **Today**, **Done today** (counts).

Job sections (each a vertical list of **job cards**):
1. **PENDING FROM PREVIOUS DAYS** — carried-over jobs.
2. **TODAY'S JOBS** — today's scheduled jobs.
3. **COMPLETED TODAY** — closed today (empty state: "None closed yet today").
4. **REPEAT CALLS (WITHIN 10 DAYS)** — flagged repeat visits; each notes
   *"No charge: customer not billed again within 10-day window."*
5. **ESCALATIONS** — urgent/repeat items needing attention, with a *View
   escalations →* link.

**Job card** contents:
- Customer name + status badge (NEW / ESTIMATE SENT / …).
- Location (area) · time (or "Yesterday 4:00 PM" / "2 days ago").
- Issue summary (e.g. "Low water flow from purifier").
- Purifier model (e.g. "Kent RO Grand Plus").
- Tags row (No AMC / High Priority / Payment Pending / Warranty Active / …).
- **Visit charge** indicator (`₹250` or `Free`).
- Actions: **Call** · **Maps** · **Open** (Open → job detail).

### 6.3 Job detail + workflow (the core screen)
A persistent header shows customer name, job id (e.g. `J-1002`), purifier model,
and the live **status pill**. Below it, a horizontal **stepper**:

`Accept → Travel → Arrive → Diagnose → Estimate → Approval → Work Done → Payment → Complete`

Completed steps show a green check; the current step is highlighted. Always-present
context cards: **address + Call Customer / Open Maps**, and **Issue & Purifier**
(issue text, model, "Last service: <date>"). The body and the sticky bottom
button change per step — see **§7** for the full state machine.

### 6.4 Help & Support
- Quick contacts: **Service Manager**, **Office** (tap to call).
- **Emergency Support** banner — "Field accident, dispute, theft" + **Call**.
- **COMMON ISSUE GUIDE** — collapsible troubleshooting: Low Flow, Bad Taste,
  Leakage, No Water.
- **WHAT TO SAY TO CUSTOMER** — script playbook (collapsibles):
  - How to explain the visit charge
  - How to explain TDS reading
  - How to ask for estimate approval
  - How to handle an angry customer
  - How to explain feedback request

### 6.5 My Reviews
- Hero: **average rating** (⭐4.7) + tiles: This Week, Jobs Rated, 5★ jobs.
- **Top Rating Streak** vs **Needs Improvement** mini-cards.
- **WHAT CUSTOMERS RATED YOU ON** — per-category scores: Polite & friendly
  behaviour, First-time fix success, On-time arrival, Job done properly, Clear
  communication.
- **RECENT FEEDBACK** — customer name + stars + comment.
- Growth nudge: *"Push your rating to 4.8★ — Better ratings unlock higher
  incentives automatically."*

### 6.6 Notifications
Bell in the top bar (unread dot). Job-assignment / approval / reminder feed.
(Lightweight; can ship as a simple list in v1.)

---

## 7. Job lifecycle (state machine)

Status progression and the action that advances it:

| # | Step | Status after | Advancing action | What the system does automatically |
|---|---|---|---|---|
| 1 | **Accept** | `ACCEPTED` | **Accept Job** (or Reject) | Notify customer of acceptance · start ETA window · log timestamp |
| 2 | **Travel** | `ON THE WAY` | **I'm On The Way** | Send WhatsApp ETA to customer · start ETA/live tracking · log on-the-way timestamp |
| 3 | **Arrive** | `ARRIVED` | **Mark Arrived** | Capture GPS (location pin + arrival time) as proof of visit. *Diagnosis is blocked until arrival is marked.* |
| 4 | **Diagnose** | `DIAGNOSED` | **Submit Diagnosis** | Save diagnosis form (see §7a). Required: issue type(s) + TDS readings. |
| 5 | **Estimate** | `ESTIMATE SENT` | **Send Estimate for Approval** | Build & send the bill estimate. |
| 6 | **Approval** | `VERIFIED` (approved) / rejected path | **Approved** / **Rejected** (+ Send Estimate via WhatsApp) | Estimate sent on WhatsApp; manager may approve if customer can't. *If rejected → collect visit charge only, then payment.* |
| 7 | **Work Done** | `WORK_DONE` | **Confirm Work Done** | After the repair: enter the machine's **final output TDS** + upload **photos of the new parts installed and the old/used parts removed** (proof of genuine parts + real work). |
| 8 | **Payment** | `PAID` | **Confirm Payment** | Record split payment (UPI/Cash/Card) until reconciled to ₹0 remaining. |
| 9 | **Complete** | `CLOSED` | **Close Job** | Payment confirms work done; capture next-service interval + optional lead. Shows success + incentive impact. |

Reject at step 1, or Rejected estimate at step 6, are alternate branches (the
rejected estimate skips Work Done and routes to a *visit-charge-only* payment).

### 7a. Diagnose form (step 4)
- **A. Issue type** — multi-select chips (REQUIRED): Low Flow, No Water, Leakage,
  Bad Taste, Noise, Electrical Issue, Service Due, Filter Issue, Pump Issue,
  Membrane Issue.
- **B. TDS Readings** (REQUIRED, *mandatory before estimate*): **Input TDS** &
  **Output TDS** numeric fields.
- **C. Parts required** — select from the parts catalog and add (each added part
  becomes an estimate line). Parts list (from `stock_items`): Sediment Filter,
  Carbon Filter, RO Membrane, Pump, SV, Adapter, UV Lamp, Tubing, Connector, …
- **D. Photos** — three upload slots: **Before**, **Damage**, **Old Part**.
- **E. Technician note** — free text + **Voice** note input.

### 7b. Build estimate (step 5)
- **Charge type** — pick exactly one (fixed, non-editable amounts):
  - Service Charge **₹400**
  - Visit Charge **₹250**
  - No Visit Charge (Under Warranty) **Free**
  - Repeat Call (within 10 days) **Free**
- **Parts** — each added part with an **editable price** (defaults from catalog,
  e.g. RO Membrane ₹1800).
- **Bill summary** — charge line + parts lines → **Parts total** → **Grand total**.
- Lock note: *"Charge types are fixed. Customer approval is required before any
  paid repair."*

### 7c. Approval (step 6)
- **Approval channel:** **WhatsApp** (system-sent message to customer) or
  **Service Manager** (if customer can't respond).
- **Send Estimate via WhatsApp**, then mark **Approved** / **Rejected**.
- Rejected → "collect visit charge only and proceed to payment".

### 7d. Work done — verify & proof (step 7)
After the customer approves and the technician completes the repair, capture
proof-of-work **before** taking payment:
- **Final Output TDS (from machine)** — REQUIRED numeric reading taken *after* the
  repair (shows the water is now clean; distinct from the pre-repair reading at
  diagnosis). Display before → after for a clear improvement story.
- **Photos of parts** — REQUIRED:
  - **New part(s) installed** (proof of genuine new parts), and
  - **Old / used part(s) removed**.
  One pair per part used; ties to the parts added at diagnosis/estimate.
- **Confirm Work Done** → advances to Payment. (Skipped on the rejected-estimate /
  visit-charge-only branch.)

### 7e. Collect payment (step 8)
- Bill recap: charge line + Parts + **Total bill**; live **Collected** vs
  **Remaining**.
- **Add payment** — method tabs **UPI / Cash / Credit Card**, amount (Up to
  remaining) + **Add**. UPI shows a **"Show QR to customer for ₹X"** card.
- **Reconciliation** list of added payments; "Bill fully collected" when
  remaining = ₹0. Supports **split** across methods.
- **Confirm Payment** (enabled once a payment is added).

### 7f. Work summary + close (step 9)
- **Summary:** issue, amount, payment modes, final output TDS, **Next service**
  interval (e.g. 6 months).
- **Create a lead?** toggle — *"Customer wants new purifier or special part?
  Manager will follow up."* (feeds the lead stream).
- **Close Job** → **"Job Closed Successfully"** screen with green check, customer
  + area, and an **Incentive impact** note (*"Good rating + no repeat complaint
  can increase your incentive this week."*). CTAs: **Back to Jobs** · **My
  Reviews**.

---

## 8. Business rules

- **Arrival gates diagnosis.** Cannot diagnose before `Mark Arrived` (GPS proof).
- **TDS mandatory before estimate.** Input & Output TDS required to proceed.
- **One charge type per job**, amounts fixed; only **part prices** are editable.
- **Customer approval required before any paid repair.** No paid work proceeds on
  an un-approved estimate.
- **Free-visit logic:**
  - Under warranty / AMC active → **No Visit Charge (Free)**.
  - **Repeat call within 10 days** → **Free** ("customer not billed again within
    10-day window"). Surfaces in the *Repeat Calls* home section.
- **Rejected estimate** → collect **visit charge only**, then close.
- **Payments may be split** across UPI/Cash/Card; must reconcile to ₹0 remaining
  before **Confirm Payment**.
- **Incentives** are driven by ratings + low repeat-complaint rate (display-only
  nudges in this app; calculation is a backend/manager concern).
- **Minimal customer messaging:** exactly one system WhatsApp message per
  milestone, no duplicates (platform-wide owner rule).

---

## 9. Data model (additions)

Most of this maps to existing tables; new fields/tables are marked **NEW**.

**`tickets`** (existing — job): reuse `customer`, `issue_description`, model,
`status`, `assigned_technician_id`, `scheduled_start/end`, `rating`,
`lead_source`. Add **NEW** technician-workflow fields:
- `tech_status` (NEW/ACCEPTED/ON_THE_WAY/ARRIVED/DIAGNOSED/ESTIMATE_SENT/
  VERIFIED/WORK_DONE/PAID/CLOSED) — finer-grained than the dashboard's coarse
  status; or extend the existing status enum.
- `accepted_at`, `enroute_at`, `arrived_at`, `diagnosed_at`, `estimate_sent_at`,
  `approved_at`, `work_done_at`, `paid_at`, `closed_at` timestamps.
- `arrival_lat`, `arrival_lng` (GPS proof).
- `tds_input`, `tds_output` (pre-repair reading at diagnosis),
  `tds_output_final` (post-repair reading at Work Done).
- `charge_type`, `charge_amount`.
- `next_service_interval`.
- `is_repeat`, `repeat_within_days`, `is_free_visit` (derived/flag).
- `approval_channel`, `approval_status`.

**`job_issues`** (NEW) — selected issue-type chips per ticket (many-to-one).

**`job_photos`** (NEW) — `ticket_id`, `kind`
(BEFORE/DAMAGE/OLD_PART — diagnosis; NEW_PART_INSTALLED/USED_PART_REMOVED — work
done), `url`, optional `stock_item_id` to tie a part photo to the part used.

**`job_notes`** (NEW) — text + optional voice-note url.

**Parts** — reuse `stock_items` (catalog + price) and record usage via
`stock_issues` / `stock_issue_lines` / `stock_movements` (CONSUME on close).

**`payments`** (NEW) — `ticket_id`, `method` (UPI/CASH/CARD), `amount`,
`created_at`. Sum must equal the approved total (or visit charge if rejected).

**Reviews** — reuse `tickets.rating`; add **NEW** `job_reviews` for per-category
scores + free-text comment, or compute category aggregates server-side.

**`leads`** (NEW or reuse lead stream) — created when "Create a lead?" is on.

---

## 10. API surface (new endpoints)

All under `/api/`, JWT-authenticated, **scoped to the logged-in technician**.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/otp/request` · `/verify` | Technician OTP login (reuse platform auth) |
| GET | `/api/tech/jobs` | Job buckets: pending / today / completed / repeat / escalations |
| GET | `/api/tech/jobs/:id` | Full job detail + current step/status |
| POST | `/api/tech/jobs/:id/accept` · `/reject` | Step 1 |
| POST | `/api/tech/jobs/:id/enroute` | Step 2 (I'm On The Way) |
| POST | `/api/tech/jobs/:id/arrive` | Step 3 (body: lat/lng) |
| POST | `/api/tech/jobs/:id/diagnose` | Step 4 (issues, tds, parts, photos, note) |
| POST | `/api/tech/jobs/:id/estimate` | Step 5 (charge_type, part prices) |
| POST | `/api/tech/jobs/:id/estimate/send` | Step 6 send via WhatsApp |
| POST | `/api/tech/jobs/:id/approval` | Step 6 approved/rejected |
| POST | `/api/tech/jobs/:id/payments` | Step 7 add a split payment |
| POST | `/api/tech/jobs/:id/close` | Step 8 (next_service, create_lead) |
| GET | `/api/tech/parts` | Parts catalog (`stock_items`) |
| GET | `/api/tech/reviews` | Reviews/ratings + categories + recent feedback |
| GET | `/api/tech/notifications` | Notification feed |
| PATCH | `/api/tech/availability` | Online/offline toggle |

Each state-advancing endpoint also triggers the milestone **WhatsApp message**
through the existing notification outbox/worker — exactly one per milestone.

---

## 11. Non-functional

- **Mobile performance** on mid-range Android; minimal JS, lazy-load non-home
  routes.
- **Field connectivity:** queue the current step's submit and retry on
  reconnect; never lose a diagnosis/payment because of a dropped signal.
- **GPS permission** prompt handled gracefully at the Arrive step.
- **Camera/upload** for the three photo slots; compress before upload.
- **Voice note** capture for the technician note.
- **Accessibility:** large tap targets, readable contrast, works one-handed.

---

## 12. Out of scope (v1)

- Manager-side approval UI (lives in the dashboard).
- Incentive *calculation* engine (app only displays nudges).
- Inventory management (uses existing stock; full stock UI is the manager's).
- Multi-language UI (prototype is English; Hindi/Marathi can come later).
- In-app chat/calling (uses the device dialer + WhatsApp).

---

## 13. Build checklist

- [ ] Scaffold Vite + React + Tailwind PWA in `technician-app/`.
- [ ] Auth (OTP) + Demo Login.
- [ ] Home job list (5 sections, job card, stats, online toggle, bell).
- [ ] Job detail shell (header, stepper, address + issue cards).
- [ ] Implement the 8 workflow steps with sticky action buttons.
- [ ] Diagnose form (issues, TDS, parts, photos, voice note).
- [ ] Estimate builder + bill summary (fixed charges, editable part prices).
- [ ] Approval (WhatsApp / Service Manager, approved/rejected).
- [ ] Payment (split UPI/Cash/Card, reconciliation, UPI QR).
- [ ] Close (next service, create-lead, success + incentive screen).
- [ ] My Reviews screen.
- [ ] Help & Support (contacts, issue guide, customer scripts).
- [ ] Wire new API endpoints + new columns/tables in the backend.
- [ ] **Link to the existing website:** same backend, same DB, same `users`/auth,
      shared notification pipeline; ship under the same project (`/tech` route or
      `tech.` subdomain) on the same API base (see §2.1).
- [ ] Verify bidirectional sync: dashboard-assigned job shows up here; steps taken
      here reflect live on the dashboard + `ticket_events`.
- [ ] Ensure each milestone fires exactly one customer WhatsApp message.
