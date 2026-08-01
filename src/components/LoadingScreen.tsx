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
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900">
      <div className="mb-4 text-lg font-bold text-white">
        Entering Kathmandu…
      </div>
      <div className="h-1.5 w-64 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-amber-400 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-2 text-xs text-slate-400">{Math.round(progress)}%</div>
    </div>
  )
}
