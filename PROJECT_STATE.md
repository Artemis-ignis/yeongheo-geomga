# 영허검가 현재 상태

기준일: 2026-08-11
브랜치: `agent/yeongheo-starfall-quality-pass`

## production 진실

- 현재 active runtime은 PixiJS 2D입니다(`src/main.js` → `src/runtime2d/Game2D.js`).
- Three.js/GLB/TRELLIS 결과는 legacy 개발·자산 QA 증거이며 production 전투가 사용하는 active 3D 모델이 아닙니다.
- WorldClaw는 지역/공유 레이아웃/접점 QA만 선택적으로 적용했습니다. 전체 3D 포트나 파노라마 전환은 하지 않았습니다.

## 현재 검증 기준

| 영역 | 현재 판정 |
|---|---|
| build | PASS; Game2D 약 548.17 kB, gzip 약 162.68 kB |
| tests | 67개 파일 / 752개 PASS |
| assets | 117/117 |
| runtime | 73/73 |
| npm audit | 알려진 취약점 0 |
| launcher | 브라우저를 열지 않는 실제 smoke PASS |
| Windows Chromium | 정확한 1920×1080·2560×1600 title/combat 및 level-up DOM 확인, console error 0 |
| 시각 확인 | title visual PASS, 최신 enemy contact PASS |

## 아직 닫히지 않은 게이트

- 전체 commercial visual gate는 **strict FAIL**입니다. 지면이 평평하고 반복적으로 보이며, 초반 threat/action feedback이 약합니다.
- rights audit는 **BLOCKED**입니다. 법적 증거가 확인된 runtime asset은 0/73입니다.
- 따라서 release approval, A-grade, rights clearance, 공식 제출 승인을 선언하지 않습니다.

이 문서는 문서 정리 pass에서 재실행한 결과가 아니라 현재 인계된 검증 사실을 정리한 것입니다. 다음 작업은 [TODO.md](TODO.md)만 따릅니다.
