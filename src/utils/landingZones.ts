/**
 * Landing exclusion zones for the parachute. Every solid prop and visual
 * landmark on the map is turned into a circular no-land zone, grown by ~10
 * units so the post-landing chase camera (7.5 units behind the soldier) always
 * sits in open ground with the world in view — never inside a wall or staring
 * at a facade, which reads as a flat blue/pink/solid screen.
 */
export interface LandingZone {
  x: number
  z: number
  r: number
}

export const LANDING_ZONES: LandingZone[] = [
  // Landmarks (visual-only, so the camera must stay well clear of them).
  { x: -95, z: -80, r: 15 }, // temple
  { x: 90, z: -90, r: 15 }, // tower
  { x: -90, z: 95, r: 17 }, // gate (large archway)
  { x: 95, z: 85, r: 15 }, // mountain
  { x: 45, z: -5, r: 13 }, // stupa
  // Riverside village + bridge.
  { x: 46, z: -28, r: 8 }, // cottage
  { x: 36, z: -22, r: 8 }, // cottage
  { x: 56, z: -16, r: 13 }, // logcabin (12 wide)
  { x: 43, z: -25, r: 7 }, // well
  { x: 42, z: -42, r: 12 }, // bridge over the river
  { x: 21.5, z: -53.5, r: 8 }, // dock
  // Pagoda + hut flanking the stupa.
  { x: 38, z: 14, r: 10 }, // pagoda
  { x: 56, z: 10, r: 10 }, // hut
  // Rocks and cliffs on the valley rim.
  { x: 70, z: 55, r: 8 }, // rock
  { x: 85, z: 50, r: 8 }, // rock
  { x: -132, z: -124, r: 36 }, // cliff
  { x: 134, z: 122, r: 36 }, // cliff
  // Hedge clusters.
  { x: 30, z: -25, r: 9 }, // bush
  { x: 16, z: -66, r: 9 }, // bush
  // Fences flanking the gate.
  { x: -78, z: 92, r: 8 },
  { x: -102, z: 92, r: 8 },
]

function blocked(x: number, z: number): boolean {
  return LANDING_ZONES.some((zone) => {
    const dx = x - zone.x
    const dz = z - zone.z
    return dx * dx + dz * dz < zone.r * zone.r
  })
}

/**
 * Return the nearest open-ground landing spot to (x, z): the spot itself when
 * clear, otherwise the closest clear point found in expanding rings up to
 * maxR units away. Keeps the walker (and the camera behind it) out of every
 * building, landmark and rim cliff.
 */
export function findClearLanding(
  x: number,
  z: number,
  maxR = 26,
  limit = 146,
): { x: number; z: number } {
  if (!blocked(x, z)) return { x, z }
  for (let ring = 1; ring * 3 <= maxR; ring++) {
    const d = ring * 3
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2
      const px = x + Math.cos(ang) * d
      const pz = z + Math.sin(ang) * d
      if (Math.abs(px) > limit || Math.abs(pz) > limit) continue
      if (!blocked(px, pz)) return { x: px, z: pz }
    }
  }
  return { x, z }
}
