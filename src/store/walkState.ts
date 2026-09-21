/**
 * Shared, mutable on-foot player state, consumed by the follow camera so it
 * can drop to crouch height while the soldier crouches.
 */
export const walkState = {
  crouching: false,
}

/**
 * Lowest local Y (relative to the avatar's visual origin) of the avatar's
 * skinned mesh at the retargeted Idle animation's first frame. WalkController
 * offsets the visual group by `-CAPSULE_HALF_LEN - feetLocalY.current` so the
 * model's feet rest on the physics capsule's bottom instead of floating.
 */
export const feetLocalY = { current: 0 }

/**
 * Shared movement input buffer for the walking soldier. Both the keyboard
 * (WalkController) and the on-screen touch controls write here, and
 * WalkController's per-frame loop reads it, so mobile and desktop drive the
 * exact same movement code. `jump` and `interact` are edge-triggered: a
 * control sets them true and WalkController consumes (clears) them next frame.
 */
export const inputState = {
  fwd: false,
  left: false,
  right: false,
  run: false,
  /**
   * Shift+S sprint latch: toggled on/off by pressing the `run` chord again, so
   * the soldier keeps sprinting until the same chord is pressed a second time.
   * This is independent of the plain-Shift hold (inputState.run) — see
   * WalkController for the chord handling.
   */
  runToggle: false,
  jump: false,
  interact: false,
}

/**
 * HUD-facing walk facts, written every frame by WalkController so the touch
 * UI can show context (e.g. whether the soldier stands next to a rideable).
 */
export const walkHud = {
  nearVehicle: false,
}

/**
 * Live on-foot facts published every frame by WalkController for the optional
 * ?debug=1 overlay (MovementDebug). Mutated in place — no React state — so the
 * overlay can prove the canonical action layer: the keyboard AND the bottom
 * on-screen controls write the same flags WalkController actually consumes.
 */
export const walkDebug = {
  forward: false,
  left: false,
  right: false,
  /** performance.now() of the last consumed jump request (edge trigger). */
  jumpPulse: 0,
  jumpState: null as 'anticipate' | 'airborne' | 'land' | null,
  grounded: false,
  moving: false,
  speed: 0,
  vy: 0,
  heading: 0,
}
