# 제출 커밋 범위

> **release-v5 갱신:** 실제 포함 범위와 산출물 판정은 [RELEASE_V5_AUDIT_2026-08-10.md](./RELEASE_V5_AUDIT_2026-08-10.md), 외부 차단은 [SUBMISSION_HANDOFF_2026-08-10.md](./SUBMISSION_HANDOFF_2026-08-10.md)를 우선합니다. 이 문서는 기존 dirty worktree의 명시적 staging 경계를 보존하며 commit·push를 허가하거나 수행하지 않습니다.

이 문서는 2026-08-09 현재 dirty worktree를 기준으로 한 제출 커밋 경계입니다. 현재 branch/working tree를 권위로 삼되, 이 문서를 작성하는 동안 commit·push·삭제·정리는 수행하지 않습니다. git add -A는 사용하지 말고 아래의 명시적 포함 목록만 staging 대상으로 삼습니다.

## 판단 기준

- production entry는 src/main.js의 PixiJS 2D 경로이며, renderer=3d는 DEV 전용입니다 (src/main.js:10-29).
- tools/asset-manifest.json에 선언된 public/assets 84개는 source audit 입력으로 포함합니다. 그중 Pages 산출물에 복사·허용되는 것은 SUBMISSION_RUNTIME_ASSETS의 40개뿐입니다.
- Vite가 dist/를 만든 뒤 allowlist 밖의 정적 public asset을 제거하고 다시 검증합니다 (vite.config.js:52-78).
- 따라서 manifest에 선언된 source asset은 포함하되, 스크린샷·trace·cache·생성 중간물과 manifest 밖의 파일은 포함하지 않습니다.

## 반드시 포함

### Production entry와 2D source

| 경로 | 포함 근거 |
|---|---|
| index.html | scene, overlay, hud, fallback DOM과 styles/hud.css 진입점 (index.html:8-18). |
| src/main.js | production에서 Game2D를 import하고 DEV-only Three 경로를 분기 (src/main.js:10-29). |
| src/runtime2d/*.js | 현재 dirty worktree의 실제 2D runtime 전체. Game2D가 World, Pixi presentation, pacing, save/UI를 연결합니다 (src/runtime2d/Game2D.js:1-32). 현재 untracked이므로 누락하면 CI checkout의 production import가 깨집니다. |
| src/data/bosses.js | CombatWorld2D의 boss 정의와 동적 referenceAsset 소비 (src/runtime2d/CombatWorld2D.js:3-5). 현재 untracked입니다. |
| src/audio/Audio.js, src/audio/synth.js | Game2D와 2D 전투 descriptor의 실제 audio cue/voice budget 구현. |
| src/core/Input.js | Game2D의 keyboard/gamepad 입력 소비. |
| src/data/characters.js, src/data/waves.js | 현재 2D 시작 roster와 wave schedule의 dirty 변경. |
| src/ui/CodexScreen.js, src/ui/HintOverlay.js, src/ui/Hud.js, src/ui/LevelUpModal.js, src/ui/ResultScreen.js, src/ui/TitleScreen.js, src/ui/icons.js | Game2D가 직접 연결하는 HUD·메뉴·결과·힌트·아이콘 변경. |
| styles/hud.css | index.html에서 로드되는 production HUD/title/background 스타일. |
| README.md | 현재 실행·build·Pages 경로를 설명하는 변경된 운영 문서. |

현재 untracked인 src/runtime2d/는 다음 파일을 모두 포함해야 합니다.

    src/runtime2d/AnimationState2D.js
    src/runtime2d/backend.js
    src/runtime2d/BossPatterns2D.js
    src/runtime2d/CombatWorld2D.js
    src/runtime2d/ContestPacing2D.js
    src/runtime2d/DaoCombatRuntime2D.js
    src/runtime2d/DaoVows2D.js
    src/runtime2d/EnemyArchetypes2D.js
    src/runtime2d/FormationDirector2D.js
    src/runtime2d/FrameTelemetry2D.js
    src/runtime2d/Game2D.js
    src/runtime2d/ParticleBudget2D.js
    src/runtime2d/PixiPresentation.js
    src/runtime2d/projection.js
    src/runtime2d/Quality2D.js
    src/runtime2d/spriteManifest.js
    src/runtime2d/WeaponBehaviors2D.js
    src/runtime2d/WorldInteractions2D.js
    src/runtime2d/WorldMap2D.js

### Build, CI, asset audit

| 경로 | 포함 근거 |
|---|---|
| .github/workflows/pages.yml | npm ci → test → source asset audit → build → submission build audit → dist upload 순서 (.github/workflows/pages.yml:21-43). |
| package.json, package-lock.json | build, assets:audit, assets:build-audit, test script와 Node/dependency lock (package.json:6-26). |
| vite.config.js | production dist pruner와 post-build asset audit (vite.config.js:52-78). |
| tools/asset-audit.mjs | 84개 public/assets manifest와 실제 파일의 대응 검증 (tools/asset-audit.mjs:41-126). |
| tools/asset-manifest.json | 현재 source/public inventory 84개와 consumer/maxBytes provenance. 전체 manifest를 포함해야 npm run assets:audit가 재현됩니다. |
| tools/submission-assets.mjs | 현재 untracked인 제출 allowlist, dynamic reference helper, output audit/prune 구현 (tools/submission-assets.mjs:15-37, 123-207). |
| tools/audit-submission-build.mjs | CI에서 post-build dist를 독립적으로 재검증하는 entry point (tools/audit-submission-build.mjs:1-6). 현재 untracked입니다. |
| tools/asset-manifest.json에 선언된 public/assets/** | source audit가 manifest의 84개 실제 파일을 모두 요구합니다. authoring/source/legacy/PBR 파일도 source 입력으로는 포함하지만, Pages dist에는 40개만 남습니다 (tools/asset-audit.mjs:108-126, vite.config.js:67-77). |

### 제출 runtime asset 40개

아래 목록은 tools/submission-assets.mjs의 assets/... 경로에 대응하는 public/assets/... 파일입니다. source commit에는 manifest의 84개를 stage하되, 이 40개만 Pages 제출 output에 허용됩니다. 즉, source staging set과 dist shipping set을 혼동하지 않습니다.

    public/assets/characters/jade-void-warden-boss-reference-v2.png
    public/assets/characters/seolryeong-character-reference-v2.png
    public/assets/characters/seolryeong-character-reference-v3.png
    public/assets/environment/jade-sanctuary-environment-v2.png
    public/assets/marketing/yeongheo-contest-keyart-v1.png
    public/assets/ui/skill-icons-v1/area-formation.png
    public/assets/ui/skill-icons-v1/attack-seal.png
    public/assets/ui/skill-icons-v1/bagua-array.png
    public/assets/ui/skill-icons-v1/cooldown-hourglass.png
    public/assets/ui/skill-icons-v1/dao-lotus.png
    public/assets/ui/skill-icons-v1/fire-talisman.png
    public/assets/ui/skill-icons-v1/flying-sword.png
    public/assets/ui/skill-icons-v1/frost-palm.png
    public/assets/ui/skill-icons-v1/healing-core.png
    public/assets/ui/skill-icons-v1/qi-shield.png
    public/assets/ui/skill-icons-v1/soul-eye.png
    public/assets/ui/skill-icons-v1/spirit-butterfly.png
    public/assets/ui/skill-icons-v1/thunder-orb.png
    public/assets/ui/skill-icons-v1/twin-blades.png
    public/assets/ui/skill-icons-v1/vajra.png
    public/assets/ui/skill-icons-v1/windstep.png
    public/assets/ui/stage-thumbnails-v1/ember.png
    public/assets/ui/stage-thumbnails-v1/frost.png
    public/assets/ui/stage-thumbnails-v1/jade.png
    public/assets/materials/environment/jade-highland-ground-v1.png
    public/assets/materials/environment/jade-pavilion-stone-v1.png
    public/assets/sprites2d/blood-scorpion-motion-v1.png
    public/assets/sprites2d/jade-sanctuary-props-v1.png
    public/assets/sprites2d/jade-serpent-motion-v1.png
    public/assets/sprites2d/jade-stone-ghoul-motion-v1.png
    public/assets/sprites2d/jade-void-warden-motion-v2.png
    public/assets/sprites2d/seolryeong-combat-v1.png
    public/assets/sprites2d/seolryeong-heroine-east-motion-v1.png
    public/assets/sprites2d/seolryeong-heroine-motion-v4.png
    public/assets/sprites2d/seolryeong-heroine-northeast-motion-v1.png
    public/assets/sprites2d/seolryeong-heroine-north-motion-v1.png
    public/assets/sprites2d/seolryeong-heroine-south-motion-v1.png
    public/assets/sprites2d/talisman-revenant-motion-v1.png
    public/assets/sprites2d/void-sentinel-motion-v2.png
    public/assets/sprites2d/yorang-motion-v2.png

### Tests

반드시 포함할 test 변경/추가는 다음과 같습니다.

    test/audio.test.js
    test/hints.test.js
    test/input.test.js
    test/smoke.test.js
    test/ui-navigation.test.js
    test/submission-assets.test.js
    test/runtime2d-*.test.js

test/submission-assets.test.js는 boss referenceAsset와 production Pixi URL이 exact allowlist 안에 있는지 검증합니다 (test/submission-assets.test.js:36-63). test/runtime2d-*.test.js는 현재 untracked runtime의 deterministic world, pacing, pool, presentation, integration 계약을 함께 stage해야 의미가 있습니다.

### Submission 문서

제출 설명·권리·readiness·build policy의 text 문서는 포함합니다.

    docs/BUILD_SUBMISSION.md
    docs/competition/ASSET_RIGHTS_LEDGER.md
    docs/competition/CHALLENGE_DELTA.md
    docs/competition/CODEX_COLLABORATION_EVIDENCE.md
    docs/competition/FINAL_RUNTIME_QA.md
    docs/competition/OPENGAME2026_SUBMISSION.md
    docs/competition/READINESS_MATRIX.md
    docs/competition/RELEASE_V4_AUDIT_2026-08-10.md
    docs/competition/RIGHTS_CONFIRMATION_KO.md
    docs/competition/SUBMISSION_COPY_KO.md
    docs/competition/SUBMISSION_COMMIT_SCOPE.md
    docs/competition/SUBMISSION_HANDOFF_2026-08-10.md

docs/BUILD_SUBMISSION.md:5-18의 재현 명령과 docs/competition/*의 제출/권리 상태는 코드와 별도로 검토 가능한 계약입니다. 캡처·trace 원본은 아래 제외 목록에 둡니다.

## 절대 포함하지 않음

### 명시적으로 제외한 변경/증거

| 경로 | 제외 이유 |
|---|---|
| .claude/launch.json | 현재 삭제 상태지만 제출 커밋 범위가 아닙니다. 삭제를 stage하지 말고, 별도 사용자 결정 전까지 scope 밖에 둡니다. |
| .playwright-cli/** | 브라우저 조작 세션/임시 사용자 상태. 재현 가능한 production source가 아닙니다. |
| output/** | 사용자/QA 실행 산출물과 증거 묶음. Pages source가 아닙니다. |
| artifacts/2d-build/**, artifacts/2d-qa/** | build/capture/QA raw evidence. text-only submission record와 구분합니다. |
| artifacts/img2threejs/**, .img2threejs/**, tools/img2threejs/**의 새 authoring/cache 산출물 | Three/img2three authoring pipeline과 cache이며 2D Pages runtime graph가 아닙니다. |
| tools/yeongheo/author_*.py, tools/yeongheo/build_*.py, tools/yeongheo/clean_*.py, tools/yeongheo/report_*.py, tools/yeongheo/validate_*.py | sprite/PBR 생성·정리·검사 도구. 제출 runtime/CI entry가 아닙니다. |
| docs/product/**, docs/superpowers/**의 설계·계획 문서 | 제품/authoring 참고자료이며 제출 build 입력이 아닙니다. |

### manifest 밖 public asset

다음처럼 tools/asset-manifest.json에 선언되지 않은 public asset은 commit하지 않습니다. 현재 source/legacy/PBR 원본 중 manifest에 선언된 파일은 source audit 때문에 포함 대상이며, output에는 들어가지 않습니다.

    public/assets/**  # tools/asset-manifest.json에 없는 신규/임시 파일만 해당

tools/submission-assets.mjs:11-13이 source tree와 Pages bundle을 의도적으로 분리하고, vite.config.js:72-76이 dist에서만 제외 파일을 제거합니다. manifest source 파일을 삭제하거나 source tree에서 이동하지 않습니다.

### legacy Three 변경은 별도 보류

현재 수정된 src/core/Game.js와 src/art/NearEnemyModels.js는 legacy Three 경로입니다. src/main.js:13-20의 DEV-only branch 외 production 2D import graph에는 없습니다. 이 두 파일과 이에 종속된 별도 3D visual 변경은 이번 2D contest commit에 자동 포함하지 말고, 필요한 경우 별도 커밋/검토 범위로 분리합니다. 단, baseline 전체 test를 유지하기 위해 기존 tracked 파일을 삭제하지 않습니다.

## Staging 검증 절차

1. 아래처럼 명시적 path만 dry-run합니다. git add -A, git add ., recursive public/ staging은 금지합니다. public source는 manifest에서 path를 읽어 명시적으로 추가합니다.

       $include = @(
         '.github/workflows/pages.yml', 'README.md', 'index.html',
         'package.json', 'package-lock.json', 'vite.config.js',
         'tools/asset-audit.mjs', 'tools/asset-manifest.json',
         'tools/submission-assets.mjs', 'tools/audit-submission-build.mjs',
         'src/main.js', 'src/data/bosses.js', 'src/runtime2d',
         'src/audio/Audio.js', 'src/audio/synth.js', 'src/core/Input.js',
         'src/data/characters.js', 'src/data/waves.js',
         'src/ui/CodexScreen.js', 'src/ui/HintOverlay.js', 'src/ui/Hud.js',
         'src/ui/LevelUpModal.js', 'src/ui/ResultScreen.js',
         'src/ui/TitleScreen.js', 'src/ui/icons.js', 'styles/hud.css',
         'public/assets/characters/jade-void-warden-boss-reference-v2.png',
         'public/assets/characters/seolryeong-character-reference-v2.png',
         'public/assets/characters/seolryeong-character-reference-v3.png',
         'public/assets/environment/jade-sanctuary-environment-v2.png',
         'public/assets/marketing/yeongheo-contest-keyart-v1.png',
         'public/assets/ui/skill-icons-v1/area-formation.png',
         'public/assets/ui/skill-icons-v1/attack-seal.png',
         'public/assets/ui/skill-icons-v1/bagua-array.png',
         'public/assets/ui/skill-icons-v1/cooldown-hourglass.png',
         'public/assets/ui/skill-icons-v1/dao-lotus.png',
         'public/assets/ui/skill-icons-v1/fire-talisman.png',
         'public/assets/ui/skill-icons-v1/flying-sword.png',
         'public/assets/ui/skill-icons-v1/frost-palm.png',
         'public/assets/ui/skill-icons-v1/healing-core.png',
         'public/assets/ui/skill-icons-v1/qi-shield.png',
         'public/assets/ui/skill-icons-v1/soul-eye.png',
         'public/assets/ui/skill-icons-v1/spirit-butterfly.png',
         'public/assets/ui/skill-icons-v1/thunder-orb.png',
         'public/assets/ui/skill-icons-v1/twin-blades.png',
         'public/assets/ui/skill-icons-v1/vajra.png',
         'public/assets/ui/skill-icons-v1/windstep.png',
         'public/assets/ui/stage-thumbnails-v1/ember.png',
         'public/assets/ui/stage-thumbnails-v1/frost.png',
         'public/assets/ui/stage-thumbnails-v1/jade.png',
         'public/assets/materials/environment/jade-highland-ground-v1.png',
         'public/assets/materials/environment/jade-pavilion-stone-v1.png',
         'public/assets/sprites2d/blood-scorpion-motion-v1.png',
         'public/assets/sprites2d/jade-sanctuary-props-v1.png',
         'public/assets/sprites2d/jade-serpent-motion-v1.png',
         'public/assets/sprites2d/jade-stone-ghoul-motion-v1.png',
         'public/assets/sprites2d/jade-void-warden-motion-v2.png',
         'public/assets/sprites2d/seolryeong-combat-v1.png',
         'public/assets/sprites2d/seolryeong-heroine-east-motion-v1.png',
         'public/assets/sprites2d/seolryeong-heroine-motion-v4.png',
         'public/assets/sprites2d/seolryeong-heroine-northeast-motion-v1.png',
         'public/assets/sprites2d/seolryeong-heroine-north-motion-v1.png',
         'public/assets/sprites2d/seolryeong-heroine-south-motion-v1.png',
         'public/assets/sprites2d/talisman-revenant-motion-v1.png',
         'public/assets/sprites2d/void-sentinel-motion-v2.png',
         'public/assets/sprites2d/yorang-motion-v2.png',
         'test/audio.test.js', 'test/hints.test.js', 'test/input.test.js',
         'test/smoke.test.js', 'test/ui-navigation.test.js',
         'test/submission-assets.test.js', 'test/runtime2d-*.test.js',
         'docs/BUILD_SUBMISSION.md', 'docs/competition'
       )
       $manifestPaths = (Get-Content -Raw tools/asset-manifest.json | ConvertFrom-Json).assets.path
       $include += $manifestPaths
       git add --dry-run -- $include

2. 실제 staging 후 이름·삭제·금지 경로를 검증합니다.

       git diff --cached --name-status
       git diff --cached --check
       $forbidden = git diff --cached --name-only | Where-Object {
         $_ -match '^(\.claude/launch\.json|\.playwright-cli/|output/|artifacts/|docs/product/|docs/superpowers/|tools/yeongheo/)'
       }
       if ($forbidden) { $forbidden; throw 'forbidden submission path staged' }

3. staged public source set이 manifest 84개와 정확히 일치하고, 그 안에 runtime allowlist 40개가 포함되는지 확인합니다. manifest 밖 public 파일을 stage하지 않았는지 반드시 확인합니다.

       $stagedPublic = git diff --cached --name-only |
         Where-Object { $_ -like 'public/assets/*' } |
         ForEach-Object { $_.Substring('public/'.Length) } |
         Sort-Object
       $manifestPaths = (Get-Content -Raw tools/asset-manifest.json | ConvertFrom-Json).assets.path | Sort-Object
       $allow = node --input-type=module -e "import { SUBMISSION_RUNTIME_ASSETS } from './tools/submission-assets.mjs'; console.log(SUBMISSION_RUNTIME_ASSETS.join('\n'))"
       $allow = $allow -split ([Environment]::NewLine) | Where-Object { $_ } | Sort-Object
       $missingSource = $manifestPaths | Where-Object { $_ -notin $stagedPublic }
       $unexpectedSource = $stagedPublic | Where-Object { $_ -notin $manifestPaths }
       $missingRuntime = $allow | Where-Object { $_ -notin $stagedPublic }
       if ($missingSource -or $unexpectedSource -or $missingRuntime) {
         $missingSource; $unexpectedSource; $missingRuntime
         throw 'manifest/source/runtime staging mismatch'
       }

4. clean-install과 제출 output을 재검증합니다.

       npm ci
       npm test
       npm run assets:audit
       npm run build
       npm run assets:build-audit

   기대값은 assets:audit의 assetCount=84, actualFileCount=84, build audit의 requiredAssetCount=40, sourceMissing=[], outputMissing=[], unexpectedOutputAssets=[]입니다. 이 명령은 staging 검증용이며, 결과물 dist/는 commit하지 않습니다.

5. 마지막으로 staged 범위와 남은 dirty 파일을 분리해 확인합니다.

       git diff --cached --name-only
       git status --short

남은 .claude/launch.json, .playwright-cli/, output/, artifacts/, authoring asset 및 별도 legacy Three 변경은 이 문서의 제출 범위 밖이며, 삭제·정리하지 않습니다.
