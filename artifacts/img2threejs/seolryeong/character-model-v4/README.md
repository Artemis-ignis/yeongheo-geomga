# 설령 캐릭터 v4 — ImageGen → img2threejs → 런타임

이 폴더는 설령 캐릭터의 v4 생성/검수 기록을 한 곳에 보관합니다.

## 파이프라인

1. `public/assets/characters/seolryeong-turnaround-v4.png`를 ImageGen으로 생성했습니다.
2. 이 이미지를 `turnaround/`의 front, three-quarter, side, back 4개 입력으로 분리했습니다.
3. 저장소에 포함된 공식 `tools/img2threejs/`의 `generate_reference_mesh.py`를 사용해 TRELLIS GLB를 생성했습니다.
4. 생성 결과를 Blender/수동 리토폴로지 없이 바로 최종 AAA 모델이라고 부르지 않고, 브라우저에서 원본 기준 이미지·현재 게임 카메라와 함께 검수했습니다.
5. 검수된 런타임 파일은 `public/assets/models/characters/seolryeong-trellis-v4.glb` 하나만 사용합니다.

## 생성 기록

- seed: `240807`
- mesh simplify: `0.93`
- texture size: `512`
- mesh: `47,723` vertices / `66,087` triangles
- material: embedded base-color texture + UV
- 상태: `multi-view-generative-proxy-reviewed-runtime`

`trellis-mesh/reference.glb`와 `reference.obj`는 변환기 로컬 중간 산출물입니다. 런타임 파일과 중복되므로 `.gitignore`로 저장소에는 올리지 않습니다. `reference-mesh.json`은 변환 결과를 재현·감사할 수 있도록 남깁니다.

## 현재 범위와 다음 품질 게이트

현재 GLB는 게임에서 실제로 보이는 성인형 설령 실루엣과 의상 레이어를 제공하는 생성형 프록시입니다. 스킨 리그, idle/attack 애니메이션, 수동 리토폴로지와 수작업 텍스처 정리는 아직 남아 있으므로 AAA 최종 모델로 판정하지 않습니다. 다음 게이트는 리그 포함 GLB와 실제 공격 애니메이션을 전투 런타임에서 검수하는 것입니다.
