import { useEffect, useState, type JSX } from 'react'
import { useStore } from '../store/useStore'
import { zones, landmarks } from '../data'
import { ZoneIcon } from './icons'
import { playClick } from '../utils/sounds'

export default function NavBar(): JSX.Element {
  const activeZone = useStore((s) => s.activeZone)
  const isPanelOpen = useStore((s) => s.isPanelOpen)
  const introDone = useStore((s) => s.introDone)
  const setActiveZone = useStore((s) => s.setActiveZone)
  const setIsPanelOpen = useStore((s) => s.setIsPanelOpen)
  const markZoneVisited = useStore((s) => s.markZoneVisited)
  const showToast = useStore((s) => s.showToast)
  const setTargetLandmark = useStore((s) => s.setTargetLandmark)

  const [pulse, setPulse] = useState(false)

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
  }

  return (
    <nav className="pointer-events-none absolute left-1/2 top-5 z-20 -translate-x-1/2">
      <div
        className={`pointer-events-auto flex gap-1.5 rounded-full border border-white/15 bg-black/40 p-1.5 backdrop-blur ${
          pulse ? 'animate-nav-pulse' : ''
        }`}
      >
        {zones.map((zone) => {
          const active = isPanelOpen && activeZone === zone.key
          return (
            <button
              key={zone.key}
              type="button"
              title={zone.title}
              disabled={!introDone}
              onClick={() => openZone(zone.key)}
              className={`group flex items-center gap-2 rounded-full px-2.5 py-1.5 text-sm font-medium transition-all duration-200 ${
                active
                  ? 'bg-amber-400 text-slate-900'
                  : introDone
                    ? 'text-white/80 hover:bg-white/15 hover:text-white active:scale-95'
                    : 'cursor-not-allowed text-white/40 hover:bg-transparent hover:text-white/40'
              }`}
            >
              <span className={active ? 'text-slate-900' : 'text-amber-300'}>
                <ZoneIcon zone={zone.key} className="h-3.5 w-3.5" />
              </span>
              <span className="hidden lg:inline">{zone.title}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
