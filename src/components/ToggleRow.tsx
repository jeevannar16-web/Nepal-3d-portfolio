import type { JSX } from 'react'

export default function ToggleRow({
  label,
  on,
  onToggle,
}: {
  label: string
  on: boolean
  onToggle: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm text-slate-200 transition hover:bg-white/10"
    >
      <span>{label}</span>
      <span
        className={`h-5 w-9 shrink-0 rounded-full border transition-colors ${
          on ? 'border-amber-400/60 bg-amber-400' : 'border-white/20 bg-white/10'
        }`}
      >
        <span
          className={`block h-4 w-4 translate-y-[1px] rounded-full bg-white shadow transition-transform ${
            on ? 'translate-x-[18px]' : 'translate-x-[1px]'
          }`}
        />
      </span>
    </button>
  )
}
