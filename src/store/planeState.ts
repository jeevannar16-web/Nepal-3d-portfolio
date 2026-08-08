/** Live airplane flight data for DOM overlays and the engine sound, updated by
 *  AirplaneController each physics frame. throttle is the effective thrust
 *  (0..1, including the takeoff spool) so the sound ramps with the plane. */
export const planeState = {
  throttle: 0,
  speed: 0,
  spool: 1,
  throttleLevel: 0.5,
  active: false,
}
