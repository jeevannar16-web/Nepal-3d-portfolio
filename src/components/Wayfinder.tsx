import { useEffect, useRef, type JSX } from 'react'
import { useStore } from '../store/useStore'
import { landmarks } from '../data'
import { minimapState } from '../store/minimapState'
import { playClick } from '../utils/sounds'

/**
 * Persistent directional indicator toward the last-viewed landmark. Shown
 * once its panel is closed; points the way in car-relative space (up = where
 * the car faces) with the distance, until the player arrives or dismisses it.
 */
export default function Wayfinder(): JSX.Element | null {
  const targetLandmark = useStore((s) => s.targetLandmark)
  const setTargetLandmark = useStore((s) => s.setTargetLandmark)
  const isPanelOpen = useStore((s) => s.isPanelOpen)
  const flyTo = useStore((s) => s.flyTo)
  const arrowRef = useRef<HTMLDivElement>(null)
  const distRef = useRef<HTMLSpanElement>(null)
  const turnRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!targetLandmark) return
    let raf = 0
    const loop = () => {
      const landmark = landmarks.find((l) => l.id === targetLandmark)
      if (!landmark) return
      const dx = landmark.position[0] - minimapState.x
      const dz = landmark.position[2] - minimapState.z
      const dist = Math.hypot(dx, dz)
      // Arrived: drop the route once the player is close enough.
      if (dist < 8) {
        setTargetLandmark(null)
        return
      }
      // Same heading convention as the car: forward is +Z (angle 0), so the
      // arrow rotates clockwise for targets to the car's right.
      const rel = Math.atan2(dx, dz) - minimapState.heading
      if (arrowRef.current) {
        arrowRef.current.style.transform = `rotate(${(rel * 180) / Math.PI}deg)`
      }
      // A quick "which way to turn" cue next to the distance — clearer at a
      // glance than rotation alone: straight ▲, right », left «.
      if (turnRef.current) {
        const dir = rel > 0.45 ? '»' : rel < -0.45 ? '«' : '▲'
        turnRef.current.textContent = dir
        turnRef.current.className =
          dir === '▲'
            ? 'text-amber-300'
            : dir === '»'
              ? 'text-emerald-300'
              : 'text-rose-300'
      }
      if (distRef.current) distRef.current.textContent = `${Math.round(dist)}`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [targetLandmark, setTargetLandmark])

  if (!targetLandmark || isPanelOpen) return null
  const landmark = landmarks.find((l) => l.id === targetLandmark)
  if (!landmark) return null

  const label = landmark.label.split(' — ')[0]

  return (
    <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-white/15 bg-black/40 py-1.5 pl-2 pr-1.5 backdrop-blur">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
          <div ref={arrowRef} className="transition-transform duration-150">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M12 3l6 10h-4v8h-4v-8H6z" />
            </svg>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            playClick()
            flyTo(landmark.position[0], landmark.position[2])
          }}
          className="text-sm font-medium text-white/90 transition hover:text-amber-300"
          title="Fly to this landmark"
        >
          {label}
        </button>
        <span className="text-xs text-white/50">
          <span ref={distRef}>0</span>m
        </span>
        <span
          ref={turnRef}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-black/30 text-sm font-bold text-amber-300"
          aria-hidden="true"
        >
          ▲
        </span>
        <button
          type="button"
          onClick={() => {
            playClick()
            setTargetLandmark(null)
          }}
          className="flex h-6 w-6 items-center justify-center rounded-full text-white/60 transition hover:bg-white/15 hover:text-white"
          aria-label="Dismiss route"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
