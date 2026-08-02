/**
 * WebGL capability helpers. @react-three/fiber v9 and three r150+ require a
 * WebGL2 context, so if that is unavailable the app swaps to the 2D view
 * instead of mounting a canvas that renders nothing.
 */

let cached: boolean | null = null

/** True when a WebGL2 context can be created in this browser. */
export function supportsWebGL(): boolean {
  if (cached !== null) return cached
  if (typeof document === 'undefined') {
    cached = false
    return cached
  }
  try {
    const canvas = document.createElement('canvas')
    cached = !!canvas.getContext('webgl2')
  } catch {
    cached = false
  }
  return cached
}

interface MemoryAwareNavigator extends Navigator {
  deviceMemory?: number
}

/**
 * Heuristic for weak hardware (low RAM / few cores) or a software renderer.
 * Used to cap the pixel ratio so the scene uses far less GPU/VRAM — the most
 * common cause of a tab crash or blank canvas on a laptop.
 */
export function shouldReduceGraphics(): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as MemoryAwareNavigator
  const mem = nav.deviceMemory ?? 8
  const cores = nav.hardwareConcurrency ?? 8
  return mem <= 4 || cores <= 4
}
