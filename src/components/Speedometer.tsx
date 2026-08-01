import { useEffect, useRef, type JSX } from 'react'
import { driveState } from '../store/driveState'
import { KMH_FACTOR, MAX_SPEED, REDLINE_RPM } from './Player'

const MAX_KMH = MAX_SPEED * KMH_FACTOR
const CIRC_SPEED = 2 * Math.PI * 40
const CIRC_RPM = 2 * Math.PI * 46

function gearBadgeClass(label: string): string {
  if (label === 'OFF') return 'bg-slate-500/70'
  if (label === 'ON') return 'bg-amber-500'
  if (label === 'R') return 'bg-red-500'
  return 'bg-emerald-500'
}

export default function Speedometer(): JSX.Element {
  const value = useRef<HTMLSpanElement>(null)
  const gear = useRef<HTMLSpanElement>(null)
  const arc = useRef<SVGCircleElement>(null)
  const rpmArc = useRef<SVGCircleElement>(null)

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
          `${(v / MAX_KMH) * CIRC_SPEED} ${CIRC_SPEED}`,
        )
      }
      const rpmNorm = Math.min(Math.max(driveState.rpm / REDLINE_RPM, 0), 1)
      if (rpmArc.current) {
        rpmArc.current.setAttribute(
          'stroke-dasharray',
          `${rpmNorm * CIRC_RPM} ${CIRC_RPM}`,
        )
      }
      if (gear.current) {
        const label = driveState.gear
        gear.current.textContent = label
        gear.current.className = `absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 ${gearBadgeClass(
          label,
        )} text-xs font-black text-white shadow`
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="pointer-events-none relative h-28 w-28 shrink-0">
      <div className="relative flex h-full w-full items-center justify-center rounded-full border border-white/15 bg-black/40 shadow-lg shadow-black/40 backdrop-blur">
        {/* gauge rings: outer thin = rpm, inner = speed */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="rgba(125,211,252,0.15)"
            strokeWidth="3"
          />
          <circle
            ref={rpmArc}
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="#7dd3fc"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`0 ${CIRC_RPM}`}
          />
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
            strokeDasharray={`0 ${CIRC_SPEED}`}
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
        className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-emerald-500 text-xs font-black text-white shadow"
      >
        D
      </span>
    </div>
  )
}
