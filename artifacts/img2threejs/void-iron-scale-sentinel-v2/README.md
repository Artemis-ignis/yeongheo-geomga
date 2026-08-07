# Void-Iron Scale Sentinel v2 (legacy)

이 폴더는 영허검가의 이전 근접 `demonCultivator` 기준 자산과 검수 증거를 보관하는 legacy 기록입니다. 현재 런타임 연결은 v3로 교체됐으며, v2 public PBR 파일은 중복 방지를 위해 보관 위치에서 분리했습니다.

## 파이프라인

1. ImageGen으로 전신 갑주 기준 이미지 `isolated-reference.png`를 만들었습니다.
2. 원본의 검은 배경은 공식 admission에서 `foreground coverage 0.980`으로 거부됐습니다. 그래서 원본을 성공으로 가장하지 않고, ImageGen으로 만든 chroma 버전에서 배경을 분리해 `isolated-reference.png`를 만들었습니다.
3. vendored GitHub `img2threejs/img2threejs`의 공식 `probe`, `admission`, `extract_pbr_evidence`, `new_sculpt_spec`, `generate_threejs_factory`를 실행했습니다.
4. isolated reference의 공식 admission은 통과했고, PBR 추출은 confidence `0.86`으로 보고됐습니다. 이 결과는 v2 검수 기록으로만 남기고, 현재 런타임은 v3 canonical Forge evidence를 사용합니다.
5. 공식 factory 출력은 non-strict 시험 fixture로만 생성했습니다. strict-quality가 요구하는 구조·재질·조명·attachment gate를 통과하지 못했으므로 generic factory를 게임에 넣지 않았습니다. 게임에는 그 결과를 바탕으로 직접 authoring한 near-detail hierarchy를 적용했습니다.

## v2 기록과 v3 런타임 전환

- v2 기준 이미지: v2 legacy archive 기록
- ImageGen 표면 타일: `public/assets/materials/guardians/void-iron-scale-armor-v1.png`
- 현재 공식 img2threejs 채널: `public/assets/materials/img2three/void-iron-scale-sentinel-v3_{ao,height,normal,roughness}.webp`
- 현재 기준 이미지와 spec: `artifacts/img2threejs/void-iron-scale-sentinel-v3/`
- 실제 모델 코드: `src/art/NearEnemyModels.js`의 `buildDemonCultivator()`
- 근접 LOD 삽입: `src/entities/EnemyManager.js`의 near-detail 슬롯

## 현재 품질 경계

v2 결과는 기존 도형 덩어리보다 개선됐지만, 스키닝된 고품질 GLB/GLTF나 AAA급 완성품은 아닙니다. 단일 이미지에서 보이지 않는 뒷면과 관절을 임의로 확정할 수 없고, img2threejs 자체도 코드 기반 procedural reconstruction 도구이기 때문입니다. 따라서 v2 상태는 `legacy / superseded by v3`로 기록합니다.

## 증거

- `assessment.json`: author-reviewed character classification과 detail inventory
- `anatomy.json`, `landmarks.png`: 캐릭터 비율·랜드마크 증거
- `pbr-report.json`, `pbr-evidence/`: 공식 추출 채널과 confidence
- `object-sculpt-spec.json`: 공식 factory 입력 초안; strict gate 미통과 상태
