import { useRef, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import Soldier from './Soldier'
import { feetLocalY } from '../store/walkState'
import type { Motion } from './Soldier'

interface RiderProps {
  /**
   * World-local offset (relative to the vehicle's `visual` group, which already
   * follows the body's heading) where the rider's HIPS rest on the seat. The
   * rider is placed facing +Z to match the vehicle's nose-forward convention.
   */
  seat: [number, number, number]
  /** Forward lean (radians) of the whole rider, to hug a bike/horse saddle. */
  lean?: number
  /**
   * Handlebar grip points in the *seat frame* (origin = hips, +Z = nose, +X =
   * right, +Y = up, before the lean rotation is applied). The rider's hands are
   * IK-solved onto these each frame. Defaults to a sport-bike crouch.
   */
  grip?: Grip
}

type Grip = {
  left: [number, number, number]
  right: [number, number, number]
}

// The retargeted avatar, in its standing Idle pose, holds its Hips ~HIP_ABOVE_FEET
// above the feet (feet ≈ at the root, hips near 0.99m up). To make the rider look
// *seated* on the seat we rest the HIPS on `seat` and let the legs dangle below,
// instead of standing on it.
const HIP_ABOVE_FEET = 0.986

// Default grip: rider's hands on a forward sport-bike bar, ~chest height.
const DEFAULT_GRIP: Grip = {
  left: [-0.28, 0.95, 0.55],
  right: [0.28, 0.95, 0.55],
}

export default function Rider({ seat, lean = 0, grip = DEFAULT_GRIP }: RiderProps): JSX.Element {
  const motionRef = useRef<Motion>({
    moving: false,
    running: false,
    crouching: false,
    jump: null,
    speed: 0,
  })
  const groupRef = useRef<THREE.Group>(null)

  // Feed world-space grip points + the vehicle's horizontal nose each frame so
  // Soldier can IK the hands onto the bars. Computed from the seat frame so the
  // hands travel with lean, heading and (in big mode) scale automatically.
  useFrame(() => {
    const g = groupRef.current
    if (!g) return
    g.updateWorldMatrix(true, false)
    // Vehicle forward (horizontal world) = the group's +Z after lean/heading.
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(g.getWorldQuaternion(new THREE.Quaternion()))
    fwd.y = 0
    fwd.normalize()
    const g0 = grip ?? DEFAULT_GRIP
    const L = new THREE.Vector3(...g0.left)
    const R = new THREE.Vector3(...g0.right)
    g.localToWorld(L)
    g.localToWorld(R)
    motionRef.current.riding = { left: L, right: R, barForward: fwd }
  })

  return (
    <group ref={groupRef} position={[seat[0], seat[1], seat[2]]} rotation={[lean, 0, 0]}>
      {/* Put the avatar's hips on the seat: step the root down by the hip
          height (feetLocalY is ~0 since feet sit at the root). */}
      <group position={[0, -HIP_ABOVE_FEET - feetLocalY.current, 0]}>
        <Soldier motionRef={motionRef} />
      </group>
    </group>
  )
}

