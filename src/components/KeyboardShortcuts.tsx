import type { JSX } from 'react'
import { ACTION_LABELS, keyLabel, useControls, type ControlAction } from '../store/controlsStore'

const HIGHLIGHT: ControlAction[] = ['forward', 'back', 'left', 'right', 'run', 'jump', 'interact', 'exit']

function Keycap({ spec }: { spec: string }): JSX.Element {
  const isChord = spec.includes('+')
  const label = keyLabel(spec)
  return (
    <kbd
      className={`inline-flex min-w-[1.6rem] items-center justify-center rounded-md border px-1.5 py-0.5 text-[11px] font-bold ${
        isChord
          ? 'border-amber-400/40 bg-amber-400/10 text-amber-200'
          : 'border-white/20 bg-white/10 text-white'
      }`}
    >
      {label}
    </kbd>
  )
}

export default function KeyboardShortcuts(): JSX.Element {
  const bindings = useControls((s) => s.bindings)

  return (
    <section className="flex flex-col rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-widest text-amber-400/90">
        Keyboard shortcuts
      </div>
      <p className="mb-2 px-2 text-[11px] font-semibold leading-snug text-white/50">
        Your current bindings. Tap any key in the Controls list below to change
        it — or use these on desktop.
      </p>
      <ul className="flex flex-col">
        {HIGHLIGHT.map((action) => (
          <li
            key={action}
            className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 odd:bg-white/[0.03]"
          >
            <span className="text-xs font-semibold text-slate-200">{ACTION_LABELS[action]}</span>
            <span className="flex flex-wrap justify-end gap-1">
              {bindings[action].map((spec) => (
                <Keycap key={spec} spec={spec} />
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
