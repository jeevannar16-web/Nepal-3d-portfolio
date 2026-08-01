import * as THREE from 'three'
import { PALETTE } from './palette'

let grassTex: THREE.CanvasTexture | null = null
export function grassTexture(): THREE.Texture {
  if (grassTex) return grassTex
  const size = 128
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!

  ctx.fillStyle = PALETTE.ground
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < 1100; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = 0.6 + Math.random() * 1.2
    ctx.fillStyle =
      Math.random() > 0.5 ? PALETTE.grassSpeckDark : PALETTE.grassSpeckLight
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  for (let i = 0; i < 90; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const len = 2 + Math.random() * 4
    const w = 0.7 + Math.random()
    ctx.strokeStyle =
      Math.random() > 0.5 ? PALETTE.grassBladeDark : PALETTE.grassBladeLight
    ctx.lineWidth = w
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + (Math.random() - 0.5) * 3, y - len)
    ctx.stroke()
  }

  grassTex = new THREE.CanvasTexture(c)
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping
  grassTex.repeat.set(180, 180)
  grassTex.colorSpace = THREE.SRGBColorSpace
  return grassTex
}

let aoTex: THREE.CanvasTexture | null = null
/**
 * Baked soft ambient-occlusion map for the whole valley floor. Single
 * non-repeating texture spanning the 300x300 world: dark radial pools under
 * the four landmarks plus a scattering of faint blobs (tree clusters), so
 * ground reads darker near object bases and lighter in open areas. Consumed by
 * meshStandardMaterial.aoMap.
 */
export function groundAOTexture(): THREE.Texture {
  if (aoTex) return aoTex
  const size = 512
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)

  const toPx = (wx: number, wz: number): [number, number] => [
    ((wx + 150) / 300) * size,
    ((wz + 150) / 300) * size,
  ]

  // Landmark bases — strongest, widest pools.
  const landmarkSpots: Array<[number, number]> = [
    [-95, -80],
    [90, -90],
    [-90, 95],
    [95, 85],
  ]
  for (const [x, z] of landmarkSpots) {
    const [px, pz] = toPx(x, z)
    const g = ctx.createRadialGradient(px, pz, 4, px, pz, 44)
    g.addColorStop(0, 'rgba(20, 26, 20, 0.38)')
    g.addColorStop(1, 'rgba(20, 26, 20, 0)')
    ctx.fillStyle = g
    ctx.fillRect(px - 44, pz - 44, 88, 88)
  }

  // A few deterministic clusters for the scattered woodland.
  const rng = (() => {
    let a = 99
    return () => {
      a |= 0
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  })()
  for (let i = 0; i < 90; i++) {
    const x = (rng() * 2 - 1) * 132
    const z = (rng() * 2 - 1) * 132
    const [px, pz] = toPx(x, z)
    const r = 10 + rng() * 18
    const g = ctx.createRadialGradient(px, pz, 2, px, pz, r)
    g.addColorStop(0, 'rgba(18, 24, 18, 0.16)')
    g.addColorStop(1, 'rgba(18, 24, 18, 0)')
    ctx.fillStyle = g
    ctx.fillRect(px - r, pz - r, r * 2, r * 2)
  }

  // Gentle large-scale mottling so open ground isn't perfectly flat.
  for (let i = 0; i < 40; i++) {
    const x = rng() * size
    const z = rng() * size
    const r = 40 + rng() * 80
    const dark = rng() > 0.4
    const g = ctx.createRadialGradient(x, z, 4, x, z, r)
    g.addColorStop(0, dark ? 'rgba(24, 30, 24, 0.10)' : 'rgba(255,255,255,0.10)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, z - r, r * 2, r * 2)
  }

  aoTex = new THREE.CanvasTexture(c)
  return aoTex
}

let matcapTex: THREE.CanvasTexture | null = null
export function matcapTexture(): THREE.Texture {
  if (matcapTex) return matcapTex
  const size = 128
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!

  ctx.fillStyle = '#43372b'
  ctx.fillRect(0, 0, size, size)

  const g = ctx.createRadialGradient(
    size * 0.4,
    size * 0.4,
    size * 0.06,
    size * 0.5,
    size * 0.5,
    size * 0.72,
  )
  g.addColorStop(0, '#f2ebdd')
  g.addColorStop(0.35, '#cfc0a5')
  g.addColorStop(0.7, '#8a7a63')
  g.addColorStop(1, '#43372b')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size * 0.5, 0, Math.PI * 2)
  ctx.fill()

  matcapTex = new THREE.CanvasTexture(c)
  matcapTex.colorSpace = THREE.SRGBColorSpace
  return matcapTex
}

let glossyTex: THREE.CanvasTexture | null = null
/**
 * High-contrast automotive matcap: a small hot specular highlight with a sharp
 * falloff to near-black, faking a clear-coated painted panel.
 */
export function glossyMatcapTexture(): THREE.Texture {
  if (glossyTex) return glossyTex
  const size = 128
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!

  ctx.fillStyle = '#0d0b09'
  ctx.fillRect(0, 0, size, size)

  const g = ctx.createRadialGradient(
    size * 0.38,
    size * 0.36,
    size * 0.03,
    size * 0.38,
    size * 0.36,
    size * 0.62,
  )
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.18, '#f4e9d8')
  g.addColorStop(0.42, '#8a7561')
  g.addColorStop(0.72, '#241d16')
  g.addColorStop(1, '#0d0b09')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size * 0.5, 0, Math.PI * 2)
  ctx.fill()

  // A secondary dim reflection band near the bottom edge (horizon reflection).
  ctx.fillStyle = 'rgba(210, 196, 176, 0.35)'
  ctx.fillRect(0, size * 0.66, size, size * 0.1)

  glossyTex = new THREE.CanvasTexture(c)
  glossyTex.colorSpace = THREE.SRGBColorSpace
  return glossyTex
}

let glowTex: THREE.CanvasTexture | null = null
/** Soft additive glow (white -> transparent) for headlight pools / light cones. */
export function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex
  const size = 128
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!

  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  )
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  glowTex = new THREE.CanvasTexture(c)
  glowTex.colorSpace = THREE.SRGBColorSpace
  return glowTex
}

let shadowTex: THREE.CanvasTexture | null = null
export function blobShadowTexture(): THREE.Texture {
  if (shadowTex) return shadowTex
  const size = 64
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!

  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.08,
    size / 2,
    size / 2,
    size * 0.5,
  )
  g.addColorStop(0, 'rgba(15,25,20,0.55)')
  g.addColorStop(0.7, 'rgba(15,25,20,0.28)')
  g.addColorStop(1, 'rgba(15,25,20,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  shadowTex = new THREE.CanvasTexture(c)
  return shadowTex
}
