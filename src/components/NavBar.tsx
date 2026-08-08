import { useEffect, useRef, useState, type JSX } from 'react'
import { useStore } from '../store/useStore'
import { zones, landmarks, identity } from '../data'
import { transportState, type TransportMode } from '../store/transportState'
import type { TimeOfDay } from '../utils/timeOfDay'
import type { WeatherKind } from '../utils/weather'
import { ZoneIcon } from './icons'
import ToggleRow from './ToggleRow'
import { playClick } from '../utils/sounds'

const columnOrder = ['about', 'skills', 'projects', 'story', 'contact']

const TIMES: { value: TimeOfDay; label: string }[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'day', label: 'Day' },
  { value: 'dusk', label: 'Dusk' },
  { value: 'night', label: 'Night' },
]

const WEATHERS: { value: WeatherKind; label: string }[] = [
  { value: 'clear', label: 'Clear' },
  { value: 'rain', label: 'Rain' },
  { value: 'fog', label: 'Fog' },
]

const VEHICLES: { mode: TransportMode | 'airplane2'; label: string; hint: string; flying?: boolean }[] = [
  { mode: 'car', label: 'Car', hint: 'On the road, wherever you parked it' },
  { mode: 'bike', label: 'Motorcycle', hint: 'Fast and nimble on the roads' },
  { mode: 'horse', label: 'Horse', hint: 'A relaxed trot around the valley' },
  {
    mode: 'airplane',
    label: 'Airplane',
    hint: 'At the airstrip. W/S throttle, A/D steer',
    flying: true,
  },
  {
    mode: 'airplane2',
    label: 'Runway plane',
    hint: 'The parked twin at the second airstrip',
    flying: true,
  },
  {
    mode: 'balloon',
    label: 'Hot-air balloon',
    hint: 'Float up and drift across the sky',
    flying: true,
  },
]

type Tab = 'explore' | 'transport' | 'settings' | 'about'

const TAB_LABELS: { value: Tab; label: string }[] = [
  { value: 'explore', label: 'Explore' },
  { value: 'transport', label: 'Transport' },
  { value: 'settings', label: 'Settings' },
  { value: 'about', label: 'About' },
]

const glassBtn =
  'pointer-events-auto flex items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/80 backdrop-blur transition-all duration-200 active:scale-95'

export default function NavBar(): JSX.Element {
  const activeZone = useStore((s) => s.activeZone)
  const isPanelOpen = useStore((s) => s.isPanelOpen)
  const introDone = useStore((s) => s.introDone)
  const playerMode = useStore((s) => s.playerMode)
  const timeOfDay = useStore((s) => s.timeOfDay)
  const setTimeOfDay = useStore((s) => s.setTimeOfDay)
  const weather = useStore((s) => s.weather)
  const setWeather = useStore((s) => s.setWeather)
  const settings = useStore((s) => s.settings)
  const toggleMuted = useStore((s) => s.toggleMuted)
  const toggleLowGraphics = useStore((s) => s.toggleLowGraphics)
  const setCameraSensitivity = useStore((s) => s.setCameraSensitivity)
  const setActiveZone = useStore((s) => s.setActiveZone)
  const setIsPanelOpen = useStore((s) => s.setIsPanelOpen)
  const markZoneVisited = useStore((s) => s.markZoneVisited)
  const showToast = useStore((s) => s.showToast)
  const setTargetLandmark = useStore((s) => s.setTargetLandmark)
  const setPrefersSimple = useStore((s) => s.setPrefersSimple)
  const replayIntro = useStore((s) => s.replayIntro)
  const setPlayerMode = useStore((s) => s.setPlayerMode)

  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('explore')
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

  // Transport garage: hop straight into a parked vehicle from anywhere on foot.
  // Each vehicle is already where the player left it (transportState pose), so
  // this just hands control over — the body was syncing there every frame.
  const boardVehicle = (mode: TransportMode | 'airplane2') => {
    if (!introDone || playerMode !== 'walk') return
    playClick()
    if (mode === 'airplane' || mode === 'airplane2') {
      transportState.activePlane = mode
      setPlayerMode('airplane')
      setOpen(false)
      return
    }
    setPlayerMode(mode)
    setOpen(false)
  }

  const vehicleGlyph = (mode: TransportMode | 'airplane2'): JSX.Element => {
    const common = {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '2',
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const,
      className: 'h-6 w-6',
    }
    switch (mode) {
      case 'car':
        return (
          <svg {...common} aria-hidden="true">
            <path d="M4 16v-3l1.5-4A2 2 0 0 1 7.4 8h9.2a2 2 0 0 1 1.9 1.5L20 13v3" />
            <circle cx="7" cy="17" r="2" />
            <circle cx="17" cy="17" r="2" />
            <path d="M4 16h16" />
          </svg>
        )
      case 'bike':
        return (
          <svg {...common} aria-hidden="true">
            <circle cx="6" cy="17" r="3" />
            <circle cx="18" cy="17" r="3" />
            <path d="M6 17h4l4-8h4l2 4-4 4" />
            <path d="M10 9h6" />
          </svg>
        )
      case 'horse':
        return (
          <svg {...common} aria-hidden="true">
            <path d="M8 20c1-3 3-6 4-9l1-4-3-2 1-2 4 1c3 1 4 4 4 7" />
            <path d="M5 20h4" />
            <path d="M12 7c1-2 2-3 4-2" />
          </svg>
        )
      case 'airplane':
      case 'airplane2':
        return (
          <svg {...common} aria-hidden="true">
            <path d="M3 12l6-2 3-6 3 6 6 2-6 2-3 6-3-6-6-2z" />
          </svg>
        )
      case 'balloon':
        return (
          <svg {...common} aria-hidden="true">
            <circle cx="12" cy="8" r="6" />
            <path d="M10 14l-3 6M14 14l3 6" />
          </svg>
        )
      default:
        return <span className="h-6 w-6" />
    }
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
        className={`${glassBtn} h-9 w-9 ${
          open
            ? 'border-amber-400/60 bg-white/15 text-amber-300'
            : 'hover:bg-white/15 hover:text-white'
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
        <div className="animate-welcome pointer-events-auto mt-3 w-[min(92vw,60rem)] rounded-2xl border border-white/15 bg-slate-900/90 p-5 text-slate-100 shadow-2xl shadow-black/50 backdrop-blur">
          {/* Tabs */}
          <div className="mb-4 flex flex-wrap gap-2">
            {TAB_LABELS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  playClick()
                  setTab(t.value)
                }}
                className={`rounded-full px-4 py-1.5 text-sm font-bold transition-all ${
                  tab === t.value
                    ? 'bg-amber-400 text-slate-900'
                    : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Explore */}
          {tab === 'explore' && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
          )}

          {/* Transport */}
          {tab === 'transport' && (
            <div className="space-y-3">
              {playerMode !== 'walk' && (
                <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-200">
                  Get out of your current vehicle first (press the Exit button or
                  Z/Esc) before switching rides.
                </p>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {VEHICLES.map((v) => {
                  const boardable = playerMode === 'walk'
                  return (
                    <button
                      key={v.mode}
                      type="button"
                      disabled={!boardable}
                      onClick={() => boardVehicle(v.mode)}
                      className={`group flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 ${
                        boardable
                          ? 'border-white/10 bg-white/5 hover:border-amber-400/50 hover:bg-white/10'
                          : 'cursor-not-allowed border-white/5 bg-white/[0.02] opacity-50'
                      }`}
                    >
                      <span className="shrink-0 text-amber-300/90">{vehicleGlyph(v.mode)}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-white">{v.label}</span>
                        <span className="block text-xs font-semibold leading-snug text-white/60">
                          {v.hint}
                        </span>
                        {v.flying && (
                          <span className="mt-1 inline-block rounded-full bg-sky-400/10 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                            Exit opens the parachute
                          </span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Settings */}
          {tab === 'settings' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <section className="flex flex-col rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-amber-400/90">
                  Sound & graphics
                </div>
                <ToggleRow label="Sound" on={!settings.muted} onToggle={toggleMuted} />
                <ToggleRow
                  label="Reduced graphics"
                  on={settings.lowGraphics}
                  onToggle={toggleLowGraphics}
                />
                <div className="mt-2 px-2">
                  <div className="flex items-center justify-between text-sm text-slate-200">
                    <span>Camera sensitivity</span>
                    <span className="font-bold text-amber-300">
                      {settings.cameraSensitivity.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={settings.cameraSensitivity}
                    onChange={(e) => setCameraSensitivity(parseFloat(e.target.value))}
                    className="mt-2 w-full accent-amber-400"
                    aria-label="Camera sensitivity"
                  />
                </div>
              </section>

              <section className="flex flex-col rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-amber-400/90">
                  World
                </div>
                <div className="mb-1 px-2 text-sm text-slate-200">Time of day</div>
                <div className="flex flex-wrap gap-2 px-2 pb-2">
                  {TIMES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => {
                        playClick()
                        setTimeOfDay(t.value)
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                        timeOfDay === t.value
                          ? 'bg-amber-400 text-slate-900'
                          : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="mb-1 px-2 text-sm text-slate-200">Weather</div>
                <div className="flex flex-wrap gap-2 px-2 pb-2">
                  {WEATHERS.map((w) => (
                    <button
                      key={w.value}
                      type="button"
                      onClick={() => {
                        playClick()
                        setWeather(w.value)
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                        weather === w.value
                          ? 'bg-amber-400 text-slate-900'
                          : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playClick()
                    setPrefersSimple(true)
                  }}
                  className="mt-auto flex w-full items-center justify-center rounded-full bg-white/10 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/20"
                >
                  Prefer a simple page?
                </button>
              </section>
            </div>
          )}

          {/* About */}
          {tab === 'about' && (
            <div className="flex flex-col rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-amber-400/90">
                About this site
              </div>
              <p className="text-sm font-semibold leading-relaxed text-slate-200">
                An interactive 3D portfolio built with React Three Fiber, Rapier physics and
                Vite. Drive around a stylized Kathmandu valley to explore {identity.name}’s work
                — walk the streets, ride, drive, and fly to every landmark.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    playClick()
                    setOpen(false)
                    replayIntro()
                  }}
                  className="flex items-center justify-center rounded-full bg-amber-400 px-3 py-2 text-sm font-bold text-slate-900 transition hover:bg-amber-300"
                >
                  Replay the intro flight
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playClick()
                    setPrefersSimple(true)
                  }}
                  className="flex items-center justify-center rounded-full bg-white/10 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/20"
                >
                  Prefer a simple page?
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </nav>
  )
}
