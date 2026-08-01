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

interface FlagPoleSpot {
  x: number
  z: number
  y: number
}

interface FlagStringSpot {
  x: number
  z: number
  y: number
  angle: number
  len: number
}

interface FlagFlagSpot {
  x: number
  z: number
  y: number
  angle: number
  color: string
}

interface StupaSpot {
  x: number
  z: number
  r: number
  s: number
}

interface ManiSpot {
  x: number
  z: number
  r: number
  s: number
}

const SCATTER_RADIUS = 138
const FLAG_COLORS = [
  '#e63946',
  '#f4a261',
  '#e9c46a',
  '#457b9d',
  '#6a994e',
  '#2a9d8f',
]
const HOUSE_COLORS = ['#e8dcc8', '#d9b98c', '#c98d5f', '#b7a396']
const STUPA_COLORS = ['#f5f0e6', '#efe7d8', '#fffaf0']
const MANI_COLORS = ['#a8a291', '#b3ad9c', '#9c9685']

export default function Decorations(): JSX.Element {
  const { trees, houses, flagPoles, flagStrings, flagFlags, stupas, manis } =
    useMemo(() => {
      const rng = mulberry32(42)
      const trees: TreeSpot[] = []
      const houses: HouseSpot[] = []
      const flagPoles: FlagPoleSpot[] = []
      const flagStrings: FlagStringSpot[] = []
      const flagFlags: FlagFlagSpot[] = []
      const stupas: StupaSpot[] = []
      const manis: ManiSpot[] = []

    // Flank each road segment with trees, houses, strings of flags, and the
    // occasional stupa or mani wall so driving feels like passing through
    // the Kathmandu valley.
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
          } else if (roll < 0.58) {
            const off = 6 + rng() * 3
            stupas.push({
              x: rx + px * off * side,
              z: rz + pz * off * side,
              r: rng() * Math.PI * 2,
              s: 0.8 + rng() * 0.5,
            })
          }
          if (rng() < 0.22) {
            const off = 3.2 + rng() * 1.5
            const bx = rx + px * off * side
            const bz = rz + pz * off * side
            const y = 1.5 + rng() * 1.0
            const angle = rng() * Math.PI * 2
            const len = 1.3 + rng() * 0.5
            const dx = Math.cos(angle)
            const dz = Math.sin(angle)
            for (const s of [-1, 1]) {
              flagPoles.push({
                x: bx + dx * (len / 2) * s,
                z: bz + dz * (len / 2) * s,
                y,
              })
            }
            flagStrings.push({ x: bx, z: bz, y, angle, len })
            for (let k = -1; k <= 1; k++) {
              flagFlags.push({
                x: bx + dx * (len / 2) * (k / 2),
                z: bz + dz * (len / 2) * (k / 2),
                y: y - 0.25,
                angle,
                color: FLAG_COLORS[Math.floor(rng() * FLAG_COLORS.length)],
              })
            }
          }
          if (rng() < 0.12) {
            const off = 4 + rng() * 3
            manis.push({
              x: rx + px * off * side,
              z: rz + pz * off * side,
              r: rng() < 0.5 ? 0 : Math.PI / 2,
              s: 0.8 + rng() * 0.6,
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

    return { trees, houses, flagPoles, flagStrings, flagFlags, stupas, manis }
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
            position={[t.x, t.s * 0.18, t.z]}
            scale={[t.s * 0.24, t.s * 0.36, t.s * 0.24]}
          />
        ))}
      </Instances>
      <Instances limit={trees.length} frustumCulled={false}>
        <coneGeometry args={[1, 1, 6]} />
        <meshStandardMaterial color="#3d7a44" flatShading />
        {trees.map((t, i) => (
          <Instance
            key={`leaf-${i}`}
            position={[t.x, t.s * 1.05, t.z]}
            scale={[t.s * 0.65, t.s * 1.5, t.s * 0.65]}
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
            scale={t.s * 1.5}
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

      {/* Prayer flags — two short poles with a string of bright flags between
          them. Poles are thick enough to read at distance so the flags never
          look like unsupported floating boxes. */}
      <Instances limit={flagPoles.length} frustumCulled={false}>
        <boxGeometry args={[0.1, 1, 0.1]} />
        <meshStandardMaterial color="#4a4236" flatShading />
        {flagPoles.map((p, i) => (
          <Instance
            key={`flagPole-${i}`}
            position={[p.x, p.y / 2, p.z]}
            scale={[1, p.y, 1]}
          />
        ))}
      </Instances>
      <Instances limit={flagStrings.length} frustumCulled={false}>
        <boxGeometry args={[1, 0.05, 0.05]} />
        <meshStandardMaterial color="#3a342c" flatShading />
        {flagStrings.map((s, i) => (
          <Instance
            key={`flagString-${i}`}
            position={[s.x, s.y, s.z]}
            rotation={[0, s.angle, 0]}
            scale={[s.len, 1, 1]}
          />
        ))}
      </Instances>
      <Instances limit={flagFlags.length} frustumCulled={false}>
        <boxGeometry args={[0.3, 0.35, 0.04]} />
        <meshStandardMaterial color="#ffffff" flatShading />
        {flagFlags.map((f, i) => (
          <Instance
            key={`flag-${i}`}
            position={[f.x, f.y, f.z]}
            rotation={[0, f.angle, 0]}
            color={f.color}
          />
        ))}
      </Instances>

      {/* Stupas — white base drum + squat dome + small spire */}
      <Instances limit={stupas.length} frustumCulled={false}>
        <cylinderGeometry args={[0.5, 0.55, 0.5, 6]} />
        <meshStandardMaterial color="#f5f0e6" flatShading />
        {stupas.map((st, i) => (
          <Instance
            key={`stupaBase-${i}`}
            position={[st.x, 0.25 * st.s, st.z]}
            rotation={[0, st.r, 0]}
            scale={st.s}
            color={STUPA_COLORS[i % STUPA_COLORS.length]}
          />
        ))}
      </Instances>
      <Instances limit={stupas.length} frustumCulled={false}>
        <sphereGeometry args={[0.5, 8, 6]} />
        <meshStandardMaterial color="#f5f0e6" flatShading />
        {stupas.map((st, i) => (
          <Instance
            key={`stupaDome-${i}`}
            position={[st.x, 0.75 * st.s, st.z]}
            rotation={[0, st.r, 0]}
            scale={[st.s * 0.9, st.s * 0.5, st.s * 0.9]}
            color={STUPA_COLORS[i % STUPA_COLORS.length]}
          />
        ))}
      </Instances>
      <Instances limit={stupas.length} frustumCulled={false}>
        <coneGeometry args={[0.08, 0.25, 4]} />
        <meshStandardMaterial color="#c9a227" flatShading />
        {stupas.map((st, i) => (
          <Instance
            key={`stupaSpire-${i}`}
            position={[st.x, 1.13 * st.s, st.z]}
            rotation={[0, st.r, 0]}
            scale={st.s}
          />
        ))}
      </Instances>

      {/* Mani walls — low carved-stone blocks along the roads */}
      <Instances limit={manis.length} frustumCulled={false}>
        <boxGeometry args={[1.8, 0.7, 1.1]} />
        <meshStandardMaterial color="#a8a291" flatShading />
        {manis.map((m, i) => (
          <Instance
            key={`mani-${i}`}
            position={[m.x, 0.35 * m.s, m.z]}
            rotation={[0, m.r, 0]}
            scale={m.s}
            color={MANI_COLORS[i % MANI_COLORS.length]}
          />
        ))}
      </Instances>
    </>
  )
}
