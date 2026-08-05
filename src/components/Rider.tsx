import { useRef, type JSX } from 'react'
import Soldier from './Soldier'
import { feetLocalY } from '../store/walkState'

interface RiderProps {
  /**
   * World-local offset (relative to the vehicle's `visual` group, which already
   * follows the body's heading) where the rider's feet should rest. The rider is
   * placed facing +Z to match the vehicle's nose-forward convention.
   */
  seat: [number, number, number]
}

export default function Rider({ seat }: RiderProps): JSX.Element {
  // Imported here so the (light) retargeting + mixer cost is shared via
  // useGLTF's cache whether the rider mounts on the bike, the horse, or the car.
  const motionRef = useRef({
    moving: false,
    running: false,
    crouching: false,
    jump: null as 'anticipate' | 'airborne' | 'land' | null,
    speed: 0,
  })

  return (
    <group position={[seat[0], seat[1], seat[2]]}>
      {/* The avatar's lowest point sits `feetLocalY.current` below its root, so step
          the root up by that amount so the rider's feet rest exactly on the seat. */}
      <group position={[0, -feetLocalY.current, 0]}>
        <Soldier motionRef={motionRef} />
      </group>
    </group>
  )
}
