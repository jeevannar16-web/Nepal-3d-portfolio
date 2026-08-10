import { useEffect, useRef, useState, type JSX } from 'react'
import {
  ACTION_LABELS,
  ACTION_ORDER,
  useControls,
  keyLabel,
  type ControlAction,
} from '../store/controlsStore'
import { playClick } from '../utils/sounds'
import ToggleRow from './ToggleRow'

/**
 * The dedicated Controls / Games panel: every action's current keys shown as
 * chips, click-to-rebind (press the new key), plus quick toggles (grow/shrink
 * model) and a reset. All bindings live in the persisted controlsStore, so
 * they apply to the keyboard and the on-screen touch controls at once.
 */
export default function ControlsPanel(): JSX.Element {
  const bindings = useControls((s) => s.bindings)
  const setBinding = useControls((s) => s.setBinding)
  const resetBindings = useControls((s) => s.resetBindings)
  const bigMode = useControls((s) => s.bigMode)
  const setBigMode = useControls((s) => s.setBigMode)

  const [rebinding, setRebinding] = useState<ControlAction | null>(null)
  const [prompt, setPrompt] = useState(false)

  // While rebinding, capture the next real key press and store it as the new
  // spec. Modifiers held at that moment are baked into a chord spec (e.g.
  // Ctrl+Home), Escape cancels.
  const rebindListener = useRef<null | (() => void)>(null)

  useEffect(() => {
    if (!rebinding) return
    setPrompt(true)
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setRebinding(null)
        setPrompt(false)
        return
      }
      if (e.key === 'Control' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Meta') return
      const mods: string[] = []
      if (e.ctrlKey) mods.push('Control')
      if (e.shiftKey) mods.push('Shift')
      if (e.altKey) mods.push('Alt')
      const spec = [...mods, e.code].join('+')
      playClick()
      setBinding(rebinding, spec)
      setRebinding(null)
      setPrompt(false)
    }
    const t = setTimeout(() => setPrompt(false), 6000)
    window.addEventListener('keydown', onKeyDown, true)
    rebindListener.current = () => {
      window.removeEventListener('keydown', onKeyDown, true)
      clearTimeout(t)
    }
    return () => {
      rebindListener.current?.()
      rebindListener.current = null
    }
  }, [rebinding, setBinding])

  const chip = 'rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-xs font-bold text-amber-200'

  return (
    <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
      <section className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="text-[11px] font-bold uppercase tracking-widest text-amber-400/90">
            Control bindings
          </div>
          <button
            type="button"
            onClick={() => {
              playClick()
              resetBindings()
            }}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold text-white/70 transition hover:bg-white/15 hover:text-white"
          >
            Reset
          </button>
        </div>
        <p className="mb-2 px-1 text-[11px] font-semibold leading-snug text-white/50">
          Tap a key to change it. Keys apply to walking and every vehicle.
        </p>

        <div className="space-y-1.5 pr-1">{ACTION_ORDER.map((action) => (
            <div
              key={action}
              className={`flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 transition ${
                rebinding === action
                  ? 'border-amber-400/70 bg-amber-400/15'
                  : 'border-white/5 bg-black/20'
              }`}
            >
              <span className="min-w-0 text-xs font-bold text-slate-200">
                {ACTION_LABELS[action]}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                {bindings[action].map((spec) => (
                  <span key={spec} className={chip}>
                    {keyLabel(spec)}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    playClick()
                    setRebinding(rebinding === action ? null : action)
                  }}
                  className={`ml-1 rounded-md px-2 py-1 text-[11px] font-bold transition ${
                    rebinding === action
                      ? 'bg-amber-400 text-slate-900'
                      : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/15 hover:text-white'
                  }`}
                >
                  {rebinding === action ? 'Listening…' : 'Change'}
                </button>
              </span>
            </div>
          ))}
        </div>

        {prompt && (
          <div className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-2 py-1.5 text-[11px] font-semibold text-amber-100/70">
            Press the new key (Esc cancels)
          </div>
        )}
      </section>

      <section className="flex flex-col rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-amber-400/90">
          Quick toggles
        </div>
        <ToggleRow
          label="Grow / shrink model"
          hint="Make the character bigger (moves slower)"
          on={bigMode}
          onToggle={() => setBigMode(!bigMode)}
        />
        <div className="mt-auto px-2 pt-3 text-[11px] font-semibold leading-relaxed text-white/50">
          Your key choices are saved on this device and reset to defaults with
          the Reset button.
        </div>
      </section>
    </div>
  )
}
