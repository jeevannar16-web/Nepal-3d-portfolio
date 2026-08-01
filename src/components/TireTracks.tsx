import { useMemo, useRef, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
import type { RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { minimapState } from '../store/minimapState'

const TRACK_COUNT = 140
const TRACK_LIFE = 6 // seconds before a track fades out
const SPAWN_INTERVAL = 0.07 // seconds between samples
const SPAWN_SPEED = 3 // min speed (units/s) to lay tracks

interface Track {
  active: boolean
  age: number
  x: number
  z: number
  heading: number
}

interface TireTracksProps {
  target: React.RefObject<RapierRigidBody | null>
}

/**
 * Fading tire marks left behind the rear wheels. A single instanced quad pool:
 * tracks are sampled along the actual path, then fade (color + shrink) to
 * nothing, so there's no terrain deformation and no per-mesh draw calls.
 */
export default function TireTracks({ target }: TireTracksProps): JSX.Element {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const tracks = useRef<Track[]>([])
  const next = useRef(0)
  const spawnTimer = useRef(0)

  const dark = useMemo(() => new THREE.Color('#262626'), [])
  const grass = useMemo(() => new THREE.Color('#54734f'), [])
  const tmpColor = useMemo(() => new THREE.Color(), [])
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const s = useMemo(() => new THREE.Vector3(), [])
  const zero = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), [])

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1.1, 0.18)
    g.rotateX(-Math.PI / 2) // lie flat on the ground
    return g
  }, [])

  if (tracks.current.length === 0) {
    for (let i = 0; i < TRACK_COUNT; i++) {
      tracks.current.push({ active: false, age: 0, x: 0, z: 0, heading: 0 })
    }
  }

  useFrame((_, delta) => {
    const rb = target.current
    if (!rb || !mesh.current) return

    const pos = rb.translation()
    const lin = rb.linvel()
    const speed = Math.hypot(lin.x, lin.z)
    const heading = minimapState.heading

    spawnTimer.current += delta
    if (speed > SPAWN_SPEED && spawnTimer.current >= SPAWN_INTERVAL) {
      spawnTimer.current = 0
      const sinH = Math.sin(heading)
      const cosH = Math.cos(heading)
      for (const lx of [0.6, -0.6]) {
        const wx = pos.x + lx * cosH - 0.75 * sinH
        const wz = pos.z - lx * sinH - 0.75 * cosH
        const t = tracks.current[next.current]
        t.active = true
        t.age = 0
        t.x = wx
        t.z = wz
        t.heading = heading
        next.current = (next.current + 1) % TRACK_COUNT
      }
    }

    for (let i = 0; i < TRACK_COUNT; i++) {
      const t = tracks.current[i]
      if (!t.active) {
        mesh.current.setMatrixAt(i, zero)
        continue
      }
      t.age += delta
      if (t.age >= TRACK_LIFE) {
        t.active = false
        mesh.current.setMatrixAt(i, zero)
        continue
      }
      const k = t.age / TRACK_LIFE
      const scale = Math.max(0.05, 1 - k * 0.9)
      q.setFromEuler(new THREE.Euler(0, t.heading, 0))
      v.set(t.x, 0.02, t.z)
      s.set(scale, scale, 1)
      m.compose(v, q, s)
      mesh.current.setMatrixAt(i, m)
      tmpColor.copy(dark).lerp(grass, k)
      mesh.current.setColorAt(i, tmpColor)
    }

    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, TRACK_COUNT]}>
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={0.6}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </instancedMesh>
  )
}
