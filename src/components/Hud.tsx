import type { JSX } from 'react'
import { identity } from '../data'

export default function Hud(): JSX.Element {
  return (
    <div className="pointer-events-none absolute left-0 top-0 z-10 flex w-full items-start justify-between p-5">
      <div>
        <h1 className="text-xl font-bold text-white drop-shadow-lg sm:text-2xl">
          {identity.name}
        </h1>
        <p className="text-sm text-white/80 drop-shadow">
          {identity.role} · {identity.location}
        </p>
      </div>
      <div className="hidden rounded-full bg-black/30 px-4 py-2 text-xs text-white/90 backdrop-blur sm:block">
        WASD / Arrow keys to drive · Enter a landmark to explore
      </div>
    </div>
  )
}
