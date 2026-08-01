import { useEffect, type JSX } from 'react'
import { useStore } from '../store/useStore'
import { landmarks } from '../data'
import { playWhoosh } from '../utils/sounds'

export default function TravelingIndicator(): JSX.Element | null {
  const flyTarget = useStore((s) => s.flyTarget)

  useEffect(() => {
    if (flyTarget) playWhoosh()
  }, [flyTarget])

  if (!flyTarget) return null

  const landmark = landmarks.find(
    (l) => l.position[0] === flyTarget.x && l.position[2] === flyTarget.z,
  )
  const label = landmark ? landmark.label.split(' — ')[0] : 'there'

  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
      <div className="flex items-center gap-3 rounded-full border border-white/20 bg-black/60 px-5 py-2.5 text-sm text-white/90 shadow-2xl backdrop-blur">
        <div className="h-2 w-2 animate-ping rounded-full bg-amber-400" />
        Traveling to {label}…
      </div>
    </div>
  )
}
