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
      className="pointer-events-auto absolute bottom-24 right-5 z-10 rounded-xl border border-white/20 bg-black/40 p-3 text-white/90 backdrop-blur transition hover:bg-black/60 hover:text-white"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22" aria-hidden="true">
        <path d="M2 9v6h3l5 4V5L5 9H2z" />
        <path d="M14 5.5v13c2.8-1.4 4.7-4 4.7-6.5S16.8 6.9 14 5.5z" />
      </svg>
    </button>
  )
}
