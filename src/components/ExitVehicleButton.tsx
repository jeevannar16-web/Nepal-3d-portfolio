import type { JSX } from 'react'
import { useStore } from '../store/useStore'
import { playClick } from '../utils/sounds'
import { exitVehicleToWalk } from '../utils/exitVehicle'

/**
 * Touch-friendly "get out" button: taps can't press F, so this glass button
 * (styled like the rest of the HUD) drops the soldier back onto his feet
 * beside the current vehicle. Sits just above the bottom-right HUD cluster.
 */
export default function ExitVehicleButton(): JSX.Element | null {
  const introDone = useStore((s) => s.introDone)
  const playerMode = useStore((s) => s.playerMode)

  if (!introDone || playerMode === 'walk') return null

  return (
    <button
      type="button"
      onClick={() => {
        playClick()
        exitVehicleToWalk(playerMode)
      }}
      title="Get out and walk (F)"
      aria-label="Get out of the vehicle and walk"
      className="pointer-events-auto absolute bottom-[172px] right-5 z-10 flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-4 py-2 text-xs font-semibold text-white/90 shadow-lg shadow-black/40 backdrop-blur transition hover:border-white/30 hover:bg-white/15 hover:text-white active:scale-95"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <circle cx="12" cy="4.5" r="2" />
        <path d="M12 8v4.5" />
        <path d="M12 12.5l-3.2 5.5" />
        <path d="M12 12.5l3.6 4.6" />
        <path d="M12 13.5l-4.2 1.6" />
      </svg>
      Get out
    </button>
  )
}
