# 영허검가 제작 원본

이 폴더는 웹 빌드에 직접 포함하지 않는 고해상도 제작 원본을 보존합니다.
실제 게임은 `public/assets`의 런타임 최적화 파일만 읽습니다.

## 계약

- `tools/yeongheo/sprite-authoring-manifest.json`이 원본 파일과 런타임 출력의 1:1 대응을 선언합니다.
- `tools/asset-manifest.json`이 제작 원본과 런타임 파일의 존재·용량·소비자를 함께 감사합니다.
- `npm run assets:audit`가 누락 원본, 중복 매핑, 선언되지 않은 런타임 출력을 실패 처리합니다.
- 이미지 생성 도구의 원본 산출물은 생성 기록 보존을 위해 별도 Codex 생성 폴더에도 남깁니다.
- `public/assets`에 제작 시트나 검토 캡처를 다시 넣지 않습니다.

## 재생성 도구

- 주인공 시트 정규화: `tools/yeongheo/normalize_heroine_components.py`
- 주인공 런타임 아틀라스 합성: `tools/yeongheo/compose_heroine_runtime_sheet.py`
- 방향형 적 시트 정규화: `tools/yeongheo/normalize_directional_enemy_atlas.py`

런타임 파일을 수동 덮어쓰기 전에 반드시 원본 매핑과 생성 명령을 갱신하고,
이후 에셋 감사·production build·전체 테스트를 순서대로 실행합니다.
