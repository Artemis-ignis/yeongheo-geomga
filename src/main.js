import * as THREE from 'three'
import { installCapture } from './dev/capture.js'

const canvas = document.getElementById('scene')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0d1117)

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 500)
camera.position.set(0, 2, 6)
camera.lookAt(0, 0, 0)

scene.add(new THREE.HemisphereLight(0xbfe9ff, 0x2a3a2a, 2.0))

const mesh = new THREE.Mesh(
  new THREE.OctahedronGeometry(1.2, 0),
  new THREE.MeshStandardMaterial({ color: 0x7fd6b5, flatShading: true }),
)
scene.add(mesh)

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})

renderer.setAnimationLoop((t) => {
  mesh.rotation.y = t * 0.001
  mesh.rotation.x = t * 0.0006
  renderer.render(scene, camera)
})

if (import.meta.env.DEV) {
  installCapture(renderer, (w, h) => {
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    mesh.rotation.set(0.4, 0.8, 0)
    renderer.render(scene, camera)
  })
}
