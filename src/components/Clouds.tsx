import { useMemo, type JSX } from 'react'
import * as THREE from 'three'
import { mulberry32 } from '../world'

interface Cloud {
  x: number
  y: number
  z: number
  s: number
  opacity: number
}

function cloudTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(c)
  const lobes: [number, number, number, number][] = [
    [128, 128, 72, 1],
    [90, 108, 46, 0.9],
    [168, 112, 48, 0.9],
    [108, 156, 42, 0.85],
    [150, 150, 40, 0.9],
  ]
  for (const [x, y, r, a] of lobes) {
    const g = ctx.createRadialGradient(x, y, 2, x, y, r)
    g.addColorStop(0, `rgba(255, 255, 255, ${0.95 * a})`)
    g.addColorStop(0.55, `rgba(255, 240, 226, ${0.5 * a})`)
    g.addColorStop(1, 'rgba(255, 235, 220, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

/**
 * A ring of soft billboard clouds for the intro sky. Sits above and around the
 * flight circuit so the airplane rounds the valley beneath a golden cloud deck,
 * then disappears after touchdown for a clean reveal of the real sky.
 */
export default function Clouds(): JSX.Element {
  const clouds = useMemo<Cloud[]>(() => {
    const rng = mulberry32(7)
    const arr: Cloud[] = []
    for (let i = 0; i < 18; i++) {
      const ang = rng() * Math.PI * 2
      const rad = 115 + rng() * 95
      arr.push({
        x: Math.cos(ang) * rad,
        z: Math.sin(ang) * rad,
        y: 48 + rng() * 60,
        s: 26 + rng() * 22,
        opacity: 0.45 + rng() * 0.4,
      })
    }
    return arr
  }, [])

  const tex = useMemo(cloudTexture, [])

  return (
    <group>
      {clouds.map((cloud, i) => (
        <sprite
          key={i}
          position={[cloud.x, cloud.y, cloud.z]}
          scale={[cloud.s, cloud.s * 0.55, 1]}
        >
          <spriteMaterial
            map={tex}
            transparent
            opacity={cloud.opacity}
            depthWrite={false}
            fog={false}
          />
        </sprite>
      ))}
    </group>
  )
}
