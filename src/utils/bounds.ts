import { WORLD_EDGE } from '../components/Ground'

export const clamp = (v: number, min: number, max: number): number =>
  Math.min(Math.max(v, min), max)

/** Soft flyable boundary: aircraft never cross it, so a bail-out can't land
 *  the player in the void past the ground plane's edge (the perimeter walls
 *  are only 2 units tall, far below cruise altitude). */
export const FLY_LIMIT = WORLD_EDGE - 20

/** Touchdown safety margin: the parachute keeps x/z inside the ground plane
 *  while descending and parks the walker on solid floor. */
export const LAND_LIMIT = WORLD_EDGE - 4

export function clampXZ(x: number, z: number, limit = FLY_LIMIT): [number, number] {
  return [clamp(x, -limit, limit), clamp(z, -limit, limit)]
}
