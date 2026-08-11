# 영허검가 현재 상태

기준일: 2026-08-12
브랜치: `agent/yeongheo-starfall-quality-pass`

## production 진실

- 현재 active runtime은 PixiJS 2D입니다(`src/main.js` → `src/runtime2d/Game2D.js`).
- Three.js/GLB/TRELLIS 결과는 legacy 개발·자산 QA 증거이며 production 전투가 사용하는 active 3D 모델이 아닙니다.
- WorldClaw는 지역/공유 레이아웃/접점 QA만 선택적으로 적용했습니다. 전체 3D 포트나 파노라마 전환은 하지 않았습니다.

## 현재 검증 기준

| 영역 | 현재 판정 |
|---|---|
| build | PASS; Game2D 554.86 kB, gzip 164.81 kB |
| tests | 67개 파일 / 761개 PASS |
| runtime assets | 74/74, source/output 누락 0, unexpected 0 |
| npm audit | 알려진 취약점 0 |
| launcher | 브라우저를 열지 않는 실제 smoke PASS |
| 7분 Windows Chrome E2E | 1920×1080 무치트 전체 루프 runtime/performance PASS, console error/warning/page error 0 |
| 2560×1600 확인 | 결과 화면 focused runtime에서 overflow 0, console/page error 0 |
| 시각 확인 | 결과 화면 결함과 `화염부` 평면 스탬프 결함 PASS; 전체 commercial visual gate는 계속 FAIL |

## 아직 닫히지 않은 게이트

- 전체 commercial visual gate는 **strict FAIL**입니다. 무치트 7분 전체 루프·결과 화면·`화염부` 투사체는 통과했지만, 후반의 동일 포즈 적 반복과 영기 보상 과밀이 전투 가독성과 제작 품질을 크게 깎습니다.
- rights audit는 **BLOCKED**입니다. 법적 증거가 확인된 runtime asset은 0/74입니다.
- 따라서 release approval, A-grade, rights clearance, 공식 제출 승인을 선언하지 않습니다.

## 2026-08-12 직접 확인한 최신 품질 패스

- immutable run `yeongheo-e2e-20260812-011322-009e0c8-r2`에서 title→전투→도 선택→성장→중간 보스→진화→POI→최종 보스→승리→재시작을 실제 7분 동안 검증했습니다. 시간 점프·피해 무효화·강제 보스/레벨/스트레스 호출은 사용하지 않았습니다.
- build identity는 commit `009e0c895edb3c4cb492f14641a493c82a6916e2`, dist manifest `3e699bc61d66b21d33b3cd3a2d0793c1d38140e13608ee6ab0fef6c145771ae0`, Game2D chunk `assets/Game2D-BmxGK81U.js` / `4da30776efda2d7cdab4089c36ef8393ddb7be5159f61da47d546f3fee80cdab`입니다.
- 실제 결과는 대승 37층, 처치 2930, 획득 영석 404이며 재시작 후 seed `3185791507`→`2590068845`, 3.718 world units 이동을 확인했습니다.
- RTX 5070 Laptop GPU WebGL2에서 600 samples, rolling FPS 129.86, p95 interval 8.5 ms, work 2.6 ms, sim 0.6 ms, draw 2.6 ms, long task 0을 기록했습니다. console error/warning/page error도 모두 0입니다. 이는 해당 자동화 런의 성능 증거이며 전체 기기군 보장은 아닙니다.
- 첫 E2E 시도 `yeongheo-e2e-20260812-010300-009e0c8`의 WebGL context 상실은 게임 회귀가 아니라 임시 E2E 스크립트가 매 샘플마다 probe canvas/context를 새로 만든 하네스 결함이었습니다. 기존 게임 canvas의 context를 재사용하도록 임시 스크립트를 고친 뒤 동일 build에서 위 immutable rerun이 통과했습니다.
- 루트가 1920×1080 표준·후반·최종 보스 프레임과 2560×1600 focused 프레임을 직접 비교했습니다. `화염부`는 이동 방향이 읽히는 금빛 부적/혜성 실루엣으로 통과했으며, 다음 최우선 결함은 동일 적의 포즈·위상·외형 반복입니다. 영기 결정은 두 번째 우선순위로 실제 밀도를 먼저 측정합니다.

다음 작업은 [TODO.md](TODO.md)의 첫 실제 미완료 항목부터 진행합니다.
