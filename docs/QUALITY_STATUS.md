# 영허검가 품질 기준선

이 문서는 자산을 계속 쌓기 전에 무엇이 실제 런타임에 연결됐고, 무엇이 아직 부족한지 기록하는 기준선입니다.

## 현재 실제 연결 상태

- `tools/img2threejs/`는 GitHub `img2threejs/img2threejs` 소스를 프로젝트 안에 vendoring한 실행 도구입니다.
- `src/art/generated/SeolryeongImg2ThreeBlockout.ts`는 ImageGen 기준 이미지와 ObjectSculptSpec에서 생성된 구조/소켓/재질 메타데이터 팩토리입니다.
- `src/art/SeolryeongImg2ThreeAdapter.js`가 위 팩토리를 플레이어 런타임 그래프에 연결하고, 보이는 전투 모델은 `src/art/HeroicModels.js`의 3D 프레젠테이션 셸이 담당합니다. 보이는 셸에도 img2threejs의 normal/roughness 채널을 적용하고, ImageGen v2 brocade를 실제 cloth map으로 연결했습니다.
- `src/world/SanctuaryCinematicSet.js`의 문루는 `JadeSanctuaryGateFactory.ts`를 구조 기준으로 연결하고, 현재 보이는 문루는 그 기준을 보강한 3D shell입니다. 제단 paver는 ImageGen 재질 `public/assets/materials/environment/jade-pavilion-stone-v1.png`를 실제 Three.js 메시에 사용합니다.
- ImageGen 재질 `public/assets/materials/characters/moon-silk-brocade-v2.png`는 설령의 보이는 robe/sleeve/panel 및 img2three 구조 모델의 silk material에 연결되어 있습니다.
- ImageGen 재질 `public/assets/materials/guardians/jade-void-armor-v1.png`는 근접 jade serpent와 sanctuary jade titan의 실제 PBR/toon material map에 연결되어 있습니다.
- 이번 패스에서 ImageGen 재질 `public/assets/materials/guardians/void-iron-scale-armor-v1.png`를 추가해 demon/ash raven 근접 모델의 robe/armor 표면에 실제 map으로 연결했습니다. 단순 참조 이미지가 아니라 `NearEnemyModels.js`의 near-detail material에서 로드됩니다.
- 교체로 끊긴 구형 `moon-silk-weave-v1.png`, `moon-silk-embroidered-v1.png`는 삭제하고 매니페스트를 13개 실제 파일과 일치시켰습니다. 새 파일은 `tools/asset-manifest.json`의 `source: imagegen` 항목으로 추적됩니다.

## 검수 결과

- 2026-08-07 현재 패스의 실제 브라우저 전투 프레임: 60 FPS, `work` 2.7~2.9 ms, `sim/draw` 0.0~0.2/2.5~2.7 ms, `dropped 0`, WebGL2. 전투 중 경지 선택을 열고 닫은 뒤에도 동일 범위를 유지했으며, 측정 HUD는 452~517 draws, 595,591~634,841 tris였습니다.
- 최신 실전 재검수는 `artifacts/img2threejs/seolryeong/character-model/review/refinement-runtime-playing-2026-08-07g.png`에 보존했습니다. 동적 로드 후 비경 진입 직전 근접 모델·장면·postprocess 셰이더를 타이틀 화면 아래에서 선컴파일해 워밍업 180.7 ms를 한 번 지불했고, 전투 진입 후 `60 FPS`, `work 2.9~3.3 ms`, `sim/draw 0.0~0.2/2.7~3.0 ms`, `dropped 0`, `warmup 180.7 ms`, WebGL2를 확인했습니다.
- `EnemyManager.prewarmNearDetailModels()`는 10개 근접 적 계열의 숨은 모델 루트를 전투 전 만들고, 렌더러 선컴파일 뒤 제거합니다. 실제 군중은 기존 InstancedMesh를 유지하고, 근접 8슬롯만 상세 모델을 사용하므로 매 프레임 모델 생성 비용을 추가하지 않습니다.
- 실제 플레이 경로도 확인했습니다: 비경 진입 → 청람비경 → 설령 한빙검파 → 전투/경지 선택 → 일시정지 → 포기 확인 → 좌화 결과 → 다시 도전 → 타이틀 복귀. 결과 화면에서도 60 FPS, `work` 2.9 ms, `dropped 0`을 확인했습니다.
- `npm test`: 31개 파일/459개 테스트 통과, `npm run build`: 통과. 초기 엔트리 청크는 3.12KB, 게임 본체는 `Game` 866KB로 지연 로드되며, `three-examples`는 21/237/344KB로 분리됐습니다. 초기 엔트리는 500KB 경고가 없지만 Game 청크 자체는 아직 경고가 남아 있으므로 번들 최적화는 미완료입니다. `npm run assets:audit`: 14개 자산/실파일 14개/오류 없음.
- 테스트/빌드/자산 감사는 별도로 실행해야 하며, 이 수치는 Windows 작업 관리자 전체 CPU 사용률을 보증하지 않습니다.
- ImageGen 기준 이미지와 게임플레이 프레임의 시각 비교는 현재 약 0.42로 기록되어 있습니다. 따라서 AAA 완료나 구조 패스 통과로 표시하지 않습니다.
- 캐릭터 img2threejs 파이프라인은 아직 `blockout`에 잠겨 있습니다. 실제 고품질 스키닝 GLB/GLTF가 생긴 것으로 오인하지 않도록 현재 팩토리는 구조 기준과 메타데이터 용도로 명시되어 있습니다.
- 근접 적 LOD는 8슬롯으로 늘렸고 stone/glacier/magma 계열에 어깨판·흉부 중심·칼라를 추가했습니다. 바깥 군중은 기존 GPU instancing을 유지해 상세도를 필요한 거리에서만 지불합니다.

## 다음 통과 조건

1. 설령 실루엣을 성인형으로 유지하면서 얼굴·머리 장식·소매·검·하단 패널의 비교 점수를 올립니다.
2. 기준 이미지와 UI가 겹치지 않는 실제 플레이 프레임으로 재검수합니다.
3. 캐릭터·적·제단의 각 보이는 자산을 실제 3D 렌더로 확인하고, F3의 draw/tri/work와 콘솔 오류를 함께 기록합니다.
4. 기준 이미지 비교가 임계값을 넘기기 전에는 `structural-pass`나 AAA 완료를 선언하지 않습니다.

개발용 캡처 환경 변수가 없는 일반 실행은 quality-pass PNG를 생성하지 않습니다. 캡처가 필요할 때만 명시적으로 켜고, 끝나면 서버를 하나만 남깁니다.
