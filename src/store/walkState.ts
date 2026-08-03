/**
 * Shared, mutable on-foot player state, consumed by the follow camera so it
 * can drop to crouch height while the soldier crouches.
 */
export const walkState = {
  crouching: false,
}

/**
 * Shared movement input buffer for the walking soldier. Both the keyboard
 * (WalkController) and the on-screen touch controls write here, and
 * WalkController's per-frame loop reads it, so mobile and desktop drive the
 * exact same movement code. `jump` and `interact` are edge-triggered: a
 * control sets them true and WalkController consumes (clears) them next frame.
 */
export const inputState = {
  fwd: false,
  back: false,
  left: false,
  right: false,
  run: false,
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
