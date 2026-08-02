import type { JSX } from 'react'
import { useStore } from '../store/useStore'
import { identity } from '../data'

export default function IntroOverlay(): JSX.Element | null {
  const introDone = useStore((s) => s.introDone)
  const introStage = useStore((s) => s.introStage)
  const introCaption = useStore((s) => s.introCaption)
  const skipIntro = useStore((s) => s.skipIntro)

  if (introDone) return null

  const stageText =
    introStage === 'taxi'
      ? 'Warm-up on the runway…'
      : introStage === 'climb'
        ? 'Climbing over the Himalayas…'
        : introStage === 'circuit'
          ? 'Circling the valley…'
          : introStage === 'approach'
            ? 'Final approach…'
            : introStage === 'landing'
              ? 'Touchdown in Kathmandu…'
              : null

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
        {stageText ? (
          <p className="mt-3 text-sm font-semibold tracking-wide text-amber-300 drop-shadow">
            {stageText}
          </p>
        ) : null}
      </div>
      {introCaption ? (
        <div
          key={introCaption}
          className="animate-intro-caption absolute bottom-14 left-1/2 -translate-x-1/2"
        >
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-4 py-2 text-sm text-white/90 backdrop-blur">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-300" />
            <span className="uppercase tracking-[0.2em] text-amber-300">
              Below
            </span>
            {introCaption}
          </div>
        </div>
      ) : null}
      <button
        type="button"
        onClick={skipIntro}
        className="pointer-events-auto absolute right-5 top-5 rounded-full border border-white/15 bg-black/40 px-4 py-2 text-xs font-semibold text-white/90 backdrop-blur transition hover:bg-black/60 hover:text-white"
      >
        Skip
      </button>
    </div>
  )
}
