import { useEffect, useState, type JSX } from 'react'
import { useStore } from '../store/useStore'
import { matchesAction, primaryCode, useControls } from '../store/controlsStore'

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
  }
  return map[spec] ?? spec.replace('Key', '').replace(/^Digit/, '')
}

function Key({ spec }: { spec: string }): JSX.Element {
  return (
    <kbd className="inline-flex min-w-[1.4rem] items-center justify-center rounded-md border border-white/25 bg-white/15 px-1.5 py-0.5 text-[10px] font-bold text-white">
      {specLabel(spec)}
    </kbd>
  )
}

export default function KeyHints(): JSX.Element {
  const introDone = useStore((s) => s.introDone)
  const isPanelOpen = useStore((s) => s.isPanelOpen)
  const [finePointer] = useState(() => window.matchMedia('(pointer: fine)').matches)
  const [dismissed, setDismissed] = useState(false)

  // Hide the hint the moment the player starts moving or after a short while,
  // so it never lingers over the action.
  useEffect(() => {
    if (!finePointer) return
    const onKey = (e: KeyboardEvent) => {
      const movement =
        matchesAction(e, 'forward') ||
        matchesAction(e, 'back') ||
        matchesAction(e, 'left') ||
        matchesAction(e, 'right')
      if (movement) setDismissed(true)
    }
    window.addEventListener('keydown', onKey)
    const t = setTimeout(() => setDismissed(true), 14000)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(t)
    }
  }, [finePointer])

  if (!introDone || !finePointer || dismissed || isPanelOpen) return <></>

  const b = useControls.getState().bindings
  const move = [b.forward[0], b.back[0], b.left[0], b.right[0]]

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
      <div className="flex max-w-full items-center gap-2 overflow-x-auto rounded-full border border-white/10 bg-black/55 px-4 py-2 text-[11px] font-bold text-white/85 shadow-lg shadow-black/40 backdrop-blur-md">
        <span className="flex items-center gap-1">
          {move.map((spec) => (
            <Key key={spec} spec={spec} />
          ))}
          <span className="ml-1">Move</span>
        </span>
        <span className="text-white/30">·</span>
        <span className="flex items-center gap-1">
          <Key spec={primaryCode('run')} />
          <span className="ml-1">Run</span>
        </span>
        <span className="text-white/30">·</span>
        <span className="flex items-center gap-1">
          <Key spec={primaryCode('jump')} />
          <span className="ml-1">Jump</span>
        </span>
        <span className="text-white/30">·</span>
        <span className="flex items-center gap-1">
          <Key spec={primaryCode('interact')} />
          <span className="ml-1">Interact</span>
        </span>
      </div>
    </div>
  )
}
