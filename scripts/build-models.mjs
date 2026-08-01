import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

class FileReader {
  constructor() {
    this.result = null
    this.onloadend = null
  }
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer
      this.onloadend?.()
    })
  }
}
globalThis.FileReader = FileReader

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'models')

const terracotta = new THREE.MeshStandardMaterial({ color: '#b5432f', flatShading: true })
const cream = new THREE.MeshStandardMaterial({ color: '#e6d3ac', flatShading: true })
const stone = new THREE.MeshStandardMaterial({ color: '#cfc2a8', flatShading: true })
const gold = new THREE.MeshStandardMaterial({ color: '#d9a520', flatShading: true })
const towerWhite = new THREE.MeshStandardMaterial({ color: '#efe8da', flatShading: true })
const brick = new THREE.MeshStandardMaterial({ color: '#a03a2a', flatShading: true })
const trim = new THREE.MeshStandardMaterial({ color: '#f0e4c8', flatShading: true })
const rock = new THREE.MeshStandardMaterial({ color: '#6b6f55', flatShading: true })
const snow = new THREE.MeshStandardMaterial({ color: '#f4f7f6', flatShading: true })

function mesh(geometry, material, x, y, z, rx = 0, ry = 0) {
  const m = new THREE.Mesh(geometry, material)
  m.position.set(x, y, z)
  m.rotation.set(rx, ry, 0)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

function tieredRoof(radiusBottom, radiusTop, height, y, material, segments = 10) {
  return mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments, 1, false), material, 0, y, 0)
}

function buildPagoda() {
  const g = new THREE.Group()
  g.add(mesh(new THREE.BoxGeometry(4.4, 0.6, 4.4), stone, 0, 0.3, 0))
  g.add(mesh(new THREE.BoxGeometry(3, 1.2, 3), cream, 0, 1.2, 0))
  g.add(tieredRoof(2.4, 1.0, 1.0, 2.3, terracotta))
  g.add(mesh(new THREE.BoxGeometry(2.1, 1.0, 2.1), cream, 0, 3.0, 0))
  g.add(tieredRoof(1.7, 0.75, 0.8, 3.9, terracotta))
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.7, 6), gold, 0, 4.65, 0))
  g.add(mesh(new THREE.SphereGeometry(0.18, 8, 6), gold, 0, 5.05, 0))
  return g
}

function buildTower() {
  const g = new THREE.Group()
  g.add(mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.6, 12), stone, 0, 0.3, 0))
  g.add(mesh(new THREE.CylinderGeometry(1.05, 1.25, 6.2, 12), towerWhite, 0, 3.7, 0))
  g.add(mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.35, 12), towerWhite, 0, 1.4, 0))
  g.add(mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.35, 12), towerWhite, 0, 2.6, 0))
  g.add(mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.35, 12), towerWhite, 0, 3.8, 0))
  g.add(mesh(new THREE.CylinderGeometry(0.5, 0.9, 1.1, 12), towerWhite, 0, 7.35, 0))
  g.add(mesh(new THREE.ConeGeometry(0.55, 0.9, 12), terracotta, 0, 8.35, 0))
  g.add(mesh(new THREE.SphereGeometry(0.22, 8, 6), gold, 0, 8.95, 0))
  return g
}

function buildGate() {
  const g = new THREE.Group()
  g.add(mesh(new THREE.BoxGeometry(0.9, 3.2, 0.9), brick, -1.4, 1.6, 0))
  g.add(mesh(new THREE.BoxGeometry(0.9, 3.2, 0.9), brick, 1.4, 1.6, 0))
  g.add(mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0), trim, -1.4, 3.5, 0))
  g.add(mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0), trim, 1.4, 3.5, 0))
  g.add(mesh(new THREE.BoxGeometry(3.7, 0.7, 1.1), brick, 0, 3.55, 0))
  g.add(tieredRoof(2.5, 1.0, 1.0, 4.4, terracotta))
  g.add(mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.7, 6), gold, 0, 5.2, 0))
  g.add(mesh(new THREE.SphereGeometry(0.2, 8, 6), gold, 0, 5.6, 0))
  return g
}

function buildMountain() {
  const g = new THREE.Group()
  g.add(mesh(new THREE.ConeGeometry(5.5, 5.5, 6), rock, 0, 2.75, 0))
  g.add(mesh(new THREE.ConeGeometry(2.6, 1.9, 6), snow, 0, 4.9, 0))
  g.add(mesh(new THREE.ConeGeometry(2.2, 3.0, 5), rock, -3.2, 1.5, 0.6))
  g.add(mesh(new THREE.ConeGeometry(1.1, 1.2, 5), snow, -3.2, 3.1, 0.6))
  return g
}

async function exportModel(group, name) {
  const exporter = new GLTFExporter()
  const glb = await exporter.parseAsync(group, { binary: true })
  const file = join(OUT, name)
  writeFileSync(file, Buffer.from(glb))
  console.log('wrote', file)
}

mkdirSync(OUT, { recursive: true })

await exportModel(buildPagoda(), 'pagoda.glb')
await exportModel(buildTower(), 'dharahara.glb')
await exportModel(buildGate(), 'gate.glb')
await exportModel(buildMountain(), 'mountain.glb')
