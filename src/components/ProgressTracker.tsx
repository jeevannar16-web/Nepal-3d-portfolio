import type { JSX } from 'react'
import { useStore } from '../store/useStore'
import { zones } from '../data'

export default function ProgressTracker(): JSX.Element {
  const visitedZones = useStore((s) => s.visitedZones)
  const total = zones.length
  const visited = visitedZones.length

  return (
    <div className="pointer-events-none absolute bottom-[13rem] right-5 z-10 rounded-2xl border border-white/15 bg-black/40 px-4 py-3 backdrop-blur">
      <div className="text-xs font-semibold uppercase tracking-widest text-white/80">
        Explored
      </div>
      <div className="mt-1 text-lg font-bold text-amber-300">
        {visited}/{total}
      </div>
      <div className="mt-2 flex gap-1">
        {zones.map((zone) => (
          <div
            key={zone.key}
            className={`h-1.5 w-4 rounded-full ${
              visitedZones.includes(zone.key) ? 'bg-amber-400' : 'bg-white/20'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
