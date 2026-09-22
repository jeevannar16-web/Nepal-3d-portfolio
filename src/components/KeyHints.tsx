import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react'
import { useStore, type PlayerMode } from '../store/useStore'
import { useControls, type ControlAction } from '../store/controlsStore'
import { useDeviceType } from '../hooks/useDeviceType'

const CODE_TO_LABEL: Record<string, string> = {
  KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  ShiftLeft: 'Shift', ShiftRight: 'Shift',
  Space: 'Space', KeyE: 'E', KeyQ: 'Q',
  Escape: 'Esc', Home: 'Home', End: 'End',
  ControlLeft: 'Ctrl', ControlRight: 'Ctrl', KeyC: 'C',
}

function codeLabel(code: string): string {
  return CODE_TO_LABEL[code] ?? code.replace('Key', '').replace(/^Digit/, '')
}

function Key({
  spec,
  on,
  color = 'amber',
}: {
  spec: string
  on: boolean
  color?: 'amber' | 'sky'
}): JSX.Element {
  const palette =
    color === 'sky'
      ? 'border-sky-300 bg-gradient-to-b from-sky-200 to-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.65)]'
      : 'border-amber-300 bg-gradient-to-b from-amber-200 to-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.65)]'
  return (
    <kbd
      className={`shrink-0 inline-flex min-w-[2rem] items-center justify-center rounded-md border-2 px-2 py-1 text-[13px] font-black text-slate-950 transition-all duration-75 ${palette} ${
        on ? 'scale-110' : 'opacity-40'
      }`}
    >
      {codeLabel(spec)}
    </kbd>
  )
}

function Pad({
  up, down, left, right, color, active,
}: {
  up: string
  down: string
  left: string
  right: string
  color?: 'amber' | 'sky'
  active: Set<string>
}): JSX.Element {
  const is = (spec: string) => active.has(spec)
  return (
    <span className="grid grid-cols-3 gap-0.5" aria-hidden="true">
      <span />
      <Key spec={up} color={color} on={is(up)} />
      <span />
      <Key spec={left} color={color} on={is(left)} />
      <Key spec={down} color={color} on={is(down)} />
      <Key spec={right} color={color} on={is(right)} />
    </span>
  )
}

function Keypad({
  wasd, arrows, active,
}: {
  wasd: { up: string; down: string; left: string; right: string }
  arrows: { up: string; down: string; left: string; right: string }
  active: Set<string>
}): JSX.Element {
  return (
    <span
      className="flex items-center gap-2 rounded-lg border-2 border-amber-300 bg-black/50 px-2.5 py-1.5"
      aria-hidden="true"
    >
      <Pad {...wasd} color="amber" active={active} />
      <span className="text-lg font-black leading-none text-white/60">=</span>
      <Pad {...arrows} color="sky" active={active} />
    </span>
  )
}

function Chip({
  children, icon,
}: {
  children: ReactNode
  icon?: boolean
}): JSX.Element {
  return (
    <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/25 px-2 py-1">
      {icon && (
        <svg className="h-3.5 w-3.5 text-amber-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

export default function KeyHints(): JSX.Element | null {
  const introDone = useStore((s) => s.introDone)
  const playerMode = useStore((s) => s.playerMode)
  const deviceType = useDeviceType()
  const bindings = useControls((s) => s.bindings)

  const [active, setActive] = useState<Set<string>>(new Set())
  const heldRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      heldRef.current.add(e.code)
      setActive(new Set(heldRef.current))
    }
    const up = (e: KeyboardEvent) => {
      heldRef.current.delete(e.code)
      setActive(new Set(heldRef.current))
    }
    const blur = () => {
      heldRef.current.clear()
      setActive(new Set())
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  if (deviceType === 'mobile') return null
  if (!introDone) return null

  const ride = isVehicle(playerMode)
  const chute = playerMode === 'parachute'
  const walk = playerMode === 'walk'

  const first = (action: ControlAction): string => bindings[action]?.[0] ?? ''
  const fwdKey = first('forward')
  const backKey = first('back')
  const screenLeftKey = first('left')
  const screenRightKey = first('right')
  // The turn keys are inverted (right-side keys now turn left and vice versa),
  // so show the actual arrow code bound to each turn action instead of always
  // placing ArrowLeft/ArrowRight in their physical pad slots.
  const arrowOf = (action: ControlAction): string =>
    bindings[action].find((s) => s.startsWith('Arrow')) ?? first(action)
  const screenLeftArrow = arrowOf('left')
  const screenRightArrow = arrowOf('right')
  const runKey =
    bindings.run.find((s) => s === 'Shift+KeyS') ??
    bindings.run.find((s) => s.includes('+')) ??
    bindings.run[0] ??
    ''

  const movementLabel = walk ? 'Move' : ride ? 'Drive' : 'Steer'

  const allKeys = (action: ControlAction) =>
    bindings[action].map((spec) => (
      <Key key={spec} spec={spec} on={active.has(spec.split('+').pop() ?? spec)} />
    ))

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1.5 rounded-2xl border-2 border-amber-300/80 bg-black/40 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-amber-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
        <Chip>
          <Keypad
            wasd={{ up: fwdKey, down: backKey, left: screenLeftKey, right: screenRightKey }}
            arrows={{ up: 'ArrowUp', down: 'ArrowDown', left: screenLeftArrow, right: screenRightArrow }}
            active={active}
          />
          <span className="ml-1.5 text-amber-100">{movementLabel}</span>
        </Chip>
        <span className="h-3 w-px bg-white/25" />
        {walk && (
          <>
            <Chip>
              <Key spec={runKey} on={active.has(runKey.replace('Shift+', '')) || active.has('ShiftLeft') || active.has('ShiftRight')} />
              <span className="ml-1 text-amber-100">Run</span>
            </Chip>
            <span className="h-3 w-px bg-white/25" />
            <Chip>
              {allKeys('jump')}
              <span className="ml-1 text-amber-100">Jump</span>
            </Chip>
            <span className="h-3 w-px bg-white/25" />
            <Chip>
              {allKeys('interact')}
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
              {allKeys('exit')}
              <span className="ml-1 text-amber-100">Exit</span>
            </Chip>
            <span className="h-3 w-px bg-white/25" />
          </>
        )}
        {walk && (
          <Chip>
            <Key spec="Escape" on={active.has('Escape')} />
            <span className="ml-1 text-amber-100">Menu</span>
          </Chip>
        )}
      </div>
    </div>
  )
}
