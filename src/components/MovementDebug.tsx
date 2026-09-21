import { useEffect, useState, type JSX } from 'react'
import { walkDebug } from '../store/walkState'

/**
 * Optional movement diagnostic overlay, hidden unless the page URL carries
 * `?debug=1`. It reads the live canonical action state published by
 * WalkController (walkDebug) — the exact flags the keyboard AND the bottom
 * on-screen controls drive — so it proves live that the on-screen controls are
 * not inverted or derailed from the keyboard, and shows the grounded/airborne
 * reading, the movement vector and the heading.
 */
function Row({
  act,
  on,
  label,
}: {
  act: string
  on: boolean
  label: string
}): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${
          on ? 'bg-emerald-400' : 'bg-white/20'
        }`}
      />
      <span className={on ? 'text-emerald-300' : 'text-white/60'}>{act}</span>
      <span className="text-white/50">{label}</span>
    </div>
  )
}

export default function MovementDebug(): JSX.Element | null {
  const [enabled] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('debug'),
  )
  const [, tick] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let raf = 0
    const loop = () => {
      tick((n) => n + 1)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [enabled])

  if (!enabled) return null
  const jumpFire = performance.now() - walkDebug.jumpPulse < 130
  return (
    <div className="pointer-events-none fixed bottom-16 left-1/2 z-[70] -translate-x-1/2 select-none rounded-xl border border-white/15 bg-black/70 px-4 py-3 font-mono text-[12px] leading-6 text-white/90 backdrop-blur">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-amber-300">
        Movement debug
      </div>
      <div className="grid grid-cols-[auto_auto] gap-x-8">
        <Row act="FWD" on={walkDebug.forward} label="W / run button" />
        <Row act="L" on={walkDebug.left} label="A / left key" />
        <Row act="R" on={walkDebug.right} label="D / right key" />
        <Row act="JUMP" on={jumpFire} label="Space / jump button" />
        <div className="text-white/70">
          grounded: <span className="text-white">{walkDebug.grounded ? 'yes' : 'no'}</span>
        </div>
        <div className="text-white/70">
          jump stage: <span className="text-white">{walkDebug.jumpState ?? '—'}</span>
        </div>
        <div className="text-white/70">
          moving: <span className="text-white">{walkDebug.moving ? 'yes' : 'no'}</span>
        </div>
        <div className="text-white/70">
          speed: <span className="text-white">{walkDebug.speed.toFixed(1)} m/s</span>
        </div>
        <div className="text-white/70">
          vy: <span className="text-white">{walkDebug.vy.toFixed(1)} m/s</span>
        </div>
        <div className="text-white/70">
          heading: <span className="text-white">{((walkDebug.heading * 180) / Math.PI).toFixed(0)}°</span>
        </div>
      </div>
      <div className="mt-1 text-[10px] italic text-white/50">
        Bottom controls and the keyboard share these exact flags.
      </div>
    </div>
  )
}