import { useEffect, useState, type JSX } from 'react'
import { useStore } from '../store/useStore'
import { transportState } from '../store/transportState'

const ENTER_RADIUS = 3.6

type Nearby = 'car' | 'bike' | 'horse' | 'airplane' | 'airplane2' | 'balloon' | null

const VEHICLE_NAME: Record<Exclude<Nearby, null>, string> = {
  car: 'the car',
  bike: 'the motorcycle',
  horse: 'the horse',
  airplane: 'the airplane',
  airplane2: 'the second airplane',
  balloon: 'the hot air balloon',
}

const MODE_NAME = {
  walk: 'On foot',
  car: 'Driving',
  bike: 'Riding',
  horse: 'Riding the horse',
  airplane: 'Flying',
  balloon: 'Flying balloon',
  parachute: 'Parachuting',
} as const

function nearestVehicle(): Nearby {
  const m = useStore.getState().playerMode
  if (m !== 'walk') return null
  const pos = transportState.walk
  let best: Nearby = null
  let bestDist = ENTER_RADIUS
  for (const kind of ['car', 'bike', 'horse', 'airplane', 'airplane2', 'balloon'] as const) {
    const p = transportState[kind]
    const d = Math.hypot(pos.x - p.x, pos.z - p.z)
    if (d < bestDist) {
      bestDist = d
      best = kind
    }
  }
  return best
}

/**
 * Contextual control hints for the transport system: "E to climb in" when the
 * soldier stands near a vehicle, and "Z to get out" whenever he's driving or
 * riding. A small mode chip shows the current way of moving.
 */
export default function TransportPrompt(): JSX.Element | null {
  const playerMode = useStore((s) => s.playerMode)
  const introDone = useStore((s) => s.introDone)
  const [nearby, setNearby] = useState<Nearby>(null)

  useEffect(() => {
    const id = window.setInterval(() => setNearby(nearestVehicle()), 250)
    return () => window.clearInterval(id)
  }, [])

  if (!introDone) return null

  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2">
      <div className="rounded-full border border-white/15 bg-black/40 px-4 py-1.5 text-[11px] uppercase tracking-widest text-white/70 backdrop-blur">
        {MODE_NAME[playerMode]}
      </div>
      {playerMode === 'walk' && nearby ? (
        <div className="rounded-full border border-amber-300/30 bg-black/60 px-4 py-2 text-sm text-white/90 backdrop-blur">
          Press <span className="font-semibold text-amber-300">E</span> to board{' '}
          {VEHICLE_NAME[nearby]}
        </div>
      ) : playerMode !== 'walk' ? (
        <div className="rounded-full border border-amber-300/30 bg-black/60 px-4 py-2 text-sm text-white/90 backdrop-blur">
          {playerMode === 'parachute' ? (
            <>Use <span className="font-semibold text-amber-300">W/S</span> to glide, <span className="font-semibold text-amber-300">A/D</span> to steer</>
          ) : (
            <>Press <span className="font-semibold text-amber-300">Z</span> (or <span className="font-semibold text-amber-300">Esc</span>) to get out and walk</>
          )}
        </div>
      ) : null}
    </div>
  )
}
