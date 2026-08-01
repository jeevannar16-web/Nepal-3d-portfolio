import { useEffect, useState, type JSX } from 'react'
import { identity } from '../data'
import { useStore } from '../store/useStore'

export default function Hud(): JSX.Element {
  const introDone = useStore((s) => s.introDone)
  const [hintFaded, setHintFaded] = useState(false)

  useEffect(() => {
    setHintFaded(false)
    const t = setTimeout(() => setHintFaded(true), 8000)
    return () => clearTimeout(t)
  }, [introDone])

  return (
    <div className="pointer-events-none absolute left-0 top-0 z-10 flex w-full items-start justify-between p-5">
      <div>
        <h1 className="text-xl font-bold text-white drop-shadow-lg sm:text-2xl">
          {identity.name}
        </h1>
        <p className="text-sm text-white/80 drop-shadow">
          {identity.role} · {identity.location}
        </p>
      </div>
      {/* Hidden while the intro's Skip button owns the top-right corner; sits
          below the menu gear once control hands to the player. Fades to a
          faint reminder after a few seconds. */}
      {introDone && (
        <div
          className={`flex flex-col items-end gap-2 pt-14 transition-opacity duration-1000 ${
            hintFaded ? 'opacity-60' : 'opacity-100'
          }`}
        >
          <div className="rounded-full border border-white/15 bg-black/40 px-4 py-2 text-center text-xs text-white/90 backdrop-blur">
            <span className="font-semibold text-amber-300">WASD / Arrow keys</span>{' '}
            to drive · visit a landmark to open its info
          </div>
        </div>
      )}
    </div>
  )
}
