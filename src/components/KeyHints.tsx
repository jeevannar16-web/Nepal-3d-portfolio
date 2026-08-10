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
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    ShiftLeft: 'Shift',
    ShiftRight: 'Shift',
    Space: 'Space',
    KeyE: 'E',
    Escape: 'Esc',
    Home: 'Home',
    End: 'End',
  }
  // Chords like 'Shift+KeyS' -> 'Shift+S'.
  return (
    map[spec] ??
    spec
      .split('+')
      .map((p) => map[p] ?? p.replace('Key', '').replace(/^Digit/, ''))
      .join('+')
  )
}

function Key({ spec }: { spec: string }): JSX.Element {
  return (
    <kbd className="inline-flex min-w-[1.7rem] items-center justify-center rounded-md border border-amber-200/80 bg-gradient-to-b from-amber-300/90 to-amber-500/60 px-1.5 py-0.5 text-[12px] font-black text-slate-950 shadow-[0_0_12px_rgba(251,191,36,0.65)]">
      {specLabel(spec)}
    </kbd>
  )
}

/** A mini keypad laid out like the real keyboard (top / left / bottom /
 *  right cells) so a player instantly sees which key moves which way. */
function Pad({
  up,
  down,
  left,
  right,
}: {
  up: string
  down: string
  left: string
  right: string
}): JSX.Element {
  return (
    <span className="grid grid-cols-3 gap-0.5" aria-hidden="true">
      <span />
      <Key spec={up} />
      <span />
      <Key spec={left} />
      <Key spec={down} />
      <Key spec={right} />
    </span>
  )
}

/** One combined movement block: WASD cluster on the left and the arrow
 *  cluster on the right, side by side in the same layout, joined by an '='
 *  so a player sees both ways to move at a glance. */
function Keypad({
  wasd,
  arrows,
}: {
  wasd: { up: string; down: string; left: string; right: string }
  arrows: { up: string; down: string; left: string; right: string }
}): JSX.Element {
  return (
    <span className="flex items-center gap-2" aria-hidden="true">
      <span className="rounded-lg border border-amber-200/40 bg-black/30 p-1.5">
        <Pad {...wasd} />
      </span>
      <span className="text-base font-black leading-none text-amber-200 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]">
        =
      </span>
      <span className="rounded-lg border border-white/25 bg-black/30 p-1.5">
        <Pad {...arrows} />
      </span>
    </span>
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
    <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/25 px-2 py-1">
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

  const first = (action: ControlAction): string => bindings[action]?.[0] ?? ''

  // NOTE: the 'left'/'right' ACTION names are swapped relative to the physical
  // keys — 'right' is bound to A/←/Home (turns screen-left), 'left' is bound to
  // D/→/End (turns screen-right), matching how the controllers interpret them.
  // The keypads are laid out by SCREEN direction, so left goes on the left side.
  const fwdKey = first('forward')
  const backKey = first('back')
  const screenLeftKey = first('right')
  const screenRightKey = first('left')
  const runKey = first('run')

  const movementLabel = walk ? 'Move' : ride ? 'Drive' : 'Steer'

  const AllKeys = ({ action }: { action: ControlAction }) => (
    <>
      {bindings[action].map((spec) => (
        <Key key={spec} spec={spec} />
      ))}
    </>
  )

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
      <div className="flex max-w-full items-center gap-2 overflow-x-auto rounded-2xl border-2 border-amber-300/60 bg-black/70 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-amber-100 shadow-[0_0_28px_rgba(251,191,36,0.55)] backdrop-blur-md">
        <Chip>
          <Keypad
            wasd={{
              up: fwdKey,
              down: backKey,
              left: screenLeftKey,
              right: screenRightKey,
            }}
            arrows={{
              up: 'ArrowUp',
              down: 'ArrowDown',
              left: 'ArrowLeft',
              right: 'ArrowRight',
            }}
          />
          <span className="ml-1 text-amber-100">{movementLabel}</span>
        </Chip>
        <span className="h-3 w-px bg-white/25" />
        {walk && (
          <>
            <Chip>
              <Key spec={runKey} />
              <span className="ml-1 text-amber-100">Run</span>
            </Chip>
            <span className="h-3 w-px bg-white/25" />
            <Chip>
              <AllKeys action="jump" />
              <span className="ml-1 text-amber-100">Jump</span>
            </Chip>
            <span className="h-3 w-px bg-white/25" />
            <Chip>
              <AllKeys action="interact" />
              <span className="ml-1 text-amber-100">Interact</span>
            </Chip>
            <span className="h-3 w-px bg-white/25" />
          </>
        )}
        <Chip icon>
          <span className="ml-1 text-amber-100">Mouse Look</span>
        </Chip>
        <span className="h-3 w-px bg-white/25" />
        {(ride || chute) && (
          <>
            <Chip>
              <AllKeys action="exit" />
              <span className="ml-1 text-amber-100">Exit</span>
            </Chip>
            <span className="h-3 w-px bg-white/25" />
          </>
        )}
        {walk && (
          <Chip>
            <Key spec="Escape" />
            <span className="ml-1 text-amber-100">Menu</span>
          </Chip>
        )}
      </div>
    </div>
  )
}