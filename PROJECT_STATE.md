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
| build | PASS; Game2D 564.65 kB, gzip 167.64 kB |
| tests | 67개 파일 / 775개 PASS |
| runtime assets | 78/78, source/output 누락 0, unexpected 0 |
| npm audit | 알려진 취약점 0 |
| launcher | 브라우저를 열지 않는 실제 smoke PASS |
| 7분 Windows Chrome E2E | 현재 `6516321`에서 1920×1080 무치트 전체 루프와 2560×1600 결과·재시작 PASS |
| 2560×1600 확인 | 현재 `6516321` 결과 화면·재시작에서 overflow 0, console/page error 0 |
| 시각 확인 | 결과 화면·`화염부`·영체 반복·영기 과밀·뇌령주·자소신뢰 과밀·석괴·부적 원혼·악귀 수사·일반 늑대 반복·공전 구슬·타격 섬광·지속 장판 겹침/기울기·보스 전조 공존 focused 결함 PASS; `ashRaven`의 늑대 실루엣 재사용과 전체 commercial visual gate는 계속 FAIL |

## 아직 닫히지 않은 게이트

- 전체 commercial visual gate는 **strict FAIL**입니다. 지속 장판·악귀 수사·일반 늑대 반복 focused 결함은 닫혔지만, `ashRaven`이 `yorang` 늑대 아틀라스를 재사용하는 종 의미 불일치와 새 build의 전체 군집 회귀가 남았습니다.
- rights audit는 **BLOCKED**입니다. 법적 증거가 확인된 runtime asset은 0/78입니다.
- 따라서 release approval, A-grade, rights clearance, 공식 제출 승인을 선언하지 않습니다.

## 2026-08-12 직접 확인한 최신 품질 패스

- commit `4be14c6`은 일반 늑대 군중에 기존 푸른 장꼬리 룬 늑대와 명확히 다른 숯빛 짧은 꼬리·비취 등마루 사냥개 4×2 authored 이동/공격 아틀라스를 추가했습니다. 기존 종·AI·충돌·체력·피해·스폰 수는 보존하고, UID 기반 저불일치 Weyl 분배로 실제 흔한 stride 2~7에서도 두 실루엣이 4:6~6:4 안에 유지되게 했습니다.
- 루트가 실제 Chrome과 정확한 headless Chrome의 72마리 집중 장면을 1920×1080·2560×1600에서 직접 확인했습니다. 기존 푸른 장꼬리와 새 숯빛 짧은 꼬리·비취 등마루가 약 절반씩 분리되고, 발 접지·그림자·주인공 가시성·크로마 경계가 읽혀 일반 늑대 단일 아틀라스 반복만 focused PASS로 판정했습니다. 유효 캡처는 `output/playwright/wolf-variant-root-20260812/07-wolf-crowd-1920.png`, `08-wolf-crowd-2560.png`입니다.
- 현재 production build는 `assets/Game2D-DZli1phQ.js` 564.65 kB / gzip 167.64 kB, SHA-256 `2c7bf17edcb6cd37689922a16ba9cc697ca7238e0930be98fa535ef963086ad2`입니다. 전체 67개 파일 / 775개 테스트, 런처 3/3, runtime allowlist 78개 / source·output 누락 0 / unexpected 0, 자산 매니페스트 127/127가 순차 확인됐습니다. 권리 감사는 의도대로 `0/78 BLOCKED`이며 500 kB 초과 번들 경고도 남습니다.
- 이번 focused 장면은 실루엣 검사용 제어 장면이며 이전 `6516321` 무치트 7분 전체 런을 대체하지 않습니다. 코드상 `ashRaven`이 여전히 `yorang` 늑대 아틀라스를 재사용하는 종 의미 불일치와 새 build의 무치트 7분 전체 회귀가 남아 전체 commercial visual gate와 release 승인은 계속 FAIL입니다.

- commit `7eae4df`은 악귀 수사 계열의 장병기 `voidSentinel` 하나만 반복되던 군집에, 비대칭 어깨 망토·쌍 갈고리 도를 가진 원본 4×2 이동/공격 아틀라스 `shadowSealDuelist`를 추가했습니다. 기존 AI·충돌·체력·피해·스폰 수는 보존하고 표현 아틀라스만 나눴습니다.
- 최초 일반 UID 해시는 실제 후반 로스터의 UID stride에서 9:1로 편향됐습니다. 루트가 이를 합격 처리하지 않고 동일 로스터를 직접 계측한 뒤, 저불일치 Weyl 순열로 바꿔 common stride 2~7과 실제 roster에서 안정적인 5:5 분배를 확인했습니다.
- 루트가 production build의 72마리 혼합 후반 군집을 1920×1080·2560×1600에서 직접 확인했습니다. 두 해상도 모두 화면 내 72/72, overflow x/y 0, console/page error 0이었고 장병기와 쌍단도 실루엣·발 접지·영웅 가시성이 분리되어 악귀 수사 반복 focused 결함만 PASS로 판정했습니다.
- 유효 캡처는 `output/playwright/mixed-late-root-20260812/07-mixed-balanced-1920.png`, `output/playwright/mixed-late-root-20260812/08-mixed-balanced-2560.png`입니다. 이 제어 장면은 실루엣 결함 검증용이며 기존 `6516321` 무치트 7분 전체 런을 대체하거나 섞지 않습니다.
- 해당 악귀 수사 checkpoint build는 `assets/Game2D-B6Z5wGxx.js` 563.84 kB / gzip 167.50 kB, SHA-256 `78a76ca20c31b20bf32bf5d281a209e5e4e520836ad7ac0637b80b6fec9491ae`입니다. 당시 전체 67개 파일 / 774개 테스트, runtime allowlist 77개 / source·output 누락 0 / unexpected 0, 자산 매니페스트 125/125가 순차 확인됐습니다.
- 이 시점의 푸른 늑대 단일 아틀라스 반복은 이후 `4be14c6`에서 focused PASS로 닫았습니다. 완료된 악귀 수사와 늑대 변형을 다시 구현하지 않습니다.

- commit `c9ce389`은 같은 법보의 깊게 겹친 지속 장판만 표현 단계에서 하나의 외곽으로 묶고, 실제 충돌·피해 틱을 담당하는 모든 시뮬레이션 장판은 보존합니다. 서로 다른 법보, 떨어진 장판, 도벽 segment는 합치지 않습니다. 이미 원근이 적용된 지면 타원은 화면 공간 회전을 제거해 방패처럼 기울지 않게 했습니다.
- 루트가 production build를 Windows Chrome 한 창·한 탭에서 직접 열어 12개의 실제 장판 판정체를 배치한 focused QA를 수행했습니다. 1920×1080·2560×1600 모두 simulation 12 / visual 1 / rotation 0, overflow x/y 0, console/page error 0이었습니다. 별도 공존 장면에서는 옥허진장의 radial 전조·보스 의도 표시와 장판이 동시에 활성화됐고, 큰 백색 외곽/회색 채움 위험 구역이 얇은 옥색 플레이어 장판보다 우선해서 읽혔습니다.
- 해당 focused 캡처는 `output/playwright/weapon-field-root-20260812/02-controlled-twelve-fields-1920.png`, `03-controlled-twelve-fields-2560.png`, `04-boss-field-coexist-1920.png`, `05-boss-field-coexist-2560.png`입니다. 이는 의도적인 집중 QA이며 아래 `6516321` 무치트 7분 전체 런을 대체하거나 섞지 않습니다.
- 현재 production build는 `assets/Game2D-bjem03DJ.js` 562.71 kB / gzip 167.27 kB, SHA-256 `5fb904936f1bc72cb0366bf30c8e35dbb1e18402fae6101328d90d907eedb231`입니다. 전체 67개 파일 / 773개 테스트, runtime allowlist 76개 / source·output 누락 0 / unexpected 0, 자산 매니페스트 123/123이 순차 확인됐습니다. 500 kB 초과 번들 경고와 권리 감사 `0/76 BLOCKED`는 계속 남습니다.
- 반복 장판과 보스 전조 공존 focused 결함은 닫혔지만, 동일 적이 후반 밀도에서 같은 색·크기·방향으로 뭉쳐 복제 스프라이트처럼 보이는 문제 때문에 전체 commercial visual gate와 release 승인은 계속 FAIL입니다.

- commit `7affb61`은 여러 공전 법보가 각자 렌더 예산을 가져 화면을 다시 채우던 결함을 전체 공유 예산 14개로 제한했습니다. commit `6516321`은 같은 원소의 근접 타격 섬광을 반경 2.6 안에서 병합하되 수명은 연장하지 않고 강도만 보강하며, 타격 효과 렌더 예산도 최대 14개로 제한했습니다. 충돌·피해·시뮬레이션 투사체·오디오는 보존했습니다.
- 루트가 exact commit `6516321` production build를 Windows Chrome 한 창·한 탭에서 `yeongheo-e2e-20260812-0603-6516321-r1`로 직접 검증했습니다. 시간 점프·피해 무효화·강제 보스·강제 레벨·stress 호출 없이 title→이동·전투→실제 성장 카드 선택→중간 보스→자소신뢰 진화와 뇌령주 재습득→최종 보스→07:00 승리→`같은 비경 다시 도전`→W 이동까지 이어졌습니다.
- 실제 결과는 대승 38층, 처치 2,987, 총 피해 519,494, 획득 영석 364입니다. 387.23초에는 자소신뢰 119개와 뇌령주 90개 등 227개 공전 시뮬레이션 바디가 남아 있어도 대표 렌더와 타격 섬광은 각각 33개·4개로 제한됐고, 420초 결과에서도 타격 섬광은 6개였습니다. 루트가 최종 보스 프레임을 원본 크기로 확인해 이전의 불투명한 보라색 덩어리가 재현되지 않아 해당 focused 결함만 PASS로 판정했습니다.
- 600 samples 기준 p95 interval 8.6 ms, long task 0, audio drop/preemption 0, overflow x/y 0, console error/warning/page error 0이었습니다. 이 수치는 해당 RTX 5070 Laptop GPU·Chrome build의 근거이며 전체 기기군 보장은 아닙니다.
- 실제 캡처는 `output/playwright/yeongheo-e2e-20260812-0603-6516321-r1/00-title-1920.png`, `01-first-combat-1920.png`, `05-final-boss-1920.png`, `06-victory-2560.png`, `07-restart-2560.png`만 보존했습니다. 레벨업 모달에 가린 잘못된 중간 캡처와 임시 자동화 스크립트는 삭제했습니다.
- 해당 전체 런 production build는 `assets/Game2D-DtJk1GKt.js` 561.24 kB / gzip 166.67 kB, SHA-256 `fff73c668a9447a442952e896e893abc7dd4d9ed5dedf7172983202ff75eafad`입니다. 전체 67개 파일 / 772개 테스트, runtime allowlist 76개 / 누락 0 / unexpected 0, 자산 매니페스트 123/123, 권리 감사의 의도된 `0/76 BLOCKED`가 순차 확인됐습니다.
- 이 전체 런에서 공전 구슬·타격 섬광 결함을 닫고 반복 지면 장판과 후반 적 군집 문제를 발견했습니다. 지면 장판은 위 `c9ce389` focused QA로 닫혔으며, 후반 적 군집 반복은 여전히 남습니다.

- commit `27142b1`은 흑의 부적 원혼 군집이 하나의 atlas를 반복하던 결함을 가면·비대칭 부적부채·짧은 장포 실루엣의 두 번째 4×2 authored 이동·공격 atlas로 보완했습니다. `talismanGhost`와 `snowWraith`의 기존 AI·충돌·체력·피해·편성은 보존하고 UID 기반으로 두 atlas를 안정적으로 나눕니다.
- 루트가 실제 Chrome 한 창·한 탭에서 시간·피해·무기·레벨을 직접 쓰는 QA mutation 없이 1920×1080 3분 35초와 2560×1600 3분 42초까지 이동·전투·성장 선택을 진행했습니다. 1920 프레임은 기존/가면 원혼 16/13, 2560 프레임은 22/23으로 나뉘며 실루엣·접지·프레임 잘림·크로마 잔여가 모두 읽혀 원혼 반복 결함만 focused PASS로 판정했습니다.
- 실제 캡처는 `output/playwright/enemy-mask-root-20260812/1920x1080-mask-live.png`, `output/playwright/enemy-mask-root-20260812/2560x1600-mask-live.png` 두 장만 보존했고, 생성 중간물과 임시 자동화 스크립트는 삭제했습니다.
- 2560×1600 focused 진단은 PixiJS WebGL2 / RTX 5070 Laptop GPU, 85 enemies·27 projectiles·123 pickups에서 rolling FPS 115.87, p95 interval 8.6 ms, work 2.3 ms, sim 0.5 ms, draw 1.9 ms, overflow x/y 0, console error/warning 0이었습니다. resize와 캡처가 포함된 long task 2건은 숨기지 않으며 전체 7분 성능 PASS로 확대하지 않습니다.
- 최신 production build는 `assets/Game2D-D143vKFW.js` 560.84 kB / gzip 166.53 kB, SHA-256 `ef0e0765eea0802b84fe6f3ef91dac3d9d2269e6da559d6cb49d3bea54fbe6f4`입니다. 전체 67개 파일 / 771개 테스트, runtime allowlist 76개 / 누락 0 / unexpected 0, 자산 매니페스트 123/123, 권리 감사의 의도된 `0/76 BLOCKED`가 순차 확인됐습니다.
- 루트의 직접 시각 판정에서 원혼 반복은 닫혔지만, 적 밀집 시 중심부 공격 이펙트가 주인공 하반신과 회피 공간을 가리는 순간이 남습니다. 따라서 전체 commercial visual gate와 release 승인은 계속 FAIL입니다.

- commit `2ec5061`은 215초 원소 고리 편성이 비경에 없는 `emberSprite`를 20마리 elite로 치환하던 실제 밸런스 버그를 같은 위협 등급·가장 가까운 HP 대체로 고쳤습니다. 정상 wave·AI·충돌은 보존했습니다.
- 같은 checkpoint에 비대칭 옥정 수호자 4×2 authored 이동·공격 atlas를 추가하고 기존 둥근 석괴와 UID 기반으로 안정적으로 혼합했습니다. 루트가 실제 전투 프레임을 원본 크기로 다시 본 결과, 1920×1080 4분 03초에는 석괴 16개가 8/8, 2560×1600 3분 56초에는 22개가 12/10으로 나뉘며 두 실루엣·발 접지·그림자·주인공 가시성이 읽혀 석괴 반복만 focused PASS로 판정했습니다.
- 실제 캡처는 `output/playwright/enemy-crowd-root-20260812-0321/1920x1080-crowd-variant-live.png`, `output/playwright/enemy-crowd-root-20260812-0321/2560x1600-crowd-variant-live.png` 두 장만 보존했고 임시 스크립트·중간 후보 이미지는 삭제했습니다.
- 같은 실제 실행에서 비동기 시작 중 숨은 타이틀 버튼이 Codex를 다시 띄워 `state=playing` 위에 메뉴가 남는 screen ownership 경쟁 조건을 발견했습니다. run 시작/정리 시 Shop·Codex를 callback 없이 숨기고, title handler를 `state=title`에만 허용했습니다. 의도적으로 loading 중 숨은 Codex 클릭을 재현해 최종 `playing/title hidden/codex hidden/shop hidden`을 확인했습니다.
- 2560×1600 focused 진단은 PixiJS WebGL2 / RTX 5070 Laptop GPU, 약 50 enemies·31 projectiles·107 pickups에서 rolling FPS 128.69, p95 interval 8.6 ms, work 1.9 ms, sim 0.5 ms, draw 1.4 ms, long task 0, overflow x/y 0, console error/warning 0이었습니다. 이는 focused 구간의 근거이며 전체 7분 성능 PASS로 확대하지 않습니다.
- 해당 stone checkpoint build는 `assets/Game2D-BPE_L9pn.js` 559.87 kB / gzip 166.33 kB, SHA-256 `c030abca197faf62f868bad1df6dc8f95cfcbb8150c4e553762fd07102647d4e`입니다. 전체 67개 파일 / 770개 테스트, runtime allowlist 75개 / 누락 0 / unexpected 0, 권리 감사의 의도된 `0/75 BLOCKED`가 순차 확인됐습니다.
- 루트의 직접 시각 판정에서 흑의 수사 군집은 여전히 같은 실루엣이 반복되고 중심부의 여러 원형 효과도 겹칩니다. 따라서 전체 commercial visual gate와 release 승인은 계속 FAIL입니다.

- 이전 뇌령주 focused checkpoint는 commit `85fb17c`입니다. `80a7569`의 4×2 authored 영체 atlas·개체별 비동기 모션·60~120초 적 편성 다변화·영기 병합 패스에 이어, 뇌령주의 보라색 지그재그 셀을 compact thunder pearl로 교체했습니다.
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
- 당시 production build는 `assets/Game2D-t6IRSWr2.js` 557.72 kB / gzip 165.82 kB, SHA-256 `669230218dfadcf011958f800807d0842d6a5b3d44e9a21e62e151f67646afc7`이며 전체 67개 파일 / 767개 테스트와 build가 순차 통과했습니다.

## 이전 build의 7분 전체 루프 증거

- immutable run `yeongheo-e2e-20260812-011322-009e0c8-r2`에서 title→전투→도 선택→성장→중간 보스→진화→POI→최종 보스→승리→재시작을 실제 7분 동안 검증했습니다. 시간 점프·피해 무효화·강제 보스/레벨/스트레스 호출은 사용하지 않았습니다.
- build identity는 commit `009e0c895edb3c4cb492f14641a493c82a6916e2`, dist manifest `3e699bc61d66b21d33b3cd3a2d0793c1d38140e13608ee6ab0fef6c145771ae0`, Game2D chunk `assets/Game2D-BmxGK81U.js` / `4da30776efda2d7cdab4089c36ef8393ddb7be5159f61da47d546f3fee80cdab`입니다.
- 실제 결과는 대승 37층, 처치 2930, 획득 영석 404이며 재시작 후 seed `3185791507`→`2590068845`, 3.718 world units 이동을 확인했습니다.
- RTX 5070 Laptop GPU WebGL2에서 600 samples, rolling FPS 129.86, p95 interval 8.5 ms, work 2.6 ms, sim 0.6 ms, draw 2.6 ms, long task 0을 기록했습니다. console error/warning/page error도 모두 0입니다. 이는 해당 자동화 런의 성능 증거이며 전체 기기군 보장은 아닙니다.
- 첫 E2E 시도 `yeongheo-e2e-20260812-010300-009e0c8`의 WebGL context 상실은 게임 회귀가 아니라 임시 E2E 스크립트가 매 샘플마다 probe canvas/context를 새로 만든 하네스 결함이었습니다. 기존 게임 canvas의 context를 재사용하도록 임시 스크립트를 고친 뒤 동일 build에서 위 immutable rerun이 통과했습니다.
- 루트가 1920×1080 표준·후반·최종 보스 프레임과 2560×1600 focused 프레임을 직접 비교했습니다. `화염부`는 이동 방향이 읽히는 금빛 부적/혜성 실루엣으로 통과했습니다. 이 증거는 이전 build의 전체 루프 안정성 근거이며 현재 `80a7569`의 전체 7분 회귀 승인으로 재사용하지 않습니다.

다음 작업은 [TODO.md](TODO.md)의 첫 실제 미완료 항목부터 진행합니다.
