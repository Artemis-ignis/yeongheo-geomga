# 영허검가 품질 기준선

> **현재 경계 (2026-08-12):** production 출품 경로는 PixiJS 2D입니다. 아래 Three.js/GLB/TRELLIS 수치와 캡처는 legacy 3D 개발·자산 QA 이력이며 현재 production 전투가 사용하는 active 3D 경로나 최신 테스트 수치가 아닙니다.

이 문서는 자산을 계속 쌓기 전에 무엇이 실제 런타임에 연결됐고, 무엇이 아직 부족한지 기록하는 기준선입니다.

## 현재 production 2D 검증 스냅샷

- build PASS: Game2D 564.65 kB, gzip 167.64 kB. 번들 warning 정리는 아직 남아 있습니다.
- tests PASS: 67개 파일/775개 테스트. assets PASS: 127/127. runtime PASS: 78/78. `npm audit` 알려진 취약점 0.
- `YEONGHEO_NO_BROWSER=1` launcher 실제 smoke PASS.
- Windows Chromium 정확한 1920×1080·2560×1600 title/combat·level-up DOM 확인, console error 0. title visual PASS와 최신 enemy contact PASS를 별도로 기록했습니다.
- 전체 commercial visual은 **strict FAIL**입니다. 반복 지면 장판·악귀 수사·일반 늑대 군집의 focused 결함은 닫았지만, `ashRaven`의 늑대 실루엣 재사용과 새 build의 후반 전체 군집 회귀가 남았습니다.
- WorldClaw는 지역/공유 레이아웃/접점 QA에만 선택적으로 적용했습니다. 전체 3D 포트나 파노라마 전환은 하지 않았습니다.
- rights audit는 **BLOCKED**이며 법적 증거는 0/78입니다. release approval, A-grade, rights clearance를 선언하지 않습니다.

- `4be14c6`에서 일반 늑대에 기존 푸른 장꼬리 룬 늑대와 구분되는 숯빛 짧은 꼬리·비취 등마루 4×2 이동/공격 아틀라스를 추가했습니다. 루트가 실제 Chrome과 정확한 1920×1080·2560×1600 집중 프레임에서 분배·접지·그림자·주인공 가시성·크로마 경계를 직접 확인해 이 focused 결함만 PASS로 판정했습니다.

## legacy 3D 개발·자산 QA 연결 상태

- `tools/img2threejs/`는 GitHub `img2threejs/img2threejs` 소스를 프로젝트 안에 vendoring한 실행 도구입니다.
- `src/art/generated/SeolryeongImg2ThreeBlockout.ts`는 ImageGen 기준 이미지와 ObjectSculptSpec에서 생성된 구조/소켓/재질 메타데이터 팩토리입니다.
- `src/art/SeolryeongImg2ThreeAdapter.js`가 위 팩토리와 GitHub 공식 파이프라인의 결과를 legacy 3D 개발·검수 그래프에 연결합니다. ImageGen v4 4방향 turnaround를 공식 `integrations/mesh3d/generate_reference_mesh.py`의 TRELLIS 멀티뷰 입력으로 넣어 `seolryeong-trellis-v4.glb`를 만들었지만, 이 66,087-triangle GLB는 legacy 3D QA 화면에서만 보입니다. 현재 production 2D 전투는 이 GLB를 로드하지 않습니다.
- 최신 ImageGen 캐릭터 기준 `public/assets/characters/seolryeong-character-reference-v3.png`는 `artifact-template-yeongheo-aaa-asset-brief` 기준으로 생성·고립 배경 제거·참조 admission을 거쳤습니다. 타이틀/선택 화면에 실제 표시하고, `HeroicModels.js`의 성인형 실루엣·얼굴·머리 장식·검·robe 분할을 이 기준으로 authoring했습니다. v3의 공식 img2three ObjectSculptSpec은 아직 strict structural/material pass 전이므로 런타임 factory로 과장하지 않고, 기존 공식 구조 factory와 보이는 presentation shell을 분리해 기록합니다.
- `public/assets/characters/seolryeong-turnaround-v4.png`는 ImageGen으로 생성한 front/three-quarter/side/back 기준이며, `artifacts/img2threejs/seolryeong/character-model-v4/turnaround/`에 네 시점 crop을 정리했습니다. TRELLIS 결과는 생성형 proxy이므로 원화와 실제 브라우저 렌더를 대조한 뒤에만 런타임 승격했습니다.
- `src/world/SanctuaryCinematicSet.js`의 문루는 `JadeSanctuaryGateFactory.ts`를 구조 기준으로 연결하고, legacy 3D 개발 화면에서 보이는 문루는 그 기준을 보강한 3D shell입니다. 제단 paver는 ImageGen 재질 `public/assets/materials/environment/jade-pavilion-stone-v1.png`를 실제 Three.js 메시에 사용합니다.
- ImageGen 재질 `public/assets/materials/characters/moon-silk-brocade-v2.png`는 설령의 보이는 robe/sleeve/panel 및 img2three 구조 모델의 silk material에 연결되어 있습니다.
- ImageGen 재질 `public/assets/materials/guardians/jade-void-armor-v1.png`는 근접 jade serpent와 sanctuary jade titan의 실제 PBR/toon material map에 연결되어 있습니다.
- 이번 패스에서 ImageGen 재질 `public/assets/materials/guardians/void-iron-scale-armor-v1.png`를 추가해 demon/ash raven 근접 모델의 robe/armor 표면에 실제 map으로 연결했습니다. 단순 참조 이미지가 아니라 `NearEnemyModels.js`의 near-detail material에서 로드됩니다.
- ImageGen으로 만든 `public/assets/characters/void-iron-scale-sentinel-reference-v2.png`는 `artifacts/img2threejs/void-iron-scale-sentinel-v2/isolated-reference.png`와 별도로 보존하고, 공식 img2threejs admission·PBR 추출을 거쳤습니다. 원본의 검은 배경은 admission이 거부했기 때문에 성공으로 처리하지 않았고, 분리된 기준만 파이프라인에 넣었습니다.
- 공식 img2threejs PBR 결과의 AO·height·normal·roughness 채널을 `public/assets/materials/img2three/void-iron-scale_*.png`로 복사해 `NearEnemyModels.js`의 근접 갑주 material에 연결했습니다. extracted portrait albedo는 얼굴을 갑주에 투영하지 않고 audit evidence로 남겼으며, ImageGen의 반복 가능한 armor tile을 albedo로 사용합니다.
- `buildDemonCultivator()`는 위 기준을 참조하는 실제 근접 3D hierarchy로 교체됐습니다. 각진 helm, cyan eye slit/chest core, layered shoulder/waist plates, cloth mantle, hooked polearm을 분리하고, 바깥 군중은 기존 instancing을 유지합니다. `near-sheet.html`은 이 런타임 factory를 직접 띄우는 개발 검수 화면입니다.
- 이번 영웅 패스에서는 `src/art/HeroicModels.js`의 설령 쉘을 다시 리팩터링했습니다. 단순 Lathe 원통 대신 주름을 가진 연속 robe 표면, 베벨된 shoulder/chest/boot plate, 축소한 허리 장식, 3D 두께가 있는 robe layer, 비율을 바로잡은 검과 손잡이 래핑, 곡면 draped ribbon 하체 패널, 넓은 뒤 머리카락 curtain, 눈·눈썹·코·입 relief와 따뜻한 피부 분리를 사용합니다. `hero-sheet.html`과 `src/dev/heroModelSheet.js`는 이 모델을 정면·회전으로 검사하는 단일 개발용 QA 표면이며, 품질-pass PNG를 생성하지 않습니다.
- strict img2threejs sculpt gate는 아직 통과하지 않았습니다. 공식 factory는 legacy 3D QA 그래프에 구조/소켓 기준으로 숨겨 연결하고, legacy 3D에서 보이는 영웅은 ImageGen 멀티뷰를 TRELLIS로 변환한 GLB를 사용합니다. 현재 production 2D 전투의 적·영웅은 이 GLB 경로가 아니며, AAA/고품질 skinned GLB로 표시하지 않습니다.
- 교체로 끊긴 구형 `moon-silk-weave-v1.png`, `moon-silk-embroidered-v1.png`는 정리했고, 새 기준 자산은 `tools/asset-manifest.json`의 `source: imagegen` 또는 `source: img2threejs` 항목으로 추적합니다. 최종 실파일 수는 별도 `assets:audit` 결과로 확인합니다.

## 검수 결과

- 2026-08-07 ImageGen v4/TRELLIS GLB 승격 후 실제 브라우저 전투 프레임은 `60 FPS / 16.7 ms`, `work 2.5 ms`, `sim/draw 0.0/2.5 ms`, `dropped 0`, WebGL2였습니다. 일반 전투는 50 enemies / 732,009 tris, level-up은 48 enemies / 712,837 tris / 30 FPS, pause는 54 enemies / 733,153 tris / 30 FPS로 확인했습니다. 이는 게임 내부 렌더 계측이며 Windows 작업 관리자 전체 CPU 사용률을 대신하지 않습니다.
- 지연 로딩 적용 후 legacy 3D 개발 경로에서 새로고침 → 비경 진입 → 청람비경 → 설령 → 전투를 다시 실행했습니다. F3 계측에서 `60 FPS / 16.7 ms`, `work 3.0 ms`, `sim/draw 0.2/2.8 ms`, `54 enemies`, `742,449 tris`, `dropped 0`, `WebGL2`, `warmup 197.9 ms`를 확인했고 브라우저 오류/경고는 0건이었습니다. 전투 중앙에는 v4 TRELLIS GLB 설령이 표시됩니다. 이는 legacy 개발 QA이며 현재 production 2D 전투의 증거가 아닙니다.
- legacy 3D 최신 런타임 재검증에서는 전투가 `60 FPS / 16.7 ms`, `work 3.4 ms`, `sim/draw 0.3/3.1 ms`, `58 enemies`, `654,847 tris`, WebGL2로 유지됐습니다. level-up은 `30 FPS / 33.4 ms`, `619,251 tris`, steady pause는 `30 FPS / 33.3 ms`, `605,989 tris`로 제한됐습니다. 이 수치는 현재 production 2D 전투나 Windows 작업 관리자 전체 CPU 사용률을 대신하지 않습니다.
- v2 근접 적 변경 후 실제 전투도 다시 통과했습니다: 00:12~00:19 구간에서 `59~60 FPS`, `work 2.7~3.1 ms`, `sim/draw 0.0~0.1/2.7~3.1 ms`, `dropped 0`, `WebGL2`, `611,251~641,399 tris`, `48~54 enemies`, `warmup 239.7 ms`를 확인했습니다. 이는 게임 내부 계측이며 Chrome/Windows 작업 관리자 전체 CPU 사용률의 증명이 아닙니다.
- Void-Iron v2 개발 검수 화면에서 실제 `buildDemonCultivator()`를 정면·회전 프레임으로 확인했습니다. 새 geometry와 AO/height/normal/roughness 연결 뒤 화면 오류는 없었지만, 기준 이미지보다 갑주가 단순하고 일부 판금이 장난감처럼 읽히는 시각 차이가 남아 있어 AAA 통과로 기록하지 않습니다.
- 이전 기준선은 `artifacts/img2threejs/seolryeong/character-model/review/refinement-runtime-playing-2026-08-07g.png`에 보존했습니다. 이번 영웅 shell 보강 전에는 워밍업 180.7 ms, `work 2.9~3.3 ms`였습니다.
- 이번 v3 reference/shell/framing 패스의 실제 캡처는 로컬 QA 세션에서 전투 00:19, `60~61 FPS`, `work 4.0~4.4 ms`, `dropped 0`, `warmup 248.2 ms`, WebGL2로 확인했습니다. 새 geometry 때문에 워밍업과 draw 비용이 늘었으므로, 다음 패스에서 근접 상세 슬롯과 쉐이더 비용을 다시 줄여야 합니다.
- `EnemyManager.prewarmNearDetailModels()`는 10개 근접 적 계열의 숨은 모델 루트를 전투 전 만들고, 렌더러 선컴파일 뒤 제거합니다. 실제 군중은 기존 InstancedMesh를 유지하고, 근접 8슬롯만 상세 모델을 사용하므로 매 프레임 모델 생성 비용을 추가하지 않습니다.
- 실제 플레이 경로도 확인했습니다: 비경 진입 → 청람비경 → 설령 한빙검파 → 전투/경지 선택 → 일시정지 → 포기 확인 → 좌화 결과 → 다시 도전 → 타이틀 복귀. 결과 화면에서도 60 FPS, `work` 2.9 ms, `dropped 0`을 확인했습니다.
- 발열 방어를 위해 `src/core/Game.js`는 플레이 중에만 60Hz를 사용하고, title/level-up/pause는 30Hz로 렌더링합니다. `document.hidden`인 탭은 렌더를 즉시 건너뛰므로 다른 탭에 남은 게임이 GPU를 계속 점유하지 않습니다. 시뮬레이션은 기존대로 일시정지되며, 음소거 상태는 변경하지 않습니다.
- `npm test`: 31개 파일/459개 테스트 통과, `npm run build`: 통과. GLTFLoader는 지연 import로 분리되어 초기 앱 엔트리는 `2.00KB`(+ preload/loader `1.28KB`)이고, Game 본체는 `880.77KB`입니다. `three-examples`는 `65/257/344KB`로 분리됐습니다. Game 청크 자체의 500KB 경고는 남아 있으므로 번들 최적화는 미완료입니다. 최신 `npm run assets:audit`는 manifest 22개/실파일 22개/오류 없음입니다.
- 테스트/빌드/자산 감사는 별도로 실행해야 하며, 이 수치는 Windows 작업 관리자 전체 CPU 사용률을 보증하지 않습니다.
- ImageGen 기준 이미지와 게임플레이 프레임의 시각 비교는 현재 약 0.42로 기록되어 있습니다. 따라서 AAA 완료나 구조 패스 통과로 표시하지 않습니다.
- 캐릭터의 기존 ObjectSculpt factory는 여전히 `blockout` 구조 기준으로 기록되어 있습니다. 이 TRELLIS GLB는 legacy 3D 브라우저 경로의 멀티뷰 생성형 proxy이며, 현재 PixiJS 2D 출품 화면의 적용 완료를 뜻하지 않습니다. 스켈레톤/애니메이션/수동 토폴로지 검수까지 끝난 AAA 최종 에셋도 아닙니다.
- 근접 영웅 시트의 실제 화면 검수에서는 ImageGen 기준의 어두운 헤어, 청백 실크, 검, 옥 장식, 따뜻한 피부 대비와 3D 회전이 읽힙니다. 다만 얼굴 비율·머리카락/의상 접합과 재질의 고급감은 아직 stylized procedural 수준입니다. 따라서 이번 패스도 AAA 완료나 `structural-pass` 통과로 기록하지 않습니다.
- 근접 적 LOD는 8슬롯으로 늘렸고 stone/glacier/magma 계열에 어깨판·흉부 중심·칼라를 추가했습니다. 바깥 군중은 기존 GPU instancing을 유지해 상세도를 필요한 거리에서만 지불합니다.

## 다음 통과 조건

1. TRELLIS GLB에 스켈레톤/idle·attack 애니메이션 또는 수동 리토폴로지 패스를 추가해 정적 proxy를 최종 캐릭터 에셋으로 승격합니다.
2. 최신 카메라 프레이밍으로 얼굴과 HUD가 겹치지 않는 실제 플레이 프레임을 유지하며 다시 검수합니다.
3. 캐릭터·적·제단의 각 보이는 자산을 실제 3D 렌더로 확인하고, F3의 draw/tri/work와 콘솔 오류를 함께 기록합니다.
4. Void-Iron 근접 적은 얼굴·어깨판·허리 스케일·폴암의 형태 차이를 줄이고, 회전 프레임에서 평면·부유·관절 틈을 다시 검사합니다.
5. 기준 이미지 비교가 임계값을 넘기기 전에는 `structural-pass`나 AAA 완료를 선언하지 않습니다.

개발용 캡처 환경 변수가 없는 일반 실행은 quality-pass PNG를 생성하지 않습니다. 캡처가 필요할 때만 명시적으로 켜고, 끝나면 서버를 하나만 남깁니다.
