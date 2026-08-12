# 영허검가 저장소 작업 규칙

## 저장소의 진실

- 현재 파일, `git diff`, 실제 빌드·테스트·Windows 런타임 결과를 이전 대화나 계획보다 우선합니다.
- 작업을 시작하기 전에 `git status`, `git diff`, `git diff --staged`, 최근 `git log`와 관련 구현을 확인합니다.
- 이미 충족된 기능은 다시 구현하지 않고, dirty worktree의 사용자·다른 에이전트 변경을 보존합니다.

## 현재 제품 경계

- production 진입점은 `src/main.js`에서 `src/runtime2d/Game2D.js`로 이어지는 PixiJS 2D 런타임입니다.
- 구형 Three.js/GLB/img2three 코드·자산·문서는 현재 저장소에서 제거했습니다. 다시 복구하거나 production 경로와 섞지 않습니다.
- WorldClaw는 지역/공유 레이아웃/접점 QA 원칙만 선택적으로 전이했습니다. 전체 3D 포트나 파노라마 전환은 결정하지 않았습니다.

## 수정과 검증

- 요청 범위 안에서 최소 diff만 만들고, 관련 없는 코드·에셋·설정을 고치지 않습니다.
- 자동·headless·fixture PASS와 실제 사용자가 보는 Windows Chromium 시각/입력/런타임 PASS를 구분합니다.
- release 승인, A-grade, 사람의 미학적 승인, 이미지 사용 권리 확인을 테스트 통과만으로 선언하지 않습니다.
- 자동 테스트는 실행 회귀만 검사합니다. 시각 품질과 재미는 실제 1920×1080·2560×1600 플레이로 사람이 판정합니다.

## Git과 작업 인계

- 명시적 지시 없이는 stage/commit/push하지 않습니다. stage가 필요하면 대상 경로를 하나씩 지정하며 `git add .`를 사용하지 않습니다.
- 저장소 정리 뒤에는 누락 에셋, 전체 테스트, production build, Windows launcher smoke를 다시 수행합니다.
- 서브에이전트는 필요할 때만 사용합니다. 마스터가 Luna 작업을 요청하는 경우에만 Luna 서브에이전트를 사용하며 모델은 Max로 고정합니다.
