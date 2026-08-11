# Codex 협업 증거 — 천겁의 맹세

> **release-v5.3 현재 연결:** 이 문서 본문의 353초 후보, 21개 자산, 53/613과 v5.2 수치는 역사적 협업 증거입니다. 최신 권위 후보·새 ZIP의 정확히 420초 승천·결과→재도전 UI 회귀·65/709 테스트·runtime 72개·Web/Windows ZIP·1920×1080/2560×1600 검증과 동일 빌드 166.468초 영상은 [RELEASE_V5_3_AUDIT_2026-08-10.md](./RELEASE_V5_3_AUDIT_2026-08-10.md)를 우선합니다. 기술 provenance 72/72와 법적 권리 0/72·공개 URL 미배포·사람 승인 대기는 [SUBMISSION_HANDOFF_V5_3_2026-08-10.md](./SUBMISSION_HANDOFF_V5_3_2026-08-10.md)를 따릅니다.

> 심사 축: Playability · Originality · Codex Collaboration · Release Potential · Presentation
> 기록 기준: 2026-08-09 KST
> 상태: 최종 로컬 실행 PASS / 공개 배포·권리·시청각 승인 전

이 문서는 현재 작업 트리에서 확인되는 기능 표면, 테스트 결과, 브라우저 QA 산출물을
대회 심사 축에 맞춰 연결하는 감사 기록입니다. 이 문서 자체는 제출 증명, 최종 품질
승인, Codex 사용 사실의 단독 증명이 아닙니다.

현재 checkout은 여러 변경과 미추적 파일이 섞인 dirty worktree이며, 고정된 커밋과
공개 deployment URL은 아직 없습니다. 최종 로컬 build_id/run_id와 이번 기록에
사용할 codex_record_id는 고정했습니다. 따라서 아래의 파일 존재는 구현
표면의 근거로만 사용합니다. 어느 파일을 어느 Codex 세션 또는 어느 서브에이전트가
작성했는지는 이 checkout만으로 확정하지 않으며, 제출 전에 실제 협업 로그와
변경 묶음을 사람이 대조해야 합니다.

## 0. 역사적 snapshot 판정 요약 (2026-08-09)

| 영역 | 현재 판정 | 의미 |
|---|---|---|
| 런타임 계약 | 자동 검증 PASS | 420초 pacing, DaoVows, BossPatterns, Formation 등은 테스트와 소스에서 확인됨 |
| 빌드 | PASS | Vite production build가 기록상 완료됨 |
| 에셋 구조 | PASS_WITH_REVIEW | 65개 manifest 항목과 실제 파일이 일치하지만 시각 승인은 아님 |
| 실제 브라우저 플레이 | 로컬 QA PASS | 최종 dist에서 제목→검맥 3단계→중간보스→옥허진장→353초 승천을 단일 런으로 확인 |
| 시각·영웅 품질 | 자동 감사 PASS / 사람 승인 대기 | 실제 런에서 HUD·전투·결과 확인; 같은 entry의 1920×1080·2560×1440 독립 감사에서 지형 경계·HUD·영웅 가독성 PASS |
| 성능 | PASS | 후반 적 146체에서 interval p95 8.1ms, p99 8.3ms, long task 0; QA 런의 저장 음소거로 청감은 미승인 |
| 공개 제출(당시) | 미완료 | 당시 후보 URL은 build와 불일치했고 제출 자산도 미고정이었음. 현재 v5.3 ZIP·썸네일·166.468초 실제 플레이 영상은 준비됐으며, 권리·공개 URL·사람 승인·제출 기록은 여전히 외부 게이트임 |
| 실행 식별자 | 로컬 고정 | `FINAL_RUNTIME_QA.md`의 build_id/run_id를 사용; commit·공개 deployment는 미고정 |

## 0.1. 이번 기록의 Codex 레코드와 사용자 결정 경계

```text
codex_record_id: 019fe2bc-1ddb-7390-910b-8a41a70aa5f0
human_decisions_recorded: 미소녀 선협물 뱀서라이크, Steam 상용 레퍼런스, OpenAI Game Builders 우승 목표, Luna max 다중 에이전트 활용
```

위 한 줄 밖의 사용자 결정을 이 문서에 추론해 추가하지 않습니다. 아래 카드의
“사람의 목표/판단”은 기능 목표와 미승인 gate를 설명하는 제품 감사 용어이며,
추가 사용자 결정이나 최종 승인으로 기록하지 않습니다.

## 1. 증거 원칙과 출처

### 1.1 사실과 해석의 경계

- 현재 소스와 테스트는 “무엇이 작업 트리에 존재하는가”를 보여 줍니다. 이것만으로
  Codex가 생성한 코드의 양, 각 사람의 기여율, 챌린지 기간에 새로 만든 범위를
  단정하지 않습니다.
- “Codex/에이전트 기여 표면”은 현재 기능과 테스트가 어떤 문제를 겨냥하는지
  설명하는 용어입니다. 실제 심사 제출에는 요청 요약, 결과, 사람의 수정·거부,
  동일 실행의 검증 로그를 별도 기록으로 붙여야 합니다.
- 자동 테스트 PASS와 실제 사용자 화면 PASS는 별도 판정입니다. 구조적 에셋
  감사 PASS_WITH_REVIEW도 시각적 productionReady 승인을 뜻하지 않습니다.
- 서로 다른 실행의 스크린샷, 콘솔 로그, 빌드 산출물을 하나의 실행처럼 묶지
  않습니다.

### 1.2 기준 문서

- 공식 요건 및 심사 축: [OPENGAME2026_SUBMISSION.md](OPENGAME2026_SUBMISSION.md)
- 제품 목표와 7분 vertical slice: [CONTEST_VERTICAL_SLICE.md](../product/CONTEST_VERTICAL_SLICE.md)
- 제출 준비 매트릭스: [READINESS_MATRIX.md](READINESS_MATRIX.md)
- 현재 제출 카피: [SUBMISSION_COPY_KO.md](SUBMISSION_COPY_KO.md)
- 현재 제품 설명: [README.md](../../README.md)

## 2. 불변 실행 식별자

최종 로컬 런 값은 아래와 같이 고정했습니다. 공개 제출에는 같은 build의 commit과
deployment URL을 추가해야 합니다.

~~~text
run_id: final-locked-2026-08-08T22-15-03-925Z
build_id: d8b67ef7c5978e2f7bf9e953ec455a9f91f0b5a03ad058e7dc256d2a37d6264e
dist_manifest_id: 2c2666a6e3be5935e15aef2bc078adcbf7058deba2783f15bb5e59d211e1154e
commit_or_revision: <미고정>
deployment_url: <미입력>
started_at_kst: 2026-08-09T06:20:23+09:00
completed_at_kst: 2026-08-09T06:29:26+09:00 이전
codex_record_set_id: 019fe2bc-1ddb-7390-910b-8a41a70aa5f0
~~~

현재 보관된 브라우저 참조 ID는 다음과 같습니다. 이 값들은 서로 다른 캡처
묶음의 참조명이며 최종 run_id 또는 build_id가 아닙니다.

| 참조 ID | 확인된 내용 | 최종 증거로 사용할 때의 제한 |
|---|---|---|
| final-locked-2026-08-08T22-15-03-925Z | 최종 dist의 제목→검맥 3단계→180초 중간보스→330초 옥허진장→353초 승천, 콘솔 예외 0, 관찰 구간 p95 8.1ms | 피해 무효화·첫 카드 자동선택을 쓴 화면 흐름 QA. 일반 사용자 밸런스·오디오 청감·공개 URL 증거가 아님 |
| jwwuv-w74-cross-1920/2560 | 같은 `Game2D-JWWUvW74.js`의 1920×1080·2560×1440 독립 전투 캡처; 직선 지형 seam 없음, HUD·영웅 가독성 PASS, 콘솔 warning/error 0 | 자동·독립 시각 감사이며 사람의 미학적 승인·권리 승인을 대신하지 않음 |
| chrome-2026-08-08T17-38-41-011Z | 1280×720, 1920×1080, 2560×1600 Chrome 캡처. 1280 화면에서 HUD, 영웅, 적, 지형·POI, 자동 검을 포함한 2D 전투가 보임 | 고정된 최종 build_id가 없고 420초 완주·재시작·콘솔 무오류를 증명하지 않음 |
| runtime2d-20260808T201914Z-5e36041fb0e9 | 최신 2D runtime의 1280×720 combat-idle 및 방향 캡처. 00:00~00:02의 영웅·HUD·지형·POI가 보임 | 시작 직후 부분 캡처일 뿐이며, 같은 run_id의 세 vow·POI·보스·420초 완주를 증명하지 않음 |
| runtime2d-20260808T200307Z-761e1eb4425a | 1280×720/1920×1080/2560×1600의 title, combat-idle, dao-card(약 00:03), boss-telegraph/active(약 00:21) QA 캡처 | forced/부분 QA 참조이며 권위 시각 180/330초 보스나 420초 완주 증거가 아님 |
| runtime2d-20260808T195303Z-06d12178533d | 제목 화면 캡처와 gameplay-1280x720-idle.png가 보관됨 | 제목 화면은 확인되지만 gameplay idle 이미지는 검은/빈 화면으로 보여 성공 증거로 사용할 수 없음 |

최종 증거를 만들 때에는 한 번의 실행에서 생성한 run_id를 스크린샷,
콘솔 로그, 성능 기록, 영상, build manifest에 반복 기록해야 합니다.

## 2.1. 기록된 구현·감사 역할과 변경 판정

이 절의 “수락”은 현재 코드·계약·문서 수준에서 변경 표면을 수락했다는
뜻입니다. 최종 제출, 실제 사용자 플레이, 권리 또는 공개 배포를 승인했다는
뜻이 아닙니다. 역할은 기능 단위로만 기록하며, 개인별 저자·기여율은 이
checkout에서 증명되지 않습니다.

### 구현·감사 에이전트 역할

- 구현 역할: PixiJS `runtime2d` production path와 420초 pacing, 20종 무기
  행동·오디오 계약, DaoVows/BossPatterns/DaoCombatRuntime, XP·초반/중반
  밸런스, Formation·POI·HUD/입력, 배포 프루닝, 썸네일 후보를 기능 단위로
  추가·연결했습니다.
- 감사 역할: Vitest 계약·회귀, production build와 asset audit, 브라우저
  캡처·시각/UI·통합·성능 QA, 권리·제출 문서의 결손을 확인했습니다.
- 두 역할의 구분은 문제→파일→검증 경로를 설명하기 위한 것이며, 실제 Codex
  세션 또는 서브에이전트 이름을 대신하지 않습니다.

### 코드·계약 수준에서 수락된 변경

| 변경 | 현재 근거 | 수락 범위와 남은 경계 |
|---|---|---|
| 20종 무기 | `src/runtime2d/WeaponBehaviors2D.js`, `test/runtime2d-weapon-behaviors.test.js`의 20개 정의·시각/오디오 descriptor 계약 | 코드·계약 수락. 20종 모두의 실제 브라우저 가독성·밸런스·오디오 믹스는 미승인 |
| Dao mirror/runtime | `DaoVows2D.js`, `BossPatterns2D.js`, `DaoCombatRuntime2D.js`, `CombatWorld2D.js`와 관련 테스트 | Dao 상태·mirror planner·standalone runtime 계약 수락 및 `CombatWorld2D`의 Dao modifier/mirror metadata 소비 확인. standalone runtime이 live loop에 직접 import됐다는 뜻은 아니며, 동일 실제 런의 선택→전투→거울 보스 증거도 없음 |
| 오디오 | `src/audio/Audio.js`, `src/audio/synth.js`, 무기 descriptor와 `CombatWorld2D`의 launch/field/impact/status 이벤트 | 합성 Web Audio 계약·이벤트 표면 수락. 브라우저 음량·중첩·장시간 세션 믹스는 미검증 |
| 420 pacing | `ContestPacing2D.js`의 20/120/180/330/420 milestone, `Game2D.js`의 20/165/270 Dao 시점, `CombatWorld2D.js`의 mid 180/final 330/timeout 420 | 코드·테스트 수락. 같은 build_id의 실제 런에서 330초 최종 보스와 353초 승리를 확인; 420초 timeout 경로는 자동 테스트 증거 |
| XP·중반 밸런스 | `src/data/waves.js` opening rework, `test/runtime2d-opening-balance.test.js`의 rate·seed 생존 계약, world XP 테스트 | 자동 계약 수락. 420초 사람 플레이의 레벨 곡선·중반 체감 밸런스 승인은 없음 |
| 배포 프루닝 | `vite.config.js`, `tools/submission-assets.mjs`, `tools/audit-submission-build.mjs`; 현재 build에서 runtime 21개, output 48개, 26,599,596 bytes 기록 | 후보 번들 프루닝 수락. 공개 후보 URL은 현재 원격 Three 번들과 로컬 Pixi 번들이 달라 release build로 수락하지 않음 |
| 썸네일 후보 | `public/assets/marketing/yeongheo-contest-keyart-v1.png` 및 `SUBMISSION_COPY_KO.md`의 1672×941 fingerprint 기록 | 파일 후보·지문 수락. 권리, 사람의 시각 승인, 업로드 및 최종 제출 사용은 미완료 |

### 반려·미완료 판정

| 항목 | 현재 판정 | 근거와 제출 전 조건 |
|---|---|---|
| 권리 | **반려/차단 — 0/72** | `ASSET_RIGHTS_LEDGER.md`의 법적 권리 확인이 0/72. 기술적 provenance·SHA는 법적 clearance가 아니므로 권리 확인 전 제출 불가 |
| 공개 배포 | **미완료** | release-v5.2 `deploymentStatus`는 `not-deployed`이며, 동일 build의 익명 공개 URL 증거가 없음. `deployment_url` placeholder 유지 |
| 실제 contest run | **release-v5.2 로컬 QA PASS** | 새 Web ZIP의 showcase seed `3185791507`에서 피해 무효화·시간 점프·보스 강제 소환 없이 정확히 420초 승천(레벨 33·2,457처치·보스 2·도가 3/3), 결과→재도전·일시정지, 별도 2560×1600 성능 smoke와 콘솔 error/warning 0을 확인. 자세한 불변 수치는 v5.2 감사를 우선 |
| 최종 제출 | **release-v5.2 당시 미완료** | 최신 v5.3에는 동일 패키지 기반 166.468초 영상과 썸네일이 준비됨. 권리, 공개 current build, 사람 시청각 승인·제출 기록은 여전히 미완료이며 최신 handoff를 우선 |

## 3. 문제 → 기여 표면 → 사람의 판단 → 검증

아래 카드는 현재 작업 트리의 실제 파일과 보관된 QA 결과를 연결한 것입니다.
“Codex/서브에이전트 기여” 칸은 기능 표면에 대한 사실 설명이며, 특정 세션의
저자 확인을 대신하지 않습니다.

### C-01. 15분형 레거시 데이터를 대회용 420초 런으로 좁히기

- 문제/목표: 심사자가 짧은 시간에 핵심 선택과 거울 보스를 경험하도록 라이브
  런을 7분으로 고정하고, 이전 장시간 wave 데이터와 구분해야 했습니다.
- Codex/서브에이전트 기여 표면: ContestPacing2D.js가 420초 상한과 직렬화 가능한
  시계를 제공하고, CombatWorld2D.js가 이를 사용해 hard timeout을 처리합니다.
  Game2D.js에는 현재 Dao 선택 시점 20초·165초·270초가 있습니다. 기존
  src/data/waves.js의 장시간/확장 데이터는 라이브 대회 상한과 별개입니다.
- 사람의 목표/판단: 권위 타임라인은 첫 맹세 20초, POI 강조 120초, 맹세 심화
  165초, 중간 보스 180초, 맹세 완성 270초, 최종 보스 330초, 좌화 타임아웃
  420초로 고정했습니다. 같은 build_id의 실제 브라우저 run에서 330초 최종 보스와
  353초 승천까지 순서와 시각을 재현했습니다.
- 검증: runtime2d-contest-pacing.test.js를 포함한 전체 suite PASS, production
  build PASS, `FINAL_RUNTIME_QA.md`의 최종 dist 단일 승리 런.
- 판정: 계약·타임라인·로컬 실제 시연 PASS. 공개 URL 재현은 미승인.

### C-02. 세 가지 Dao Vow가 실제 전투 변화를 만들게 하기

- 문제/목표: 선택이 단순한 텍스트가 아니라 이후 전투와 마지막 거울 보스의
  의미를 바꾸게 해야 합니다.
- Codex/서브에이전트 기여 표면: DaoVows2D.js에 sword·frost·spirit의
  기본·심화·완성 상태, 전투 modifier, mirror metadata가 있고, Game2D.js와
  CombatWorld2D.js가 선택 상태를 연결합니다.
- 사람의 목표/판단: 세 개의 맹세를 모두 읽히는 하나의 7분 루프에 넣고,
  선택의 결과를 보스에 되돌려 보여 주는 것이 핵심 hook입니다. 권위 선택
  시점은 20초·165초·270초로 정합화되었으며, 사람에게 남은 결정은 이를
  동일한 실제 run에서 수락할 수 있는지 확인하는 것입니다.
- 검증: runtime2d-dao-vows.test.js와 game flow 관련 테스트가 전체 suite에
  포함되어 PASS 기록입니다. 최종 로컬 런에서 검맥·회귀검선·검환 선택과
  `sword-fan`·`returning-sword-line`·`closing-sword-ring`, 세 mirror phase를
  동일 run_id로 확인했습니다.
- 판정: 데이터·계약·실제 연결 PASS. 다른 두 vow와 사람의 체감 승인은 별도 gate.

### C-03. 선택한 길을 비추는 Boss Mirror 만들기

- 문제/목표: 일반 wave와 구별되는 한 번의 결승 경험이 필요하고, 보스가
  선택한 Dao를 비추어야 합니다.
- Codex/서브에이전트 기여 표면: BossPatterns2D.js는 renderer-independent
  결정론적 planner, jadeVoidWarden final boss, 세 HP phase, zone·line·cone·
  radial·orbit 패턴과 telegraph를 정의합니다. CombatWorld2D.js가
  daoVows.vowId를 읽고 phase 및 pattern 실행을 연결합니다.
- 사람의 목표/판단: 최종 보스 하나와 명확한 telegraph로 7분 영상에서 hook을
  전달하고, 보스 수·패턴 수를 더 늘리지 않는 것이 scope 판단입니다.
- 검증: runtime2d-boss-patterns.test.js 및 전투 관련 전체 suite PASS 기록.
  실제 180초 mid boss, 330초 final boss, 세 phase 변화의 동일 실행
  브라우저 증거는 없습니다.
- 판정: 설계·계약은 확인, 읽기 쉬운 실제 보스 시연은 미승인.

### C-04. Formation으로 minute-to-minute 변화를 보이기

- 문제/목표: 자동 공격만 반복되는 인상을 줄이고, 짧은 시연에도 적의
  공간적 리듬이 보이게 해야 합니다.
- Codex/서브에이전트 기여 표면: FormationDirector2D.js가 exactly-once와
  retry 가능한 이벤트 디렉터를 제공하며, src/data/formations.js에는
  75초 ring wisp, 140초 wall wolf, 215초 ring emberSprite, 290초
  pincer jadeSerpent, 365초 ring talismanGhost가 있습니다. 430초 이후
  이벤트는 420초 대회 런 바깥의 확장 데이터입니다.
- 사람의 목표/판단: 다섯 개의 읽기 쉬운 공간 beat만 남기고, 확장 wave와
  적 종류 증식은 제출 slice에서 자릅니다.
- 검증: runtime2d-formations.test.js 및 전체 suite PASS 기록. 다섯 이벤트를
  한 화면·한 run_id로 모두 재현한 브라우저 캡처는 없습니다.
- 판정: 이벤트 계약은 확인, 실제 연출 완주 증거는 미승인.

### C-05. POI를 선택 가능한 세계 상호작용으로 만들기

- 문제/목표: 전투 외에 플레이어가 잠깐 이동하고 E를 눌러 판단하는
  공간적 선택이 필요합니다.
- Codex/서브에이전트 기여 표면: WorldInteractions2D.js가 seed·stage·chunk
  기반 결정론적 POI를 만들고 altar·treasure·eliteSeal·healingSpring의
  소비·보상 상태를 관리합니다. Game2D.js가 근접 prompt, E/gamepad 입력,
  보상 연결, Pixi POI 표시를 시도합니다.
- 사람의 목표/판단: 대회 시연에서 한 번은 확실히 보이는 POI route와
  고정 showcase seed를 선택해야 합니다. 현재 seed는 매 런 makeSeed()로
  만들어지며 첫 7분에 특정 POI가 나온다는 보장이 없습니다.
- 검증: runtime2d-interactions.test.js와 world 관련 테스트 PASS 기록.
  통합 리뷰는 partial integration으로 판정했고, POI pool 용량, 이벤트 전달·
  보상 원자성, context recovery, elite 보장 문제가 남아 있습니다.
- 판정: 모듈·기본 연결은 존재하지만 제출용 route는 미승인.

### C-06. 제작 런타임을 PixiJS 2.5D로 고정하기

- 문제/목표: 심사자가 설치 없이 브라우저에서 바로 플레이할 수 있는
  production path가 필요하고, 레거시 Three.js 실험 경로와 섞이면 안 됩니다.
- Codex/서브에이전트 기여 표면: main.js의 production path는 Game2D.js,
  PixiPresentation.js 및 runtime2d backend/projection을 사용합니다.
  legacy Three.js는 개발 시 ?renderer=3d로만 여는 경로로 분리되어 있습니다.
- 사람의 목표/판단: 대회 제출은 PixiJS 2D runtime을 기준으로 하고,
  Three.js는 dev-only로 남기는 결정입니다.
- 검증: chrome-2026-08-08T17-38-41-011Z 캡처에서 2D 전투 화면이
  확인됩니다. 그러나 공개 URL, 새 브라우저 세션의 title→play→end
  재현, 420초 완주를 확인한 기록은 없습니다.
- 판정: 렌더러 경계와 일부 화면은 확인, 출시 가능한 브라우저 build는
  미승인.

### C-07. 제목·HUD·결과 화면과 캐릭터 가독성

- 문제/목표: 첫 10초에 조작법과 목표를 이해시키고, 맹세·보스·결과를
  영상과 스크린샷에서 읽히게 해야 합니다.
- Codex/서브에이전트 기여 표면: TitleScreen.js의 천겁에 들기 quickStart,
  Hud.js의 전투·Dao·보스 정보, ResultScreen.js, CodexScreen.js,
  LevelUpModal.js, styles/hud.css와 관련 UI 테스트가 있습니다.
- 사람의 목표/판단: 메뉴를 길게 확장하지 않고 하나의 quickStart로 시연
  진입을 단순화하며, 영웅·적·telegraph를 우선 읽히게 하는 것입니다.
- 검증: title-1280x720.png에서 제목 화면과 quickStart가 보입니다.
  최신 `runtime2d-20260808T201914Z-5e36041fb0e9`의 combat-idle·방향 캡처에는
  00:00~00:02의 2D 영웅·HUD·지형·POI가 보입니다. 반면 이전
  `runtime2d-20260808T195303Z-06d12178533d`의 gameplay idle은 검은/빈 화면으로
  성공 증거로 세지 않습니다. HEROINE_RUNTIME_REVIEW.md는 NO-GO이며,
  UI_FLOW_REAUDIT.md는 partial pass입니다.
- 판정: 진입 화면은 확인, 캐릭터 시각 승인·전체 UI flow는 미승인.

### C-08. 자동 검증과 제출 자산 감사

- 문제/목표: 대회용 변경이 빌드에 들어가고, 누락 에셋이나 테스트 회귀를
  빠르게 발견해야 합니다.
- Codex/서브에이전트 기여 표면: runtime2d 전용 테스트 묶음,
  tools/audit-submission-build.mjs, tools/submission-assets.mjs,
  tools/asset-manifest.json 및 package scripts가 검사 표면을 제공합니다.
- 사람의 목표/판단: 자동 PASS를 출발점으로만 사용하고, 브라우저·시각·권리
  gate가 통과하기 전에는 제출 가능하다고 부르지 않는 것입니다.
- 검증: 아래 5절의 npm test, npm run build, npm run assets:audit 결과를
  기록했습니다.
- 판정: 자동 계약은 PASS, 실제 release gate는 미승인.

## 4. 현재 변경·증거 표면 목록

다음은 이 증거 문서가 근거로 삼는 관련 파일의 현재 상태입니다. 전체
worktree에는 이 목록 밖의 변경도 있습니다. tracked 수정과 untracked 추가를
구분하지 않고 챌린지 기간의 신규 작업이라고 주장해서는 안 됩니다.

### 4.1 production/runtime 관련

- tracked 수정: src/main.js, src/core/Game.js, src/core/Input.js,
  src/data/waves.js, src/ui/TitleScreen.js, src/ui/Hud.js,
  src/ui/LevelUpModal.js, src/ui/ResultScreen.js, src/ui/CodexScreen.js,
  src/ui/icons.js, styles/hud.css, index.html, vite.config.js
- untracked runtime: src/runtime2d/AnimationState2D.js,
  src/runtime2d/backend.js,
  BossPatterns2D.js, CombatWorld2D.js, ContestPacing2D.js, DaoVows2D.js,
  DaoCombatRuntime2D.js,
  EnemyArchetypes2D.js, FormationDirector2D.js, FrameTelemetry2D.js,
  Game2D.js, ParticleBudget2D.js, PixiPresentation.js, Quality2D.js,
  WeaponBehaviors2D.js, WorldInteractions2D.js, WorldMap2D.js,
  projection.js, spriteManifest.js
- 데이터: src/data/bosses.js, src/data/formations.js
- 오디오: src/audio/Audio.js, src/audio/synth.js 및 runtime2d 무기·전투 오디오 descriptor/event 표면

### 4.2 테스트·감사 관련

- tracked 수정: test/input.test.js, test/smoke.test.js
- runtime2d 및 제출 테스트: test/runtime2d-animation-state.test.js,
  runtime2d-backend.test.js, runtime2d-boss-patterns.test.js,
  runtime2d-contest-pacing.test.js, runtime2d-dao-vows.test.js,
  runtime2d-enemy-archetypes.test.js, runtime2d-formations.test.js,
  runtime2d-frame-telemetry.test.js, runtime2d-game-flow.test.js,
  runtime2d-hud.test.js, runtime2d-interactions.test.js,
  runtime2d-dao-combat-runtime.test.js,
  runtime2d-opening-balance.test.js,
  runtime2d-manifest.test.js, runtime2d-map.test.js,
  runtime2d-particle-budget.test.js, runtime2d-projection.test.js,
  runtime2d-weapon-behaviors.test.js, runtime2d-world.test.js,
  submission-assets.test.js, ui-navigation.test.js
- 감사 도구: tools/audit-submission-build.mjs, tools/submission-assets.mjs,
  tools/asset-manifest.json 및 tools/yeongheo/validate_runtime_sprites.py

### 4.3 문서·브라우저·시각 QA

- 제품·제출 문서: README.md, docs/product/CONTEST_VERTICAL_SLICE.md,
  docs/competition/OPENGAME2026_SUBMISSION.md,
  docs/competition/READINESS_MATRIX.md, docs/competition/SUBMISSION_COPY_KO.md
- QA 산출물: artifacts/2d-qa/SPRITE_ASSET_AUDIT.md,
  HEROINE_RUNTIME_REVIEW.md, INTEGRATION_REVIEW.md,
  UI_FLOW_REAUDIT.md, PERFORMANCE_AUDIT.md,
  artifacts/2d-qa/chrome/의 브라우저 캡처
- 브라우저 로그·캡처: .playwright-cli/ 및
  artifacts/2d-qa/latest-runtime/의 참조 파일

이 목록은 파일별 Codex 저자 목록이 아닙니다. 제출 전에 각 변경 묶음을
실제 요청·응답 요약, 사람의 review, 테스트 실행에 연결해 codex_record_id를
부여해야 합니다.

## 5. 검증 원장

아래 결과는 현재 작업에서 기록된 실행 결과입니다. 이 문서를 작성하면서
검증용 build와 테스트는 재실행했지만, 최종 release build 또는 최종 브라우저
run을 만들지는 않았습니다. 모든 항목은 위의 미고정 식별자와 함께 읽어야
하며, 자동 PASS는 실제 사용자 플레이 PASS가 아닙니다.

| 검증 | 명령/증거 | 기록된 결과 | 판정 범위 |
|---|---|---|---|
| 단위·통합 suite | npm test | Vitest 4.1.10, 53개 test file, 613 tests passed | 계약·회귀 PASS; 실제 화면·오디오·배포는 아님 |
| production build | npm run build | Vite 8.1.5, 764 modules transformed, 성공. pruner: runtime 21개, output 48개, 26,599,596 bytes | 번들 생성 PASS; 공개 호스팅·새 세션 실행은 아님 |
| 에셋 감사 | npm run assets:audit | assetCount 65, actualFileCount 65, errors [] | 파일 대응 PASS; 시각 승인 아님 |
| 2D Chrome 캡처 | artifacts/2d-qa/chrome/chrome-2026-08-08T17-38-41-011Z-* | 3 해상도 캡처, 2D 전투 요소 확인 | 부분적인 사용자 화면 증거 |
| 최신 제목 화면 | artifacts/2d-qa/latest-runtime/runtime2d-20260808T195303Z-06d12178533d/title-1280x720.png | 제목·quickStart 확인 | 진입 화면만 증명 |
| 최신 부분 gameplay 캡처 | artifacts/2d-qa/latest-runtime/runtime2d-20260808T201914Z-5e36041fb0e9/의 combat-idle·방향 이미지 | 00:00~00:02의 2D 영웅·HUD·지형·POI 확인 | 시작 직후 부분 화면; full run 아님 |
| 이전 gameplay idle 캡처 | runtime2d-20260808T195303Z-06d12178533d/gameplay-1280x720-idle.png | 검은/빈 화면으로 보여 성공으로 인정하지 않음 | 실패 신호/재검증 필요 |
| 부분 Dao·boss 캡처 | runtime2d-20260808T200307Z-761e1eb4425a/의 dao-card·boss-active | Dao 약 00:03, boss-active 약 00:21의 forced/부분 QA | 권위 180/330초 보스·420초 완주 아님 |
| 스프라이트 구조 감사 | artifacts/2d-qa/SPRITE_ASSET_AUDIT.md | PASS_WITH_REVIEW, P0/P1 0, P2 28, visualApproval pending, productionReady false | 구조·수량만 PASS |
| 영웅 runtime review | artifacts/2d-qa/HEROINE_RUNTIME_REVIEW.md | NO-GO | 원본 크기·고정 FPS Windows 재검증 필요 |
| 통합 review | artifacts/2d-qa/INTEGRATION_REVIEW.md | WorldInteractions partial, EnemyArchetypes/AnimationState 독립 모듈 상태 | 전체 feature 통합 승인 아님 |
| 성능 review | artifacts/2d-qa/PERFORMANCE_AUDIT.md | Node stress 중심, renderer/DOM/audio 미검증 | 브라우저 성능 gate 미승인 |

### 5.1 역사적 콘솔 오류는 최종 성공 증거가 아니다

이전 브라우저 로그에는 다음 오류가 기록되어 있습니다. 날짜가 다른
실행의 과거 신호이므로 현재 코드의 최종 실패라고 단정하지 않지만, 최종
run에서 콘솔이 깨끗한지 확인해야 하는 이유로 보관합니다.

- .playwright-cli/console-2026-08-07T07-01-13-454Z.log:
  this._setSceneMode is not a function
- .playwright-cli/console-2026-08-08T14-45-17-587Z.log:
  this._ensureDamageTexts is not a function

최종 제출 영상·스크린샷에는 이 과거 로그를 현재 PASS로 둔갑시켜 사용하지
않으며, 동일 run_id의 실제 브라우저 콘솔 기록으로 대체해야 합니다.

## 6. 심사 5축에 대한 현재 증거와 결손

| 심사 축 | 현재 말할 수 있는 사실 | 아직 말할 수 없는 것 / 다음 gate |
|---|---|---|
| Playability | PixiJS production path, 420초 pacing 계약, HUD·입력·Dao·boss·formation 연결, 자동 suite PASS | 새 브라우저에서 title→play→세 선택→mid/final boss→승패/timeout→retry를 한 run에서 완주했다는 주장. 공개 URL과 콘솔 무오류 필요 |
| Originality | anime-girl xianxia survivor-like의 세 Dao vow와 선택을 비추는 jade mirror boss 구조가 소스와 제품 문서에 존재 | 실제 플레이에서 선택이 전투·보스에 체감된다는 주장. 7분 영상에서 hook beat를 명확히 보여야 함 |
| Codex Collaboration | 문제를 pacing·vow·boss·formation·POI·QA 단위로 나누고, 관련 source/test/doc를 연결할 수 있음 | 특정 Codex/서브에이전트가 어떤 변경을 생성했는지, 사람이 무엇을 수정·거부했는지. 세션 기록과 사람의 review가 필요 |
| Release Potential | 설치 없는 웹을 목표로 한 Pixi path, manifest/audit 도구, 65/65 asset 대응 | 공개 배포 URL, 다른 세션·브라우저 안정성, 권리·라이선스, Hive 확장 계획이 확인됐다는 주장 |
| Presentation | 제목 화면, HUD, 일부 2D 전투 캡처, boss telegraph 설계가 있음 | 최종 thumbnail, 3분 이하 실제 플레이 영상, 영웅 시각 승인, 오디오·자막·카메라가 완성됐다는 주장 |

## 7. 사람이 결정하고 승인해야 하는 항목

아래는 Codex가 임의로 완료 처리할 수 없는 제품·제출 판단입니다.

- [x] 권위 타임라인을 같은 build_id의 실제 run에서 확인했다: Dao 선택
  20/165/270초, POI 구간, 중간 보스 180초, 최종 보스 330초, 353초 승리.
  420초 좌화 timeout의 정확성은 자동 테스트로 분리 검증했다.
- [ ] showcase seed와 첫 420초의 POI route/type을 고정하고, 세 vow·세
  formation·mid/final boss를 실제로 관찰할 수 있는지 확인한다.
- [ ] 제출 범위를 고정한다: 1 heroine, 1 stage, 4 enemy silhouette,
  3 weapon, 1 evolution, 3 vows, 1 mirror finale를 넘는 데이터·캐릭터·
  스테이지 확장은 이번 slice에서 제외할지 결정한다.
- [ ] 영웅 P0/P1 시각 이슈와 중복 slash, 방향 재사용, 발 위치 흔들림,
  고해상도 가독성 문제를 수정한 뒤 Windows 원본 크기·고정 FPS로 승인한다.
- [ ] browser performance gate를 정의하고 실제 renderer·DOM·오디오 포함
  세션에서 측정한다. Node stress만으로 release 성능을 승인하지 않는다.
- [ ] 공개 URL, no-login 접근, 새 세션 재현, 지원 해상도와 재시작 흐름을
  사람의 브라우저에서 확인한다.
- [ ] 코드·이미지·영상·음원·폰트·데이터·오픈소스·AI 생성물의 권리를
  확인하고, 실제 참가자 개인정보·토큰은 저장소 문서에 넣지 않는다.
- [ ] 3분 이하 실제 플레이 영상과 Codex 설명을 선택 제출할지 결정한다.
- [ ] 기존 코드와 2026-08-04~2026-08-26 챌린지 기간의 신규·개선 범위를
  사람의 변경 기록으로 분리한다.

### 7.1. 사용자 결정 기록 경계

위 목록은 아직 승인되지 않은 제출 전 gate이며, 사용자 결정의 과거 사실을
추가로 기록한 목록이 아닙니다. 이 문서에 명시적으로 남기는 사용자 결정은
다음 한 줄로 제한합니다.

> 미소녀 선협물 뱀서라이크, Steam 상용 레퍼런스, OpenAI Game Builders 우승 목표, Luna max 다중 에이전트 활용

타임라인·seed·scope·시각·권리·release에 관한 나머지 항목은 사람이 확인해야
하는 pending gate로만 유지합니다.

## 8. 측정 가능한 제출 gate

| Gate | 완료 조건 | 현재 |
|---|---|---|
| G0 identity | 하나의 run_id, build_id, commit/revision, deployment_url을 고정하고 모든 증거에 동일하게 기록 | release-v5.3·로컬 package run_id 고정 / commit·공개 deployment 미고정 |
| G1 contract | npm test, npm run build, npm run assets:audit를 같은 build 후보에서 재실행하고 결과 보관 | PASS, 로컬 build_id에 연결 |
| G2 playthrough | 익명 새 브라우저에서 install/login 없이 시작, 이동·자동 공격·세 vow·POI·formation·mid boss·final boss·승패 또는 420초 timeout·retry를 한 run에서 재현; 콘솔 예외 0 | v5.3 ZIP 로컬 실제 420초 승리·결과→재도전 PASS / 공개 익명 URL 미배포 |
| G3 visual | Windows 원본 크기와 고정 FPS의 실제 영상을 검토하고 영웅·적·telegraph·HUD가 겹치지 않으며 visualApproval을 사람이 true로 기록 | 1920×1080·2560×1600 독립 감사 PASS / 사람 원본 크기 승인 대기 |
| G4 performance | renderer·DOM·audio를 포함한 지원 해상도 성능 측정, 장시간 run과 resize/context recovery 확인 | v5.3 장시간 성능·오디오 계측·2560×1600 resize PASS / 사람 청감 승인 대기 |
| G5 release | 공개 URL, 새 세션 접근, thumbnail, 소개문 200자 이내, 실제 영상, 권리 목록, 제출 전 개인정보 점검 | 로컬 ZIP·thumbnail·소개문·166.468초 실제 영상 준비 / 공개 URL·권리·사람 승인·개인정보 점검 대기 |
| G6 collaboration | codex_record_id별 문제·기여·사람의 판단·검증·거부 변경을 실제 로그와 연결 | 미완료 |

## 9. Codex 협업 기록 양식

실제 세션을 확인한 뒤 아래 한 묶음씩 채웁니다. 비공개 대화 원문이나
인증 정보를 복사하지 말고, 요청과 판단의 안전한 요약만 남깁니다.

~~~text
codex_record_id: 019fe2bc-1ddb-7390-910b-8a41a70aa5f0
run_id: <최종 동일 run_id 또는 미고정>
build_id: <최종 동일 build_id 또는 미고정>
problem: <해결하려던 제품/기술 문제>
request_summary: <Codex 또는 서브에이전트에 요청한 요약>
codex_or_subagent_contribution: <생성·수정·분석·테스트한 범위>
files_touched: <실제 변경 파일 목록>
human_goal: <사람이 달성하려던 플레이어 경험>
human_decisions: 미소녀 선협물 뱀서라이크, Steam 상용 레퍼런스, OpenAI Game Builders 우승 목표, Luna max 다중 에이전트 활용
verification_commands: <명령과 결과>
browser_evidence: <동일 run_id의 안전한 캡처·로그 경로>
accepted: <yes/no/pending>
rejected_or_edited: <사람이 거부·수정한 제안>
privacy_review: <personal_data=none, secrets=none>
~~~

### 9.1 제출 문구에 사용할 수 있는 안전한 서술

다음처럼 “현재 증거가 말하는 범위”만 서술합니다.

> Codex 협업은 420초 pacing, 세 Dao Vow, 선택을 비추는 보스 패턴,
> formation·POI 모듈과 자동 검증을 작은 문제 단위로 나누는 데 사용했다.
> 사람이 최종 scope, 타임라인, 시각 품질, 공개 배포 및 제출 여부를 결정했고,
> 자동 테스트 PASS와 실제 브라우저·시각 승인 여부를 별도로 검토했다.

다음 표현은 현재 근거만으로 사용하지 않습니다.

- “Codex가 전체 게임을 완성했다”
- “모든 서브에이전트 기여가 재현·승인됐다”
- “420초 플레이가 모든 브라우저에서 통과했다”
- “시각 품질·성능·공개 배포가 완료됐다”
- “실제 영상·썸네일·권리 확인·제출이 끝났다”

## 10. 개인정보·비밀·권리 보호

- 이 문서에는 이름, 이메일, 계정 ID, 전화번호, 주소, 생년월일, 법정대리인
  정보, OAuth 토큰, API key, 쿠키, private URL, 내부 비밀, 비공개 대화
  원문을 기록하지 않습니다.
- 브라우저 증거는 인증 정보가 없는 공개 경로만 참조합니다. 인증 URL이나
  쿼리 문자열에 토큰이 있으면 문서에 넣지 않고 안전한 로컬 별칭으로
  대체합니다.
- 외부·AI 생성 에셋은 제출 전에 출처와 사용 권리를 별도로 확인합니다.
  이 문서의 파일 목록은 라이선스 승인 목록을 대신하지 않습니다.
- 참가자 정보와 실제 제출 클릭은 대표자가 공식 제출 화면에서 직접 처리하고,
  이 저장소에는 placeholder와 검증 결과만 남깁니다.

## 11. 최종 업데이트 규칙

최종 제출 전 다음 순서로만 이 문서를 갱신합니다.

1. 사람의 scope·타임라인·seed 결정을 기록합니다.
2. 하나의 build_id로 build와 asset audit을 재실행합니다.
3. 같은 run_id로 브라우저 full playthrough, 콘솔, 성능, 캡처를 수집합니다.
4. Windows 시각 검토와 권리·개인정보 검토 결과를 사람이 승인합니다.
5. 실제 Codex/서브에이전트 로그와 변경 파일을 codex_record_id에 연결합니다.
6. 공개 URL과 제출 결과를 확인한 뒤에만 placeholder를 실제 값으로 바꿉니다.

그 전까지 이 문서의 판정은 “자동 계약 일부 PASS, 실제 출시·시각·제출
gate 미승인”으로 유지합니다.
