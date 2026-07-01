'use client'

import { useState } from 'react'
import { X, Plus, GripVertical } from 'lucide-react'
import { createTracker, createStep } from '@/lib/db'
import { defaultStreakSide } from '@/lib/stats'
import { COLORS, EMOJIS } from '@/lib/constants'
import type { Tracker, TrackerType, GoalDirection, StreakSide, TrackerStep } from '@/lib/types'

export default function AddTrackerModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (t: Tracker, steps: TrackerStep[]) => void
}) {
  const [name, setName] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [type, setType] = useState<TrackerType>('yesno')
  const [goal, setGoal] = useState<GoalDirection>('more')
  const [streakSide, setStreakSide] = useState<StreakSide>('did')
  const [emoji, setEmoji] = useState(EMOJIS[0])
  const [color, setColor] = useState(COLORS[0])
  const [unit, setUnit] = useState('')
  const [steps, setSteps] = useState<string[]>(['', ''])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSeries = type === 'series'

  // Picking a goal sets a sensible default streak side (avoid-goals streak on
  // clean days); the user can still flip it below.
  function pickGoal(g: GoalDirection) {
    setGoal(g)
    setStreakSide(defaultStreakSide(g))
  }

  async function submit() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Give it a name first.')
      return
    }
    const stepLabels = steps.map((s) => s.trim()).filter(Boolean)
    if (isSeries && stepLabels.length === 0) {
      setError('Add at least one step.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const t = await createTracker({
        name: trimmed,
        subtitle: subtitle.trim() || null,
        type,
        color,
        emoji,
        unit: type === 'yesno' || isSeries ? null : unit.trim() || null,
        // series: more steps done is the win; streak counts days you did it
        goal_direction: isSeries ? 'more' : goal,
        streak_side: type === 'measure' || isSeries ? 'did' : streakSide,
      })
      const created = isSeries
        ? await Promise.all(stepLabels.map((label, i) => createStep(t.id, label, i)))
        : []
      onCreated(t, created)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Check your connection.')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-200 sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New tracker</h2>
          <button onClick={onClose} className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100">
            <X size={20} />
          </button>
        </div>

        {/* Name */}
        <label className="mb-1 block text-sm font-medium text-zinc-600">What do you want to track?</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !saving && submit()}
          placeholder="e.g. Standard drinks, Chia seeds…"
          className="mb-3 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-indigo-500"
        />
        <input
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !saving && submit()}
          maxLength={200}
          placeholder="Subtitle (optional, e.g. a short description)"
          className="mb-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />

        {/* Type */}
        <label className="mb-1 block text-sm font-medium text-zinc-600">How do you log it?</label>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <TypeButton
            active={type === 'yesno'}
            title="Yes / No"
            sub="Did it or not"
            onClick={() => setType('yesno')}
          />
          <TypeButton
            active={type === 'count'}
            title="Count"
            sub="How many"
            onClick={() => setType('count')}
          />
          <TypeButton
            active={type === 'measure'}
            title="Measure"
            sub="A number, e.g. weight"
            onClick={() => setType('measure')}
          />
          <TypeButton
            active={type === 'series'}
            title="Series"
            sub="A checklist of steps"
            onClick={() => setType('series')}
          />
        </div>

        {/* Steps editor (series only) */}
        {isSeries && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-zinc-600">
              Steps <span className="font-normal text-zinc-400">(in order)</span>
            </label>
            <div className="space-y-2">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <GripVertical size={15} className="flex-none text-zinc-300" />
                  <input
                    value={s}
                    onChange={(e) => setSteps((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        setSteps((arr) => [...arr, ''])
                      }
                    }}
                    maxLength={120}
                    placeholder={`Step ${i + 1} (e.g. brush teeth)`}
                    className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={() => setSteps((arr) => (arr.length > 1 ? arr.filter((_, j) => j !== i) : arr))}
                    aria-label={`Remove step ${i + 1}`}
                    className="flex-none rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-red-600"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setSteps((arr) => [...arr, ''])}
              className="mt-2 flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-indigo-600"
            >
              <Plus size={14} /> Add step
            </button>
          </div>
        )}

        {/* Unit (count + measure) */}
        {(type === 'count' || type === 'measure') && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-zinc-600">
              Unit <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder={type === 'measure' ? 'e.g. lbs, kg, %' : 'e.g. drinks, glasses, times'}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
          </div>
        )}

        {/* Goal direction — not used for series (more steps done is the win) */}
        {!isSeries && (
          <>
            <label className="mb-1 block text-sm font-medium text-zinc-600">
              {type === 'measure' ? 'Which direction is your goal?' : 'Is doing this good or bad for you?'}
            </label>
            <div className="mb-4 grid grid-cols-3 gap-2">
              {type === 'measure' ? (
                <>
                  <GoalButton active={goal === 'less'} title="Lower" sub="down 💚" onClick={() => pickGoal('less')} />
                  <GoalButton active={goal === 'more'} title="Higher" sub="up 💚" onClick={() => pickGoal('more')} />
                  <GoalButton active={goal === 'neutral'} title="Just track" sub="no goal" onClick={() => pickGoal('neutral')} />
                </>
              ) : (
                <>
                  <GoalButton active={goal === 'more'} title="Good" sub="more = 💚" onClick={() => pickGoal('more')} />
                  <GoalButton active={goal === 'less'} title="Bad" sub="less = 💚" onClick={() => pickGoal('less')} />
                  <GoalButton active={goal === 'neutral'} title="Neutral" sub="just count" onClick={() => pickGoal('neutral')} />
                </>
              )}
            </div>
          </>
        )}

        {/* Streak side — not meaningful for measure/series */}
        {type !== 'measure' && !isSeries && (
          <>
        <label className="mb-1 block text-sm font-medium text-zinc-600">Which streak do you want to celebrate?</label>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <GoalButton
            active={streakSide === 'did'}
            title="Days I did it"
            sub={type === 'count' ? 'logged ≥ 1' : 'marked done'}
            onClick={() => setStreakSide('did')}
          />
          <GoalButton
            active={streakSide === 'skipped'}
            title="Days I skipped"
            sub="kept it at zero"
            onClick={() => setStreakSide('skipped')}
          />
        </div>
          </>
        )}

        {/* Emoji */}
        <label className="mb-1 block text-sm font-medium text-zinc-600">Icon</label>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg ${
                emoji === e ? 'bg-indigo-100 ring-2 ring-indigo-500' : 'bg-zinc-100 hover:bg-zinc-200'
              }`}
            >
              {e}
            </button>
          ))}
        </div>

        {/* Color */}
        <label className="mb-1 block text-sm font-medium text-zinc-600">Color</label>
        <div className="mb-5 flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`color ${c}`}
              className={`h-8 w-8 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-zinc-900' : ''}`}
              style={{ background: c }}
            />
          ))}
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <button
          onClick={submit}
          disabled={saving}
          className="w-full rounded-lg bg-indigo-600 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Creating…' : 'Create tracker'}
        </button>
      </div>
    </div>
  )
}

function TypeButton({
  active,
  title,
  sub,
  onClick,
}: {
  active: boolean
  title: string
  sub: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border p-3 text-left ${
        active ? 'border-indigo-500 bg-indigo-50' : 'border-zinc-300 hover:bg-zinc-50'
      }`}
    >
      <div className="font-medium">{title}</div>
      <div className="text-xs text-zinc-500">{sub}</div>
    </button>
  )
}

function GoalButton({
  active,
  title,
  sub,
  onClick,
}: {
  active: boolean
  title: string
  sub: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-2 py-2 text-center ${
        active ? 'border-indigo-500 bg-indigo-50' : 'border-zinc-300 hover:bg-zinc-50'
      }`}
    >
      <div className="text-sm font-medium">{title}</div>
      <div className="text-[11px] text-zinc-500">{sub}</div>
    </button>
  )
}
