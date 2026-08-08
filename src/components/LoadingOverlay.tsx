import { useEffect, useState, type JSX } from 'react'
import { useProgress } from '@react-three/drei'

/**
 * Full-screen loader shown while the 3D assets stream in. Without it the world
 * (ground, roads, map) renders first and the soldier/vehicles pop in later;
 * with it the scene is revealed in one go once every model is cached. Hides
 * when the loader finishes, or as a fallback if a file errors or a stall caps
 * the wait, so the app can never be stuck behind the overlay.
 */
export default function LoadingOverlay(): JSX.Element | null {
  const { active, progress, loaded, total, errors } = useProgress()
  const [ready, setReady] = useState(false)
  const failed = (errors?.length ?? 0) > 0

  useEffect(() => {
    if (ready) return
    // onLoad sets active=false while the final onProgress already reached 100,
    // so both together mean every asset is cached and it's safe to reveal.
    const finished = !active && progress >= 100
    if (finished || failed) {
      const t = setTimeout(() => setReady(true), 350)
      return () => clearTimeout(t)
    }
  }, [active, progress, failed, ready])

  // Never trap the app behind the overlay (stalled request, bad CDN, etc.).
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 20000)
    return () => clearTimeout(t)
  }, [])

  if (ready) return null

  const pct = Math.min(Math.round(progress), 100)

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-slate-900 text-white">
      <div className="flex items-baseline gap-2 font-semibold tracking-widest text-amber-300">
        <span className="text-3xl">Namaste</span>
        <span className="text-sm text-white/70">· loading Nepal…</span>
      </div>
      <div className="h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-amber-400 transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-white/50">
        {total > 0 ? `${loaded}/${total} assets` : 'warming up…'} {pct}%
      </div>
    </div>
  )
}
