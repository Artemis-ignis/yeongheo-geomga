# Upstream img2threejs

The production source is downloaded from [img2threejs/img2threejs](https://github.com/img2threejs/img2threejs), pinned at commit `d6673386f89673a58736f8d398dd16ece67874f5`.

The verified local checkout is `.img2threejs/upstream/` (ignored so the
repository does not accumulate a second copy of the upstream history). The
tracked `tools/img2threejs/` folder is only a small reproducibility snapshot;
the gate factory used by the game was generated from the official checkout,
not from an image-only extraction.

Yeongheo Geomga uses the upstream `forge` pipeline to turn an ImageGen Jade
Sanctuary Gate reference into a quality-gated `ObjectSculptSpec` and generated
Three.js factory. The runtime game imports the generated factory under
`src/art/generated/` as its emergency geometry LOD; the detailed foreground
presentation remains a separate authored layer so the low-cost fallback does
not lower the normal visual tier.

Reproduce the official download and gate generation from a clean checkout:

```powershell
git clone --depth 1 https://github.com/img2threejs/img2threejs.git .img2threejs/upstream
git -C .img2threejs/upstream checkout d6673386f89673a58736f8d398dd16ece67874f5
$python = 'C:\Users\50106\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $python .img2threejs/upstream/forge/stage2_spec/validate_sculpt_spec.py docs/assets/jade-sanctuary-gate-sculpt-spec.json --strict-quality --json
& $python .img2threejs/upstream/forge/stage3_build/generate_threejs_factory.py docs/assets/jade-sanctuary-gate-sculpt-spec.json --out artifacts/img2threejs/jade-sanctuary-gate/generated/JadeSanctuaryGateFactory.ts --pass-id blockout --force
npm run assets:img2three-gate
```

The final command applies the tracked runtime policy that keeps the emergency
LOD self-contained; the ignored authoring PBR maps are never requested by a
player's browser.

The generated source is committed so a player who downloads the game does not
need Python or the upstream repository at runtime.

The current Seolryeong v3 ImageGen reference is recorded under
`artifacts/img2threejs/seolryeong/character-model-v3/`. Its isolated reference
and PBR evidence are admitted for authoring, but the v3 spec is intentionally
kept as a draft until the upstream structural/material checks pass. The runtime
therefore uses the pinned official factory for structure and sockets, applies
the verified img2three PBR channels to the visible authored cloth, and uses the
v3 reference to drive the visible presentation shell. This is a deliberate
quality boundary, not a claim that the upstream tool magically produced a
skinned AAA GLB.

The upstream project is Apache-2.0 licensed. See `LICENSE` in this directory.
