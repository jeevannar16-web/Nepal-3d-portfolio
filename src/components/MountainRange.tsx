import { useMemo, type JSX } from 'react'
import { Instances, Instance } from '@react-three/drei'
import { mulberry32 } from '../world'

interface Peak {
  x: number
  z: number
  h: number
  s: number
  r: number
  color: string
  snow: boolean
}

const ROCK_COLORS = ['#7b8ca6', '#6d7f9c', '#8598b0', '#667999']

/**
 * Low-poly Himalayan ring around the valley — purely atmospheric, no physics.
 * Sits just inside the boundary walls so Kathmandu feels ringed by mountains.
 */
export default function MountainRange(): JSX.Element {
  const peaks = useMemo<Peak[]>(() => {
    const rng = mulberry32(7)
    const list: Peak[] = []
    const COUNT = 42
    for (let i = 0; i < COUNT; i++) {
      const angle = (i / COUNT) * Math.PI * 2 + (rng() - 0.5) * 0.35
      const radius = 128 + rng() * 18
      const h = 18 + rng() * 26
      const s = 1.3 + rng() * 1.1
      list.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        h,
        s,
        r: rng() * Math.PI * 2,
        color: ROCK_COLORS[Math.floor(rng() * ROCK_COLORS.length)],
        snow: h > 30 && rng() < 0.7,
      })
    }
    return list
  }, [])

  const snowPeaks = useMemo(() => peaks.filter((p) => p.snow), [peaks])

  return (
    <>
      <Instances limit={peaks.length} frustumCulled={false}>
        <coneGeometry args={[1, 1, 4]} />
        <meshStandardMaterial color="#ffffff" flatShading />
        {peaks.map((p, i) => (
          <Instance
            key={`peak-${i}`}
            position={[p.x, p.h * 0.5, p.z]}
            rotation={[0, p.r, 0]}
            scale={[p.s, p.h, p.s]}
            color={p.color}
          />
        ))}
      </Instances>
      <Instances limit={snowPeaks.length} frustumCulled={false}>
        <coneGeometry args={[1, 1, 4]} />
        <meshStandardMaterial color="#f4f8fc" flatShading />
        {snowPeaks.map((p, i) => (
          <Instance
            key={`snow-${i}`}
            position={[p.x, p.h * 0.65, p.z]}
            rotation={[0, p.r, 0]}
            scale={[p.s * 0.45, p.h * 0.35, p.s * 0.45]}
          />
        ))}
      </Instances>
    </>
  )
}
