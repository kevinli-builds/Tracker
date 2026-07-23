'use client'

// Year in Pixels (OPUS_BRIEF §4 D1) — a full calendar year of one tracker as a
// Mon→Sun pixel grid, downloadable as a PNG poster. The grid math is pure and
// tested (`lib/stats.ts` yearGrid); this file is layout + the canvas draw.
//
// Ethos: the ramp is relative to the tracker's own year (never a comparison),
// untracked days render fainter than tracked-but-empty ones, and no copy here
// scores the user — it states what happened.

import { useMemo, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import type { Tracker, DayTotals } from '@/lib/types'
import { yearGrid, trackedYears, type YearGrid, type YearLevel } from '@/lib/stats'
import { cellFill, slug, MONTHS_SHORT } from '@/lib/pixels'
import { fmtNum } from '@/lib/format'
import { shortDay } from '@/lib/date'

// Row labels: only Mon/Wed/Fri, like every calendar heatmap — 7 labels is noise.
const ROW_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', '']

export default function YearPixels({
  tracker,
  totals,
  since,
  today,
}: {
  tracker: Tracker
  totals: DayTotals
  since: string
  today: string
}) {
  const years = useMemo(() => trackedYears(totals, today), [totals, today])
  const [year, setYear] = useState(years[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Yes/no has one meaningful state per day; everything else gets the ramp.
  const binary = tracker.type === 'yesno'
  const grid = useMemo(
    () => yearGrid(totals, year, { since, today, binary }),
    [totals, year, since, today, binary],
  )

  const unit = tracker.unit?.trim()
  const summary = grid.loggedDays
    ? `${grid.loggedDays} ${grid.loggedDays === 1 ? 'day' : 'days'} logged · ${fmtNum(grid.total)}${unit ? ` ${unit}` : ''} total`
    : 'Nothing logged this year yet'

  async function download() {
    setSaving(true)
    setError(null)
    try {
      const blob = await drawPoster(canvasRef.current, tracker, grid, summary)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${slug(tracker.name)}-${grid.year}-pixels.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      // Revoke on the next tick — Safari needs the URL alive through the click.
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setError('Could not build the poster image.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-500">Year in pixels</h2>
        <div className="flex items-center gap-1.5">
          {years.length > 1 && (
            <div className="flex overflow-hidden rounded-full border border-zinc-200">
              {years.map((y) => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={`px-2.5 py-1 text-[11px] font-medium transition ${
                    y === year ? 'text-white' : 'text-zinc-500 hover:bg-zinc-100'
                  }`}
                  style={y === year ? { background: tracker.color } : undefined}
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

      <div className="rounded-2xl border border-zinc-200 bg-white p-3">
        {/* 53 columns never fit a phone — the grid scrolls inside its own box. */}
        <div className="overflow-x-auto">
          <Grid grid={grid} color={tracker.color} />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
          <span>{summary}</span>
          <span className="flex items-center gap-1">
            Less
            {([0, 1, 2, 3, 4] as YearLevel[]).map((l) => (
              <i
                key={l}
                className="inline-block h-2.5 w-2.5 rounded-[2px]"
                style={{ background: cellFill(tracker.color, l, true) }}
              />
            ))}
            More
          </span>
        </div>
        {grid.best && (
          <p className="mt-1 text-[11px] text-zinc-400">
            Best day: {shortDay(grid.best.day)} · {fmtNum(grid.best.total)}
            {unit ? ` ${unit}` : ''}
          </p>
        )}
        {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}
      </div>

      {/* Offscreen scratch canvas for the PNG export. */}
      <canvas ref={canvasRef} className="hidden" />
    </section>
  )
}

// ── On-screen grid (SVG so the cells stay crisp at any zoom) ────────────────

const CELL = 11
const GAP = 3
const PITCH = CELL + GAP
const LABEL_W = 26
const MONTH_H = 14

function Grid({ grid, color }: { grid: YearGrid; color: string }) {
  const width = LABEL_W + grid.weeks * PITCH
  const height = MONTH_H + 7 * PITCH

  return (
    <svg width={width} height={height} role="img" aria-label={`${grid.year} activity grid`}>
      {grid.monthCols.map(({ month0, col }) => (
        <text
          key={month0}
          x={LABEL_W + col * PITCH}
          y={10}
          className="fill-zinc-400"
          style={{ fontSize: 9 }}
        >
          {MONTHS_SHORT[month0]}
        </text>
      ))}
      {ROW_LABELS.map((label, row) =>
        label ? (
          <text
            key={row}
            x={0}
            y={MONTH_H + row * PITCH + CELL - 1}
            className="fill-zinc-400"
            style={{ fontSize: 9 }}
          >
            {label}
          </text>
        ) : null,
      )}
      {grid.cells.map((c) => (
        <rect
          key={c.day}
          x={LABEL_W + c.col * PITCH}
          y={MONTH_H + c.row * PITCH}
          width={CELL}
          height={CELL}
          rx={2}
          fill={cellFill(color, c.level, c.inRange)}
        >
          {/* One string, not text + expression: React requires a single child in <title>. */}
          <title>{`${c.day}${c.logged ? `: ${fmtNum(c.total)}` : c.inRange ? ': —' : ''}`}</title>
        </rect>
      ))}
    </svg>
  )
}

// ── PNG poster ──────────────────────────────────────────────────────────────

const P = {
  cell: 20,
  gap: 5,
  pad: 44,
  labelW: 52,
  monthH: 26,
  headerH: 104,
  footerH: 62,
  scale: 2, // draw at 2× for a crisp poster on retina screens and in print
}

// Draw the poster onto `canvas` and resolve its PNG blob. Kept separate from
// the component so the layout above stays readable; throws if the browser
// refuses a 2D context or the blob (the caller shows a small error).
function drawPoster(
  canvas: HTMLCanvasElement | null,
  tracker: Tracker,
  grid: YearGrid,
  summary: string,
): Promise<Blob> {
  if (!canvas) throw new Error('no canvas')
  const pitch = P.cell + P.gap
  const gridW = grid.weeks * pitch - P.gap
  const w = P.pad * 2 + P.labelW + gridW
  const h = P.headerH + P.monthH + 7 * pitch + P.footerH

  canvas.width = w * P.scale
  canvas.height = h * P.scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  ctx.scale(P.scale, P.scale)

  const sans = 'system-ui, "Segoe UI", "Segoe UI Emoji", Roboto, Helvetica, Arial, sans-serif'

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)

  // Header: emoji + name on the left, year on the right in the tracker colour.
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#18181b'
  ctx.font = `600 30px ${sans}`
  ctx.fillText(`${tracker.emoji} ${tracker.name}`, P.pad, 56)

  ctx.fillStyle = tracker.color
  ctx.font = `700 30px ${sans}`
  ctx.textAlign = 'right'
  ctx.fillText(String(grid.year), w - P.pad, 56)
  ctx.textAlign = 'left'

  ctx.fillStyle = '#71717a'
  ctx.font = `14px ${sans}`
  ctx.fillText(summary, P.pad, 80)

  // Month labels.
  const gridX = P.pad + P.labelW
  const gridY = P.headerH + P.monthH
  ctx.fillStyle = '#a1a1aa'
  ctx.font = `12px ${sans}`
  for (const { month0, col } of grid.monthCols) {
    ctx.fillText(MONTHS_SHORT[month0], gridX + col * pitch, gridY - 9)
  }
  for (let row = 0; row < 7; row++) {
    if (ROW_LABELS[row]) ctx.fillText(ROW_LABELS[row], P.pad, gridY + row * pitch + P.cell - 4)
  }

  // Cells.
  for (const c of grid.cells) {
    ctx.fillStyle = cellFill(tracker.color, c.level, c.inRange)
    ctx.beginPath()
    ctx.roundRect(gridX + c.col * pitch, gridY + c.row * pitch, P.cell, P.cell, 4)
    ctx.fill()
  }

  // Footer: legend on the left, wordmark on the right.
  const footY = gridY + 7 * pitch + 32
  ctx.fillStyle = '#a1a1aa'
  ctx.font = `12px ${sans}`
  ctx.fillText('Less', P.pad, footY + 10)
  let swatchX = P.pad + 34
  for (const level of [0, 1, 2, 3, 4] as YearLevel[]) {
    ctx.fillStyle = cellFill(tracker.color, level, true)
    ctx.beginPath()
    ctx.roundRect(swatchX, footY, 12, 12, 3)
    ctx.fill()
    swatchX += 16
  }
  ctx.fillStyle = '#a1a1aa'
  ctx.fillText('More', swatchX + 4, footY + 10)

  ctx.textAlign = 'right'
  ctx.fillStyle = '#d4d4d8'
  ctx.fillText('dailytally', w - P.pad, footY + 10)
  ctx.textAlign = 'left'

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png')
  })
}
