import type { JSX } from 'react'
import { useStore } from '../store/useStore'
import { identity } from '../data'

export default function IntroOverlay(): JSX.Element | null {
  const introDone = useStore((s) => s.introDone)
  const introVariant = useStore((s) => s.introVariant)
  const visitorCountry = useStore((s) => s.visitorCountry)
  const skipIntro = useStore((s) => s.skipIntro)

  if (introDone) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <div className="animate-intro-name text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow-2xl sm:text-6xl">
          {identity.name}
        </h1>
        <p className="mt-3 text-sm font-medium uppercase tracking-[0.25em] text-amber-300 drop-shadow-lg sm:text-base">
          {identity.role}
        </p>
        <p className="mt-2 text-xs text-white/70 drop-shadow">
          {identity.location}
        </p>
        {introVariant === 'air' && visitorCountry ? (
          <p className="mt-3 text-sm font-semibold tracking-wide text-amber-300 drop-shadow">
            Flying in from {visitorCountry}…
          </p>
        ) : introVariant === 'local' ? (
          <p className="mt-3 text-sm font-semibold tracking-wide text-amber-300 drop-shadow">
            Arriving over Kathmandu…
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={skipIntro}
        className="pointer-events-auto absolute right-5 top-5 rounded-full border border-white/25 bg-black/40 px-4 py-2 text-xs font-semibold text-white/90 backdrop-blur transition hover:bg-black/60 hover:text-white"
      >
        Skip
      </button>
    </div>
  )
}
