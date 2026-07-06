# Tracker (dailytally) — Product / Design / Engineering Brief

_Written 2026-07-03 by a Claude portfolio review session. Audience: a future Opus
session. Read `CLAUDE.md` first (day-key/local-date rules, RLS pattern, migration
conventions). Verify current state before implementing — features may have shipped
since this was written._

---

## 1. Product roadmap (PM)

Tracker's logging/analytics core is genuinely complete (4 tracker types, sections,
resources, notes, editable history). What it lacks is everything that happens when
the app is **closed**: reminders, installability, and a reason to reflect weekly.
Habit trackers live or die on the return visit.

### P1 — PWA + reminders (the single highest-leverage feature)
**Instructions for Opus:**
- Add `manifest.json` + icons + a minimal service worker (cache the app shell;
  data stays network-first). Follow the pattern in
  `C:\Users\snoww\PersonalAssist\public\` (manifest + `sw.js`) — same stack.
- Web Push reminders need a send path, which needs a server. Two options; pick A:
  - **A (recommended):** per-tracker local notification settings + a daily
    "anything unlogged?" push via a Vercel cron route + `web-push` (store
    subscriptions in a new `push_subscriptions` table, RLS own-rows). Mirror
    PersonalAssist's `lib/push.ts` + `api/cron/notify` implementation.
  - B: Supabase Edge Function on a schedule (pg_cron) — keeps it serverless-free
    but adds a new deployment surface.
- Reminder config UI: a "Remind me" toggle + time on the tracker detail page,
  stored on `trackers` (migration `11-reminders.sql`, keep `schema.sql` in sync).
- iOS caveat: push requires the PWA installed to the home screen — surface the
  same explainer message PersonalAssist uses.

### P1 — Weekly review ("Your week") screen (retention + the app's soul)
A Sunday-evening summary: per tracker — total vs last week, streak status, best
day; plus any notes written that week.
**Instructions for Opus:**
- Pure computation from existing `entries`/`day_notes` — extend `lib/stats.ts`
  (keep it pure + unit-tested, that's the house style).
- Route `app/week/page.tsx`, linked from a small card on the dashboard that
  appears from Friday–Monday ("Your week is ready").
- If push (above) ships, send one weekly push linking here.

### P2 — Numeric goals with progress
`goal_direction` exists but there's no target ("≤ 2 drinks/week", "≥ 3 runs/week").
**Instructions for Opus:**
- Migration: `trackers.goal_target numeric?`, `goal_period 'day'|'week'` (nullable
  = no target). Extend `AddTrackerModal` (progressive disclosure — only show
  target fields once a direction is chosen).
- Dashboard card shows a thin progress bar vs target for the current period;
  weekly review and Analytics reference it. Extend `lib/stats.ts` with
  `periodProgress()` + tests.

### P2 — CSV export (trust + honest-data ethos)
Per-tracker and all-data export, client-side generation. Escape formula-injection
(cells starting `= + - @` — copy the guard from BookTracker `web/src/lib/csv.ts`).
Add to the detail page ⋯ menu and a global settings sheet.

### P3 — Streak-share image
Canvas-generated share card ("42-day streak · Went outside") for accountability
posts. Client-only, no backend. This is the only acquisition feature worth doing —
Tracker is a private tool; growth is word-of-mouth.

### Explicitly not now
Social feeds, friends/leaderboards (against the "private, honest" spirit),
native apps.

---

## 2. Design audit

Strengths: genuinely low-friction logging (tap on the card), bottom sheets,
safe-area handling, mobile-first sizing, consistent optimistic updates.

Issues:
1. **AddTrackerModal option overload.** Name, subtitle, type, goal, streak side,
   emoji, color, unit, steps — intimidating for a first tracker. Default to a
   two-step flow: (1) name + type with 3 example chips, (2) "More options"
   collapsed section for the rest. Everything is editable later anyway.
2. **Streak-side and goal-direction semantics are invisible.** "Did" vs "skipped"
   streaks confuse on first encounter; add one-line helper text under each toggle
   (e.g. *"Streak counts days you logged it"* / *"…days you kept it at zero"*).
3. **Calendar tint legend.** Green/red tints by goal direction are unexplained —
   add a tiny legend row under the month grid.
4. **Reorder arrows are clunky** (up/down taps per row). Fine for now; if it
   itches, long-press drag with `@dnd-kit` — but only within sections, matching
   the existing `sort_order` persistence.
5. **Empty dashboard** should show 3 tappable starter templates ("Went outside",
   "Water", "Night routine" series) instead of only an Add button — templates
   also teach the tracker types.

---

## 3. Engineering audit

### Refactor targets
- Codebase health is the best in the portfolio (pure `lib/` with tests, all
  queries in `db.ts`, tolerant readers for missing tables). Keep that bar.
- `app/t/[id]/page.tsx` accumulates: today logger, steps manager, resources,
  calendar, analytics, day editor, emoji picker, edit modal. Split into
  `detail/` components before adding reminders/goals UI there.
- `db.ts` is nearing "everything file" size — if it passes ~500 lines, split by
  domain (`db/trackers.ts`, `db/entries.ts`, `db/resources.ts`) behind one
  barrel export; keep `isMissingTable` shared.

### Security audit potential
Model is sound: RLS everywhere with `auth.uid()` defaults, private Storage with
signed URLs, `normalizeUrl` guards link hrefs, headers in `next.config.ts`.
Remaining:
1. **Full CSP** is the documented next step (`script-src`/`connect-src`/
   `style-src`). Build it against the live Google OAuth + Supabase flow on a
   preview deploy first — a wrong directive locks users out (CLAUDE.md warns).
   `connect-src` needs the Supabase URL + wss; `style-src` likely needs
   `'unsafe-inline'` under Tailwind v4.
2. **Storage bucket limits**: verify `resource-files` enforces the 10MB/MIME
   limits at the bucket level, not just in client guards.
3. **Sign-out everywhere / token revocation** — low priority for a single-user-
   per-account app; skip unless sharing features arrive.
4. No secrets in the repo (anon key is public by design) — keep it that way;
   never introduce the service key into this codebase.

---

## 4. Surprise & delight (unbuilt ideas — cherry-pick)

_Playful, self-contained moments. Tracker's spirit is "private, honest,
low-friction" — every idea below celebrates or comforts; none guilt or gamify
against the user._

### D1 — Year in Pixels poster
A full-year heatmap (365 tiny squares tinted by day total) per tracker, plus an
all-trackers composite — downloadable as a PNG poster titled with the tracker
name and year. Pure client canvas from existing `entries`; extend `lib/stats.ts`
with a `yearGrid()` helper (tested). This is the identity artifact for a private
tool: people print these.

### D2 — Notes to your future self at milestones
When creating/editing a tracker, optionally write a message ("if you're reading
this, you did 30 days — remember why you started"). On hitting the milestone:
one tasteful confetti burst (respect `prefers-reduced-motion`) + the note in a
bottom sheet. Migration: `tracker_milestones(tracker_id, threshold_days, note,
fired_at)`. Getting mail from past-you is the single most emotional feature a
habit tracker can ship.

### D3 — "On this day"
Dashboard header occasionally shows "A year ago today you wrote: *…first run
without stopping*" — resurfacing `day_notes` from ±1 day, one year back. One
query, no schema. Notes exist precisely so they can come back.

### D4 — Welcome-back fresh start (anti-guilt lapse handling)
If a tracker with a previously long streak has 7+ silent days, replace the cold
zero with a warm card: "Welcome back. Your 42-day streak is safe in history —
want a fresh start?" with a one-tap "start again today" (no data change, just
framing + an optional marker). Streak apps lose people at the *break*, not the
building; this is the moment to be kind.

### D5 — Correlation hints (honest ones)
In the weekly review: "On days you logged **Went outside**, you logged **Slept
well** 1.8× more often" — computed in pure `stats.ts` with a minimum-sample
guard (≥20 overlapping days) and phrased as observation, never causation. The
"whoa" feature for people tracking more than three things.

---

## 5. First-visit cold open (user-requested 2026-07-04 — build next)

A brief intro shown once after first sign-in, before the empty dashboard.

- New `components/IntroSheet.tsx`, rendered from the dashboard (`app/page.tsx`)
  when the user is signed in, has **zero trackers**, and
  `localStorage['tracker.introSeen']` is unset. Standard bottom-sheet pattern
  (`items-end … sm:items-center`, `rounded-t-2xl`, backdrop tap dismisses).
- Content: one line — "Track anything you do (or don't do), one tap a day."
  Then the four types, one line each with their emoji:
  ✅ Yes/no · 🔢 Count · ⚖️ Measure · 📋 Series (a daily checklist).
  Primary CTA: "Add your first tracker" → opens `AddTrackerModal`.
  Secondary: "I'll look around first" (dismiss).
- If starter templates exist by then (brief §2.5), show 3 tappable template
  chips inside the sheet instead of only the CTA.
- Set the localStorage flag on ANY dismissal path. Reopen affordance: a small
  "?" button next to the sign-out control on the dashboard header.
- Keep copy in the app's plain, non-preachy voice; no gamification promises.

---

## 6. Wave 2 — after the cold open (written 2026-07-04)

_State at writing: PWA shell, /week review, numeric goals, and the intro
sheet are LIVE (migration 11-goals.sql must be applied in Supabase).
Verify state before building._

### W1 — Close the reminder loop (the P1 that still has no send path)
The service worker exists; reminders still need delivery. Per section 1
option A: `push_subscriptions` table (RLS own-rows), a "Remind me" toggle +
time per tracker (migration 12-reminders.sql), and a Vercel cron route with
`web-push` that sends "anything unlogged today?" — mirror PersonalAssist
`lib/push.ts` + `api/cron/notify`. Needs the Supabase service key in a
Vercel-only env var (server route — the FIRST server-side code in this repo;
keep it to the one route). iOS = install-to-home-screen caveat, reuse the
explainer copy.

### W2 — Delights, in value order
D1 Year-in-Pixels poster (identity artifact; pure canvas + tested
`yearGrid()` in stats.ts) → D2 future-self milestone notes → D4 anti-guilt
welcome-back card → D3 on-this-day → D5 correlation hints (min-sample
guarded, weekly review only).

### W3 — Data respect features
- CSV export (formula-injection-guarded, per section 1).
- **CSV import** — the onboarding wedge for people leaving other habit apps:
  map columns to (tracker, day, value), preview, bulk insert. "Honest
  backfilling counts" is already the house rule; imports extend it.

### W4 — Quick-log box (friction ~zero, tentative)
A single text input on the dashboard: "2 drinks yesterday", "weight 78.4",
"went outside". Rule-based parser (number + tracker-name fuzzy match +
day word) — NO LLM, keep it offline-fast and predictable; unmatched input
just focuses the matching card. Pure, testable `lib/quicklog.ts`.

### Tentative / parked
- Per-tracker read-only share link (opt-in, revocable). Runs against the
  private ethos — only build on explicit user pull.
- Apple Health import: no web API; a HealthKit-export-XML upload parser is
  possible but heavy. Park.
- Streak share image: fold into D1 poster work if built.

---

## 8. Mobile & web experience scan (2026-07-05 — static review; app is
login-gated so no anonymous browser pass)

The mobile conventions are documented and consistently applied (44px
targets, bottom sheets, safe-area padding, `viewport-fit=cover`, max-w-lg
single column). Three things to eyeball on a phone next session-with-login:
1. The new `/week` review page — chart widths and the Fri-Mon dashboard
   card at 375px.
2. Goal progress bars on `TrackerCard` — confirm they do not crowd the
   tap-to-log button (the card is the primary touch surface).
3. The IntroSheet (section 5) uses `env(safe-area-inset-bottom)` — confirm
   on a notched device that the CTA is not flush against the home indicator.
Also: the PWA manifest shipped — verify install + icon on iOS, and that the
service worker does not cache-poison after deploys (network-first for data
was the spec).
