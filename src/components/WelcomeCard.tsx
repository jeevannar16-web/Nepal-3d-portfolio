import { useEffect, useState, type JSX } from 'react'
import { useStore } from '../store/useStore'
import { useDeviceType } from '../hooks/useDeviceType'

export default function WelcomeCard(): JSX.Element | null {
  const introDone = useStore((s) => s.introDone)
  const welcomeDismissed = useStore((s) => s.welcomeDismissed)
  const dismissWelcome = useStore((s) => s.dismissWelcome)
  const visitedZones = useStore((s) => s.visitedZones)
  const deviceType = useDeviceType()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!introDone) return
    const t = setTimeout(() => setShow(true), 900)
    return () => clearTimeout(t)
  }, [introDone])

  if (!introDone || welcomeDismissed || !show) return null

  const hints: [string, string][] = deviceType === 'mobile'
    ? [
        ['Left thumb', 'Move / drive'],
        ['Sprint', 'Hold the sprint button'],
        ['Jump', 'Tap the jump button'],
        ['Get in', 'Tap when near a vehicle'],
        ['Get out', 'Tap the exit button'],
        ['Minimap', 'Tap a landmark to fly'],
      ]
    : [
        ['WASD', 'Move / drive'],
        ['Shift', 'Sprint'],
        ['Space', 'Jump'],
        ['E', 'Enter vehicle'],
        ['Z', 'Get out'],
        ['G · R · H', 'Engine · Reverse · Honk'],
        ['Q / E', 'Look around'],
      ]

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center px-4">
      <div className="animate-welcome pointer-events-auto w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900/85 p-6 text-center shadow-2xl shadow-black/50 backdrop-blur">
        <h2 className="text-lg font-bold text-white">Welcome to my little world</h2>
        <p className="mt-2 text-sm text-white/80">
          You just touched down — walk around, or press{' '}
          <span className="font-semibold text-amber-300">E</span> near the car,
          motorcycle or horse to ride. Stop at any landmark to open a story.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-1.5 text-left">
          {hints.map(([keys, action]) => (
            <div
              key={action}
              className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-1.5"
            >
              <span className="text-xs text-white/70">{action}</span>
              <kbd className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                {keys}
              </kbd>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-white/60">
          Explored {visitedZones.length}/5 zones · click the minimap to fly
        </p>
        <button
          type="button"
          onClick={dismissWelcome}
          className="mt-4 rounded-full bg-amber-400 px-6 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-300 active:scale-95"
        >
          Start exploring
        </button>
      </div>
    </div>
  )
}
