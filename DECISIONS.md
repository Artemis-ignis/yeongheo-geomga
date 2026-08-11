# 결정 기록

## 2026-08-11 현재 결정

- **Production runtime:** PixiJS 2D `runtime2d`를 권위 화면과 전투 경로로 유지합니다. Three.js/GLB/TRELLIS는 legacy 개발·자산 QA로만 취급합니다.
- **WorldClaw 적용 범위:** 지역/공유 레이아웃/접점 QA 원칙만 선택적으로 전이합니다. 전체 3D 포트와 파노라마 전환은 하지 않습니다.
- **품질 판정:** 구조·빌드·자산·런처·제한된 DOM/런타임 증거의 PASS와 실제 상업적 시각 승인 판정을 분리합니다. 현재 title visual과 최신 enemy contact는 PASS지만 전체 commercial visual은 지면 반복과 초반 feedback 때문에 strict FAIL입니다.
- **권리 판정:** 기술 provenance와 법적 권리를 분리합니다. legal evidence 0/73인 현재 rights audit는 `BLOCKED`이며 rights clearance를 주장하지 않습니다.
- **출시 언어:** 현재 상태를 release approval, A-grade, 공식 제출 승인으로 표현하지 않습니다. 남은 일은 [TODO.md](TODO.md)의 다섯 항목만 기준으로 삼습니다.
- **작업 보존:** dirty worktree의 기존 변경을 보존하고, `.claude/launch.json` 삭제는 사용자 소유의 무관 변경으로 취급합니다. Git stage가 필요할 때도 경로를 명시하며 `git add .`를 사용하지 않습니다.
