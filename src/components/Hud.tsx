import { useEffect, useState, type JSX } from 'react'
import { identity } from '../data'
import { useStore } from '../store/useStore'

export default function Hud(): JSX.Element | null {
  const introDone = useStore((s) => s.introDone)
  const [hintFaded, setHintFaded] = useState(false)

  useEffect(() => {
    if (!introDone) return
    setHintFaded(false)
    const t = setTimeout(() => setHintFaded(true), 8000)
    return () => clearTimeout(t)
  }, [introDone])

  // Identity + drive hint live as a centered title at the top — hidden while
  // the intro overlay already shows the name in the sky.
  if (!introDone) return null

  return (
    <div className="pointer-events-none absolute left-0 top-5 z-10 flex w-full flex-col items-center gap-2">
      <div className="flex flex-col items-center">
        <h1 className="text-xl font-extrabold text-white drop-shadow-lg sm:text-2xl">
          {identity.name}
        </h1>
        <p className="text-sm font-bold text-white/90 drop-shadow">
          {identity.role} · {identity.location}
        </p>
      </div>
      {/* Fades to a faint reminder after a few seconds so the title stays clean. */}
      <div
        className={`transition-opacity duration-1000 ${
          hintFaded ? 'opacity-50' : 'opacity-100'
        }`}
      >
        <div className="rounded-full border border-white/15 bg-black/40 px-4 py-2 text-center text-xs font-semibold text-white/90 backdrop-blur">
          Press <span className="font-bold text-amber-300">W</span> to drive — engine starts automatically ·{' '}
          <span className="font-bold text-amber-300">G</span> stops it
        </div>
      </div>
    </div>
  )
}
