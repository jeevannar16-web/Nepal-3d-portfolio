import type { TransportPose } from './transportState'

/**
 * Shared auto-pilot flags for vehicles the player left behind. When the
 * player bails out of the airplane or balloon, the vehicle keeps "flying"
 * itself back to its parking spot while the player descends under the
 * parachute. The owning controller reads `active` on every frame and scripts
 * the descent from `from` to `to` over `duration` seconds, then parks and
 * clears the flag.
 */
export interface AutoLand {
  active: boolean
  from: TransportPose
  to: TransportPose
  duration: number
}

const idle = (): TransportPose => ({ x: 0, z: 0, y: 0, heading: 0 })

export const autopilot: Record<string, AutoLand> = {
  airplane: { active: false, from: idle(), to: idle(), duration: 8 },
  airplane2: { active: false, from: idle(), to: idle(), duration: 8 },
  balloon: { active: false, from: idle(), to: idle(), duration: 8 },
}
