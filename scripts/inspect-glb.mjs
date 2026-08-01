/**
 * Quick-and-dirty GLB inspector for choosing/placing downloaded models.
 * Parses the glTF JSON + BIN chunks directly, then uses three.js math to
 * compute accurate world-space bounds (accounting for node transforms).
 *
 * Usage: node scripts/inspect-glb.mjs <file.glb> [more...]
 */
import * as THREE from 'three'
import fs from 'fs'

function loadGLB(path) {
  const buf = fs.readFileSync(path)
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path}: not a GLB`)
  const jsonLen = buf.readUInt32LE(12)
  const raw = buf.toString('utf8', 20, 20 + jsonLen)
  const json = JSON.parse(raw.slice(0, raw.lastIndexOf('}') + 1))
  return { json }
}

function nodeWorldMatrices(json) {
  const mats = new Map()
  const walk = (idx, parentMat) => {
    const node = json.nodes[idx]
    const m = new THREE.Matrix4()
    if (node.matrix) {
      m.fromArray(node.matrix)
    } else {
      m.compose(
        node.translation
          ? new THREE.Vector3().fromArray(node.translation)
          : new THREE.Vector3(),
        node.rotation
          ? new THREE.Quaternion().fromArray(node.rotation)
          : new THREE.Quaternion(),
        node.scale
          ? new THREE.Vector3().fromArray(node.scale)
          : new THREE.Vector3(1, 1, 1),
      )
    }
    const world = parentMat ? parentMat.clone().multiply(m) : m
    mats.set(idx, world)
    for (const c of node.children || []) walk(c, world)
  }
  const scenes = json.scenes || []
  const root = json.scene !== undefined ? scenes[json.scene] : scenes[0]
  for (const n of root?.nodes || []) walk(n, null)
  return mats
}

function inspect(path) {
  const { json } = loadGLB(path)
  const mats = nodeWorldMatrices(json)
  let world = null
  let meshes = 0
  let matsWithTex = 0
  let embedded = 0
  const box = new THREE.Box3()
  const v = new THREE.Vector3()
  const corners = [
    new THREE.Vector3(1, 1, 1),
    new THREE.Vector3(1, 1, -1),
    new THREE.Vector3(1, -1, 1),
    new THREE.Vector3(1, -1, -1),
    new THREE.Vector3(-1, 1, 1),
    new THREE.Vector3(-1, 1, -1),
    new THREE.Vector3(-1, -1, 1),
    new THREE.Vector3(-1, -1, -1),
  ]

  for (const [ni, m] of mats) {
    const node = json.nodes[ni]
    if (node.mesh === undefined) continue
    const mesh = json.meshes[node.mesh]
    meshes += mesh.primitives.length
    for (const prim of mesh.primitives) {
      const accIdx = prim.attributes.POSITION
      const acc = json.accessors[accIdx]
      if (!acc || !acc.min || !acc.max) continue
      const mn = new THREE.Vector3().fromArray(acc.min)
      const mx = new THREE.Vector3().fromArray(acc.max)
      box.min.copy(mn)
      box.max.copy(mx)
      for (const c of corners) {
        v.set(
          c.x === 1 ? mx.x : mn.x,
          c.y === 1 ? mx.y : mn.y,
          c.z === 1 ? mx.z : mn.z,
        )
        v.applyMatrix4(m)
        if (!world) world = new THREE.Box3(v.clone(), v.clone())
        else world.expandByPoint(v)
      }
    }
  }

  // materials / textures summary
  for (const mat of json.materials || []) {
    const pbr = mat.pbrMetallicRoughness || {}
    const texes = [
      pbr.baseColorTexture,
      pbr.metallicRoughnessTexture,
      pbr.normalTexture,
      pbr.emissiveTexture,
      mat.occlusionTexture,
    ].filter(Boolean)
    if (texes.length) matsWithTex++
  }
  for (const img of json.images || []) if (!img.uri) embedded++

  if (!world) {
    console.log(`${path}: no geometry found`)
    return
  }
  const size = new THREE.Vector3()
  world.getSize(size)
  const tallest = ['x', 'y', 'z'][
    [size.x, size.y, size.z].indexOf(Math.max(size.x, size.y, size.z))
  ]
  console.log('='.repeat(70))
  console.log(path)
  console.log(
    `  world bbox: min[${world.min.toArray().map((n) => +n.toFixed(2))}] max[${world.max
      .toArray()
      .map((n) => +n.toFixed(2))}]`,
  )
  console.log(
    `  size: ${size.toArray().map((n) => +n.toFixed(2))}   tallest axis: ${tallest}   base y: ${+world.min.y.toFixed(2)}`,
  )
  console.log(
    `  meshes: ${meshes}  mats: ${(json.materials || []).length} (${matsWithTex} textured)  embedded images: ${embedded}`,
  )
}

for (const f of process.argv.slice(2)) {
  inspect(f)
}
