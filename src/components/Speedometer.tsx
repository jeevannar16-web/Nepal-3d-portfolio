import { useEffect, useRef, type JSX } from 'react'
import { driveState } from '../store/driveState'

export default function Speedometer(): JSX.Element {
  const value = useRef<HTMLSpanElement>(null)
  const gear = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let raf = 0
    const loop = () => {
      if (value.current) {
        value.current.textContent = String(Math.round(driveState.speedKmh))
      }
      if (gear.current) {
        gear.current.textContent = driveState.reverse ? 'R' : 'D'
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="pointer-events-none absolute bottom-5 right-5 z-10 flex items-end gap-2 rounded-xl border border-white/20 bg-black/40 px-4 py-3 backdrop-blur">
      <span ref={gear} className="pb-1 text-sm font-bold text-amber-300">
        D
      </span>
      <span className="text-3xl font-extrabold tabular-nums leading-none text-white">
        <span ref={value}>0</span>
      </span>
      <span className="pb-0.5 text-[10px] uppercase tracking-wider text-white/60">
        km/h
      </span>
    </div>
  )
}
