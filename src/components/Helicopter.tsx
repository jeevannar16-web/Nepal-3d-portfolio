import { useMemo, useRef, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { assetUrl } from '../utils/assetUrl'

// helicopter.glb (EC135) is ~14.97 long / rotor radius 5.05 in model units;
// 0.55 shrinks the rotor to ~5.5 so it sits inside the 3.2-radius helipad.
const HELI_SCALE = 0.55
// Model base (skids) sits at model-local y=-1.35; offset so the skids rest on
// the helipad surface (y = 0).
const HELI_BASE_OFFSET = 1.35 * HELI_SCALE

/** Radians per second — fast enough to read as motion blur, no strobing. */
const ROTOR_SPEED = 12

/**
 * Nodes making up the main rotor assembly in helicopter.glb. Every one of
 * them shares the same pivot (the mast axis), so applying a single yaw to all
 * of them sweeps the whole rotor in a horizontal circle around the mast.
 * The transparent fenestron disc at the tail (rotor_disc_T) is left static.
 */
const ROTOR_NAMES = [
  'Flexbeam',
  'Cylinder_001',
  'mastandswashplate',
  'pitchlink1',
  'pitchlink2',
  'pitchlink3',
  'pitchlink4',
  'scissor',
  'blade1', 'blade1a', 'blade1b', 'blade1c', 'blade1d',
  'blade2', 'blade2a', 'blade2b', 'blade2c', 'blade2d',
  'blade3', 'blade3a', 'blade3b', 'blade3c', 'blade3d',
  'blade4', 'blade4a', 'blade4b', 'blade4c', 'blade4d',
  'blurred1a', 'blurred2a', 'blurred3a', 'blurred4a',
]

/**
 * Spins the helicopter's main rotor around the world-vertical mast axis.
 * Each rotor node's baked orientation (base) is captured once, then every
 * frame it is yawed about the axis that maps to world-up in the node's parent
 * frame — so the blades orbit horizontally no matter how the model group is
 * rotated or scaled.
 */
function HelicopterRotors({
  scene,
  parentQuat,
}: {
  scene: THREE.Object3D
  parentQuat: THREE.Quaternion
}): JSX.Element | null {
  const nodes = useMemo(() => {
    const list: { node: THREE.Object3D; base: THREE.Quaternion }[] = []
    scene.traverse((o) => {
      if (o.name && ROTOR_NAMES.includes(o.name)) {
        list.push({ node: o, base: o.quaternion.clone() })
      }
    })
    return list
  }, [scene])

  const axis = useMemo(
    () =>
      new THREE.Vector3(0, 1, 0)
        .applyQuaternion(parentQuat.clone().invert())
        .normalize(),
    [parentQuat],
  )

  const angle = useRef(0)
  const yaw = useMemo(() => new THREE.Quaternion(), [])

  useFrame((_, delta) => {
    angle.current += delta * ROTOR_SPEED
    yaw.setFromAxisAngle(axis, angle.current)
    for (const { node, base } of nodes) {
      node.quaternion.copy(base).premultiply(yaw)
    }
  })

  return null
}

/**
 * Detailed EC135 helicopter (helicopter.glb) parked on the airport helipad,
 * replacing the old primitive stand-in. Nose faces +X in the model, so the
 * 90° yaw points it down the field; the main rotor assembly spins via
 * HelicopterRotors while the body stays parked.
 */
export default function Helicopter(): JSX.Element {
  const gltf = useGLTF(assetUrl('/models/helicopter.glb'))

  // Full parent chain from a rotor node up to the world: the group's 90° yaw
  // composed with the model root (Y_UP_Transform). The rotor sweep axis is
  // world-up expressed in that frame.
  const parentQuat = useMemo(
    () =>
      new THREE.Quaternion()
        .setFromEuler(new THREE.Euler(0, Math.PI / 2, 0))
        .multiply(gltf.scene.quaternion.clone()),
    [gltf],
  )

  return (
    <group position={[-10, HELI_BASE_OFFSET, 80]} rotation={[0, Math.PI / 2, 0]}>
      <primitive object={gltf.scene} scale={HELI_SCALE} />
      <HelicopterRotors scene={gltf.scene} parentQuat={parentQuat} />
    </group>
  )
}
