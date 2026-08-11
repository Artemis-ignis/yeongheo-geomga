# 챌린지 기간 변경 범위 — 기준 커밋 대비 delta

> **역사적 snapshot 주의:** 본문의 2026-08-09 65개/21개 자산 수치는 당시 기록입니다. 최신 source 116개, runtime 72개, release-v5.3 고정 산출물은 [RELEASE_V5_3_AUDIT_2026-08-10.md](./RELEASE_V5_3_AUDIT_2026-08-10.md)와 `ASSET_RIGHTS_LEDGER.md`를 우선합니다.

> 작품: 영허검가 / contest slice: 천겁의 맹세
> 기준 커밋: 351541c8acf64029d27c016612b0383e0c79a74d
> 기준 커밋 시각: 2026-08-07 13:11:55 +09:00
> 기준 커밋 메시지: Integrate ImageGen v3 Forge enemy assets
> 비교 기준: 2026-08-09 현재 작업 트리
> 상태: 제출 전 변경 범위 초안 / 사람의 챌린지 기간·저자 확인 전

이 문서는 기존 프로젝트 사용 요건을 위해 기준 커밋과 현재 작업 트리의
차이를 설명합니다. “현재 작업 트리에 있다”는 사실과 “챌린지 기간에 새로
개발했고 제출 범위에 포함한다”는 사실을 분리합니다.

현재 작업 트리는 여러 추적 수정, 미추적 소스·에셋·QA 파일이 섞인 dirty
checkout입니다. 고정된 현재 커밋, build_id, Codex 세션 ID가 없으므로 아래의
파일 목록은 변경 표면과 제품 분류를 위한 근거입니다. 각 항목의 실제 챌린지
기간, 기여자, 제출 포함 여부는 대표자가 작업 로그와 변경 시각을 대조해
확정해야 합니다.

## 0. 불변 식별자와 비교 경계

~~~text
baseline_commit: 351541c8acf64029d27c016612b0383e0c79a74d
current_revision: <미고정>
run_id: <미고정>
build_id: <미고정>
deployment_url: <미입력>
challenge_window: <사람이 공식 챌린지 기간과 실제 작업 로그로 확정>
~~~

비교에 사용한 사실:

- 기준 커밋의 tree와 현재 추적 파일 diff를 확인했습니다.
- 현재 미추적 파일은 runtime2d, test, docs, artifacts, public assets로
  범위를 나누어 확인했습니다.
- 현재 실행 결과는 npm test 51개 파일·590 tests passed, npm run build
  764 modules transformed, npm run assets:audit assetCount 65·actualFileCount
  65입니다.
- 이 문서 작성은 새로운 최종 run_id 또는 build_id를 만들지 않습니다.

### 분류 라벨

| 라벨 | 뜻 |
|---|---|
| DELTA-CANDIDATE | 기준 커밋에 없거나, 현재 contest 경로를 명확히 개선하는 변경. 제출 전 사람의 기간·권리 확인 필요 |
| RETAINED | 기준 커밋에 이미 있거나 현재도 보존되는 기존 기능. 신규 기능으로 주장하지 않음 |
| LEGACY | 현재 작업 트리에 남지만 contest production path가 아닌 기존 경로·확장 데이터 |
| PARTIAL | 모듈·계약·화면 일부는 존재하지만 실제 제품 흐름 또는 통합 승인이 없음 |
| EXCLUDED | 사용자 변경 또는 실험으로 보이지만 contest delta라고 확정할 근거가 부족해 변경 범위에서 제외 |

## 1. 기준 커밋의 출발점

기준 커밋의 README와 코드가 설명하는 출발점은 다음과 같습니다.

- Three.js WebGL2가 기본 production renderer였습니다.
- 게임은 anime-girl xianxia Vampire-Survivors-like로 설명되고, 한 런은
  15분 생존이었습니다.
- 세 명의 수사와 여러 법보·공법·진화가 있는 장기 캠페인형 범위였습니다.
- 기준 wave 데이터의 RUN_SECONDS는 900초이고, 요왕과 마존의 장시간
  boss schedule이 있었습니다.
- src/data/formations.js와 test/formations.test.js는 이미 기준 커밋에
  존재했습니다. formation 아이디어와 데이터 자체를 이번 챌린지 신규로
  주장하지 않습니다.
- src/art, src/world, src/entities, src/combat, src/audio, public/assets,
  public/models와 img2threejs authoring pipeline은 이미 대규모 3D 기반을
  이루고 있었습니다.
- 기준 커밋에는 src/runtime2d, docs/competition, docs/product,
  artifacts/2d-qa, runtime2d 전용 테스트가 없었습니다.
- 기준 커밋의 test 파일 수는 31개였습니다. 이는 현재 suite에 계속
  포함되는 기존 회귀 범위입니다.

따라서 이번 delta의 중심은 기존 3D 캠페인을 새 게임으로 교체했다는
주장이 아니라, 기존 프로젝트 위에 브라우저 contest용 PixiJS 2D 수직
슬라이스와 그 검증·제출 자료를 추가한 것입니다.

## 2. 한눈에 보는 baseline → current

| 영역 | 기준 커밋 | 현재 작업 트리 | delta 판정 |
|---|---|---|---|
| 제품 경험 | Three.js 15분 캠페인, 다수 캐릭터·법보·진화 | 천겁의 맹세 420초 목표, 설령 중심, 세 Dao Vow와 선택을 비추는 보스 | 제품 목표와 scope 문서가 새로 생김. 실제 런은 부분 구현 |
| production entry | src/main.js가 core/Game.js를 바로 로드 | Game2D/PixiJS를 기본으로 로드하고 Three.js는 DEV + renderer=3d | 명확한 renderer cutover candidate |
| 시간 계약 | RUN_SECONDS 900, 8분·15분 boss data | ContestPacing2D 420초, mid 180초, final 330초, hard timeout 420초 | 새 contest pacing contract. 기존 900초 data는 retained legacy |
| 맹세·거울 | DaoVow/BossMirror 모델 없음 | DaoVows2D, BossPatterns2D, CombatWorld 연결 | 새 feature candidate; 브라우저 완주 미승인 |
| formation | FORMATIONS 데이터와 순수 각도 함수가 이미 있음 | FormationDirector2D가 deterministic dispatch와 CombatWorld 연결을 추가 | 데이터 신규 아님. runtime director 통합이 delta |
| POI | 기존 3D 세계·제단 자산 | WorldInteractions2D, E/gamepad, 4종 POI, Pixi 표시 | 새 2D 모듈이지만 통합 partial |
| asset manifest | 22개 항목, 2D sprite family 없음 | 65개 항목, 43개 항목 추가, 2D sprite/source와 contest keyart 포함 | 기술 asset delta. 권리 승인은 별도 미완료 |
| 자동 검증 | 31개 test file | 현재 실행 51개 file, 590 tests passed | runtime2d·submission·UI 테스트 추가 |
| QA | 기준 tree에는 2D QA 폴더 없음 | 2D sprite, hero, integration, performance, browser captures | 증거 surface 추가. 시각·성능 최종 승인은 아님 |
| 제출 자료 | competition/product 제출 문서 없음 | contest spec, official requirements, readiness, copy, Codex evidence, rights ledger | 제출 준비 문서 delta. 실제 제출 아님 |

## 3. 제품 delta — 무엇을 contest slice로 새로 약속했는가

### P-01. 15분 생존에서 7분의 선택·거울 서사로 축소

제품 문서 [CONTEST_VERTICAL_SLICE.md](../product/CONTEST_VERTICAL_SLICE.md)는
기존 장기 캠페인과 다른 contest 계약을 정의합니다.

- 시작 후 420초에 승리 또는 좌화 결과로 끝납니다.
- 기본 시연자는 설령 + 청람비경 + 기본 시련입니다.
- 플레이어 동사는 이동, 축지법, 영기·영석 회수, 세 번의 Dao 선택,
  거울 보스 처치로 좁혔습니다.
- 제품 hook은 Build your Dao. Fight its mirror입니다.
- scope 목표는 1 heroine, 1 stage, 4 enemy silhouette, 3 weapon,
  1 evolution, 3 vows, 1 mirror finale입니다.
- 공식 요건·심사 축·제출물은 OPENGAME2026_SUBMISSION.md에 분리했습니다.

이는 baseline의 15분·다수 콘텐츠를 삭제했다는 뜻이 아닙니다. 기존 캠페인
데이터를 보존하고, contest 진입점에서 새 첫 경험을 좁히려는 제품 결정입니다.

### P-02. 현재 코드와 제품 문서 사이에 남은 timeline 차이

현재 소스에서 확인되는 시간은 다음과 같습니다.

- ContestPacing2D milestone: firstOath 20초, POI emphasis 120초,
  mid boss 180초, final boss 330초, hard timeout 420초.
- Game2D의 Dao milestone: 20초, 165초, 270초.
- 제품 수직 슬라이스 문서의 목표 선택 시점: 45초, 135초, 240초.

따라서 420초 상한과 boss 시점은 코드·문서가 상당 부분 맞지만, 세 선택의
정확한 시점은 아직 제품 lock이 아닙니다. 제출 delta에 현재 코드가 문서
목표를 완전히 구현했다고 쓰지 않습니다.

### P-03. 사람이 선택해야 하는 contest 범위

다음은 제품 문서의 목표이며, current runtime이 자동으로 모두 보장한다는
뜻이 아닙니다.

- showcase seed를 고정해야 하지만 Game2D는 현재 매 런 makeSeed()를 사용합니다.
- POI는 생성·표시·E 입력이 있으나 첫 7분에 특정 POI가 반드시 등장하는
  route는 고정되지 않았습니다.
- 현재 source에는 baseline 캠페인에서 물려받은 많은 캐릭터·무기·적·stage
  데이터가 남아 있습니다. 이번 제출에 무엇을 노출할지 사람의 scope lock이
  필요합니다.

## 4. 코드 delta — 실제 변경 표면

### 4.1 production entry와 dependency 변경

DELTA-CANDIDATE:

- src/main.js는 baseline의 WebGL2 capability check 후 core/Game.js를
  바로 실행하던 흐름에서, production에서는 runtime2d/Game2D.js를
  실행하는 흐름으로 바뀌었습니다.
- DEV에서만 query parameter renderer=3d를 사용할 때 core/Game.js를
  legacy renderer로 로드합니다. Three.js 코드를 삭제하지 않고 production
  entry에서 분리한 것입니다.
- package.json/package-lock.json은 pixi.js를 runtime dependency로 넣고,
  three는 devDependency로 옮겼습니다.
- package script assets:build-audit가 추가되었습니다.
- vite.config.js에는 build 후 제출 runtime asset을 검사·prune하는
  submission-runtime-asset-pruner가 추가되었습니다.
- .github/workflows/pages.yml에는 npm run assets:audit 단계가 추가되었습니다.
- index.html에는 contest 화면에 사용할 작은 favicon이 추가되었습니다.

현재 npm run build 결과는 Vite 8.1.5, 764 modules transformed입니다.
이것은 bundle 생성 증거이지 public deployment 증거가 아닙니다.

### 4.2 contest runtime 모듈

기준 커밋에 없고 현재 미추적 상태인 주요 runtime2d 모듈은 다음과 같습니다.

- runtime2d/Game2D.js: Pixi presentation, 입력, HUD, audio, 결과 흐름의
  contest 실행 조정
- runtime2d/CombatWorld2D.js: fixed-tick 전투, 420초 상한, boss,
  formation, 무기·적·pickup 연결
- runtime2d/PixiPresentation.js: 2.5D 투영, actor·POI·projectile·HUD
  presentation
- runtime2d/ContestPacing2D.js: 420초 clock과 one-shot milestone
- runtime2d/DaoVows2D.js: 검맥·설맥·심맥 상태와 전투 modifier·mirror metadata
- runtime2d/BossPatterns2D.js: jadeVoidWarden의 vow별 pattern planner와
  3 phase contract
- runtime2d/FormationDirector2D.js: baseline FORMATIONS를 deterministic
  exactly-once/retry dispatch로 연결
- runtime2d/WorldInteractions2D.js: seed·stage·chunk 기반 altar,
  treasure, eliteSeal, healingSpring과 소비·보상 상태
- runtime2d/EnemyArchetypes2D.js: grunt·charger·ranged·tank·elite·boss
  분류와 scaling contract
- runtime2d/AnimationState2D.js: 방향·우선순위·frame contract
- runtime2d/WeaponBehaviors2D.js: 2D 무기 행동·잔류장·오디오 cue metadata
- runtime2d/WorldMap2D.js, projection.js, backend.js, spriteManifest.js:
  world/projection/backend/asset contract
- runtime2d/FrameTelemetry2D.js, ParticleBudget2D.js, Quality2D.js:
  frame·particle·품질 계측 및 예산 contract

src/data/bosses.js도 추가되어 codex와 2D runtime이 공유할 renderer-independent
boss catalogue를 제공합니다. baseline의 BossManager와 기존 boss data를
삭제한 것이 아니라 contest 경로에 공유 데이터를 추가한 것입니다.

### 4.3 UI·입력·공통 코드 개선

현재 tracked diff 중 contest 경로와 직접 연결되는 표면:

- src/ui/TitleScreen.js: 천겁에 들기 quickStart, 수사·비경·확인 흐름,
  keyboard/controller focus, E 조작 안내
- src/ui/Hud.js: Dao 상태·progress·VFX label, POI radar, boss presentation
- src/ui/LevelUpModal.js: Dao 카드·선택 presentation
- src/ui/ResultScreen.js: contest 결과·Dao summary·retry surface
- src/ui/CodexScreen.js: data/bosses.js 기반 codex 참조
- src/ui/icons.js: Three geometry import 없이 data 기반 2D creature glyph
- src/core/Input.js: E/world interaction, DOM control edge, modal confirm
- styles/hud.css: runtime2d banner, POI prompt, context panel, Dao card/HUD,
  boss layout
- test/input.test.js, test/smoke.test.js: DOM activation, E latch,
  Pixi runtime dependency boundary 회귀 테스트

이 변경들은 화면·입력 계약을 추가하지만, 모든 UI flow가 실제 Chrome에서
완료되었다는 뜻은 아닙니다. 최신 UI review는 별도 QA 절에 기록합니다.

### 4.4 명시적으로 delta에서 제외한 tracked 변경

다음은 현재 diff에 있지만 contest delta라고 확정할 근거가 부족하거나
legacy 실험으로 보이므로 이 문서의 신규 기능·제출 범위에 포함하지 않습니다.

- src/art/NearEnemyModels.js의 buildGlacierWarden 및 InstancedMesh/PBR
  near-detail 추가
- public/assets/characters/glacier-warden-reference-v1.png,
  public/assets/materials/img2three/glacier-warden-v1/**,
  artifacts/img2threejs/glacier-warden-v1/**,
  tools/yeongheo/author_glacier_warden.py와 관련 contact sheet/후처리 도구
- src/core/Game.js의 legacy Three.js level-up render cadence 조정
- src/data/waves.js의 0·30·60초 enemy type 보강. 파일의 권위 RUN_SECONDS는
  여전히 900초이며, contest CombatWorld2D의 420초 pacing 증거로 사용하지 않음

이 항목들은 삭제하지 않았고, 현재 작업자의 소유·의도를 추측하지도 않습니다.

## 5. 에셋 delta — 새 2D 후보와 기존 3D 보존

### 5.1 매니페스트 비교

| 항목 | baseline 351541c | current | 의미 |
|---|---:|---:|---|
| tools/asset-manifest.json entries | 22 | 65 | 43 entries 추가, baseline 항목 삭제 없음 |
| 2D sprite/source entry | 0 | 36 | hero·enemy·boss·props runtime/source family |
| contest keyart | 0 | 1 | marketing/contest keyart 후보 |
| jade highland ground | 0 | 1 | Pixi 2D ground 후보 |
| Glacier Warden reference/PBR | 0 | 5 | 현재 delta에서 EXCLUDED |

현재 43개 manifest 추가 중 contest runtime 후보로 세는 것은 36개 2D
sprite/source, keyart 1개, jade highland ground 1개입니다. Glacier Warden
5개는 별도 3D 실험으로 보이며 이 delta의 제출 asset으로 세지 않습니다.

### 5.2 현재 asset pipeline과 검증

DELTA-CANDIDATE:

- public/assets/sprites2d에는 설령·요랑·void sentinel·jade void warden,
  talisman revenant, jade serpent, jade stone ghoul, blood scorpion과
  authoring source sheet가 추가되었습니다.
- public/assets/marketing/yeongheo-contest-keyart-v1.png와
  public/assets/materials/environment/jade-highland-ground-v1.png가
  contest presentation 후보로 추가되었습니다.
- tools/asset-manifest.json에 role, tier, source, consumer, maxBytes가
  기록됩니다.
- tools/submission-assets.mjs의 현재 계획상 runtime allowlist는 21개입니다.
- npm run build의 현재 pruner 기록은 runtime 21개, source 92 files /
  87,696,639 bytes, output 48 files / 26,575,137 bytes,
  sourceMissing 0, outputMissing 0, unexpected 0, removed 44 files /
  61,121,502 bytes입니다.
- npm run assets:audit는 assetCount 65, actualFileCount 65, errors []로
  통과했습니다.

자동 매니페스트·파일 대응 PASS는 권리 승인이나 시각 승인이 아닙니다.
현재 docs/competition/ASSET_RIGHTS_LEDGER.md의 판정은 runtime allowlist
21개 전부 권리 증거 미확인·차단입니다. ImageGen provenance, chroma/despill,
외부 img2threejs/Forge pipeline은 제작 경로를 설명할 뿐 제출·공개 권리를
자동 부여하지 않습니다.

### 5.3 baseline asset과 legacy asset

baseline의 다음 범위는 기존 자산이며 이번 챌린지 신규로 주장하지 않습니다.

- public/assets의 기존 environment, character reference, material, guardian,
  GLB와 img2threejs PBR evidence
- src/art/의 Three.js geometry·material·model adapter
- artifacts/img2threejs/seolryeong 및 기존 void iron scale pipeline
- public/models/characters/seolryeong-trellis-v4.glb

이 3D 자산은 현재 worktree에 남아 있지만 production contest entry가 Pixi
2D로 바뀌었다는 사실과 양립합니다. 사용 권리와 제출·thumbnail·video
포함 여부는 별도의 사람 gate입니다.

## 6. QA·테스트 delta

### 6.1 자동 검증

기준 tree에는 31개 test file이 있었고, 현재 실행에는 runtime2d와 submission
검사가 추가되어 다음 결과를 기록했습니다.

| 실행 | 현재 결과 | 증명 범위 |
|---|---|---|
| npm test | 51 test files passed, 590 tests passed, Vitest 4.1.10 | 순수 계약·회귀. 브라우저 시각·공개 배포는 아님 |
| npm run build | Vite 8.1.5, 764 modules transformed | production bundle 생성. public URL은 아님 |
| npm run assets:audit | assetCount 65, actualFileCount 65, errors [] | manifest↔파일 대응. 권리·미술 승인 아님 |

추가된 테스트 표면에는 runtime2d-animation-state, backend, boss-patterns,
contest-pacing, dao-vows, enemy-archetypes, formations, frame-telemetry,
game-flow, hud, interactions, manifest, map, particle-budget, presentation,
projection, weapon-behaviors, world, submission-assets, ui-navigation가
포함됩니다. test/formations.test.js 등 baseline 테스트는 retained 회귀
범위입니다.

### 6.2 브라우저·시각 QA

현재 작업 트리에서 확인한 주요 evidence:

- artifacts/2d-qa/latest-runtime/
  runtime2d-20260808T200307Z-761e1eb4425a/에는 1280, 1920, 2560 해상도의
  title, combat-idle, Dao card, boss-telegraph, boss-active 캡처가 있습니다.
- 이 캡처들은 2D terrain, hero, enemy, HUD, Dao card, boss bar와
  telegraph가 화면에 나타나는 것을 증명합니다.
- boss-active와 boss-telegraph 캡처의 timer는 약 00:20–00:21입니다.
  따라서 강제·부분 boss QA 장면으로는 사용할 수 있지만 330초 scheduled
  final boss 또는 420초 완주 증거로 사용하지 않습니다.
- 이전 1280·1920·2560 Chrome 묶음
  chrome-2026-08-08T17-38-41-011Z-*도 2D 전투 요소를 보여 주는 참조
  캡처입니다.
- runtime2d-20260808T195303Z-06d12178533d의 오래된 gameplay idle
  캡처는 빈/검은 화면으로 보여 성공 증거로 세지 않습니다. 이후
  200307Z 캡처가 유효한 부분 장면을 보여 주지만, 둘을 하나의 실행으로
  섞지 않습니다.

### 6.3 QA의 미완료 판정

- SPRITE_ASSET_AUDIT.md: 구조 PASS_WITH_REVIEW, P0/P1 0, P2 28,
  visualApproval pending, productionReady false
- HEROINE_RUNTIME_REVIEW.md: NO-GO. 방향 재사용, 발 pivot 흔들림,
  duplicate slash, 고해상도 가독성, fixed-FPS Windows 재검토가 남음
- INTEGRATION_REVIEW.md: WorldInteractions2D는 partial integration,
  EnemyArchetypes2D와 AnimationState2D는 독립 모듈 수준,
  event/reward/context/pool 통합 문제가 남음
- PERFORMANCE_AUDIT.md: Node stress와 core 계측 중심. renderer·DOM·audio
  브라우저 성능을 승인하지 않음
- UI_FLOW_REAUDIT.md: partial pass. 실제 Chrome full flow와 overlap/
  selection evidence가 부족함

따라서 이 delta는 “2D QA 산출물이 생겼다”라고만 기록하며, “시각적으로
출시 승인됐다”라고 기록하지 않습니다.

## 7. Codex 협업 delta

### 7.1 기준 커밋 대비 새 process surface

baseline에는 개발 계획과 품질 문서가 일부 있었지만, 대회 제출용
Codex evidence와 기존 프로젝트 delta를 연결하는 문서는 없었습니다.
현재 worktree에는 다음 문서가 추가되었습니다.

- docs/product/CONTEST_VERTICAL_SLICE.md: 420초 제품 목표, timeline,
  vow·mirror·scope·gate
- docs/competition/OPENGAME2026_SUBMISSION.md: 공식 요건, 심사 축,
  제출물·권리·Codex 선택 제출
- docs/competition/READINESS_MATRIX.md: G0–G6 readiness와 외부 미완료
- docs/competition/SUBMISSION_COPY_KO.md: 소개문·영상 storyboard·Codex copy
- docs/competition/CODEX_COLLABORATION_EVIDENCE.md: 문제→기여 표면→사람의
  판단→검증→미승인 항목
- docs/competition/ASSET_RIGHTS_LEDGER.md: 21개 runtime allowlist 권리 gate
- docs/BUILD_SUBMISSION.md 및 QA docs: bundle·asset·runtime evidence

### 7.2 기록 가능한 협업 문제 분해

현재 소스·테스트에서 확인되는 문제 분해는 다음과 같습니다.

| 문제 | Codex/에이전트 기여 표면 | 사람의 판단 | 현재 증거 |
|---|---|---|---|
| 15분을 심사용 7분으로 좁히기 | ContestPacing2D, CombatWorld2D, product spec | 420초 상한과 hook 채택, 선택 시점은 아직 lock 필요 | pacing tests PASS, full run 없음 |
| 선택이 전투를 바꾸기 | DaoVows2D, HUD/modal integration | 검맥·설맥·심맥을 남기고 세부 확장은 자름 | Dao tests와 카드 캡처, 전체 연쇄 미검증 |
| 보스가 선택을 비추기 | BossPatterns2D, jadeVoidWarden integration | 1 final boss·3 phase로 제한 | boss tests와 부분 telegraph/active 캡처 |
| 평범한 wave를 공간 사건으로 만들기 | FormationDirector2D와 기존 FORMATIONS 연결 | baseline formation data는 보존, director만 contest에 연결 | formation tests PASS, 전체 route 캡처 없음 |
| 전투 밖 선택 | WorldInteractions2D, Input E/gamepad, Pixi POI | showcase seed·POI route를 사람이 고정해야 함 | interactions tests, integration partial |
| browser bundle 안전성 | Pixi cutover, manifest, asset pruner, build tests | Three.js는 legacy dev-only로 보존 | build/audit PASS, public URL 없음 |

이 표는 특정 Codex 세션 또는 서브에이전트의 저자성을 주장하지 않습니다.
git diff에는 요청·응답·session ID가 없고, 현재 파일은 여러 작업자의 dirty
변경과 섞여 있습니다. 실제 제출에는 CODEX_COLLABORATION_EVIDENCE.md의
codex_record_id별로 사람의 review와 동일 build/run 검증을 연결해야 합니다.

### 7.3 사람이 직접 결정한 것으로 기록해야 할 것

- 최종 timeline: 현재 20/165/270초와 제품 목표 45/135/240초 중 하나
- showcase seed와 첫 420초 POI route
- 1 heroine·1 stage·4 silhouette·3 weapon·1 evolution scope lock
- hero visual NO-GO 수정 여부
- browser performance·audio·context recovery gate
- 공개 URL·thumbnail·3분 영상·권리·개인정보 점검
- 기존 범위와 challenge window 신규 변경의 최종 구분

## 8. 기존 기능·삭제·미사용 legacy

### 8.1 retained existing features

다음은 baseline에 이미 있었거나 baseline 기능을 계속 보존하는 범위입니다.

- Three.js core Game, world, art, entities, combat, audio, meta progression
- 3명의 수사와 baseline의 weapon/passive/evolution data
- 900초 WAVES와 8분·15분 legacy boss schedule
- src/data/formations.js와 formationAngles/formationType의 authored data
- 기존 3D environment·GLB·PBR/authoring evidence
- baseline 31개 test file와 기존 domain contract
- localStorage meta progression, shop, codex, legacy result flow

현재 production entry가 PixiJS로 바뀌었다고 해서 위 파일들이 모두 삭제되거나
2D contest에서 모두 검증되었다고 말하지 않습니다.

### 8.2 legacy 또는 contest에서 사용하지 않는 범위

- src/core/Game.js와 Three.js graph는 DEV query renderer=3d에서만 접근하는
  legacy renderer입니다.
- src/data/waves.js의 RUN_SECONDS 900과 430초 이후 formation entries는
  contest 420초 상한 밖의 campaign/extension data입니다.
- baseline의 multi-character selection, shop, long-run meta, 3D GLB
  presentation은 contest 기본 첫 런의 필수 경험이 아닙니다.
- AnimationState2D와 EnemyArchetypes2D는 현재 QA에서 독립 모듈로 판정되어
  모든 live enemy/hero animation·stats를 대체하지 않습니다.
- runtime asset manifest의 authoring source와 allowlist 밖의 3D/legacy
  assets는 현재 submission bundle에 자동 포함된다고 가정하지 않습니다.

### 8.3 삭제 기록

현재 tracked diff에서 .claude/launch.json 삭제가 보입니다. 이는 게임 기능
삭제로 입증되지 않은 개발 환경 파일이며, 이 문서의 challenge delta에는
포함하지 않습니다. 소유자 확인 없이 복구·추가 삭제하지 않습니다.

## 9. 현재 미완료·미승인 항목

| 항목 | 현재 사실 | 제출 시 필요한 처리 |
|---|---|---|
| timeline | 코드와 제품 문서의 Dao 시점이 다름 | 사람의 하나의 timeline lock |
| deterministic showcase | Game2D seed는 makeSeed() | 고정 seed와 evidence run |
| POI | 4종 생성·입력·표시 partial | 첫 420초 route, atomic reward, pool/context 검증 |
| enemy archetype/animation | 독립 모듈, live path 미통합 | 연결할지 제외할지 사람 결정. 무리한 통합 금지 |
| boss/formation | 계약·부분 장면 확인 | scheduled 180/330초와 420초 결과까지 full run |
| visual | sprite structure PASS_WITH_REVIEW, hero NO-GO | Windows original-size fixed-FPS 승인 |
| performance | Node stress 중심 | browser renderer/DOM/audio gate |
| rights | runtime allowlist 21개 권리 미확인·차단 | 자산별 권리·AI/외부 도구 조건 확인 |
| public release | 공개 URL과 no-login 새 세션 미검증 | 배포, uptime, 재시작, 지원 해상도 점검 |
| collaboration | session/author mapping 없음 | Codex record와 human decision 연결 |
| submission | 실제 upload·thumbnail·video 없음 | 대표자 공식 화면에서 직접 제출·기록 |

## 10. 제출 전 측정 gate

| Gate | measurable completion criteria | 현재 |
|---|---|---|
| D0 delta ownership | baseline commit, challenge window, 사람별 변경 묶음, 제외 목록을 확인 | 미완료 |
| D1 contract | 동일 build 후보에서 npm test, npm run build, npm run assets:audit 재실행; 결과를 build_id에 연결 | 명령 결과 PASS, ID 연결 미완료 |
| D2 full playthrough | 새 브라우저에서 title→play→세 vow→POI→formation→mid boss→final boss→승패/420 timeout→retry; 콘솔 exception 0 | v5.3 ZIP 로컬 실제 420초 승리·결과→재도전 PASS / 공개 URL 미배포 |
| D3 visual | 1280/1920/2560 또는 지원 범위에서 fixed-FPS Windows 영상; hero·enemy·telegraph·HUD overlap 없음; 사람 visualApproval=true | 1920×1080·2560×1600 자동·실행 감사 PASS / 사람 원본 크기 승인 대기 |
| D4 release/right | 공개 URL, no-login, runtime assets 권리 확인, thumbnail·소개문·영상 권리 확인 | 로컬 ZIP·thumbnail·소개문·166.468초 영상 준비 / 권리 0/72·공개 URL·사람 승인 대기 |
| D5 Codex evidence | codex_record_id별 problem/contribution/human decision/verification/accepted를 실제 로그와 연결 | 미완료 |

최종 evidence의 모든 캡처·콘솔·성능·영상·build manifest는 같은 run_id와
build_id를 사용해야 합니다. 현재 보관된 chrome/runtime2d 디렉터리 이름은
참조 ID일 뿐 최종 식별자가 아닙니다.

## 11. 보존·갱신 원칙

- 이 문서는 기준 커밋과 현재 worktree의 delta를 기록할 뿐, 다른 파일을
  revert, clean, delete하거나 ownership을 추정하지 않습니다.
- 현재 상태가 바뀌면 current_revision과 build_id를 고정한 뒤 동일 명령과
  동일 브라우저 흐름을 다시 기록합니다.
- Glacier Warden 같은 별도 3D 실험이 contest runtime에 실제로 편입될 경우,
  사람의 명시적 scope 결정과 권리·QA row를 먼저 추가합니다.
- 자동 PASS를 visual, performance, rights, public deployment PASS로 승격하지
  않습니다.
- 개인정보, OAuth token, API key, cookie, private URL, 내부 대화 원문은
  이 문서에 넣지 않습니다.

현재 이 문서의 최종 요약은 다음과 같습니다.

> 기준 351541c의 기존 Three.js 15분 프로젝트 위에 PixiJS 2D 420초 contest
> slice, Dao Vow·Boss Mirror·POI·formation runtime, 테스트·에셋·제출 QA
> 표면이 추가되었다. 자동 계약과 부분 화면 증거는 있지만, 일부 통합·시각·
> 성능·권리·공개 배포·Codex 세션 연결은 아직 승인되지 않았다.
