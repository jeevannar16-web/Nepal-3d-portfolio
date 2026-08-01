export type EngineState = 'off' | 'starting' | 'on'

/** Gear label shown on the speedometer. OFF = engine off, ON = cranking. */
export type GearLabel = 'OFF' | 'ON' | 'R' | '1' | '2' | '3' | '4'

/** Live driving data for DOM overlays, updated by Player each physics frame. */
export const driveState = {
  speedKmh: 0,
  reverse: false,
  gear: 'OFF' as GearLabel,
  rpm: 0,
  throttle: 0,
  engineState: 'off' as EngineState,
}
