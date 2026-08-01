import { useMemo, type JSX } from 'react'
import { Instances, Instance } from '@react-three/drei'
import { roadPaths, mulberry32, pointSegDist } from '../world'
import { landmarks } from '../data'
import { blobShadowTexture } from '../utils/textures'

interface TreeSpot {
  x: number
  z: number
  s: number
}

interface HouseSpot {
  x: number
  z: number
  r: number
  s: number
  color: string
}

interface FlagSpot {
  x: number
  z: number
  y: number
  r: number
  color: string
}

const SCATTER_RADIUS = 138
const FLAG_COLORS = [
  '#e63946',
  '#f4a261',
  '#e9c46a',
  '#457b9d',
  '#6a994e',
  '#a98467',
  '#f1faee',
  '#2a9d8f',
]
const HOUSE_COLORS = ['#e8dcc8', '#d9b98c', '#c98d5f', '#b7a396']

export default function Decorations(): JSX.Element {
  const { trees, houses, flags } = useMemo(() => {
    const rng = mulberry32(42)
    const trees: TreeSpot[] = []
    const houses: HouseSpot[] = []
    const flags: FlagSpot[] = []

    // Flank each road segment with trees, a few houses, and strings of flags
    // so driving between landmarks feels like passing through a small town.
    for (const path of roadPaths) {
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i]
        const b = path[i + 1]
        const dx = b[0] - a[0]
        const dz = b[1] - a[1]
        const len = Math.hypot(dx, dz)
        if (len < 1) continue
        const px = -dz / len
        const pz = dx / len
        const steps = Math.floor(len / 6)
        for (let s = 0; s <= steps; s++) {
          const t = s / steps
          const rx = a[0] + dx * t
          const rz = a[1] + dz * t
          const side = rng() < 0.5 ? 1 : -1
          const roll = rng()
          if (roll < 0.5) {
            const off = 4.5 + rng() * 3.5
            trees.push({
              x: rx + px * off * side,
              z: rz + pz * off * side,
              s: 0.8 + rng() * 1.4,
            })
          } else if (roll < 0.56) {
            const off = 10 + rng() * 5
            houses.push({
              x: rx + px * off * side,
              z: rz + pz * off * side,
              r: rng() * Math.PI * 2,
              s: 0.9 + rng() * 0.8,
              color: HOUSE_COLORS[Math.floor(rng() * HOUSE_COLORS.length)],
            })
          }
          if (rng() < 0.22) {
            const off = 3.2 + rng() * 1.5
            flags.push({
              x: rx + px * off * side,
              z: rz + pz * off * side,
              y: 1.3 + rng() * 1.1,
              r: rng() * 0.4 - 0.2,
              color: FLAG_COLORS[Math.floor(rng() * FLAG_COLORS.length)],
            })
          }
        }
      }
    }

    // A little scattered woodland on open ground, kept off roads and landmarks.
    for (let i = 0; i < 70; i++) {
      const x = (rng() * 2 - 1) * SCATTER_RADIUS
      const z = (rng() * 2 - 1) * SCATTER_RADIUS
      if (Math.hypot(x, z) < 10) continue
      let clear = true
      for (const l of landmarks) {
        if (Math.hypot(x - l.position[0], z - l.position[2]) < 10) {
          clear = false
          break
        }
      }
      if (!clear) continue
      for (const path of roadPaths) {
        for (let k = 0; k < path.length - 1; k++) {
          if (pointSegDist(x, z, path[k], path[k + 1]) < 5) {
            clear = false
            break
          }
        }
        if (!clear) break
      }
      if (clear) trees.push({ x, z, s: 0.8 + rng() * 1.2 })
    }

    return { trees, houses, flags }
  }, [])

  const treeShadow = useMemo(() => blobShadowTexture(), [])

  return (
    <>
      <Instances limit={trees.length} frustumCulled={false}>
        <cylinderGeometry args={[0.5, 0.65, 1, 5]} />
        <meshStandardMaterial color="#5d4328" flatShading />
        {trees.map((t, i) => (
          <Instance
            key={`trunk-${i}`}
            position={[t.x, t.s * 0.4, t.z]}
            scale={[t.s * 0.12, t.s * 0.8, t.s * 0.12]}
          />
        ))}
      </Instances>
      <Instances limit={trees.length} frustumCulled={false}>
        <coneGeometry args={[1, 1, 6]} />
        <meshStandardMaterial color="#3d7a44" flatShading />
        {trees.map((t, i) => (
          <Instance
            key={`leaf-${i}`}
            position={[t.x, t.s, t.z]}
            scale={[t.s, t.s * 1.3, t.s]}
            color={i % 3 === 0 ? '#4c8a52' : '#3d7a44'}
          />
        ))}
      </Instances>
      <Instances limit={trees.length} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={treeShadow} transparent depthWrite={false} />
        {trees.map((t, i) => (
          <Instance
            key={`treeShadow-${i}`}
            position={[t.x, 0.015, t.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={t.s * 1.6}
            color="#ffffff"
          />
        ))}
      </Instances>

      <Instances limit={houses.length} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" flatShading />
        {houses.map((h, i) => (
          <Instance
            key={`house-${i}`}
            position={[h.x, h.s * 0.8, h.z]}
            rotation={[0, h.r, 0]}
            scale={[h.s * 2.2, h.s * 1.6, h.s * 2.2]}
            color={h.color}
          />
        ))}
      </Instances>
      <Instances limit={houses.length} frustumCulled={false}>
        <coneGeometry args={[1, 1, 4]} />
        <meshStandardMaterial color="#8a3b2e" flatShading />
        {houses.map((h, i) => (
          <Instance
            key={`roof-${i}`}
            position={[h.x, h.s * 1.6, h.z]}
            rotation={[0, Math.PI / 4, 0]}
            scale={[h.s * 1.7, h.s * 0.9, h.s * 1.7]}
            color="#a0513f"
          />
        ))}
      </Instances>
      <Instances limit={houses.length} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={treeShadow} transparent depthWrite={false} />
        {houses.map((h, i) => (
          <Instance
            key={`houseShadow-${i}`}
            position={[h.x, 0.015, h.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={h.s * 3.2}
            color="#ffffff"
          />
        ))}
      </Instances>

      <Instances limit={flags.length} frustumCulled={false}>
        <boxGeometry args={[0.7, 0.45, 0.05]} />
        <meshStandardMaterial color="#ffffff" flatShading />
        {flags.map((f, i) => (
          <Instance
            key={`flag-${i}`}
            position={[f.x, f.y, f.z]}
            rotation={[0, f.r, 0]}
            color={f.color}
          />
        ))}
      </Instances>
    </>
  )
}
