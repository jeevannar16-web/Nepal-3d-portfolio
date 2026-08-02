import type { JSX } from 'react'
import Scene2D from './Scene2D'

interface FallbackViewProps {
  /** Optional reason shown in a dismissible-until-reload banner. */
  notice?: string | null
}

/**
 * Rendered whenever the 3D scene can't run (no WebGL2, a context that was
 * lost, or an unexpected crash). Shows the lightweight 2D view with a small
 * banner explaining why, plus a reload button to retry 3D.
 */
export default function FallbackView({ notice }: FallbackViewProps): JSX.Element {
  return (
    <div className="relative h-full w-full">
      {notice && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center p-3">
          <div className="pointer-events-auto flex max-w-xl items-center gap-3 rounded-xl border border-amber-400/30 bg-slate-900/95 px-4 py-3 text-xs text-amber-200 shadow-lg backdrop-blur">
            <span className="leading-relaxed">{notice}</span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="shrink-0 rounded-lg bg-amber-500 px-3 py-1 font-semibold text-slate-900 transition hover:bg-amber-400"
            >
              Reload
            </button>
          </div>
        </div>
      )}
      <Scene2D />
    </div>
  )
}
