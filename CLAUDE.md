# Tracker — Project Context

## What this is
A dead-simple personal habit/quantity tracker. The user adds their own trackers
("Standard drinks", "Chia seeds", "Went outside", "Weight", "Night routine")
that are **yes/no** (did it or not), **count** (how many in a day), **measure**
(a free-form numeric reading like weight, latest replaces), or **series** (an
ordered checklist of steps that resets daily). They tap to log, see a
**calendar** of which days, and a few **analytics** (streaks, totals, a 30-day
chart). Every day is editable after the fact and can carry a free-text note.
The guiding spirit: a private, honest, low-friction personal tool.

## Local workspace
This repo lives at **`C:\Users\snoww\Mapper-Tracker\tracker\`** — a gitignored subfolder of the user's `Mapper-Tracker` workspace (renamed from `Map` → `Mapper + Tracker` → `Mapper-Tracker`; the `+`/space in the old name broke Turbopack's `next dev` HMR — keep the path free of `+`/spaces), which is itself the `personal-site` portfolio repo. The sibling **MapCrowd** app (`../mapcrowd/`, github `snowwarrior1-alt/Mapper`) is a separate repo in the same workspace, and the two **share one Supabase project** (named "Mapper+Tracker", ref `tmycdgnofvmbyrmpqohw`) — see Deployment.

## Tech stack
- **Framework**: Next.js 16 (App Router, Turbopack), all pages are `'use client'`
- **DB + Auth**: Supabase (Postgres, RLS, Google OAuth)
- **Styling**: Tailwind CSS v4 (`@import "tailwindcss"`, CSS vars in `globals.css`)
- **Icons**: lucide-react
- **Language**: TypeScript
- Mirrors the **MapCrowd** project's stack and conventions (sibling repo).

## Running locally
```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build check
npm test         # vitest — unit tests for lib/stats.ts (pure logic)
```
`.env.local` needs (Supabase dashboard → Settings → API):
```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co   # MUST include https://
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```
**Build-time env**: `NEXT_PUBLIC_*` vars are inlined at *build* time, and
`lib/supabase.ts` throws at module load if they're missing — so the build fails
without them. For a CI/clean build without real creds, pass dummy values:
`NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy npm run build`.

## Project structure
```
app/
  page.tsx          # Dashboard: auth gate → tracker list, tap-to-log, add modal, sign-out
  t/[id]/page.tsx   # Detail: today logger, resources, calendar, analytics, per-day editor, editable icon, delete
  layout.tsx        # Root layout + viewport (viewport-fit=cover for safe-area)
  globals.css       # Tailwind import + theme CSS vars
components/
  AddTrackerModal.tsx  # Create OR edit form (pass `initial` + onSaved): name, subtitle, type, goal, streak, emoji, color, unit
  TrackerCard.tsx      # Dashboard row: log controls (incl. measure number field), today's-note, reorder arrows, "days since" hint
  CalendarView.tsx     # Month grid; days are buttons → onSelectDay; note dots
  DayEditor.tsx        # Bottom-sheet for one day: value editor + note textarea
  Analytics.tsx        # Stat tiles + 30-day bar chart
  ResourcesSection.tsx # Tracker-level links, notes + file uploads (add/edit/delete) on the detail page
  SectionHeader.tsx    # Dashboard group divider: title + rule, collapse, rename, delete, reorder
  StepChecklist.tsx    # Series step checkboxes (card inline expand, detail today, DayEditor)
  SignInScreen.tsx     # "Sign in with Google" gate
lib/
  supabase.ts       # Supabase client (throws if env missing)
  db.ts             # ALL queries (trackers, entries, notes, resources, sections, steps); step check = addEntry(...stepId), uncheckStep
  useUser.ts        # useUser() hook + signInWithGoogle()/signOut()
  types.ts          # Tracker (+section_id), Section, TrackerStep, Entry (+step_id), TrackerType (yesno/count/measure/series), GoalDirection, DayTotals, TrackerResource
  date.ts           # LOCAL day-key helpers + dayLabel/daysInMonth/daysBetween — unit-tested
  date.test.ts
  url.ts            # normalizeUrl (safe http(s) only) + safeHref + hostLabel for resource links — unit-tested
  url.test.ts
  format.ts         # fmtNum (≤2-decimal display for measure values) — unit-tested
  format.test.ts
  stats.ts          # Pure analytics (dayTotals, streaks, summarize, summarizeMeasure, buildBuckets sum/avg) — unit-tested
  stats.test.ts
  constants.ts      # COLORS + EMOJIS palettes
supabase/
  schema.sql        # Full current schema — run on a FRESH project
  02-auth.sql       # Migration: per-user ownership + RLS (already applied to live DB)
  03-notes.sql      # Migration: day_notes table (already applied to live DB)
  04-streak-side.sql # Migration: trackers.streak_side column (did/skipped)
  05-resources.sql  # Migration: tracker_resources table (links + notes)
  06-measure.sql    # Migration: 'measure' type + entries.value int→numeric
  07-sections.sql   # Migration: sections table + trackers.section_id
  08-series.sql     # Migration: 'series' type + tracker_steps table + entries.step_id
  09-subtitle.sql   # Migration: trackers.subtitle (optional description)
  10-storage.sql    # Migration: 'file' resource kind + private Storage bucket + RLS
  11-goals.sql      # Migration: trackers.goal_target + goal_period (numeric goals)
public/
  manifest.json     # PWA manifest (installable, standalone)
  icon.svg          # App/maskable icon
  sw.js             # App-shell service worker (offline shell; data network-first)
```

## Data model
| Table | Purpose |
|---|---|
| `trackers` | One per tracked thing: `user_id` (owner), name, `type` (`yesno`/`count`), `color`, `emoji`, `unit?`, `goal_direction` (`more`/`less`/`neutral`), `streak_side` (`did`/`skipped` — which side the streak counts), `goal_target?`/`goal_period?` (`day`/`week` — optional numeric goal for count/yes-no), `sort_order`, `archived`, `created_at`. |
| `entries` | One row per tap: `user_id`, `tracker_id`, `day` (LOCAL date), `value` (**numeric** — measures store decimals). A count day = `SUM(value)`; a yes/no day = "done" if any row exists; a **measure** day = one row holding the reading (latest replaces). |
| `day_notes` | Optional note, unique per (`tracker_id`, `day`): `user_id`, `note`, `updated_at`. |
| `tracker_resources` | Reference material attached to a tracker (not a day): `kind` (`link`/`note`/`file`), optional `title`, `url` (links), `body` (notes), `file_path`/`file_name`/`file_size` (uploads), `sort_order`. A check enforces link⇒url, note⇒body, file⇒file_path. |
| `sections` | Dashboard groups: `title`, `sort_order`, `collapsed` (synced). `trackers.section_id` → `sections.id` (`on delete set null` → ungrouped). |
| `tracker_steps` | Steps of a `series` tracker: `tracker_id`, `label`, `sort_order`. A checked step is an `entries` row with `step_id` set (day total = # steps done). |

- **RLS**: every table is `for all to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id)`. The `user_id` columns **default to
  `auth.uid()`**, so client inserts don't pass `user_id` — it's filled from the
  JWT, and the check passes. To add a column/table, keep this pattern.
- **Migrations**: fresh project → run `schema.sql` (full state). Existing DB →
  run only the numbered files not yet applied, in order. `schema.sql` is kept in
  sync as the union of all migrations.

## Key conventions & gotchas
- **Day keys are LOCAL, not UTC.** `lib/date.ts` `toDayKey()`/`todayKey()` format
  `YYYY-MM-DD` in the browser's local timezone so a late-night tap lands on the
  right day. Never send `new Date().toISOString()` as a day. The `day` column is
  a Postgres `date`.
- **Editing any day reuses the same writers.** `db.ts` `addEntry`/`removeLastEntry`/
  `clearDay` all take a `day` arg; the "today" logger and the calendar `DayEditor`
  call the same `adjust(day, delta)` / `setDone(day, done)` handlers in
  `app/t/[id]/page.tsx`. Local `entries` state is mutated optimistically and a
  `busy` flag guards against double-submits while a write is in flight.
- **Analytics `since`** = the tracker's created day, or the earliest entry day if
  earlier (so honest backfilling counts). Computed in the detail page.
- **Streak side** (`trackers.streak_side`): `'did'` streaks on days you logged it
  (`total > 0`), `'skipped'` on clean days (`total === 0`). It's **independent of
  `goal_direction`** (which still drives the calendar tint + the "good/clean/active
  days" tile). Default at creation comes from the goal (`defaultStreakSide`: `less`
  → `skipped`, else `did`); the detail page's "Streak counts" toggle flips it live
  via `updateTracker`. Streak math (`currentStreak`/`longestStreak`) takes the side,
  not the goal. App code reads `tracker.streak_side ?? defaultStreakSide(...)` so it
  still works against rows from before migration 04.
- **Chart ranges**: `Analytics` lets you pick week / month / year / all / custom
  (date pickers). `stats.buildBuckets(totals, start, end)` auto-picks a
  `Granularity` (`chooseGranularity`: ≤45 days daily, ≤366 weekly, else monthly) so
  the bar count stays phone-readable. **Note callouts only render on daily bars** (a
  week/month bucket has no single note day). Callouts mark interior strict local
  max (`▲`) / min (`▼`) bars that have a `day_notes` note, shown on hover (desktop)
  or tap (mobile).
- **Subtitle** (`trackers.subtitle`, migration 09): an optional one-line
  description shown under the name on the dashboard card and the detail header
  (click-to-edit there via `updateTracker`). Set at creation in `AddTrackerModal`.
- **Editing a tracker**: the detail page's "Edit" button opens `AddTrackerModal`
  with `initial={tracker}` (same form as create). Changing the **type** is
  **non-destructive — existing entries stay** (the chosen "cut-over"); series
  steps are managed on the detail page, not in the edit form. Also inline on the
  detail page: emoji picker, subtitle (click-to-edit), streak-side toggle.
- **Editing tracker settings** all go through `db.ts` `updateTracker(id, patch)`
  (patches `name`/`subtitle`/`color`/`emoji`/`unit`/`goal_direction`/`streak_side`/`type`/`sort_order`/`section_id`). The
  detail header's icon tile is a button → inline emoji picker (same `EMOJIS`
  palette as the create modal) that calls `changeEmoji`, persisting optimistically
  with rollback on error — the same pattern as the streak-side toggle. `name`,
  `color`, and `unit` are patchable too but have no UI yet.
- **Dashboard ordering** is `trackers.sort_order` asc (then `created_at`).
  `listTrackers` reads it; the dashboard's up/down arrows swap two rows and
  persist `sort_order = list position` via `updateTracker` for every row whose
  position changed (optimistic, reverts on failure). The column predates this —
  no migration needed.
- **Sections** (`sections` table, [`SectionHeader`](components/SectionHeader.tsx)):
  optional collapsible groups on the dashboard. Trackers reference one via
  `section_id` (null = **ungrouped, rendered first** with no header). The
  dashboard groups `trackers` by `section_id`; **up/down arrows reorder within a
  group** (`moveTracker` swaps the in-group neighbour, then persists global
  `sort_order`); assignment is a `<select>` on each card (`assignSection` →
  `updateTracker({ section_id })`). `collapsed` is a **synced** column (toggling
  writes it). Section CRUD/reorder live in `db.ts` (`createSection`/`updateSection`/
  `deleteSection`); deleting a section ungroups its trackers (FK `on delete set
  null`). `listSections` tolerates a missing table (migration 07).
- **"Days since" hint** (dashboard card): `daysBetween(lastDay, today)` where
  `lastDay` comes from `db.ts` `listLatestEntries()` (latest `{day, value}` per
  tracker; pulls `(tracker_id, day, value)` for the user and keeps the first of a
  `day desc` sort). Hidden when logged today (covered by `todayTotal`) or never
  logged. It re-resolves from `todayTotal` automatically once you log today.
- **Measure trackers** (`type: 'measure'`, e.g. weight): a free-form numeric
  reading per day, **latest replaces** (one entry/day) via `db.ts` `setDayValue`
  (clear the day + insert one). Entry is a number field on the dashboard card,
  the detail Today logger, and `DayEditor` — all reject blank/0/NaN. `entries.value`
  is `numeric`; `db.ts` `toEntry` coerces it to a JS number (PostgREST can return
  numeric as a string). Analytics swap the count/streak tiles for **latest /
  average / lowest / highest** (`summarizeMeasure`), the chart **averages** each
  bucket (`buildBuckets(..., 'avg')`) and scales bars from a baseline below the
  min so small changes show. Streak side is hidden (a 0 day isn't "clean" for a
  measure); the calendar tints logged days uniformly rather than by amount/goal.
  Display values go through `lib/format.ts` `fmtNum`.
- **Tracker resources** (`tracker_resources`, [`ResourcesSection`](components/ResourcesSection.tsx)):
  links + notes attached to a tracker, on the detail page below the Today logger.
  **Link URLs go through `lib/url.ts` `normalizeUrl`** — bare domains get
  `https://`, and only `http:`/`https:` are allowed (javascript:/data:/file:/…
  are rejected) since the value becomes a `target="_blank"` href. Links render
  with `rel="noopener noreferrer"`. **File uploads** (migration 10) go to a
  **private** Storage bucket `resource-files` under `<uid>/<tracker_id>/…` (RLS:
  own-folder only); `db.ts` `uploadResourceFile`/`signedUrlForFile` (60s signed
  URLs)/`removeResourceFile`. Client guards mirror the bucket (docs+images, 10MB);
  deleting a file resource best-effort removes the Storage object then the row.
  The section self-loads via `listResources`, which (like the notes readers)
  **tolerates a missing table** so the page still works before migration 05 is
  applied — but adds/edits fail until it is.
- **Series trackers** (`type: 'series'`, e.g. a night routine): an ordered
  checklist of `tracker_steps` that **resets daily**. A checked step is an
  `entries` row tagged with `step_id` (so a day's total = # steps done, and
  series reuses count-style calendar/analytics). `lib/stats.ts` `seriesProgress`
  computes done/total/next/complete. Dashboard card: the big button
  (`onCheckNext`) checks the next unchecked step in order; **tapping the card
  expands an inline `StepChecklist`** (out-of-order); **right-click / long-press
  (~500ms) opens a hold-menu** (reveal checklist / reset today / mark all done /
  open page). Steps are created in `AddTrackerModal` and managed on the detail
  page (`StepsManager`); `DayEditor` shows the checklist for a past day. Series
  forces `goal_direction: 'more'` and `streak_side: 'did'` (no goal/streak UI).
- **`listNotes`/`listResources` tolerate a missing table** via the shared
  `isMissingTable` helper in `db.ts` (matches `42P01`/`PGRST205`/the table name),
  so the detail page still loads if migration 03 or 05 lags a deploy.
- **Auth is client-side, like MapCrowd** — `signInWithOAuth({ provider: 'google',
  options: { redirectTo: window.location.origin } })`, no server callback route.
  `useUser()` reads `getSession()` + subscribes to `onAuthStateChange`. Both pages
  gate on it (spinner → SignInScreen → content). The redirect origin MUST be in
  Supabase → Authentication → URL Configuration → Redirect URLs or sign-in fails.
- **Security headers** live in [`next.config.ts`](next.config.ts) `headers()` and
  apply to every route: `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'`
  (anti-clickjacking), `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`, and HSTS. A full script/style/connect CSP is the next
  step but must be validated against the live Google OAuth + Supabase flow first
  (a wrong directive locks users out). Security model overall: client-only SPA,
  **RLS is the boundary** (every table `auth.uid() = user_id`), the anon key is
  public by design, and all user text (incl. notes) renders as escaped JSX.
- **Numeric goals** (`trackers.goal_target`/`goal_period`, migration 11): an
  optional target for the current period — `≥ N` (goal_direction `more`) or `≤ N`
  (`less`), per `day` or `week`. Only surfaced for **count / yes-no** (measure is
  latest-replace; series/neutral have no target); the `AddTrackerModal` fields
  appear only once a direction is chosen (progressive disclosure) and both columns
  null ⇒ no goal. `lib/stats.ts` `periodProgress(actual, target, direction)` (pure)
  returns `{ ratio, met }`; the dashboard `TrackerCard` shows a thin bar. The
  dashboard computes the period total as today's (optimistic) total for `day`
  goals, or **week-to-date** for `week` goals — `weekPrior` (Mon→yesterday, via
  `listEntriesInRange`) plus today, so a tap moves the bar. `goal_target` is
  `numeric`, so `db.ts` `toTracker` coerces it to a JS number (like `toEntry`).
- **Weekly review** (`app/week/page.tsx`): a "Your week" summary — per tracker,
  this week vs last, active days, best day, current streak; plus any notes written
  this week. Pure computation via `lib/stats.ts` `weekReview(...)` over full
  history (`listAllEntries`, so streaks aren't truncated); weeks are **Monday→
  Sunday** (`lib/date.ts` `startOfWeek`). Notes come from `listNotesInRange`
  (tolerates a missing `day_notes` table). The dashboard shows a "Your week is
  ready" card linking here **Fri→Mon** (`fromDayKey(today).getDay()`).
- **PWA** (`public/manifest.json` + `icon.svg` + `sw.js`): installable, standalone.
  The service worker caches the app shell (`/`, `/week`, manifest, icon) + hashed
  `/_next/static` assets and is **network-first for navigations**; it only touches
  **same-origin GETs**, so Supabase/Google requests pass straight through (never
  served stale). Registered by `components/ServiceWorkerRegister.tsx`, **production
  only** (a SW breaks Turbopack HMR in `next dev`). Note: `icon.svg` covers Android/
  desktop install + maskable; a PNG `apple-touch-icon` can be added for iOS polish.
- **Mobile-first.** Tap targets are kept ≥44px; modals are bottom sheets
  (`items-end ... sm:items-center`, `rounded-t-2xl`) that dismiss on backdrop tap;
  the floating Add button uses `env(safe-area-inset-bottom)` (needs
  `viewport-fit=cover`, set in `layout.tsx`).

## Verifying changes
- `npm run build` (with real or dummy env) + `npm test` should both pass.
- The app is auth-gated, so previewing signed-in screens needs a session. The
  pattern used during development: create a throwaway user via the GoTrue admin
  API (service-role key, `email_confirm:true`), password-grant a session, inject
  it into the browser's `localStorage` under `sb-<ref>-auth-token`, then delete
  the user after. (Supabase uses rotating ES256 JWT keys — a freshly minted token
  can briefly 401 with "no suitable key" until the JWKS cache catches up; refresh
  or retry.)

## Deployment
- **GitHub**: https://github.com/snowwarrior1-alt/Tracker (Vercel auto-deploys `main`)
- **Live**: https://dailytally.vercel.app
- **Supabase**: shares MapCrowd's project — named **"Mapper+Tracker"**
  (`tmycdgnofvmbyrmpqohw`) — to stay under the free-tier 2-project cap. Tracker
  only owns the `trackers`/`entries`/`day_notes` tables; its RLS doesn't touch
  MapCrowd data. Google OAuth + the Google callback are already configured at the
  project level.
- **Vercel env vars**: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  set for all environments. Must exist *before* a build (inlined at build time).

## Features built
- Add trackers (yes/no or count; emoji, color, unit, goal direction, streak side)
- Tap-to-log on the dashboard; per-tracker detail with today logger
- Month calendar tinted by goal direction; note dots
- Analytics: current/longest streak, good/clean days, totals, 7/30-day sums
- **Adjustable chart range**: week / month / year / all / custom, auto-bucketed
  daily → weekly → monthly to stay readable
- **Choosable streak side** ("did it" vs "skipped"), set at creation and flippable
  on the detail page
- **Editable icon** — tap the detail-page header tile to pick a new emoji (persists
  via `updateTracker`)
- **Reorderable dashboard** — up/down arrows on each card move trackers and
  persist `sort_order`
- **"Days since last logged" hint** — a subtle clock badge on each dashboard card
  when a tracker hasn't been logged today
- **Tracker resources** — attach titled links (e.g. a routine doc) and free-text
  notes to a tracker, on its detail page (needs migration `05-resources.sql`)
- **Measure tracker type** — free-form numeric readings (e.g. weight), latest
  replaces per day, with latest/avg/min/max + trend chart (needs migration
  `06-measure.sql`, which also makes `entries.value` numeric)
- **Dashboard sections** — collapsible groups (title + thin rule); assign via a
  per-card picker, reorder within a group, collapse state synced (needs migration
  `07-sections.sql`)
- **Series tracker type** — a daily-resetting checklist of steps (e.g. a routine)
  with an advance button, inline checklist, and a hold/right-click menu (needs
  migration `08-series.sql`)
- **File uploads on resources** — attach docs/images (private Storage, signed
  URLs) alongside links/notes (needs migration `10-storage.sql`)
- **Numeric goals** — an optional `≥`/`≤` target per day or week on count/yes-no
  trackers, with a progress bar on the dashboard card (needs migration
  `11-goals.sql`)
- **Weekly review** (`/week`) — a "Your week" summary (this vs last week, active
  days, best day, streak, this week's notes); a dashboard card links to it Fri→Mon
- **Installable PWA** — manifest + icon + app-shell service worker (offline shell,
  data stays network-first)
- **Edit a tracker** — an Edit button reopens the create form to change any
  setting; type changes keep existing entries
- **Edit any past day** via a calendar-tap bottom sheet (adjust value / toggle)
- **Per-day notes**, with peak/dip **note callouts** on the daily chart; today's
  note is also editable inline from each **dashboard card** (`listNotesForDay`)
- Google sign-in, per-user data (RLS)
- Mobile-tuned (tap targets, bottom sheets, safe-area)
