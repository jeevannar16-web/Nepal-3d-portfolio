import { useRef, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { useStore } from '../store/useStore'
import type { LandmarkConfig } from '../data'

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
  return (
    <primitive
      object={gltf.scene.clone()}
      position={[0, 0, 0]}
      castShadow
    />
  )
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
      <mesh ref={mesh} castShadow position={[0, 0.75, 0]}>
        <coneGeometry args={[1.2, 1.5, 4]} />
        <meshStandardMaterial color={config.color} />
      </mesh>
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[2.4, 0.8, 2.4]} />
        <meshStandardMaterial color={config.color} />
      </mesh>
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[2.2, 32]} />
        <meshStandardMaterial color="#8d6e63" />
      </mesh>
    </group>
  )
}

export default function Landmark({ config, playerRef }: LandmarkProps): JSX.Element {
  const trigger = useRef<RapierRigidBody>(null)
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

      {config.modelPath ? (
        <LandmarkModel path={config.modelPath} />
      ) : (
        <ProceduralLandmark config={config} />
      )}
    </group>
  )
}
