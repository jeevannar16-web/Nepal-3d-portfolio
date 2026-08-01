import { useEffect, type JSX } from 'react'
import { playHonk } from '../utils/sounds'

export default function HonkButton(): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyH' && !e.repeat) playHonk()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <button
      type="button"
      onClick={() => playHonk()}
      title="Honk (H)"
      aria-label="Honk horn"
      className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/50 text-amber-200/90 backdrop-blur transition-transform duration-75 hover:border-white/30 hover:text-amber-100 active:scale-75 active:bg-amber-400/30"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
        <path d="M2 9v6h3l5 4V5L5 9H2z" />
        <path d="M14 5.5v13c2.8-1.4 4.7-4 4.7-6.5S16.8 6.9 14 5.5z" />
      </svg>
    </button>
  )
}
