# Seolryeong v3 asset pass

이 폴더는 최신 ImageGen 캐릭터 기준을 공식 img2threejs 파이프라인에 넣어
검수한 authoring evidence입니다.

- `seolryeong-isolated-reference.png`: chroma 제거 후 공식 reference admission을 통과한 기준 이미지
- `assessment.json`, `anatomy.json`, `detail-inventory.json`, `material-regions.json`: 사람 검토가 필요한 authoring 입력
- `pbr-evidence/`: frost-silk 표면에 대해 추출된 albedo/roughness/normal/height/AO 증거
- `object-sculpt-spec.json`: upstream generator가 만든 초안; strict structural/material pass 전에는 런타임 factory로 승격하지 않음
- `landmarks.png`, `detail-inventory/`: silhouette와 세부 feature 확인용 시각 자료

런타임은 `src/art/SeolryeongImg2ThreeAdapter.js`에서 고정된 공식 factory를
구조/socket 기준으로 사용하고, `src/art/HeroicModels.js`의 보이는 3D shell에
ImageGen 기준으로 authoring한 성인형 실루엣과 img2three PBR normal/roughness를
적용합니다. 따라서 이 폴더의 중간 산출물을 전부 브라우저가 읽거나 게임 번들에
넣지 않습니다.
