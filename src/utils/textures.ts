import * as THREE from 'three'

let grassTex: THREE.CanvasTexture | null = null
export function grassTexture(): THREE.Texture {
  if (grassTex) return grassTex
  const size = 128
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!

  ctx.fillStyle = '#79b383'
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < 1100; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = 0.6 + Math.random() * 1.2
    ctx.fillStyle =
      Math.random() > 0.5 ? 'rgba(62,118,72,0.5)' : 'rgba(148,198,130,0.5)'
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
      Math.random() > 0.5 ? 'rgba(56,110,66,0.7)' : 'rgba(120,170,100,0.7)'
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
