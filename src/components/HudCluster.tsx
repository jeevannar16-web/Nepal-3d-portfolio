import type { JSX } from 'react'
import { useStore } from '../store/useStore'
import { zones } from '../data'
import Speedometer from './Speedometer'
import HonkButton from './HonkButton'

/**
 * Single bottom-right HUD cluster: speedometer as the main circular element,
 * with the explored progress and honk button integrated into the same card so
 * there are no separate floating boxes stacked with gaps between them.
 */
export default function HudCluster(): JSX.Element {
  const visitedZones = useStore((s) => s.visitedZones)
  const total = zones.length
  const visited = visitedZones.length

  return (
    <div className="pointer-events-none absolute bottom-5 right-5 z-10 flex items-center gap-3 rounded-2xl border border-white/15 bg-black/40 p-3 shadow-lg shadow-black/40 backdrop-blur">
      <Speedometer />
      <div className="flex flex-col items-center gap-3">
        <div className="flex flex-col items-center">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-white/80">
            Explored
          </div>
          <div className="text-base font-bold leading-tight text-amber-300">
            {visited}/{total}
          </div>
          <div className="mt-1 flex gap-1">
            {zones.map((zone) => (
              <div
                key={zone.key}
                className={`h-1.5 w-3 rounded-full ${
                  visitedZones.includes(zone.key) ? 'bg-amber-400' : 'bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>
        <HonkButton />
      </div>
    </div>
  )
}
