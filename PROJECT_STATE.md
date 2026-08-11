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
| build | PASS; Game2D 557.72 kB, gzip 165.82 kB |
| tests | 67개 파일 / 767개 PASS |
| runtime assets | 74/74, source/output 누락 0, unexpected 0 |
| npm audit | 알려진 취약점 0 |
| launcher | 브라우저를 열지 않는 실제 smoke PASS |
| 7분 Windows Chrome E2E | 이전 checkpoint `009e0c8`에서 1920×1080 무치트 전체 루프 runtime/performance PASS; 현재 `4c59057`은 전체 7분 재검증 필요 |
| 2560×1600 확인 | 현재 `4c59057`의 3분 42초 자소신뢰 focused runtime에서 overflow 0, console/page error 0 |
| 시각 확인 | 결과 화면·`화염부`·영체 반복·영기 과밀·뇌령주·자소신뢰 과밀 focused 결함 PASS; 전체 commercial visual gate는 계속 FAIL |

## 아직 닫히지 않은 게이트

- 전체 commercial visual gate는 **strict FAIL**입니다. 영체 적 반복·영기 보상 과밀·뇌령주/자소신뢰 표현은 focused 실플레이에서 개선을 확인했지만, 흑의 수사·거대 석괴가 같은 포즈로 군집하는 새 반복 결함, 현재 checkpoint의 전체 7분 회귀, 겹치는 발밑 법진/공전 효과의 의미·접지 가독성 검증이 남았습니다.
- rights audit는 **BLOCKED**입니다. 법적 증거가 확인된 runtime asset은 0/74입니다.
- 따라서 release approval, A-grade, rights clearance, 공식 제출 승인을 선언하지 않습니다.

## 2026-08-12 직접 확인한 최신 품질 패스

- 현재 focused checkpoint는 commit `85fb17c`입니다. `80a7569`의 4×2 authored 영체 atlas·개체별 비동기 모션·60~120초 적 편성 다변화·영기 병합 패스에 이어, 뇌령주의 보라색 지그재그 셀을 compact thunder pearl로 교체했습니다.
- 루트가 실제 Windows Chrome 한 탭에서 1920×1080 2분 26초와 2560×1600 2분 29초까지 직접 이동·전투·성장 선택을 플레이했습니다. 시간·피해·레벨·보스를 쓰는 QA mutation은 사용하지 않았습니다.
- 동일 구간의 화면 내 pickup은 변경 전 185개에서 변경 후 127개로 감소했으며 보상 가치 보존을 위해 누적 경제 ledger는 Float64로 유지합니다. 영체·늑대·청사 실루엣이 함께 읽히고 오래된 영기가 전투선을 덮지 않아 두 focused 결함은 PASS로 판정했습니다.
- 해당 enemy/pickup focused build는 `assets/Game2D-DyLjsbkz.js` 556.22 kB / gzip 165.27 kB, SHA-256 `efd68d5151c41aabe97893d392b63c1e3784e4cf93352918f16afa665d1e45a4`였습니다. 전체 67개 파일 / 764개 테스트와 production build가 순차 통과했습니다.
- 2560×1600 focused 진단은 PixiJS WebGL2 / RTX 5070 Laptop GPU, rolling FPS 111.61, p95 interval 8.5 ms, work 1.8 ms, sim 0.4 ms, draw 1.5 ms, overflow x/y 0, console error/warning 0이었습니다. resize/자동화가 포함된 long task 3건은 숨기지 않으며, 현재 전체 7분 성능 PASS 근거로 사용하지 않습니다.
- 실제 캡처는 `output/playwright/enemy-pickup-pass-20260812-0206/01-1920x1080-02m26s.png`, `output/playwright/enemy-pickup-pass-20260812-0206/02-2560x1600-02m29s.png`에 분리 보존했습니다.
- 루트가 새 build를 실제 Chrome 한 창·한 탭에서 시작해 정상 성장 선택으로 31초에 Lv.1 뇌령주를 습득했습니다. 1920×1080과 2560×1600에서 여러 공전 세트가 움직이는 장면을 직접 확인했으며 시간·피해·무기·레벨 상태를 쓰는 QA mutation은 사용하지 않았습니다.
- 뇌령주는 설명과 일치하는 둥근 영주 실루엣으로 읽히고, 이전 보라색 낙서 고리는 재현되지 않았습니다. 전투 DPS·재시전·공전 수명은 이번 시각 수정에서 보존했습니다.
- 2560×1600 진단은 Chrome 151 / PixiJS WebGL2 / RTX 5070 Laptop GPU, overflow x/y 0, console error/warning 0, rolling FPS 117.27, p95 interval 8.4 ms, work 1.7 ms, sim 0.4 ms, draw 1.4 ms였습니다. resize/자동화가 포함된 long task 2건은 전체 7분 성능 PASS 근거로 사용하지 않습니다.
- 뇌령주 캡처는 `output/playwright/thunder-orb-root-20260812-0220/01-1920x1080-orb.png`, `output/playwright/thunder-orb-root-20260812-0220/03-2560x1600-orb.png`에 보존했습니다.
- 루트가 `0940708`에서 새 전체 런을 직접 진행해 title→성장→검맥 3/3→중간 보스 처치→자소신뢰 진화→최종 보스→패배→재시작까지 확인했습니다. 다만 결과 화면 캡처를 놓쳤고 승리하지 못했으므로 이 런을 현재 E2E PASS로 사용하지 않습니다. 이 런의 5분 42초 프레임에서 40개가 넘는 자소신뢰 구슬이 캐릭터·보스·회피 공간을 가리는 결함을 직접 발견했습니다.
- commit `4c59057`은 충돌·피해를 담당하는 모든 공전 투사체는 그대로 유지하고, 렌더러만 무기별 최대 14개의 각도 분산 대표 구슬을 고르는 최소 수정입니다. 여러 공전 무기가 동시에 존재할 때도 각 그룹의 예산이 독립적으로 적용되도록 회귀 검사를 포함했습니다.
- 루트가 실제 Chrome 한 창·한 탭에서 시간·피해·무기·레벨 상태를 쓰는 QA mutation 없이 3분 42초까지 이동·전투·성장 선택을 진행해 뇌령주 Lv.5와 영근을 획득하고 자소신뢰로 정상 진화했습니다. 2560×1600 프레임에서 자소신뢰 simulation body 111개가 존재해도 구슬은 최대 14개만 분산 표시되어 주인공·적·회피 공간이 다시 읽혔습니다.
- 자소신뢰 캡처는 `output/playwright/orbit-cap-root-20260812-0255/02-1920x1080-violet-thunder-live.png`, `output/playwright/orbit-cap-root-20260812-0255/02-2560x1600-violet-thunder-live.png`에 보존했습니다. 실패한 모달 캡처와 임시 자동화 스크립트는 삭제했습니다.
- 2560×1600 진단은 Chrome 151 / PixiJS WebGL2 / RTX 5070 Laptop GPU, overflow x/y 0, console error/warning 0, rolling FPS 129.03, p95 interval 8.6 ms, work 2.0 ms, sim 0.5 ms, draw 1.6 ms, long task 0이었습니다. 이는 focused 구간의 근거이며 전체 7분 성능 PASS로 확대하지 않습니다.
- 최신 production build는 `assets/Game2D-t6IRSWr2.js` 557.72 kB / gzip 165.82 kB, SHA-256 `669230218dfadcf011958f800807d0842d6a5b3d44e9a21e62e151f67646afc7`이며 전체 67개 파일 / 767개 테스트와 build가 순차 통과했습니다.

## 이전 build의 7분 전체 루프 증거

- immutable run `yeongheo-e2e-20260812-011322-009e0c8-r2`에서 title→전투→도 선택→성장→중간 보스→진화→POI→최종 보스→승리→재시작을 실제 7분 동안 검증했습니다. 시간 점프·피해 무효화·강제 보스/레벨/스트레스 호출은 사용하지 않았습니다.
- build identity는 commit `009e0c895edb3c4cb492f14641a493c82a6916e2`, dist manifest `3e699bc61d66b21d33b3cd3a2d0793c1d38140e13608ee6ab0fef6c145771ae0`, Game2D chunk `assets/Game2D-BmxGK81U.js` / `4da30776efda2d7cdab4089c36ef8393ddb7be5159f61da47d546f3fee80cdab`입니다.
- 실제 결과는 대승 37층, 처치 2930, 획득 영석 404이며 재시작 후 seed `3185791507`→`2590068845`, 3.718 world units 이동을 확인했습니다.
- RTX 5070 Laptop GPU WebGL2에서 600 samples, rolling FPS 129.86, p95 interval 8.5 ms, work 2.6 ms, sim 0.6 ms, draw 2.6 ms, long task 0을 기록했습니다. console error/warning/page error도 모두 0입니다. 이는 해당 자동화 런의 성능 증거이며 전체 기기군 보장은 아닙니다.
- 첫 E2E 시도 `yeongheo-e2e-20260812-010300-009e0c8`의 WebGL context 상실은 게임 회귀가 아니라 임시 E2E 스크립트가 매 샘플마다 probe canvas/context를 새로 만든 하네스 결함이었습니다. 기존 게임 canvas의 context를 재사용하도록 임시 스크립트를 고친 뒤 동일 build에서 위 immutable rerun이 통과했습니다.
- 루트가 1920×1080 표준·후반·최종 보스 프레임과 2560×1600 focused 프레임을 직접 비교했습니다. `화염부`는 이동 방향이 읽히는 금빛 부적/혜성 실루엣으로 통과했습니다. 이 증거는 이전 build의 전체 루프 안정성 근거이며 현재 `80a7569`의 전체 7분 회귀 승인으로 재사용하지 않습니다.

다음 작업은 [TODO.md](TODO.md)의 첫 실제 미완료 항목부터 진행합니다.
