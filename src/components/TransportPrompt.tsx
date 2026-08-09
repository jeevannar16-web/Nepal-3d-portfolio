import type { JSX } from 'react'
import { useStore } from '../store/useStore'
import { useDeviceType } from '../hooks/useDeviceType'

const MODE_NAME = {
  walk: 'On foot',
  car: 'Driving',
  bike: 'Riding',
  horse: 'Riding the horse',
  airplane: 'Flying',
  balloon: 'Flying balloon',
  parachute: 'Parachuting',
} as const

/**
 * Contextual control hints for the transport system — shown only while riding
 * or parachuting: the current mode chip plus how to get out (or steer the
 * canopy). Deliberately hidden while on foot so no walking hints sit at the
 * bottom middle of the screen.
 */
export default function TransportPrompt(): JSX.Element | null {
  const playerMode = useStore((s) => s.playerMode)
  const introDone = useStore((s) => s.introDone)
  const deviceType = useDeviceType()

  // Mobile already carries the Exit action (plus mode) in the TouchControls dock
  // and the D-pad, so a bottom-center pill would overlap those buttons. Keep this
  // hint on desktop keyboards only, and stay above the desktop KeyHints bar.
  if (deviceType === 'mobile') return null
  if (!introDone || playerMode === 'walk') return null

  return (
    <div className="pointer-events-none absolute bottom-24 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2">
      <div className="rounded-full border border-white/15 bg-black/40 px-4 py-1.5 text-[11px] uppercase tracking-widest text-white/70 backdrop-blur">
        {MODE_NAME[playerMode]}
      </div>
      <div className="rounded-full border border-amber-300/30 bg-black/60 px-4 py-2 text-sm text-white/90 backdrop-blur">
         {playerMode === 'parachute' ? (
           <>Use <span className="font-semibold text-amber-300">W/S</span> to glide, <span className="font-semibold text-amber-300">A/D</span> to steer</>
         ) : (
           <>Press <span className="font-semibold text-amber-300">Z</span> (or <span className="font-semibold text-amber-300">Esc</span>) to get out and walk</>
         )}
      </div>
    </div>
  )
}
