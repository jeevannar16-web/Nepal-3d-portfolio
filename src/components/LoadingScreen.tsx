import { useEffect, useState, type JSX } from 'react'
import { useProgress } from '@react-three/drei'

const MIN_MS = 700

export default function LoadingScreen(): JSX.Element {
  const { active, progress } = useProgress()
  const [minElapsed, setMinElapsed] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), MIN_MS)
    return () => clearTimeout(t)
  }, [])

  const visible = active || !minElapsed

  if (!visible) return <></>

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center overflow-hidden bg-slate-900">
      {/* Soft gradient backdrop — a hint of the dusk Kathmandu sky. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#1e293b_0%,#0f172a_55%,#020617_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-amber-500/10 to-transparent" />

      {/* Faint mountain silhouette at the base. */}
      <svg
        className="absolute bottom-0 left-1/2 h-32 w-96 -translate-x-1/2 opacity-25"
        viewBox="0 0 384 128"
        fill="none"
        aria-hidden="true"
      >
        <path d="M0 128 96 40l64 56 64-72 96 104Z" fill="#fbbf24" opacity="0.45" />
        <path d="M240 128l48-64 96 64Z" fill="#fbbf24" opacity="0.25" />
      </svg>

      <div className="relative flex flex-col items-center rounded-2xl border border-white/15 bg-black/40 px-8 py-6 backdrop-blur">
        {/* Icon mark — sun over the peaks, echoing the valley's landmarks. */}
        <svg
          viewBox="0 0 24 24"
          className="mb-3 h-10 w-10 text-amber-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="17" cy="6" r="2.6" />
          <path d="M2 20 8.5 9l4.5 7 3-5.5L22 20Z" />
        </svg>

        <div className="mb-4 text-lg font-bold text-white">Entering Kathmandu…</div>
        <div className="h-1.5 w-64 overflow-hidden rounded-full border border-white/10 bg-white/10">
          <div
            className="h-full rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.55)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-slate-400">{Math.round(progress)}%</div>
      </div>
    </div>
  )
}
