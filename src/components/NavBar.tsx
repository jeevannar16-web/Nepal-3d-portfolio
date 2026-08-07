import { useEffect, useRef, useState, type JSX } from 'react'
import { useStore } from '../store/useStore'
import { zones, landmarks, identity } from '../data'
import { ZoneIcon } from './icons'
import ToggleRow from './ToggleRow'
import { playClick } from '../utils/sounds'

const columnOrder = ['about', 'skills', 'projects', 'story', 'contact']

export default function NavBar(): JSX.Element {
  const activeZone = useStore((s) => s.activeZone)
  const isPanelOpen = useStore((s) => s.isPanelOpen)
  const introDone = useStore((s) => s.introDone)
  const setActiveZone = useStore((s) => s.setActiveZone)
  const setIsPanelOpen = useStore((s) => s.setIsPanelOpen)
  const markZoneVisited = useStore((s) => s.markZoneVisited)
  const showToast = useStore((s) => s.showToast)
  const setTargetLandmark = useStore((s) => s.setTargetLandmark)
  const settings = useStore((s) => s.settings)
  const toggleMuted = useStore((s) => s.toggleMuted)
  const toggleLowGraphics = useStore((s) => s.toggleLowGraphics)
  const setPrefersSimple = useStore((s) => s.setPrefersSimple)
  const replayIntro = useStore((s) => s.replayIntro)

  const [open, setOpen] = useState(false)
  const [pulse, setPulse] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!introDone) return
    setPulse(false)
    const t = setTimeout(() => setPulse(true), 4000)
    const stop = setTimeout(() => setPulse(false), 5200)
    return () => {
      clearTimeout(t)
      clearTimeout(stop)
    }
  }, [introDone])

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

  const openZone = (key: string) => {
    // Nothing can open a panel while the intro is still playing, so the intro
    // overlay and a ContentPanel can never render at the same time.
    if (!introDone) return
    playClick()
    if (markZoneVisited(key)) {
      const zone = zones.find((z) => z.key === key)
      showToast(`${zone?.title ?? 'Zone'} unlocked!`)
    }
    // Remember the zone's landmark so the wayfinder can point the way back.
    const landmark = landmarks.find((l) => l.contentKey === key)
    setTargetLandmark(landmark ? landmark.id : null)
    setActiveZone(key)
    setIsPanelOpen(true)
    setOpen(false)
  }

  return (
    <nav
      ref={rootRef}
      className="pointer-events-none absolute right-5 top-5 z-30 flex flex-col items-end"
    >
      <button
        type="button"
        title="Menu"
        aria-label="Menu"
        aria-expanded={open}
        disabled={!introDone}
        onClick={() => {
          if (!introDone) return
          playClick()
          setOpen((o) => !o)
        }}
        className={`pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/80 backdrop-blur transition-all duration-200 ${
          open
            ? 'border-amber-400/60 bg-white/15 text-amber-300'
            : 'hover:bg-white/15 hover:text-white active:scale-95'
        } ${pulse ? 'animate-nav-pulse' : ''} ${
          introDone ? '' : 'cursor-not-allowed text-white/40'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>

      {open && (
        <div className="animate-welcome pointer-events-auto mt-3 w-[min(92vw,64rem)] rounded-2xl border border-white/15 bg-slate-900/90 p-5 text-slate-100 shadow-2xl shadow-black/50 backdrop-blur">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {/* Settings */}
            <section className="flex flex-col rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-amber-400/90">
                Settings
              </div>
              <ToggleRow label="Sound" on={!settings.muted} onToggle={toggleMuted} />
              <ToggleRow
                label="Reduced graphics"
                on={settings.lowGraphics}
                onToggle={toggleLowGraphics}
              />
            </section>

            {/* Zones */}
            {columnOrder.map((key) => {
              const zone = zones.find((z) => z.key === key)
              if (!zone) return null
              const active = isPanelOpen && activeZone === zone.key
              return (
                <button
                  key={zone.key}
                  type="button"
                  onClick={() => openZone(zone.key)}
                  className={`group flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all duration-200 ${
                    active
                      ? 'border-amber-400/70 bg-amber-400/15'
                      : 'border-white/10 bg-white/5 hover:border-amber-400/40 hover:bg-white/10'
                  }`}
                >
                  <span
                    className={`${
                      active ? 'text-amber-300' : 'text-white/70 group-hover:text-amber-300'
                    }`}
                  >
                    <ZoneIcon zone={zone.key} className="h-4 w-4" />
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      active ? 'text-amber-200' : 'text-white group-hover:text-amber-200'
                    }`}
                  >
                    {zone.title}
                  </span>
                  <span className="text-xs font-semibold leading-snug text-white/60">
                    {zone.subtitle}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="my-4 h-px bg-white/10" />

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Controls */}
            <section className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-amber-400/90">
                Controls
              </div>
              <ul className="space-y-1.5 text-sm font-semibold text-slate-200">
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
            </section>

            {/* About this site */}
            <section className="flex flex-col rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-amber-400/90">
                About this site
              </div>
              <p className="text-sm font-semibold leading-relaxed text-slate-200">
                An interactive 3D portfolio built with React Three Fiber, Rapier physics and
                Vite. Drive around a stylized Kathmandu valley to explore {identity.name}’s work.
              </p>
              <button
                type="button"
                onClick={() => {
                  playClick()
                  setOpen(false)
                  replayIntro()
                }}
                className="mt-3 flex w-full items-center justify-center rounded-full bg-amber-400 px-3 py-2 text-sm font-bold text-slate-900 transition hover:bg-amber-300"
              >
                Replay the intro flight
              </button>
              <button
                type="button"
                onClick={() => {
                  playClick()
                  setPrefersSimple(true)
                }}
                className="mt-2 flex w-full items-center justify-center rounded-full bg-white/10 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/20"
              >
                Prefer a simple page?
              </button>
            </section>
          </div>
        </div>
      )}
    </nav>
  )
}
