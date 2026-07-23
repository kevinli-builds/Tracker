'use client'

// All-trackers Year in Pixels (OPUS_BRIEF §4 D1, second half) — every tracker
// as one day-per-pixel strip for a chosen year, stacked into a single poster.
//
// Same ethos as the per-tracker grid: each strip is shaded against its OWN
// year (a heavy month of one habit never makes another look faint), untracked
// days stay lighter than tracked-but-empty ones, and nothing here ranks the
// trackers against each other.

import { useMemo, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import type { Tracker } from '@/lib/types'
import { yearGrid, trackedYears, type TrackerSeries, type YearGrid } from '@/lib/stats'
import { cellFill, MONTHS_SHORT } from '@/lib/pixels'

// One tracker's year, ready to draw.
interface Row {
  id: string
  name: string
  emoji: string
  color: string
  grid: YearGrid
}

function buildRows(series: TrackerSeries[], trackers: Record<string, Tracker>, year: number, today: string): Row[] {
  return series.map((s) => {
    const t = trackers[s.id]
    return {
      id: s.id,
      name: s.name,
      emoji: t?.emoji ?? '•',
      color: t?.color ?? '#6366f1',
      grid: yearGrid(s.totals, year, { since: s.since, today, binary: s.type === 'yesno' }),
    }
  })
}

export default function YearComposite({
  series,
  trackers,
  today,
}: {
  series: TrackerSeries[]
  trackers: Record<string, Tracker>
  today: string
}) {
  // Year chips span every year ANY tracker has data in.
  const years = useMemo(() => {
    const merged: Record<string, number> = {}
    for (const s of series) for (const day of Object.keys(s.totals)) merged[day] = 1
    return trackedYears(merged, today)
  }, [series, today])

  const [year, setYear] = useState(years[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const rows = useMemo(() => buildRows(series, trackers, year, today), [series, trackers, year, today])
  const loggedDays = rows.reduce((n, r) => n + r.grid.loggedDays, 0)

  async function download() {
    setSaving(true)
    setError(null)
    try {
      const blob = await drawComposite(canvasRef.current, rows, year, loggedDays)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `year-in-pixels-${year}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setError('Could not build the poster image.')
    } finally {
      setSaving(false)
    }
  }

  if (rows.length === 0) return null

  return (
    <section className="mt-8">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-500">Your year in pixels</h2>
        <div className="flex items-center gap-1.5">
          {years.length > 1 && (
            <div className="flex overflow-hidden rounded-full border border-zinc-200">
              {years.map((y) => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={`px-2.5 py-1 text-[11px] font-medium transition ${
                    y === year ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:bg-zinc-100'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={download}
            disabled={saving}
            className="flex min-h-[32px] items-center gap-1 rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-medium text-zinc-500 transition hover:bg-zinc-50 hover:text-indigo-600 disabled:opacity-50"
          >
            <Download size={13} /> {saving ? 'Saving…' : 'Poster'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-3 ring-1 ring-black/5">
        {/* A year of days never fits a phone — the strips scroll as one block. */}
        <div className="overflow-x-auto">
          <Strips rows={rows} />
        </div>
        <p className="mt-2 text-[11px] text-zinc-400">
          {rows.length} {rows.length === 1 ? 'tracker' : 'trackers'} · {loggedDays} logged{' '}
          {loggedDays === 1 ? 'day' : 'days'} in {year} · each strip is shaded against its own year
        </p>
        {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </section>
  )
}

// ── On-screen strips ────────────────────────────────────────────────────────

const DAY_W = 3
const ROW_H = 13
const ROW_GAP = 4
const LABEL_W = 96
const HEAD_H = 14

// The index of each month's first day — month ticks for a day-indexed strip.
function monthTicks(grid: YearGrid): { month0: number; index: number }[] {
  const ticks: { month0: number; index: number }[] = []
  grid.cells.forEach((c, i) => {
    if (c.day.endsWith('-01')) ticks.push({ month0: Number(c.day.slice(5, 7)) - 1, index: i })
  })
  return ticks
}

function Strips({ rows }: { rows: Row[] }) {
  const days = rows[0].grid.cells.length
  const width = LABEL_W + days * DAY_W
  const height = HEAD_H + rows.length * (ROW_H + ROW_GAP)
  const ticks = monthTicks(rows[0].grid)

  return (
    <svg width={width} height={height} role="img" aria-label={`All trackers, ${rows[0].grid.year}`}>
      {ticks.map(({ month0, index }) => (
        <text
          key={month0}
          x={LABEL_W + index * DAY_W}
          y={10}
          className="fill-zinc-400"
          style={{ fontSize: 9 }}
        >
          {MONTHS_SHORT[month0]}
        </text>
      ))}
      {rows.map((row, r) => {
        const y = HEAD_H + r * (ROW_H + ROW_GAP)
        return (
          <g key={row.id}>
            <text x={0} y={y + ROW_H - 3} className="fill-zinc-600" style={{ fontSize: 10 }}>
              {row.emoji} {row.name.length > 11 ? row.name.slice(0, 10) + '…' : row.name}
            </text>
            {row.grid.cells.map((c, i) => (
              <rect
                key={c.day}
                x={LABEL_W + i * DAY_W}
                y={y}
                width={DAY_W - 0.5}
                height={ROW_H}
                fill={cellFill(row.color, c.level, c.inRange)}
              >
                <title>{`${row.name} · ${c.day}${c.logged ? `: ${c.total}` : ''}`}</title>
              </rect>
            ))}
          </g>
        )
      })}
    </svg>
  )
}

// ── PNG poster ──────────────────────────────────────────────────────────────

const P = {
  dayW: 4,
  rowH: 26,
  rowGap: 8,
  labelW: 210,
  pad: 48,
  headerH: 116,
  monthH: 24,
  footerH: 56,
  scale: 2,
}

function drawComposite(
  canvas: HTMLCanvasElement | null,
  rows: Row[],
  year: number,
  loggedDays: number,
): Promise<Blob> {
  if (!canvas) throw new Error('no canvas')
  const days = rows[0].grid.cells.length
  const stripW = days * P.dayW
  const w = P.pad * 2 + P.labelW + stripW
  const h = P.headerH + P.monthH + rows.length * (P.rowH + P.rowGap) + P.footerH

  canvas.width = w * P.scale
  canvas.height = h * P.scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  ctx.scale(P.scale, P.scale)

  const sans = 'system-ui, "Segoe UI", "Segoe UI Emoji", Roboto, Helvetica, Arial, sans-serif'

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#18181b'
  ctx.font = `600 32px ${sans}`
  ctx.fillText('Year in Pixels', P.pad, 58)

  ctx.fillStyle = '#6366f1'
  ctx.font = `700 32px ${sans}`
  ctx.textAlign = 'right'
  ctx.fillText(String(year), w - P.pad, 58)
  ctx.textAlign = 'left'

  ctx.fillStyle = '#71717a'
  ctx.font = `14px ${sans}`
  ctx.fillText(
    `${rows.length} ${rows.length === 1 ? 'tracker' : 'trackers'} · ${loggedDays} logged ${loggedDays === 1 ? 'day' : 'days'} · each strip shaded against its own year`,
    P.pad,
    84,
  )

  const stripX = P.pad + P.labelW
  const topY = P.headerH + P.monthH

  // Month ticks across the top of the strips.
  ctx.fillStyle = '#a1a1aa'
  ctx.font = `12px ${sans}`
  for (const { month0, index } of monthTicks(rows[0].grid)) {
    ctx.fillText(MONTHS_SHORT[month0], stripX + index * P.dayW, topY - 8)
  }

  rows.forEach((row, r) => {
    const y = topY + r * (P.rowH + P.rowGap)
    ctx.fillStyle = '#3f3f46'
    ctx.font = `15px ${sans}`
    const label = `${row.emoji} ${row.name}`
    // Trim long names to the label gutter rather than letting them collide.
    let text = label
    while (ctx.measureText(text).width > P.labelW - 16 && text.length > 4) {
      text = text.slice(0, -2)
    }
    ctx.fillText(text === label ? label : text + '…', P.pad, y + P.rowH - 7)

    row.grid.cells.forEach((c, i) => {
      ctx.fillStyle = cellFill(row.color, c.level, c.inRange)
      ctx.fillRect(stripX + i * P.dayW, y, P.dayW - 0.5, P.rowH)
    })
  })

  const footY = topY + rows.length * (P.rowH + P.rowGap) + 26
  ctx.fillStyle = '#d4d4d8'
  ctx.font = `12px ${sans}`
  ctx.textAlign = 'right'
  ctx.fillText('dailytally', w - P.pad, footY)
  ctx.textAlign = 'left'

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png')
  })
}
