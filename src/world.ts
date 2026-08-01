import { landmarks } from './data'

export type Point = [number, number] // [x, z]

const pos = (id: string): Point => {
  const landmark = landmarks.find((l) => l.id === id)
  if (!landmark) return [0, 0]
  return [landmark.position[0], landmark.position[2]]
}

const temple = pos('temple')
const tower = pos('tower')
const gate = pos('gate')
const mountain = pos('mountain')

/**
 * Curved road network. Each path is a polyline of [x, z] waypoints so drives
 * between landmarks bend through the valley instead of running in a beeline:
 * a winding outer ring plus two cross-valley highways through the center.
 */
export const roadPaths: Point[][] = [
  // Outer ring — south
  [temple, [-35, -98], [30, -100], tower],
  // Outer ring — east
  [tower, [105, -15], [102, 35], mountain],
  // Outer ring — north
  [mountain, [20, 100], [-45, 102], gate],
  // Outer ring — west
  [gate, [-104, 30], [-102, -25], temple],
  // Cross highway — temple <-> mountain (through center)
  [temple, [-45, -40], [0, 0], [45, 40], mountain],
  // Cross highway — gate <-> tower (through center)
  [gate, [-45, 48], [0, 0], [45, -45], tower],
]

/** Deterministic PRNG so scenery stays in the same place every load. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Distance from a point to a line segment (for keeping trees off the road). */
export function pointSegDist(x: number, z: number, a: Point, b: Point): number {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const lenSq = dx * dx + dz * dz
  let t = lenSq > 0 ? ((x - a[0]) * dx + (z - a[1]) * dz) / lenSq : 0
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t))
}
