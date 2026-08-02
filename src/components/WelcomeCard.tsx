import { useEffect, useState, type JSX } from 'react'
import { useStore } from '../store/useStore'

export default function WelcomeCard(): JSX.Element | null {
  const introDone = useStore((s) => s.introDone)
  const welcomeDismissed = useStore((s) => s.welcomeDismissed)
  const dismissWelcome = useStore((s) => s.dismissWelcome)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!introDone) return
    const t = setTimeout(() => setShow(true), 900)
    return () => clearTimeout(t)
  }, [introDone])

  if (!introDone || welcomeDismissed || !show) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center px-4">
      <div className="animate-welcome pointer-events-auto rounded-2xl border border-white/15 bg-slate-900/85 p-6 text-center shadow-2xl shadow-black/50 backdrop-blur">
        <h2 className="text-lg font-bold text-white">Welcome to my little world</h2>
        <p className="mt-2 max-w-xs text-sm text-white/80">
          You just touched down — walk around, or press E near the car, motorcycle or horse to ride.
          Stop at any landmark to open a story.
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
