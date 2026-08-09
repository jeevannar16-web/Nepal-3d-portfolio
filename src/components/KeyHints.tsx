import { type JSX, type ReactNode } from 'react'
import { useStore, type PlayerMode } from '../store/useStore'
import { useControls, type ControlAction } from '../store/controlsStore'
import { useDeviceType } from '../hooks/useDeviceType'

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
  const deviceType = useDeviceType()

  const bindings = useControls((s) => s.bindings)

  // On touch devices the on-screen D-pad (TouchControls) already carries the
  // arrow buttons + Exit in the corners, so a full-width hint bar down there
  // would just overlap it. Show the keyboard-centric hint bar on desktop only.
  if (deviceType === 'mobile') return <></>
  if (!introDone || isPanelOpen) return <></>

  const ride = isVehicle(playerMode)
  const chute = playerMode === 'parachute'
  const walk = playerMode === 'walk'

  const ActionChips = ({ action }: { action: ControlAction }) => (
    <>
      {bindings[action].map((spec) => (
        <Key key={spec} spec={spec} />
      ))}
    </>
  )

return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
      <div className="flex max-w-full items-center gap-2 overflow-x-auto rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-500/20 via-white/10 to-emerald-500/20 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white/90 shadow-[0_0_28px_rgba(251,191,36,0.45)] backdrop-blur-md">
        {walk && (
          <>
            <Chip>
              <ActionChips action="forward" />
              <ActionChips action="back" />
              <ActionChips action="left" />
              <ActionChips action="right" />
              <span className="ml-1">Move</span>
            </Chip>
            <span className="h-3 w-px bg-white/20" />
            <Chip>
              <ActionChips action="run" />
              <span className="ml-1">Run</span>
            </Chip>
            <span className="h-3 w-px bg-white/20" />
            <Chip>
              <ActionChips action="jump" />
              <span className="ml-1">Jump</span>
            </Chip>
            <span className="h-3 w-px bg-white/20" />
            <Chip>
              <ActionChips action="interact" />
              <span className="ml-1">Interact</span>
            </Chip>
            <span className="h-3 w-px bg-white/20" />
          </>
        )}
        {ride && (
          <>
            <Chip>
              <ActionChips action="forward" />
              <ActionChips action="back" />
              <ActionChips action="left" />
              <ActionChips action="right" />
              <span className="ml-1">Drive</span>
            </Chip>
            <span className="h-3 w-px bg-white/20" />
          </>
        )}
        {chute && (
          <>
            <Chip>
              <ActionChips action="forward" />
              <ActionChips action="back" />
              <ActionChips action="left" />
              <ActionChips action="right" />
              <span className="ml-1">Steer</span>
            </Chip>
            <span className="h-3 w-px bg-white/20" />
          </>
        )}
        <Chip icon>
          <span className="ml-1 text-amber-100/90">Mouse Look</span>
        </Chip>
        <span className="h-3 w-px bg-white/20" />
        {(ride || chute) && (
          <>
            <Chip>
              <ActionChips action="exit" />
              <span className="ml-1">Exit</span>
            </Chip>
            <span className="h-3 w-px bg-white/20" />
          </>
        )}
        <Chip>
          <ActionChips action="exit" />
          <span className="ml-1">Menu</span>
        </Chip>
      </div>
    </div>
  )
}
