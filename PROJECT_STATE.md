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
| build | PASS; Game2D 552.61 kB, gzip 164.07 kB |
| tests | 67개 파일 / 759개 PASS |
| assets | 119/119 |
| runtime | 74/74 |
| npm audit | 알려진 취약점 0 |
| launcher | 브라우저를 열지 않는 실제 smoke PASS |
| Windows Chromium | 정확한 1920×1080·2560×1600 combat 확인, overflow 0, console error 0 |
| 시각 확인 | ground/contact PASS, 마기 잔영과 영기 보상 의미 분리 PASS |

## 아직 닫히지 않은 게이트

- 전체 commercial visual gate는 **strict FAIL**입니다. 이번 접지·적/보상 의미 분리는 통과했지만 현재 build의 무치트 7분 전체 루프, 보스·결과 화면, 후반 전투 밀도와 안정성을 다시 통과해야 합니다.
- rights audit는 **BLOCKED**입니다. 법적 증거가 확인된 runtime asset은 0/74입니다.
- 따라서 release approval, A-grade, rights clearance, 공식 제출 승인을 선언하지 않습니다.

## 2026-08-11 직접 확인한 최신 품질 패스

- 초반 보라색 mote형 적을 authored `마기 잔영`으로 교체하고, 보상 영기는 회전하는 청록 결정 실루엣으로 분리했습니다.
- 주인공과 겹치는 순간에는 마기 잔영 시각 alpha만 낮춰 주인공을 읽히게 했고, 충돌·피해·경로 시뮬레이션은 바꾸지 않았습니다.
- 실제 1920×1080과 2560×1600 Chrome 프레임에서 적/보상/주인공의 역할 분리와 레이아웃을 루트가 직접 판정했습니다. 자동화 탭의 진단 FPS는 호출 간 throttling 영향을 받으므로 안정 60 FPS 증거로 사용하지 않습니다.

다음 작업은 [TODO.md](TODO.md)의 첫 실제 미완료 항목부터 진행합니다.
