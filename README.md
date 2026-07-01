# Tracker

A dead-simple personal tracker. Add anything you want to track — a yes/no habit
("ate chia seeds today?"), a daily count ("standard drinks"), or a measurement
you type in ("weight") — then log it. See a calendar of which days you did it
and a few analytics (streaks, totals/trends, a chart).

Built with **Next.js 16 + Supabase + Tailwind v4**, deployed on **Vercel** —
the same stack as MapCrowd.

## How it works

- **Dashboard** (`/`) — every tracker as a row. Tap the check (yes/no), the
  `+ / −` (count), or type a number (measure, e.g. weight) to log today. Tap the
  row to open its detail. Each card also has a **today's-note** subsection — jot
  a quick free-text note for today right from the dashboard. Use the **up/down
  arrows** to reorder your trackers, and a subtle clock badge shows **how many
  days since** you last logged each one.
- **Measure trackers** — for things you record a number for (weight, resting
  heart rate, %). You type the value (decimals OK); the latest reading replaces
  that day's. Analytics show **latest / average / lowest / highest** and a trend
  chart instead of totals.
- **Sections** — group trackers under minimalist headers (a title above a thin
  line) right on the dashboard. Add a section, pick a tracker's section from its
  card, reorder within a group, and **collapse** sections you don't need open
  (collapse state syncs across devices). Ungrouped trackers show at the top.
- **Series trackers** — an ordered **checklist** that resets daily (e.g. a night
  routine: "brush teeth", "floss"…). The big button on the card checks off the
  **next** step each tap; **tap the card** to expand the full list and check
  steps off out of order; **right-click / tap-and-hold** for a menu (reveal
  checklist, reset today, mark all done, open page). Manage the steps on the
  tracker's detail page.
- **Detail** (`/t/[id]`) — a bigger "today" logger, a month **calendar** tinted
  by what you logged, and **analytics**: current/longest streak, good days,
  totals, trailing 7/30-day sums, and a bar chart with an **adjustable range**
  (week / month / year / all / custom) that auto-buckets daily → weekly →
  monthly so it stays phone-readable. On the daily view, relative peaks (`▲`)
  and dips (`▼`) that have a note get a **callout** you can hover/tap. Tap the
  **icon** in the header to swap a tracker's emoji any time.
- **Resources** — attach reference material to the tracker itself: titled
  **links** (e.g. a link to your stretch-routine doc), free-text **notes**, and
  **file uploads** (docs & images, ≤10 MB). These live on the detail page and are
  separate from per-day notes. Links open in a new tab (validated to safe
  `http(s)`); files go to a **private** store and open via a temporary link.
- **Edit any day** — tap any day on the calendar to open a sheet that adjusts
  that day's value (or toggles yes/no) and edits a free-text **note** for the
  day. Days with a note show a dot. Backfilling earlier days extends analytics
  back to the earliest logged day, so honest backfilling still counts.
- **Edit a tracker** — the **Edit** button on a tracker's page reopens the form
  to change any setting (name, description, type, icon, color, unit, goal…).
  Changing the type is non-destructive: your existing entries are kept.
- **Subtitle** — give any tracker an optional one-line description that shows
  under its name (handy inside a group, e.g. a note on each stretch in a stretch
  routine). Set it when creating a tracker, or click it on the tracker's page.
- **Goal direction** — when you create a tracker you say whether doing it is
  *good* (more = 💚, e.g. chia seeds), *bad* (less = 💚, e.g. drinks — a clean
  day is the win), or *neutral*. This only changes how streaks/"good days" and
  the calendar colors are framed.
- **Streak side** — choose whether a tracker's streak counts the days you
  *did it* or the days you *skipped it*. It defaults from the goal direction at
  creation (a "less is better" tracker streaks on clean days) and can be flipped
  any time from the detail page.

Data is stored in Supabase and synced across every device you open the site on.

**Sign in with Google** — each account sees only its own trackers (Supabase Auth
+ row-level security keyed on `user_id`). Sign in on any device to pick up where
you left off.

## One-time setup

This app needs a Supabase project with Google sign-in. Each user only sees their
own data (per-user RLS).

1. **Create a Supabase project** at https://supabase.com (free tier is plenty).
2. **Apply the schema**: open the project → SQL Editor → paste all of
   [`supabase/schema.sql`](supabase/schema.sql) → Run. (This is the full current
   state — includes auth ownership and the `day_notes` table.)
3. **Get your keys**: Project Settings → API. Copy the Project URL and the
   `anon` `public` key.
4. **Local env**: copy `.env.local.example` to `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
   The URL **must** include `https://`.
5. **Enable Google sign-in**:
   - On an **existing** DB (created before these features), run the migrations
     you haven't yet, in order: [`supabase/02-auth.sql`](supabase/02-auth.sql)
     (adds `user_id` ownership + per-user RLS),
     [`supabase/03-notes.sql`](supabase/03-notes.sql) (adds the `day_notes`
     table), [`supabase/04-streak-side.sql`](supabase/04-streak-side.sql)
     (adds the `trackers.streak_side` column), and
     [`supabase/05-resources.sql`](supabase/05-resources.sql) (adds the
     `tracker_resources` table for links + notes), and
     [`supabase/06-measure.sql`](supabase/06-measure.sql) (adds the `measure`
     tracker type and makes `entries.value` numeric), and
     [`supabase/07-sections.sql`](supabase/07-sections.sql) (adds the `sections`
     table and `trackers.section_id`), and
     [`supabase/08-series.sql`](supabase/08-series.sql) (adds the `series` type,
     the `tracker_steps` table, and `entries.step_id`), and
     [`supabase/09-subtitle.sql`](supabase/09-subtitle.sql) (adds an optional
     `trackers.subtitle`), and
     [`supabase/10-storage.sql`](supabase/10-storage.sql) (adds the `file`
     resource kind + a private Storage bucket for uploads). On a **fresh** DB,
     `schema.sql` already includes all of these — skip them.
   - Supabase → **Authentication → Providers → Google**: make sure it's enabled.
   - Supabase → **Authentication → URL Configuration → Redirect URLs**: add
     `http://localhost:3000/**` (local dev) and `https://<your-vercel-app>/**`
     (production). The OAuth redirect (`window.location.origin`) must be on this
     allowlist or sign-in fails.

## Running locally

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build check
npm test         # vitest — unit tests for lib/stats.ts
```

## Deploying (Vercel)

1. Push this repo to GitHub (`origin` is already set to the Tracker repo).
2. Import it in Vercel → it auto-detects Next.js.
3. Add the two `NEXT_PUBLIC_SUPABASE_*` env vars in Vercel → Settings →
   Environment Variables.
4. Deploy. Every push to `main` redeploys.

## Project layout

```
app/
  page.tsx          # Dashboard — tracker list + tap-to-log + add modal
  t/[id]/page.tsx   # Tracker detail — today logger, resources, calendar, analytics, delete
  layout.tsx        # Root layout
  globals.css       # Tailwind + theme vars
components/
  AddTrackerModal.tsx  # Create form: name, type, goal direction, streak side, emoji, color, unit
  TrackerCard.tsx      # Dashboard row + inline log controls + today's-note subsection
  CalendarView.tsx     # Month grid; tap a day to edit it
  DayEditor.tsx        # Per-day sheet: value editor + note
  Analytics.tsx        # Stat tiles + adjustable-range bar chart with note callouts
  ResourcesSection.tsx # Tracker-level links + notes
  SectionHeader.tsx    # Dashboard group header (title + rule, collapse, rename, delete)
  StepChecklist.tsx    # Series step checkboxes (shared by card, detail, day editor)
  SignInScreen.tsx     # Google sign-in gate
lib/
  supabase.ts       # Supabase client (validates env vars at startup)
  db.ts             # All queries (trackers, entries, notes, resources)
  useUser.ts        # Auth hook + signInWithGoogle/signOut
  types.ts          # Tracker, Entry, GoalDirection, TrackerResource types
  date.ts           # Local-date helpers (day keys are local, not UTC)
  url.ts            # Safe-URL normalize + host label for resource links
  format.ts         # fmtNum — display formatting for measure values
  stats.ts          # Pure analytics: streaks, day totals, summaries, measure stats
  *.test.ts         # Unit tests (stats, date, url, format)
  constants.ts      # Color + emoji palettes
supabase/
  schema.sql        # Full current schema — run once on a fresh project
  02-auth.sql       # Migration: per-user ownership + RLS
  03-notes.sql      # Migration: day_notes table
  04-streak-side.sql # Migration: trackers.streak_side column
  05-resources.sql  # Migration: tracker_resources table (links + notes)
  06-measure.sql    # Migration: 'measure' type + numeric entry values
  07-sections.sql   # Migration: sections table + trackers.section_id
  08-series.sql     # Migration: 'series' type + tracker_steps + entries.step_id
  09-subtitle.sql   # Migration: optional trackers.subtitle
  10-storage.sql    # Migration: 'file' resource kind + private Storage bucket
```

## Data model

| Table | What |
|---|---|
| `trackers` | One row per thing tracked: `user_id` owner, name, `type` (`yesno`/`count`), color, emoji, optional `unit`, `goal_direction`, `streak_side` (`did`/`skipped` — which side the streak counts). |
| `entries` | One row per tap: `user_id`, `tracker_id`, `day` (local date), `value` (numeric). A count day is `SUM(value)`; a yes/no day is "done" if any row exists; a measure day is a single reading (latest replaces). |
| `day_notes` | Optional free-text note per (`tracker_id`, `day`). |
| `tracker_resources` | Reference material on a tracker: `kind` (`link`/`note`), optional `title`, `url` (links), `body` (notes). |
| `sections` | Dashboard groups: `title`, `sort_order`, `collapsed`. `trackers.section_id` points here (null = ungrouped). |
| `tracker_steps` | Steps of a `series` tracker: `label`, `sort_order`. A checked step is an `entries` row with `step_id` set. |

All tables are RLS-scoped to `auth.uid() = user_id`; the `user_id` columns
default to `auth.uid()` so inserts fill the owner automatically.
