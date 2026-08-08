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

export type GraphicsTier = 'low' | 'high'

let tierCache: GraphicsTier | null = null

/**
 * Reads the real (unmasked) GPU name so the tier check can tell a discrete
 * NVIDIA/AMD card from a laptop's integrated Intel/AMD graphics. Falls back to
 * `null` when the context or extension is unavailable.
 */
function gpuRendererString(): string | null {
  if (typeof document === 'undefined') return null
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl2') ??
      (canvas.getContext('webgl') as WebGLRenderingContext | null)
    if (!gl) return null
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    if (!info) return null
    const name = gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
    return typeof name === 'string' ? name : null
  } catch {
    return null
  }
}

/**
 * Auto-detects how much quality this machine can realistically run, so the
 * game ships "reduced" on weak hardware and full quality on capable desktops.
 *
 * Signals (in order of importance):
 *   - GPU renderer string: a discrete NVIDIA/AMD card → high; an integrated
 *     Intel/UHD/Iris/Arc or VEGA/Adreno/Mali chip → low. RAM and core counts
 *     are unreliable on their own (browsers cap `deviceMemory` at 8 GB and
 *     laptops report many cores), but they still shift the score.
 */
export function detectGraphicsTier(): GraphicsTier {
  if (tierCache !== null) return tierCache
  if (typeof navigator === 'undefined') {
    tierCache = 'high'
    return tierCache
  }

  const nav = navigator as MemoryAwareNavigator
  const mem = nav.deviceMemory ?? 8
  const cores = nav.hardwareConcurrency ?? 8

  const gpu = (gpuRendererString() ?? '').toLowerCase()
  const hasDiscreteGpu =
    /nvidia|geforce|quadro|rtx|gtx|radeon\s*\(tm\)?\s*rx|advanced micro devices/.test(
      gpu,
    )
  const hasIntegratedGpu =
    /intel|uhd|iris|arc|vega|adreno|mali|radeon/.test(gpu)

  let score = 0
  if (mem <= 4) score -= 2
  else if (mem <= 6) score -= 1
  if (cores <= 4) score -= 1
  if (hasDiscreteGpu) score += 2
  if (hasIntegratedGpu && !hasDiscreteGpu) score -= 1
  if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) score -= 1

  tierCache = score >= 1 ? 'high' : 'low'
  return tierCache
}

/**
 * True when this machine should keep quality low. Backed by the same cached
 * tier detection, so every call site agrees on the result.
 */
export function shouldReduceGraphics(): boolean {
  return detectGraphicsTier() === 'low'
}
