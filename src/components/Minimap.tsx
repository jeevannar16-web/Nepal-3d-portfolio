import { useEffect, useRef, type JSX } from 'react'
import { landmarks } from '../data'
import { minimapState } from '../store/minimapState'

const WORLD_SIZE = 100
const MAP_SIZE = 160

export default function Minimap(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

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

    const draw = () => {
      ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE)

      ctx.fillStyle = 'rgba(2, 6, 23, 0.6)'
      ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE)

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
      ctx.lineWidth = 1
      ctx.strokeRect(0.5, 0.5, MAP_SIZE - 1, MAP_SIZE - 1)

      const toPx = (x: number, z: number): [number, number] => [
        ((x + WORLD_SIZE / 2) / WORLD_SIZE) * MAP_SIZE,
        ((z + WORLD_SIZE / 2) / WORLD_SIZE) * MAP_SIZE,
      ]

      for (const landmark of landmarks) {
        const [lx, lz] = toPx(landmark.position[0], landmark.position[2])
        ctx.fillStyle = landmark.color
        ctx.beginPath()
        ctx.arc(lx, lz, 4, 0, Math.PI * 2)
        ctx.fill()
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

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="pointer-events-none absolute bottom-5 left-5 z-10 rounded-xl border border-white/20 bg-black/40 p-2 backdrop-blur">
      <canvas
        ref={canvasRef}
        style={{ width: MAP_SIZE, height: MAP_SIZE }}
      />
    </div>
  )
}
