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
| build | PASS; Game2D 553.76 kB, gzip 164.56 kB |
| tests | 67개 파일 / 760개 PASS |
| runtime assets | 74/74, source/output 누락 0, unexpected 0 |
| npm audit | 알려진 취약점 0 |
| launcher | 브라우저를 열지 않는 실제 smoke PASS |
| 7분 Windows Chrome E2E | 1920×1080 무치트 전체 루프 runtime/performance PASS, console error/warning/page error 0 |
| 2560×1600 확인 | 결과 화면 focused runtime에서 overflow 0, console/page error 0 |
| 시각 확인 | 결과 화면의 전투 잔상·내부 ID 노출·레이아웃 결함 PASS |

## 아직 닫히지 않은 게이트

- 전체 commercial visual gate는 **strict FAIL**입니다. 무치트 7분 전체 루프와 결과 화면 결함은 통과했지만, `화염부` 투사체가 붉은 주황색 평면 스탬프처럼 보이고 후반의 동일 포즈 적 반복·영기 보상 과밀이 전투 가독성과 제작 품질을 크게 깎습니다.
- rights audit는 **BLOCKED**입니다. 법적 증거가 확인된 runtime asset은 0/74입니다.
- 따라서 release approval, A-grade, rights clearance, 공식 제출 승인을 선언하지 않습니다.

## 2026-08-12 직접 확인한 최신 품질 패스

- immutable run `yeongheo-e2e-20260812-003100-85a81c8`에서 title→전투→도 선택→성장→중간 보스→진화→최종 보스→승리→재시작을 실제 7분 동안 검증했습니다. 시간 점프·피해 무효화·강제 보스/레벨/스트레스 호출은 사용하지 않았습니다.
- build identity는 commit `85a81c843f17d0a137bbbb9759945a0df2db58bc`, dist manifest `8193d58be3356db9937920cf5f2fce1f4be4e20eb7edff13340023c599c2f81a`, Game2D chunk `assets/Game2D-XxloffMq.js` / `4cb0c4fd87655dd4c44c61e1f5319ad4f2e9e3b95ca934ea703b337a8e3f9e2d`입니다.
- 실제 결과는 대승 38층, 처치 2919, 획득 영석 416이며 재시작 후 seed가 바뀌고 3.718 world units 이동했습니다.
- RTX 5070 Laptop GPU WebGL2에서 600 samples, rolling FPS 129.68, p95 work 2.4 ms, sim 0.6 ms, draw 2.0 ms, long task 0을 기록했습니다. 이는 해당 자동화 런의 성능 증거이며 전체 기기군 보장은 아닙니다.
- 루트가 실제 프레임을 직접 재검토한 결과, 다음 최우선 결함은 디버그 표식이 아니라 이동 방향과 맞지 않는 세워진 불꽃 실루엣의 `화염부` 투사체임을 확인했습니다.

다음 작업은 [TODO.md](TODO.md)의 첫 실제 미완료 항목부터 진행합니다.
