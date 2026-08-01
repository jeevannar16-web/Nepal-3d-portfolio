import { useEffect, useRef, type JSX } from 'react'
import { driveState } from '../store/driveState'
import { KMH_FACTOR, MAX_SPEED } from './Player'

const MAX_KMH = MAX_SPEED * KMH_FACTOR
const CIRCUMFERENCE = 2 * Math.PI * 40

export default function Speedometer(): JSX.Element {
  const value = useRef<HTMLSpanElement>(null)
  const gear = useRef<HTMLSpanElement>(null)
  const arc = useRef<SVGCircleElement>(null)

  useEffect(() => {
    let raf = 0
    const loop = () => {
      const v = Math.min(driveState.speedKmh, MAX_KMH)
      if (value.current) {
        value.current.textContent = String(Math.round(v))
      }
      if (arc.current) {
        arc.current.setAttribute(
          'stroke-dasharray',
          `${(v / MAX_KMH) * CIRCUMFERENCE} ${CIRCUMFERENCE}`,
        )
      }
      if (gear.current) {
        const rev = driveState.reverse
        gear.current.textContent = rev ? 'R' : 'D'
        gear.current.classList.toggle('bg-red-500', rev)
        gear.current.classList.toggle('bg-emerald-500', !rev)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="pointer-events-none absolute bottom-5 right-5 z-10">
      <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-white/20 bg-black/50 shadow-lg shadow-black/40 backdrop-blur">
        {/* gauge ring */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="5"
          />
          <circle
            ref={arc}
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`0 ${CIRCUMFERENCE}`}
          />
        </svg>
        {/* minor tick marks */}
        <div className="absolute inset-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-0 h-1.5 w-px bg-white/25"
              style={{
                transform: `translateX(-50%) rotate(${i * 45}deg)`,
                transformOrigin: '0 46px',
              }}
            />
          ))}
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[11px] uppercase tracking-widest text-white/50">km/h</span>
          <span className="text-4xl font-black tabular-nums leading-none text-white">
            <span ref={value}>0</span>
          </span>
        </div>
      </div>
      <span
        ref={gear}
        className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-emerald-500 text-xs font-black text-white shadow"
      >
        D
      </span>
    </div>
  )
}
