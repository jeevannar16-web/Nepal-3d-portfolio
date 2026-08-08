export type TransportMode = 'walk' | 'car' | 'bike' | 'horse' | 'airplane' | 'balloon'

export interface TransportPose {
  x: number
  z: number
  y: number
  heading: number
}

/** Where the soldier should step out of the landed plane and walk to. */
export interface SpawnWalk {
  from: { x: number; z: number }
  to: { x: number; z: number }
}

/**
 * Shared, mutable transport state. The player can walk as the soldier and get
 * into / out of the car, the motorcycle or the horse anywhere, any time, so
 * each vehicle (and the walker) keeps its own persisted position + heading
 * across mode switches. The active controller writes its pose back every
 * frame; the next time that vehicle is entered it spawns where it was left.
 */
export const transportState = {
  mode: 'walk' as TransportMode,
  walk: { x: -8, z: 90, y: 0.91, heading: Math.PI / 2 } as TransportPose,
  car: { x: 12, z: 97, y: 0.5, heading: 0 } as TransportPose,
  bike: { x: 18, z: 97, y: 0.5, heading: 0 } as TransportPose,
  horse: { x: 24, z: 97, y: 0.5, heading: 0 } as TransportPose,
  airplane: { x: -12, z: 88, y: 0, heading: -Math.PI / 2 } as TransportPose,
  balloon: { x: 40, z: -30, y: 2, heading: 0 } as TransportPose,
  /** Optional scripted walk performed right after the intro (soldier exits
   *  the landed plane), before the player gets control. */
  spawnWalk: null as SpawnWalk | null,
  /** The soldier stays where he got out of a vehicle, so re-entering the same
   *  vehicle finds it where it was left. */
  exitOffset: 2.2,
}
