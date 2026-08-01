import { useEffect, useRef, useState, type JSX } from 'react'
import { useStore } from '../store/useStore'
import { playClick } from '../utils/sounds'
import { identity } from '../data'

function ToggleRow({
  label,
  on,
  onToggle,
}: {
  label: string
  on: boolean
  onToggle: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm text-slate-200 transition hover:bg-white/10"
    >
      <span>{label}</span>
      <span
        className={`h-5 w-9 rounded-full border transition-colors ${
          on ? 'border-amber-400/60 bg-amber-400' : 'border-white/20 bg-white/10'
        }`}
      >
        <span
          className={`block h-4 w-4 translate-y-[1px] rounded-full bg-white shadow transition-transform ${
            on ? 'translate-x-[18px]' : 'translate-x-[1px]'
          }`}
        />
      </span>
    </button>
  )
}

/**
 * Single top-right menu: one gear icon opens one dropdown containing sound,
 * reduced-graphics, the controls reference and about-this-site info — instead
 * of several separate floating toolbar buttons.
 */
export default function Menu(): JSX.Element | null {
  const introDone = useStore((s) => s.introDone)
  const settings = useStore((s) => s.settings)
  const toggleMuted = useStore((s) => s.toggleMuted)
  const toggleLowGraphics = useStore((s) => s.toggleLowGraphics)
  const setPrefersSimple = useStore((s) => s.setPrefersSimple)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Kept hidden while the intro's Skip button owns the top-right corner.
  if (!introDone) return null

  const toggle = () => {
    playClick()
    setOpen((o) => !o)
  }

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute right-5 top-5 z-30 flex flex-col items-end gap-2"
    >
      <button
        type="button"
        title="Menu"
        aria-label="Menu"
        aria-expanded={open}
        onClick={toggle}
        className={`pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/80 backdrop-blur transition-all duration-200 ${
          open
            ? 'bg-white/15 text-white'
            : 'hover:bg-white/15 hover:text-white active:scale-95'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>

      {open && (
        <div className="animate-welcome pointer-events-auto w-72 rounded-2xl border border-white/15 bg-slate-900/90 p-4 text-slate-100 shadow-2xl shadow-black/50 backdrop-blur">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-amber-400/90">
            Settings
          </div>
          <ToggleRow label="Sound" on={!settings.muted} onToggle={toggleMuted} />
          <ToggleRow
            label="Reduced graphics"
            on={settings.lowGraphics}
            onToggle={toggleLowGraphics}
          />

          <div className="my-3 h-px bg-white/10" />

          <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-amber-400/90">
            Controls
          </div>
          <ul className="space-y-1.5 text-sm text-slate-300">
            <li>
              <b className="text-white">W / S</b> — throttle / brake (the engine
              auto-starts; in R, S accelerates backward)
            </li>
            <li>
              <b className="text-white">G</b> — start / stop the engine
            </li>
            <li>
              <b className="text-white">A / D</b> or <b className="text-white">Arrows</b> — steer
            </li>
            <li>
              <b className="text-white">R</b> — reverse gear (only when stopped)
            </li>
            <li>
              <b className="text-white">Right-drag</b> or <b className="text-white">Q / E</b> — look around
            </li>
            <li>
              <b className="text-white">H</b> — honk
            </li>
            <li>
              <b className="text-white">Click a landmark</b> — open its info
            </li>
            <li>
              <b className="text-white">Minimap</b> — fly to a landmark
            </li>
          </ul>

          <div className="my-3 h-px bg-white/10" />

          <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-amber-400/90">
            About this site
          </div>
          <p className="text-sm leading-relaxed text-slate-300">
            An interactive 3D portfolio built with React Three Fiber, Rapier physics and
            Vite. Drive around a stylized Kathmandu valley to explore {identity.name}’s work.
          </p>

          <div className="my-3 h-px bg-white/10" />

          <button
            type="button"
            onClick={() => {
              playClick()
              setPrefersSimple(true)
            }}
            className="flex w-full items-center justify-center rounded-full bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
          >
            Prefer a simple page?
          </button>
        </div>
      )}
    </div>
  )
}
