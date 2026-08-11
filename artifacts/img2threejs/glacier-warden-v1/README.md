# Glacier Warden v1

This asset is the current production reference and bounded near-detail runtime realization for `빙벽수`.

## Source and Forge path

1. ImageGen generated a four-view turnaround: front, front three-quarter, side, and back.
2. The views were cropped into `turnaround/` and reviewed at original resolution.
3. The vendored GitHub `img2threejs/img2threejs` Forge tools produced `assessment.json`, the authored `object-sculpt-spec.json`, the shared PBR evidence in `pbr-evidence/`, and `glacier-warden-v1.factory.ts`.
4. `validate_sculpt_spec.py --strict-quality` passes. The PBR extraction report is `pbr-report.json` with confidence `0.841` against a `0.70` target.

The PBR maps are reference-derived estimates from one cropped view, not exact photogrammetry or semantic material masks. The runtime therefore keeps the maps shared and applies material response through authored blue-steel, frost, cloth, and emissive recipes instead of duplicating false per-material textures.

## Runtime policy

- `src/art/NearEnemyModels.js` is the bounded near-detail realization used only for the closest eight targets.
- The outer horde remains one instanced mesh per enemy type.
- Repeated shoulder ice, crown, armor, cloak, and shard parts use `InstancedMesh`; the authored model is 35 mesh draws after the first optimization pass.
- The four runtime WebP channels live under `public/assets/materials/img2three/glacier-warden-v1/` and are listed in `tools/asset-manifest.json`.
- The reference image is `public/assets/characters/glacier-warden-reference-v1.png`.

TRELLIS promotion to a skinned GLB remains a separate gate because the external anonymous GPU quota was not available. No placeholder GLB is claimed here; this pass is the verified Forge-backed near-detail model used by the game.
