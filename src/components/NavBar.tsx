import { useEffect, useState, type JSX } from 'react'
import { useStore } from '../store/useStore'
import { zones } from '../data'
import { playClick } from '../utils/sounds'

const icons: Record<string, JSX.Element> = {
  about: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  ),
  skills: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18v3h3l5.7-5.7a4.5 4.5 0 0 0 6-6L15 12l-3-3 2.7-2.7Z" />
    </svg>
  ),
  projects: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v11Z" />
    </svg>
  ),
  contact: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  ),
}

export default function NavBar(): JSX.Element {
  const activeZone = useStore((s) => s.activeZone)
  const isPanelOpen = useStore((s) => s.isPanelOpen)
  const introDone = useStore((s) => s.introDone)
  const setActiveZone = useStore((s) => s.setActiveZone)
  const setIsPanelOpen = useStore((s) => s.setIsPanelOpen)
  const markZoneVisited = useStore((s) => s.markZoneVisited)

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
    playClick()
    setActiveZone(key)
    setIsPanelOpen(true)
    markZoneVisited(key)
  }

  return (
    <nav className="pointer-events-none absolute left-1/2 top-5 z-20 -translate-x-1/2">
      <div
        className={`pointer-events-auto flex gap-1 rounded-full border border-white/15 bg-black/40 p-1.5 backdrop-blur ${
          pulse ? 'animate-nav-pulse' : ''
        }`}
      >
        {zones.map((zone) => {
          const active = isPanelOpen && activeZone === zone.key
          return (
            <button
              key={zone.key}
              type="button"
              onClick={() => openZone(zone.key)}
              className={`group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                active
                  ? 'bg-amber-400 text-slate-900'
                  : 'text-white/80 hover:bg-white/15 hover:text-white active:scale-95'
              }`}
            >
              <span className={active ? 'text-slate-900' : 'text-amber-300'}>
                {icons[zone.key]}
              </span>
              {zone.title}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
