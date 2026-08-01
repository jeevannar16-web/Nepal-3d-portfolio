import { useMemo, type JSX } from 'react'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { grassTexture, groundAOTexture } from '../utils/textures'
import { PALETTE } from '../utils/palette'

export const WORLD_EDGE = 150
const WALL_HEIGHT = 2

export default function Ground(): JSX.Element {
  // The floor needs a uv2 channel for aoMap (baked soft occlusion pools).
  const floorGeometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(WORLD_EDGE * 2, WORLD_EDGE * 2)
    geo.setAttribute('uv2', geo.getAttribute('uv'))
    return geo
  }, [])

  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <mesh geometry={floorGeometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <meshStandardMaterial
            map={grassTexture()}
            aoMap={groundAOTexture()}
            aoMapIntensity={0.9}
            color={PALETTE.ground}
          />
        </mesh>
        <CuboidCollider args={[WORLD_EDGE, 0.5, WORLD_EDGE]} position={[0, -0.5, 0]} />
      </RigidBody>

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[WORLD_EDGE, WALL_HEIGHT / 2, 0.5]} position={[0, WALL_HEIGHT / 2, WORLD_EDGE]} />
      </RigidBody>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[WORLD_EDGE, WALL_HEIGHT / 2, 0.5]} position={[0, WALL_HEIGHT / 2, -WORLD_EDGE]} />
      </RigidBody>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.5, WALL_HEIGHT / 2, WORLD_EDGE]} position={[WORLD_EDGE, WALL_HEIGHT / 2, 0]} />
      </RigidBody>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.5, WALL_HEIGHT / 2, WORLD_EDGE]} position={[-WORLD_EDGE, WALL_HEIGHT / 2, 0]} />
      </RigidBody>
    </>
  )
}
