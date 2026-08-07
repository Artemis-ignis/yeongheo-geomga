# Void-Iron Cultivator v3 asset brief

This folder is the canonical authoring record for the near-detail enemy created from the ImageGen v3 four-view turnaround.

## Pipeline

1. ImageGen produced `turnaround-source.png` with front, three-quarter, side, and back views.
2. The four panels were cropped into `turnaround/` for multi-view intake.
3. The vendored GitHub source in `tools/img2threejs/` authored `assessment.json` and the starter `object-sculpt-spec.json`.
4. `tools/yeongheo/author_void_iron_sentinel.py` replaced the generic humanoid scaffold with the subject-specific armor hierarchy, detail inventory, sockets, repetition systems, lighting intent, and runtime budget.
5. The official Forge PBR extractor generated one canonical full-object evidence set under `pbr-evidence/` and patched the spec. Material recipes link to that set explicitly; byte-identical per-material copies are not committed. The extraction confidence is `0.769` with the documented single-image limitations.
6. Strict validation passes, and `void-iron-cultivator-v3.factory.ts` is the generated Forge blockout factory.

## Runtime policy

The playable near enemy remains the authored bounded model in `src/art/NearEnemyModels.js`. It uses the existing ImageGen scale tile plus the canonical ImageGen/img2threejs normal, roughness, height, and AO evidence, compressed to runtime WebP under `public/assets/materials/img2three/` and linked in the asset manifest. Material-specific authored response sits on top. The v3 turnaround and spec are attached as runtime metadata. The generated Forge factory is kept as an authoring/review artifact until a visual comparison proves it is better than the existing near-detail model.

The official TRELLIS multi-view call was attempted with the four crops but stopped before generation because the anonymous Hugging Face ZeroGPU quota was exhausted. No fake GLB is claimed. A future TRELLIS GLB promotion must pass four-view visual review, animation/socket review, and the browser performance gate first.

## Re-run

```powershell
$py = 'C:\Users\50106\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $py tools\yeongheo\author_void_iron_sentinel.py
& $py tools\img2threejs\forge\stage2_spec\validate_sculpt_spec.py artifacts\img2threejs\void-iron-scale-sentinel-v3\object-sculpt-spec.json --strict-quality
& $py tools\img2threejs\forge\stage3_build\generate_threejs_factory.py artifacts\img2threejs\void-iron-scale-sentinel-v3\object-sculpt-spec.json --out artifacts\img2threejs\void-iron-scale-sentinel-v3\void-iron-cultivator-v3.factory.ts --pass-id blockout --force
```
