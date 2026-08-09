import { type JSX, type ReactNode } from 'react'
import { useStore, type PlayerMode } from '../store/useStore'

function specLabel(spec: string): string {
  const map: Record<string, string> = {
    KeyW: 'W',
    KeyA: 'A',
    KeyS: 'S',
    KeyD: 'D',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    ShiftLeft: 'Shift',
    ShiftRight: 'Shift',
    Space: 'Space',
    KeyE: 'E',
    Escape: 'Esc',
    Home: 'Home',
    End: 'End',
  }
  return map[spec] ?? spec.replace('Key', '').replace(/^Digit/, '')
}

function Key({ spec }: { spec: string }): JSX.Element {
  return (
    <kbd className="inline-flex min-w-[1.4rem] items-center justify-center rounded-md border border-amber-300/60 bg-gradient-to-b from-amber-400/40 to-amber-600/30 px-1.5 py-0.5 text-[10px] font-black text-amber-100 shadow-[0_0_10px_rgba(251,191,36,0.45)]">
      {specLabel(spec)}
    </kbd>
  )
}

function Chip({
  icon,
  children,
}: {
  icon?: boolean
  children: ReactNode
}): JSX.Element {
  return (
    <span className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/25 px-2 py-1">
      {icon && (
        <svg
          className="h-3.5 w-3.5 text-amber-200"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="6" y="3" width="12" height="18" rx="6" />
          <path d="M12 7v4" />
        </svg>
      )}
      {children}
    </span>
  )
}

const isVehicle = (mode: PlayerMode): boolean =>
  mode === 'car' ||
  mode === 'bike' ||
  mode === 'horse' ||
  mode === 'airplane' ||
  mode === 'balloon'

export default function KeyHints(): JSX.Element {
  const introDone = useStore((s) => s.introDone)
  const isPanelOpen = useStore((s) => s.isPanelOpen)
  const playerMode = useStore((s) => s.playerMode)

  if (!introDone || isPanelOpen) return <></>
  // No on-foot hints at the bottom middle: the bar only appears when it has
  // real content to show — riding a vehicle or steering a parachute.
  if (playerMode === 'walk') return <></>

  const ride = isVehicle(playerMode)
  const chute = playerMode === 'parachute'

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
      <div className="flex max-w-full items-center gap-2 overflow-x-auto rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-500/20 via-white/10 to-emerald-500/20 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white/90 shadow-[0_0_28px_rgba(251,191,36,0.4)] backdrop-blur-md">
        {ride && (
          <>
            <Chip>
              <Key spec="KeyW" />
              <Key spec="KeyA" />
              <Key spec="KeyS" />
              <Key spec="KeyD" />
              <span className="ml-1">Drive</span>
            </Chip>
            <span className="h-3 w-px bg-white/20" />
          </>
        )}
        {chute && (
          <>
            <Chip>
              <Key spec="Home" />
              <Key spec="End" />
              <span className="ml-1">Steer</span>
            </Chip>
            <span className="h-3 w-px bg-white/20" />
          </>
        )}
        <Chip icon>
          <span className="ml-1 text-amber-100/90">Mouse Look</span>
        </Chip>
        <span className="h-3 w-px bg-white/20" />
        {ride && (
          <>
            <Chip>
              <Key spec="Escape" />
              <span className="ml-1">Exit</span>
            </Chip>
            <span className="h-3 w-px bg-white/20" />
          </>
        )}
        <Chip>
          <Key spec="Escape" />
          <span className="ml-1">Menu</span>
        </Chip>
      </div>
    </div>
  )
}
