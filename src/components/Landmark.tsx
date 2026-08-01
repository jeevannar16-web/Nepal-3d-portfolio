import { useRef, useMemo, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { useStore } from '../store/useStore'
import type { LandmarkConfig } from '../data'
import { matcapTexture } from '../utils/textures'
import BlobShadow from './BlobShadow'

interface LandmarkProps {
  config: LandmarkConfig
  playerRef: React.RefObject<RapierRigidBody | null>
}

/**
 * Blender-model loading slot.
 *
 * TODO (swap in real models):
 *  1. Export a .glb from Blender and drop it into public/models/.
 *  2. Set `modelPath` on the matching entry in src/data.ts,
 *     e.g. '/models/temple.glb'.
 *  3. No other code changes needed. The physics trigger stays separate.
 */
function LandmarkModel({ path }: { path: string }): JSX.Element {
  const gltf = useGLTF(path)
  const clone = useMemo(() => {
    const c = gltf.scene.clone()
    const matcap = matcapTexture()
    c.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const baseColor =
        (mesh.material as THREE.MeshStandardMaterial)?.color?.getHex() ?? 0xffffff
      const mat = new THREE.MeshMatcapMaterial({
        color: baseColor,
        matcap,
        flatShading: true,
      })
      mesh.material = mat
    })
    return c
  }, [gltf.scene])

  return <primitive object={clone} position={[0, 0, 0]} />
}

/**
 * Procedural stand-in shape (temple/tower/gate/mountain silhouette).
 * Kept as the default until a modelPath is provided in data.ts.
 */
function ProceduralLandmark({ config }: { config: LandmarkConfig }): JSX.Element {
  const mesh = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!mesh.current) return
    mesh.current.rotation.y = state.clock.elapsedTime * 0.4
  })

  return (
    <group position={[0, 1, 0]}>
      <mesh ref={mesh} position={[0, 0.75, 0]}>
        <coneGeometry args={[1.2, 1.5, 4]} />
        <meshMatcapMaterial color={config.color} matcap={matcapTexture()} flatShading />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[2.4, 0.8, 2.4]} />
        <meshMatcapMaterial color={config.color} matcap={matcapTexture()} flatShading />
      </mesh>
    </group>
  )
}

export default function Landmark({ config, playerRef }: LandmarkProps): JSX.Element {
  const trigger = useRef<RapierRigidBody>(null)
  const visual = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const pulse = useRef(0)
  const setActiveZone = useStore((s) => s.setActiveZone)
  const setIsPanelOpen = useStore((s) => s.setIsPanelOpen)

  const enter = (e: { other: { rigidBody?: RapierRigidBody } }) => {
    if (e.other.rigidBody && e.other.rigidBody === playerRef.current) {
      setActiveZone(config.contentKey)
      setIsPanelOpen(true)
    }
  }

  const exit = (e: { other: { rigidBody?: RapierRigidBody } }) => {
    if (e.other.rigidBody && e.other.rigidBody === playerRef.current) {
      setActiveZone(null)
      setIsPanelOpen(false)
    }
  }

  useFrame((state) => {
    const rb = playerRef.current
    if (!rb || !visual.current) return

    const p = rb.translation()
    const dx = p.x - config.position[0]
    const dz = p.z - config.position[2]
    const dist = Math.sqrt(dx * dx + dz * dz)
    const range = config.triggerRadius * 1.5
    const target = Math.max(0, 1 - dist / range)
    pulse.current += (target - pulse.current) * 0.12

    const t = state.clock.elapsedTime
    const glow = pulse.current * (0.5 + 0.5 * Math.sin(t * 5))
    visual.current.scale.setScalar(1 + glow * 0.12)
    visual.current.position.y = glow * 0.25

    if (ring.current) {
      const mat = ring.current.material as THREE.MeshBasicMaterial
      mat.opacity = pulse.current * 0.45
      const s = 1 + glow * 0.5
      ring.current.scale.setScalar(s)
    }
  })

  return (
    <group position={config.position}>
      {/* Physics body (invisible): static, carries only the sensor trigger */}
      <RigidBody ref={trigger} type="fixed" colliders={false}>
        <CuboidCollider
          args={[config.triggerRadius, config.triggerRadius, config.triggerRadius]}
          sensor
          onIntersectionEnter={enter}
          onIntersectionExit={exit}
        />
      </RigidBody>

      <group ref={visual}>
        {config.modelPath ? (
          <LandmarkModel path={config.modelPath} />
        ) : (
          <ProceduralLandmark config={config} />
        )}
      </group>

      <BlobShadow radius={config.triggerRadius * 0.9} />

      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[config.triggerRadius * 1.05, config.triggerRadius * 1.35, 32]} />
        <meshBasicMaterial
          color={config.color}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

