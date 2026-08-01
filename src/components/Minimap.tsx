import { useEffect, useRef, type JSX } from 'react'
import { landmarks } from '../data'
import { minimapState } from '../store/minimapState'
import { useStore } from '../store/useStore'

const WORLD_SIZE = 300
const MAP_SIZE = 160

export default function Minimap(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const flyTo = useStore((s) => s.flyTo)
  const introDone = useStore((s) => s.introDone)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = MAP_SIZE * dpr
    canvas.height = MAP_SIZE * dpr
    ctx.scale(dpr, dpr)

    let raf = 0

    const toPx = (x: number, z: number): [number, number] => [
      ((x + WORLD_SIZE / 2) / WORLD_SIZE) * MAP_SIZE,
      ((z + WORLD_SIZE / 2) / WORLD_SIZE) * MAP_SIZE,
    ]

    const draw = () => {
      ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE)

      ctx.fillStyle = 'rgba(2, 6, 23, 0.6)'
      ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE)

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
      ctx.lineWidth = 1
      ctx.strokeRect(0.5, 0.5, MAP_SIZE - 1, MAP_SIZE - 1)

      for (const landmark of landmarks) {
        const [lx, lz] = toPx(landmark.position[0], landmark.position[2])
        ctx.fillStyle = landmark.color
        ctx.beginPath()
        ctx.arc(lx, lz, 4, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.font = '9px system-ui, sans-serif'
        ctx.textBaseline = 'middle'
        ctx.fillText(landmark.label.split(' — ')[0], lx + 7, lz)
      }

      const [px, pz] = toPx(minimapState.x, minimapState.z)
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(px, pz, 5, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 2
      const headingLen = 8
      const hx = Math.sin(minimapState.heading) * headingLen
      const hz = Math.cos(minimapState.heading) * headingLen
      ctx.beginPath()
      ctx.moveTo(px, pz)
      ctx.lineTo(px + hx, pz + hz)
      ctx.stroke()

      raf = requestAnimationFrame(draw)
    }

    const handleClick = (e: MouseEvent) => {
      if (!introDone) return
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      for (const landmark of landmarks) {
        const [lx, lz] = toPx(landmark.position[0], landmark.position[2])
        const dist = Math.hypot(mx - lx, my - lz)
        if (dist <= 12) {
          flyTo(landmark.position[0], landmark.position[2])
          return
        }
      }
    }

    raf = requestAnimationFrame(draw)
    canvas.addEventListener('click', handleClick)
    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('click', handleClick)
    }
  }, [flyTo, introDone])

  return (
    <div
      className={`pointer-events-auto absolute bottom-5 left-5 z-10 rounded-xl border border-white/20 bg-black/40 p-2 backdrop-blur transition-opacity duration-700 ${
        introDone ? 'opacity-100' : 'opacity-75'
      }`}
    >
      <canvas
        ref={canvasRef}
        style={{ width: MAP_SIZE, height: MAP_SIZE }}
        className="cursor-pointer"
        title="Click a landmark to fly to it"
      />
      <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 px-0.5">
        {landmarks.map((landmark) => (
          <span key={landmark.id} className="flex items-center gap-1 text-[9px] text-white/70">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: landmark.color }}
            />
            {landmark.label.split(' — ')[0]}
          </span>
        ))}
        <span className="flex items-center gap-1 text-[9px] text-white/70">
          <span className="inline-block h-2 w-2 rounded-full bg-white" />
          You
        </span>
      </div>
    </div>
  )
}
