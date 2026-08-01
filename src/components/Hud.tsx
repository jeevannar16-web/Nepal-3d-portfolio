import { useEffect, useState, type JSX } from 'react'
import { identity } from '../data'
import { useStore } from '../store/useStore'

export default function Hud(): JSX.Element {
  const isPanelOpen = useStore((s) => s.isPanelOpen)
  const setPrefersSimple = useStore((s) => s.setPrefersSimple)
  const [hintFaded, setHintFaded] = useState(false)

  useEffect(() => {
    setHintFaded(false)
    const t = setTimeout(() => setHintFaded(true), 5000)
    return () => clearTimeout(t)
  }, [isPanelOpen])

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
      <div
        className={`flex flex-col items-end gap-2 transition-opacity duration-1000 ${
          hintFaded ? 'opacity-40' : 'opacity-100'
        }`}
      >
        <div className="hidden rounded-full bg-black/30 px-4 py-2 text-xs text-white/90 backdrop-blur xl:block">
          WASD / Arrow keys to drive · Enter a landmark to explore
        </div>
        <button
          type="button"
          onClick={() => setPrefersSimple(true)}
          className="pointer-events-auto text-xs text-white/70 underline decoration-white/40 underline-offset-4 transition hover:text-white hover:decoration-white"
        >
          Prefer a simple page?
        </button>
      </div>
    </div>
  )
}
