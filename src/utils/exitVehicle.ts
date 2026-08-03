import { transportState, type TransportMode } from '../store/transportState'
import { useStore } from '../store/useStore'

/**
 * Get out of the active vehicle on foot: place the soldier beside the vehicle
 * (same offset the F key uses) and switch to walk mode. Shared by the
 * on-screen exit button so touch players get the same behaviour as the F key.
 */
export function exitVehicleToWalk(mode: TransportMode): void {
  if (mode === 'walk') return
  const v = transportState[mode]
  const rightX = Math.cos(v.heading)
  const rightZ = -Math.sin(v.heading)
  transportState.walk = {
    x: v.x + rightX * transportState.exitOffset,
    z: v.z + rightZ * transportState.exitOffset,
    y: 0.5,
    heading: v.heading,
  }
  useStore.getState().setPlayerMode('walk')
}
