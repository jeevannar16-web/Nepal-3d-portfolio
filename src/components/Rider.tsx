import { useRef, type JSX } from 'react'
import Soldier from './Soldier'
import { feetLocalY } from '../store/walkState'

interface RiderProps {
  /**
   * World-local offset (relative to the vehicle's `visual` group, which already
   * follows the body's heading) where the rider's HIPS rest on the seat. The
   * rider is placed facing +Z to match the vehicle's nose-forward convention.
   */
  seat: [number, number, number]
  /** Forward lean (radians) of the whole rider, to hug a bike/horse saddle. */
  lean?: number
}

// The retargeted avatar, in its standing Idle pose, holds its Hips ~HIP_ABOVE_FEET
// above the feet (feet ≈ at the root, hips near 0.99m up). To make the rider look
// *seated* on the seat we rest the HIPS on `seat` and let the legs dangle below,
// instead of standing on it.
const HIP_ABOVE_FEET = 0.986

export default function Rider({ seat, lean = 0 }: RiderProps): JSX.Element {
  // Shared via useGLTF cache whether the rider mounts on the bike, the horse, or
  // the car.
  const motionRef = useRef({
    moving: false,
    running: false,
    crouching: false,
    jump: null as 'anticipate' | 'airborne' | 'land' | null,
    speed: 0,
  })

  return (
    <group position={[seat[0], seat[1], seat[2]]} rotation={[lean, 0, 0]}>
      {/* Put the avatar's hips on the seat: step the root down by the hip
          height (feetLocalY is ~0 since feet sit at the root). */}
      <group position={[0, -HIP_ABOVE_FEET - feetLocalY.current, 0]}>
        <Soldier motionRef={motionRef} />
      </group>
    </group>
  )
}
