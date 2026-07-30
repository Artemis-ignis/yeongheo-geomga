import * as THREE from 'three'
import { buildColored, flare, gradient, limb, revolve, roughen, shear } from './shapeKit.js'
import { panelSeams, studRing, trimBand } from './detailKit.js'

/**
 * One merged geometry per enemy type, built once and cached.
 *
 * Colour is baked into vertex colours rather than coming from the material, so a
 * single instanced draw call renders a creature with a dark back, a pale belly
 * and lit eyes. Shapes follow curves and lathe profiles instead of being boxes
 * bolted together — at a hundred on screen the silhouette is the only thing the
 * player can read, so it has to be a silhouette worth reading.
 */

const cache = new Map()

const BUILDERS = {
  // 마기 잔영 — a hooded wraith trailing off into smoke.
  wisp() {
    // A peaked hood, not a rounded teardrop. The round version measured as a
    // near-perfect circle from every angle and was the blobbiest thing shipped.
    const shroud = revolve([
      [0.00, 1.12], [0.13, 1.00], [0.28, 0.82], [0.40, 0.58],
      [0.44, 0.34], [0.38, 0.16], [0.22, 0.04], [0.00, 0.00],
    ], 14)
    gradient(shroud, 0x3d2a72, 0x9070d8, 'y')
    roughen(shroud, 0.035, 7)
    // Pitched forward, as though it is always mid-lunge.
    shear(shroud, 0.30)

    const parts = [
      [shroud, {}, undefined],
      // Hollow of the hood. It has to stay *inside* the sheared shroud — pushed
      // out to follow the lean it stops being a hollow and becomes an eyeball.
      [new THREE.SphereGeometry(0.17, 12, 8), { y: 0.60, z: 0.22 }, 0x281a44],
      // Two ember eyes — the only bright thing on it.
      [new THREE.SphereGeometry(0.05, 6, 5), { x: -0.075, y: 0.62, z: 0.32 }, 0xff9de0],
      [new THREE.SphereGeometry(0.05, 6, 5), { x: 0.075, y: 0.62, z: 0.32 }, 0xff9de0],
    ]

    // Ragged hem: torn points around the bottom edge, longest at the sides. A
    // clean lathe hem is the single biggest tell that a shape came off a lathe.
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2
      const h = 0.16 + Math.abs(Math.sin(a)) * 0.22
      parts.push([
        new THREE.ConeGeometry(0.075, h, 4),
        { x: Math.sin(a) * 0.34, y: 0.02 + h * 0.5, z: Math.cos(a) * 0.34, rx: Math.PI },
        0x4a3580,
      ])
    }

    // A long smoke plume dragging behind — this is what gives the silhouette a
    // back, and it is most of what the player sees when 잔영 crosses the screen.
    for (let i = 0; i < 5; i++) {
      const a = -0.6 + i * 0.3
      const len = 1.0 + Math.cos(a) * 0.42
      parts.push([
        limb(
          [[Math.sin(a) * 0.22, 0.58, -0.05],
            [Math.sin(a) * 0.4, 0.5, -len * 0.38],
            [Math.sin(a) * 0.54, 0.3, -len * 0.74],
            [Math.sin(a) * 0.44, 0.08, -len]],
          [0.11, 0.075, 0.04, 0.004], 14, 5,
        ),
        {}, i % 2 ? 0x8f74d8 : 0x6a51ac,
      ])
    }

    // Two ragged sleeves reaching ahead of the hood.
    for (const side of [-1, 1]) {
      parts.push([
        limb(
          [[side * 0.22, 0.48, 0.14], [side * 0.34, 0.32, 0.5], [side * 0.26, 0.22, 0.78]],
          [0.095, 0.068, 0.018], 10, 5,
        ),
        {}, 0x7b5fc0,
      ])
    }
    return buildColored(parts)
  },

  // 요랑 — a lean quadruped built to read as "charging at you".
  wolf() {
    const body = limb(
      [[0, 0.52, -0.46], [0, 0.58, -0.14], [0, 0.57, 0.22], [0, 0.52, 0.5]],
      [0.9, 1.25, 1.15, 0.72], 16, 9,
    )
    body.scale(0.30, 0.26, 0.30)
    // Light warm taupe, and every part of the pelt shares it.
    //
    // 요랑 is the only creature that fights on both the dark green plateau and
    // the dark violet snowfield, so it cannot be dark itself. Recolouring the
    // body alone moved nothing, because the dominant colour of a model is
    // whichever bucket holds the most vertices — a gradient spreads across many
    // buckets while four flat-shaded legs pile into one, so the legs were
    // deciding what the creature looked like to the contrast gate, and to the
    // eye.
    gradient(body, 0xd6c9b8, 0x8c7c6c, 'y')

    const head = limb(
      [[0, 0.60, 0.48], [0, 0.58, 0.68], [0, 0.52, 0.86]],
      [0.62, 0.5, 0.24], 8, 8,
    )
    head.scale(0.33, 0.30, 0.33)
    gradient(head, 0xe0d3c2, 0x968574, 'y')

    const parts = [
      [body, {}, undefined],
      [head, {}, undefined],
      // Snout.
      [new THREE.ConeGeometry(0.085, 0.24, 6), { y: 0.5, z: 0.92, rx: Math.PI / 2 }, 0x6f6156],
      // Eyes.
      [new THREE.SphereGeometry(0.042, 6, 5), { x: -0.085, y: 0.63, z: 0.78 }, 0xffd76a],
      [new THREE.SphereGeometry(0.042, 6, 5), { x: 0.085, y: 0.63, z: 0.78 }, 0xffd76a],
      // Ears.
      [new THREE.ConeGeometry(0.062, 0.17, 4), { x: -0.11, y: 0.78, z: 0.6, rx: -0.2 }, 0xb3a494],
      [new THREE.ConeGeometry(0.062, 0.17, 4), { x: 0.11, y: 0.78, z: 0.6, rx: -0.2 }, 0xb3a494],
    ]

    // Legs, angled slightly outward.
    for (const [lx, lz] of [[-0.14, 0.3], [0.14, 0.3], [-0.14, -0.26], [0.14, -0.26]]) {
      parts.push([
        limb([[lx, 0.44, lz], [lx * 1.15, 0.24, lz - 0.02], [lx * 1.2, 0.02, lz]], [0.075, 0.055, 0.05], 6, 5),
        {}, 0xd9cfc2,
      ])
    }

    // Shoulder mane.
    for (let i = 0; i < 7; i++) {
      const a = -0.45 + i * 0.15
      parts.push([
        new THREE.ConeGeometry(0.055, 0.24, 4),
        { x: Math.sin(a) * 0.2, y: 0.76 + Math.cos(a) * 0.04, z: 0.18, rx: -0.55, rz: a },
        0x8f8072,
      ])
    }

    // Tail.
    parts.push([
      limb([[0, 0.5, -0.5], [0, 0.62, -0.72], [0.04, 0.78, -0.88]], [0.07, 0.05, 0.02], 8, 5),
      {}, 0xb3a494,
    ])

    // A studded collar — hardware is what says "bound by something", and it
    // separates 요랑 from an ordinary animal at a glance.
    parts.push(trimBand(0.26, 0.62, 0.1, 0x3a4c63, { taper: 1.05, segments: 12 }))
    parts.push(...studRing(6, 0.27, 0.62, 0xffd76a, { size: 0.032, shape: 'gem' }))
    return buildColored(parts)
  },

  // 석귀 — a hunched mass of stone with a sunken head and heavy arms.
  stoneGhoul() {
    const torso = revolve([
      [0.00, 1.28], [0.42, 1.20], [0.66, 0.94], [0.74, 0.58],
      [0.66, 0.26], [0.48, 0.06], [0.00, 0.00],
    ], 12)
    gradient(torso, 0x6e6558, 0xa89c88, 'y')
    roughen(torso, 0.085, 3)
    // Hunched forward over its own weight. A lathed torso stood upright is a
    // barrel, and 석귀 and 용암귀 were reading as the same barrel as each other.
    shear(torso, 0.20)

    const parts = [
      [torso, {}, undefined],
      // Head, half-buried in the shoulders.
      [roughen(new THREE.DodecahedronGeometry(0.32, 0), 0.06, 11), { y: 1.26, z: 0.08 }, 0xb0a493],
      // Glowing seams where the stone has cracked open.
      [new THREE.SphereGeometry(0.055, 6, 5), { x: -0.13, y: 1.3, z: 0.26 }, 0xff8a5a],
      [new THREE.SphereGeometry(0.055, 6, 5), { x: 0.13, y: 1.3, z: 0.26 }, 0xff8a5a],
      [new THREE.BoxGeometry(0.5, 0.05, 0.04), { y: 0.72, z: 0.62, rz: 0.3 }, 0xd8663a],
      [new THREE.BoxGeometry(0.34, 0.05, 0.04), { y: 0.5, z: 0.6, rz: -0.4 }, 0xb8552f],
    ]

    // Heavy arms hanging past the knees.
    //
    // The radii below are absolute. Scaling the part instead — as this used to —
    // shrinks the *positions* too, which folded both arms inside the torso and
    // left 석귀 reading as a featureless boulder.
    for (const side of [-1, 1]) {
      parts.push([
        limb(
          [[side * 0.72, 1.02, 0], [side * 0.92, 0.62, 0.06], [side * 0.84, 0.22, 0.02]],
          [0.216, 0.252, 0.30], 8, 6,
        ),
        {}, 0xa4998a,
      ])
      // Fist.
      parts.push([roughen(new THREE.DodecahedronGeometry(0.26, 0), 0.05, 5 + side), { x: side * 0.84, y: 0.16 }, 0x8d8375])
      // Stubby leg.
      parts.push([new THREE.CylinderGeometry(0.2, 0.24, 0.3, 6), { x: side * 0.3, y: 0.14 }, 0x7d7466])
    }
    // Shoulder spurs and a jutting brow. The back slabs below fixed how 석귀
    // reads as it turns, but from any single angle its outline was still a
    // smooth curve — these break the edge itself, which is the part of the
    // silhouette the player actually traces.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const h = 0.42 - i * 0.09
        parts.push([
          roughen(new THREE.ConeGeometry(0.17 - i * 0.03, h, 4), 0.04, 31 + i * 3 + side),
          {
            x: side * (0.62 + i * 0.06),
            y: 1.06 - i * 0.26,
            z: 0.1 - i * 0.16,
            rz: side * (0.9 + i * 0.2), rx: -0.2,
          },
          i % 2 ? 0xa89c88 : 0x8d8375,
        ])
      }
    }
    parts.push([
      roughen(new THREE.BoxGeometry(0.52, 0.16, 0.3), 0.05, 77),
      { y: 1.36, z: 0.3, rx: 0.35 }, 0xb0a493,
    ])

    // Broken slabs jutting off its back — the read that separates 석귀 from an
    // ordinary boulder, and from 용암귀, which is craggy all over instead.
    for (let i = 0; i < 5; i++) {
      const a = -0.75 + i * 0.375
      const h = 0.34 + Math.cos(a) * 0.24
      parts.push([
        roughen(new THREE.BoxGeometry(0.30, h, 0.14), 0.05, 13 + i),
        {
          x: Math.sin(a) * 0.56,
          y: 1.06 + Math.cos(a) * 0.16,
          z: -0.46 - Math.cos(a) * 0.22,
          rz: a * 0.7, rx: -0.35,
        },
        i % 2 ? 0x8d8375 : 0x6e6558,
      ])
    }
    // Rune studs hammered into the stone, still glowing.
    parts.push(...studRing(7, 0.7, 0.68, 0xe07a42, { size: 0.05, shape: 'gem' }))
    return buildColored(parts)
  },

  // 부적귀 — an empty robe held up by a talisman where the face should be.
  talismanGhost() {
    const robe = revolve([
      [0.00, 1.30], [0.20, 1.24], [0.28, 1.02], [0.34, 0.72],
      [0.46, 0.36], [0.56, 0.10], [0.50, 0.02], [0.00, 0.00],
    ], 14)
    gradient(robe, 0xc4b073, 0xefe2bc, 'y')
    // An empty robe hangs — it does not stand upright like a person.
    shear(robe, -0.16)

    const parts = [
      [robe, {}, undefined],
      // The talisman itself, and the void behind it.
      [new THREE.SphereGeometry(0.19, 10, 8), { y: 1.2 }, 0x4a412c],
      [new THREE.BoxGeometry(0.26, 0.4, 0.03), { y: 1.2, z: 0.17 }, 0xf6e9b0],
      [new THREE.BoxGeometry(0.05, 0.28, 0.02), { y: 1.2, z: 0.19 }, 0xb4342a],
      [new THREE.BoxGeometry(0.14, 0.04, 0.02), { y: 1.3, z: 0.19 }, 0xb4342a],
      [new THREE.BoxGeometry(0.14, 0.04, 0.02), { y: 1.1, z: 0.19 }, 0xb4342a],
      // A sash at the waist.
      [new THREE.CylinderGeometry(0.36, 0.36, 0.07, 14), { y: 0.62 }, 0x9a3f34],
    ]

    // Wide sleeves, held out in front the way a caster holds a seal.
    for (const side of [-1, 1]) {
      parts.push([
        limb(
          [[side * 0.3, 1.02, 0.02], [side * 0.5, 0.84, 0.34], [side * 0.4, 0.66, 0.66]],
          [0.225, 0.30, 0.186], 10, 6,
        ),
        {}, 0xe6dcb4,
      ])
    }
    // A long train of cloth dragging behind — the counterweight to the sleeves,
    // and the reason 부적귀 reads differently from the side than head-on.
    for (const [dx, len] of [[-0.14, 0.86], [0.0, 1.14], [0.14, 0.9]]) {
      parts.push([
        limb(
          [[dx, 0.5, -0.18], [dx * 1.5, 0.34, -len * 0.55], [dx * 1.7, 0.12, -len]],
          [0.20, 0.14, 0.03], 10, 5,
        ),
        { sx: 0.9, sy: 0.9, sz: 0.9 }, 0xcbb87e,
      ])
    }
    // Paper charms strung across the chest.
    for (const [cx, cy] of [[-0.22, 0.92], [0.22, 0.9], [0, 0.78]]) {
      parts.push([new THREE.BoxGeometry(0.1, 0.2, 0.015), { x: cx, y: cy, z: 0.3, rz: cx * 1.2 }, 0xf6e9b0])
    }
    // Seams down the robe and a studded sash.
    parts.push(...panelSeams(5, [
      [0.20, 1.24], [0.28, 1.02], [0.34, 0.72], [0.46, 0.36], [0.56, 0.10],
    ], 0xa8813f, { thickness: 0.011, lift: 1.03 }))
    parts.push(...studRing(6, 0.38, 0.62, 0xe8c56a, { size: 0.033 }))
    return buildColored(parts)
  },

  // 혈갈 — carried high on splayed legs, tail arched over the back.
  //
  // The first version laid a lathed carapace flat on the ground and shrank the
  // tail to a fifth scale, which read as a red pancake from every angle. The
  // tail is the whole point of a scorpion, so here it owns the top half of the
  // silhouette and the body is lifted clear of the ground to make room for legs.
  bloodScorpion() {
    const abdomen = limb(
      [[0, 0.30, -0.46], [0, 0.33, -0.16], [0, 0.31, 0.12]],
      [0.14, 0.23, 0.19], 12, 8,
    )
    gradient(abdomen, 0x7a1c36, 0xc44a63, 'y')

    const thorax = limb(
      [[0, 0.31, 0.10], [0, 0.30, 0.30], [0, 0.27, 0.46]],
      [0.20, 0.17, 0.10], 10, 8,
    )
    gradient(thorax, 0x8a2340, 0xd05a72, 'y')

    // Segmented tail, arching up over the back and striking forward.
    const tail = limb(
      [[0, 0.40, -0.50], [0, 0.72, -0.66], [0, 1.05, -0.52],
        [0, 1.20, -0.14], [0, 1.10, 0.20]],
      [0.115, 0.098, 0.082, 0.066, 0.046], 24, 7,
    )
    gradient(tail, 0x932c44, 0xd05a72, 'y')

    const parts = [
      [abdomen, {}, undefined],
      [thorax, {}, undefined],
      [tail, {}, undefined],
      // Stinger.
      [new THREE.ConeGeometry(0.055, 0.24, 6), { y: 1.04, z: 0.32, rx: 2.2 }, 0x5e1c2c],
      // Eye cluster.
      [new THREE.SphereGeometry(0.032, 6, 5), { x: -0.07, y: 0.37, z: 0.34 }, 0xffd05a],
      [new THREE.SphereGeometry(0.032, 6, 5), { x: 0.07, y: 0.37, z: 0.34 }, 0xffd05a],
    ]

    // Tail segment rings, so the arch reads as jointed rather than as a hose.
    for (let i = 0; i < 5; i++) {
      const t = 0.12 + i * 0.19
      const a = Math.PI * t
      parts.push([
        new THREE.BoxGeometry(0.13, 0.035, 0.09),
        { y: 0.42 + Math.sin(a) * 0.82, z: -0.52 + (1 - Math.cos(a)) * 0.42, rx: -a * 0.5 },
        0x6d2333,
      ])
    }

    // Four pairs of legs, splayed wide and reaching the ground.
    for (let i = 0; i < 4; i++) {
      const z = -0.26 + i * 0.20
      const spread = 0.34 + Math.abs(i - 1.5) * 0.06
      for (const side of [-1, 1]) {
        parts.push([
          limb(
            [[side * 0.16, 0.30, z],
              [side * spread, 0.34, z + side * 0.05],
              [side * (spread + 0.14), 0.10, z + side * 0.07],
              [side * (spread + 0.10), 0.0, z + side * 0.06]],
            [0.055, 0.045, 0.032, 0.02], 10, 5,
          ),
          {}, 0x9c3450,
        ])
      }
    }

    // Pincer arms held out in front.
    for (const side of [-1, 1]) {
      parts.push([
        limb(
          [[side * 0.16, 0.30, 0.36], [side * 0.34, 0.26, 0.60], [side * 0.31, 0.24, 0.80]],
          [0.075, 0.095, 0.065], 10, 6,
        ),
        {}, 0xc8536b,
      ])
      // Two-part claw, opened.
      for (const jaw of [-1, 1]) {
        parts.push([
          new THREE.ConeGeometry(0.042, 0.26, 5),
          { x: side * 0.31, y: 0.24 + jaw * 0.05, z: 0.95, rx: Math.PI / 2 - jaw * 0.26 },
          0x7e2a3c,
        ])
      }
    }
    return buildColored(parts)
  },

  // 마수사 — a corrupted cultivator: robe, masked face, a ring of blades.
  demonCultivator() {
    const robe = revolve([
      [0.00, 1.72], [0.22, 1.64], [0.30, 1.30], [0.40, 0.92],
      [0.58, 0.46], [0.72, 0.10], [0.64, 0.02], [0.00, 0.00],
    ], 16)
    gradient(robe, 0x4d2a80, 0x9a6ed4, 'y')

    const parts = [
      [robe, {}, undefined],
      [new THREE.SphereGeometry(0.24, 14, 10), { y: 1.76 }, 0x412a63],
      // Featureless mask.
      [new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), { y: 1.78, z: 0.08, rx: 1.35 }, 0xe8d9ff],
      [new THREE.BoxGeometry(0.19, 0.028, 0.02), { y: 1.79, z: 0.24 }, 0x5a2f8f],
      // Shoulder mantle and sash.
      [new THREE.CylinderGeometry(0.42, 0.3, 0.14, 14), { y: 1.44 }, 0x8f5fd0],
      [new THREE.CylinderGeometry(0.46, 0.46, 0.08, 14), { y: 0.86 }, 0xd8b45a],
    ]

    for (const side of [-1, 1]) {
      parts.push([
        limb(
          [[side * 0.36, 1.4, 0.04], [side * 0.56, 1.06, 0.24], [side * 0.48, 0.74, 0.30]],
          [0.21, 0.285, 0.186], 10, 6,
        ),
        {}, 0xa075de,
      ])
    }

    // A fan of blades hanging at his back. They used to orbit in a full ring,
    // which made the whole figure axially symmetric — a fan behind the shoulders
    // reads as a threat from the side and as a crown from the front.
    for (let i = 0; i < 9; i++) {
      const a = -1.2 + (i / 8) * 2.4
      parts.push([
        new THREE.BoxGeometry(0.05, 0.78 + Math.cos(a) * 0.42, 0.024),
        {
          x: Math.sin(a) * 0.88,
          y: 2.06 + Math.cos(a) * 0.34,
          z: -0.42 - Math.cos(a) * 0.22,
          rz: a * 0.8,
        },
        i % 2 ? 0xd9c2ff : 0xb79ae8,
      ])
    }
    // Horns off the mask, so the head has a shape of its own at a distance.
    for (const side of [-1, 1]) {
      parts.push([
        limb(
          [[side * 0.14, 1.92, 0.04], [side * 0.34, 2.16, -0.16], [side * 0.3, 2.34, -0.46]],
          [0.062, 0.042, 0.012], 10, 5,
        ),
        {}, 0xd8b45a,
      ])
    }
    // Robe train, so the lathe is not the whole lower silhouette.
    for (const [dx, len] of [[-0.2, 0.8], [0.06, 1.05], [0.22, 0.75]]) {
      parts.push([
        limb(
          [[dx, 0.44, -0.3], [dx * 1.4, 0.3, -len * 0.6], [dx * 1.6, 0.06, -len]],
          [0.26, 0.18, 0.04], 10, 5,
        ),
        { sx: 0.95, sy: 0.95, sz: 0.95 }, 0x5f3a94,
      ])
    }
    // Embroidery down the robe and gems on the sash.
    parts.push(...panelSeams(6, [
      [0.22, 1.64], [0.30, 1.30], [0.40, 0.92], [0.58, 0.46], [0.72, 0.10],
    ], 0xd8b45a, { thickness: 0.013, lift: 1.03 }))
    parts.push(...studRing(8, 0.48, 0.86, 0xffe9a8, { size: 0.036, shape: 'gem' }))
    return buildColored(parts)
  },
}

/**
 * 청사 — a coiled serpent reared up to strike.
 *
 * The plateau needed a creature of its own, and nothing else in the bestiary is
 * legless: a coil on the ground under a raised head gives 청람비경 a silhouette
 * that cannot be mistaken for a wolf or a robe at any distance.
 */
BUILDERS.jadeSerpent = () => {
  const body = limb(
    [[-0.30, 0.09, -0.42], [0.34, 0.11, -0.34], [0.44, 0.12, 0.16],
      [-0.02, 0.13, 0.36], [-0.34, 0.22, 0.06], [-0.16, 0.48, -0.06],
      [0.06, 0.68, 0.14], [0.04, 0.74, 0.44]],
    [0.05, 0.13, 0.17, 0.17, 0.15, 0.125, 0.105, 0.088], 30, 8,
  )
  // Teal rather than leaf green. A green serpent on a green plateau measured
  // ΔE 16 against the field it lives on — pushing the hue toward cyan keeps it
  // jade without letting it sink into the grass.
  gradient(body, 0x0c4a4e, 0x54d8c8, 'y')

  const head = limb(
    [[0.04, 0.75, 0.42], [0.03, 0.765, 0.58], [0.02, 0.73, 0.74]],
    [0.10, 0.125, 0.05], 10, 8,
  )
  gradient(head, 0x15706e, 0x7ceadc, 'y')

  const parts = [
    [body, {}, undefined],
    [head, {}, undefined],
    // Slit eyes, and the forked tongue tasting the air.
    [new THREE.SphereGeometry(0.036, 6, 5), { x: -0.075, y: 0.79, z: 0.6 }, 0xffd24a],
    [new THREE.SphereGeometry(0.036, 6, 5), { x: 0.075, y: 0.79, z: 0.6 }, 0xffd24a],
    [new THREE.ConeGeometry(0.012, 0.16, 3), { x: -0.02, y: 0.715, z: 0.84, rx: Math.PI / 2, rz: 0.3 }, 0xd8465e],
    [new THREE.ConeGeometry(0.012, 0.16, 3), { x: 0.02, y: 0.715, z: 0.84, rx: Math.PI / 2, rz: -0.3 }, 0xd8465e],
  ]

  // Flared hood — the read that says "about to strike" before the dash starts.
  for (const side of [-1, 1]) {
    const hood = new THREE.SphereGeometry(0.26, 10, 8, 0, Math.PI, 0, Math.PI * 0.7)
    parts.push([hood, {
      x: side * 0.05, y: 0.63, z: 0.06,
      rx: -0.5, rz: side * 1.25, sx: 1, sy: 0.7, sz: 0.28,
    }, side < 0 ? 0x2a7d58 : 0x246f4e])
  }

  // Dorsal scutes running the length of the spine.
  const spine = [
    [0.30, 0.20, -0.34], [0.42, 0.22, 0.12], [-0.02, 0.24, 0.34],
    [-0.32, 0.33, 0.04], [-0.16, 0.58, -0.06], [0.05, 0.77, 0.12],
  ]
  for (const [sx, sy, sz] of spine) {
    parts.push([new THREE.ConeGeometry(0.038, 0.1, 4), { x: sx, y: sy, z: sz }, 0xd8f0a8])
  }

  // Pale belly scutes banding the outer coil.
  for (let i = 0; i < 9; i++) {
    const a = -0.6 + (i / 8) * 3.4
    parts.push([
      new THREE.BoxGeometry(0.075, 0.02, 0.05),
      { x: Math.cos(a) * 0.42, y: 0.03, z: Math.sin(a) * 0.42 - 0.06, ry: -a },
      0xe4f2c4,
    ])
  }
  return buildColored(parts)
}

// ---- 적염비경 --------------------------------------------------------------

/** 화정 — a spark elemental: a hot core wrapped in rising flame tongues. */
BUILDERS.emberSprite = () => {
  const core = revolve([
    [0.00, 0.78], [0.18, 0.62], [0.26, 0.40], [0.22, 0.18], [0.00, 0.06],
  ], 12)
  gradient(core, 0xffe08a, 0xff6a2a, 'y')

  shear(core, 0.22)

  const parts = [[core, {}, undefined]]
  // Flame tongues swept back by its own motion. Evenly spaced around the axis
  // they cancelled out into a blob; raked backward they give it a direction.
  //
  // Nine thin tongues rather than five fat ones, and the radii are absolute:
  // scaling the part shrank the tongues' positions as well as their thickness,
  // which pulled them into the core and left a folded orange shard.
  for (let i = 0; i < 9; i++) {
    const a = -1.25 + (i / 8) * 2.5
    const rake = 0.5 + Math.cos(a) * 0.6
    const tall = 0.62 + Math.cos(a) * 0.44
    parts.push([
      limb(
        [[Math.sin(a) * 0.19, 0.10, 0.08],
          [Math.sin(a) * 0.30, 0.14 + tall * 0.42, -rake * 0.34],
          [Math.sin(a) * 0.34, 0.14 + tall * 0.78, -rake * 0.74],
          [Math.sin(a) * 0.26, 0.14 + tall, -rake]],
        [0.09, 0.062, 0.032, 0.004], 14, 5,
      ),
      {}, i % 3 === 0 ? 0xfff0b0 : (i % 3 === 1 ? 0xffcf6a : 0xff8a3c),
    ])
  }
  // Loose sparks shed off the tongues.
  for (let i = 0; i < 5; i++) {
    const a = -0.9 + i * 0.45
    parts.push([
      new THREE.OctahedronGeometry(0.038, 0),
      { x: Math.sin(a) * 0.42, y: 0.72 + (i % 2) * 0.28, z: -0.62 - (i % 3) * 0.2 },
      0xfff0b0,
    ])
  }
  parts.push([new THREE.SphereGeometry(0.07, 6, 5), { x: -0.07, y: 0.56, z: 0.3 }, 0xfff2c0])
  parts.push([new THREE.SphereGeometry(0.07, 6, 5), { x: 0.07, y: 0.56, z: 0.3 }, 0xfff2c0])
  return buildColored(parts)
}

/** 용암귀 — cooled crust over a molten interior, cracked open at every seam. */
BUILDERS.magmaBrute = () => {
  const torso = revolve([
    [0.00, 1.35], [0.44, 1.26], [0.70, 0.98], [0.78, 0.60],
    [0.68, 0.26], [0.48, 0.06], [0.00, 0.00],
  ], 12)
  gradient(torso, 0x3d2018, 0x8a4028, 'y')
  roughen(torso, 0.1, 5)
  shear(torso, 0.16)

  const parts = [
    [torso, {}, undefined],
    [roughen(new THREE.DodecahedronGeometry(0.34, 0), 0.07, 9), { y: 1.32, z: 0.08 }, 0x5a2c1c],
    // Molten seams.
    [new THREE.BoxGeometry(0.6, 0.07, 0.05), { y: 0.86, z: 0.66, rz: 0.28 }, 0xffb04a],
    [new THREE.BoxGeometry(0.42, 0.07, 0.05), { y: 0.56, z: 0.62, rz: -0.4 }, 0xff8a2a],
    [new THREE.BoxGeometry(0.3, 0.06, 0.05), { y: 1.1, z: 0.5, rz: 0.5 }, 0xffc86a],
    [new THREE.SphereGeometry(0.07, 6, 5), { x: -0.14, y: 1.36, z: 0.3 }, 0xffe07a],
    [new THREE.SphereGeometry(0.07, 6, 5), { x: 0.14, y: 1.36, z: 0.3 }, 0xffe07a],
  ]
  for (const side of [-1, 1]) {
    parts.push([
      limb(
        [[side * 0.80, 1.06, 0], [side * 1.00, 0.62, 0.06], [side * 0.92, 0.2, 0.02]],
        [0.247, 0.286, 0.338], 8, 6,
      ),
      {}, 0x6b3423,
    ])
    parts.push([roughen(new THREE.DodecahedronGeometry(0.28, 0), 0.06, 7 + side), { x: side * 0.92, y: 0.14 }, 0x8a4028])
  }
  // Crust plates breaking the outline all the way round, so 용암귀 reads as
  // something crusted over rather than as a smooth boulder. 석귀 gets angular
  // spurs instead — the two heavies have to be tellable apart in a crowd.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.4
    const y = 0.34 + (i % 4) * 0.28
    const r = 0.52 + Math.sin(i * 2.1) * 0.16
    parts.push([
      roughen(new THREE.DodecahedronGeometry(0.2 + (i % 3) * 0.05, 0), 0.06, 41 + i),
      { x: Math.sin(a) * r, y, z: Math.cos(a) * r },
      i % 2 ? 0x8a4028 : 0x5a2c1c,
    ])
  }

  // Cooled crust breaking off its back, with the melt showing through beneath.
  for (let i = 0; i < 6; i++) {
    const a = -0.9 + i * 0.36
    const h = 0.4 + Math.cos(a) * 0.3
    parts.push([
      roughen(new THREE.DodecahedronGeometry(0.19 + Math.cos(a) * 0.07, 0), 0.05, 21 + i),
      { x: Math.sin(a) * 0.62, y: 1.02 + Math.cos(a) * 0.2, z: -0.5 - Math.cos(a) * 0.2 },
      0x2e1710,
    ])
    parts.push([
      new THREE.BoxGeometry(0.04, h * 0.5, 0.04),
      { x: Math.sin(a) * 0.56, y: 0.86 + Math.cos(a) * 0.18, z: -0.42 - Math.cos(a) * 0.16, rz: a },
      0xffb04a,
    ])
  }
  parts.push(...studRing(7, 0.74, 0.72, 0xff9a3c, { size: 0.055, shape: 'gem' }))
  return buildColored(parts)
}

/** 재까마귀 — a fast flier, all wing and beak. */
BUILDERS.ashRaven = () => {
  const body = limb(
    [[0, 0.72, -0.3], [0, 0.78, 0], [0, 0.72, 0.32]],
    [0.55, 0.85, 0.4], 10, 8,
  )
  body.scale(0.3, 0.26, 0.3)
  // Cold near-black. Warm brown put it inside the ash ground it flies over; a
  // raven reads best as the darkest, coolest thing in a warm frame anyway.
  gradient(body, 0x585463, 0x14121c, 'y')

  const parts = [
    [body, {}, undefined],
    [new THREE.ConeGeometry(0.07, 0.3, 5), { y: 0.72, z: 0.5, rx: Math.PI / 2 }, 0xe8b04a],
    [new THREE.SphereGeometry(0.045, 6, 5), { x: -0.08, y: 0.8, z: 0.28 }, 0xff8a4a],
    [new THREE.SphereGeometry(0.045, 6, 5), { x: 0.08, y: 0.8, z: 0.28 }, 0xff8a4a],
  ]
  // Swept wings.
  for (const side of [-1, 1]) {
    parts.push([
      limb(
        [[side * 0.14, 0.78, 0], [side * 0.52, 0.9, -0.16], [side * 0.86, 0.74, -0.4]],
        [0.5, 0.34, 0.1], 10, 4,
      ),
      { sx: 1, sy: 0.35, sz: 1 }, 0x2b2836,
    ])
  }
  parts.push([new THREE.ConeGeometry(0.07, 0.34, 4), { y: 0.7, z: -0.42, rx: -1.3 }, 0x201e2a])
  return buildColored(parts)
}

// ---- 한천비경 --------------------------------------------------------------

/**
 * 설랑 — the wolf frozen over, with a mane of ice it carries like armour.
 *
 * This used to be 요랑 with five small spikes glued on, which measured at 0.72
 * silhouette likeness against it — and unlike 석귀 and 용암귀, these two share a
 * 비경 and genuinely appear side by side. A recolour is not a second creature.
 * The ice here is structural: a tall dorsal crest, sheeted shoulders, and a
 * frozen plume of a tail that changes the outline from every angle.
 */
BUILDERS.frostWolf = () => {
  const base = BUILDERS.wolf()
  // Rebuilt rather than recoloured: a shared geometry would repaint 요랑 too.
  const parts = [[base, {}, undefined]]

  // Dorsal crest, tallest over the shoulders.
  for (let i = 0; i < 7; i++) {
    const t = i / 6
    const h = 0.52 - t * 0.30
    parts.push([
      new THREE.ConeGeometry(0.075 - t * 0.025, h, 4),
      { x: 0, y: 0.74 + h * 0.42, z: 0.26 - t * 0.62, rx: -0.42 + t * 0.2 },
      i % 2 ? 0xdaf2ff : 0x9fd0ea,
    ])
  }
  // Sheets of ice over the shoulders, jutting sideways past the body.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const h = 0.42 - i * 0.09
      parts.push([
        new THREE.ConeGeometry(0.062, h, 4),
        { x: side * (0.22 + i * 0.05), y: 0.66 - i * 0.1, z: 0.2 - i * 0.2, rz: side * (1.0 + i * 0.15), rx: -0.2 },
        0xcfeaff,
      ])
    }
  }
  // Frozen plume of a tail, held high and heavy with ice.
  parts.push([
    limb([[0, 0.52, -0.5], [0.03, 0.8, -0.78], [0.02, 1.04, -0.92]], [0.09, 0.11, 0.03], 12, 6),
    {}, 0xbfe4f6,
  ])
  for (let i = 0; i < 4; i++) {
    parts.push([
      new THREE.ConeGeometry(0.055, 0.2, 4),
      { x: (i % 2 ? 1 : -1) * 0.09, y: 0.7 + i * 0.11, z: -0.72 - i * 0.05, rz: (i % 2 ? 1 : -1) * 1.1 },
      0xdaf2ff,
    ])
  }
  const geo = buildColored(parts)
  // Wash the whole thing toward ice.
  // Washed hard toward white. A light wash left it a mid blue-grey, which is
  // the same value as the 한천 snowfield it hunts on — and unlike 요랑 this one
  // really is made of ice, so pale is both correct and legible.
  const col = geo.attributes.color
  for (let i = 0; i < col.count; i++) {
    col.setXYZ(i,
      col.getX(i) * 0.30 + 0.46,
      col.getY(i) * 0.26 + 0.66,
      col.getZ(i) * 0.20 + 0.80)
  }
  col.needsUpdate = true
  return geo
}

/** 설귀 — a veiled figure of drifting snow. */
BUILDERS.snowWraith = () => {
  const shroud = revolve([
    [0.00, 1.10], [0.24, 1.00], [0.34, 0.76], [0.40, 0.46],
    [0.34, 0.22], [0.20, 0.06], [0.00, -0.02],
  ], 14)
  // A wraith on a snowfield has to be the dark shape, not the pale one. The
  // original pale-on-pale version measured ΔE 1.0 against the 한천 ground: a
  // ranged attacker the player could not see at all.
  gradient(shroud, 0x1d3352, 0x8fb6d8, 'y')
  shear(shroud, -0.12)
  // Thin front-to-back so the veil hangs like cloth rather than a bell.
  flare(shroud, 0.4, -0.22)

  const parts = [
    [shroud, {}, undefined],
    [new THREE.SphereGeometry(0.2, 12, 8), { y: 0.82, z: 0.1 }, 0x16243d],
    [new THREE.SphereGeometry(0.05, 6, 5), { x: -0.08, y: 0.84, z: 0.24 }, 0x9ff0ff],
    [new THREE.SphereGeometry(0.05, 6, 5), { x: 0.08, y: 0.84, z: 0.24 }, 0x9ff0ff],
  ]
  // Icicles along the hem, heaviest at the front where the veil parts.
  for (let i = 0; i < 7; i++) {
    const a = -1.3 + (i / 6) * 2.6
    parts.push([
      new THREE.ConeGeometry(0.05, 0.2 + Math.cos(a) * 0.16, 4),
      { x: Math.sin(a) * 0.3, y: 0.02, z: 0.06 + Math.cos(a) * 0.26, rx: Math.PI },
      0xcfeaff,
    ])
  }
  // Arms of drifting snow, reaching for the player.
  for (const side of [-1, 1]) {
    parts.push([
      limb(
        [[side * 0.24, 0.78, 0.08], [side * 0.38, 0.62, 0.4], [side * 0.3, 0.52, 0.68]],
        [0.16, 0.11, 0.03], 10, 5,
      ),
      {}, 0xbcdcf0,
    ])
  }
  // A veil trailing off behind into snowfall.
  for (const [dx, len] of [[-0.1, 0.72], [0.1, 0.72], [0, 0.98]]) {
    parts.push([
      limb(
        [[dx, 0.7, -0.16], [dx * 1.6, 0.5, -len * 0.6], [dx * 1.8, 0.24, -len]],
        [0.18, 0.12, 0.02], 10, 5,
      ),
      {}, 0x8fb8d4,
    ])
  }
  return buildColored(parts)
}

/** 빙벽수 — a wall of ice that walks. */
BUILDERS.glacierWarden = () => {
  const body = revolve([
    [0.00, 1.75], [0.50, 1.62], [0.78, 1.20], [0.86, 0.70],
    [0.74, 0.28], [0.52, 0.05], [0.00, 0.00],
  ], 10)
  // Pale glacier ice, not deep water. Same reason as 설랑: the mid blue it had
  // was the ground's own value on the only stage it appears on.
  gradient(body, 0x7fc0e0, 0xeafaff, 'y')

  const parts = [[body, {}, undefined]]
  // A crest of ice erupting from its back, tallest along the spine and shorter
  // toward the shoulders. Ringed evenly around the body — as this was — the
  // shards cancel into a radially symmetric pincushion and 빙벽수 reads as a
  // spiky ball from every angle instead of as a wall advancing on you.
  for (let i = 0; i < 11; i++) {
    const a = -1.35 + (i / 10) * 2.7
    const h = 0.55 + Math.cos(a) * 0.85
    parts.push([
      new THREE.ConeGeometry(0.11 + Math.cos(a) * 0.05, h, 4),
      {
        x: Math.sin(a) * 0.66,
        y: 1.42 + h * 0.42,
        z: -0.42 - Math.cos(a) * 0.34,
        rz: Math.sin(a) * 0.55, rx: -0.34,
      },
      i % 2 ? 0xdff2ff : 0x9fd0ea,
    ])
  }
  parts.push([new THREE.SphereGeometry(0.09, 8, 6), { x: -0.2, y: 1.5, z: 0.62 }, 0x9ff0ff])
  parts.push([new THREE.SphereGeometry(0.09, 8, 6), { x: 0.2, y: 1.5, z: 0.62 }, 0x9ff0ff])
  for (const side of [-1, 1]) {
    parts.push([
      limb(
        [[side * 0.88, 1.3, 0], [side * 1.08, 0.8, 0.06], [side * 1.0, 0.3, 0.02]],
        [0.247, 0.286, 0.351], 8, 6,
      ),
      {}, 0xa8d6ee,
    ])
  }
  return buildColored(parts)
}

export function buildEnemyGeometry(enemyId) {
  let geo = cache.get(enemyId)
  if (geo === undefined) {
    const build = BUILDERS[enemyId]
    if (build === undefined) throw new Error(`[art] no geometry builder for enemy "${enemyId}"`)
    geo = build()
    cache.set(enemyId, geo)
  }
  return geo
}
