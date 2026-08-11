# OpenAI Game Builders Seoul 제출 자산 권리 원장

> 기준 시각: 2026-08-10 KST / release-v5.3
> 범위: `tools/asset-manifest.json`, `public/assets/**`, 현재 제출 allowlist, 생성·provenance 문서
> 판정: **권리 게이트 차단**. 이 문서는 어떤 미확인 자산도 승인하지 않는다.
> package 기준: release-v5.3 Web/Windows 로컬 검토 후보. 현재 패키지 fingerprint는 [RELEASE_V5_3_AUDIT_2026-08-10.md](./RELEASE_V5_3_AUDIT_2026-08-10.md)를 우선하며, 본문의 release-v3~v5.2 provenance·해시 명칭은 역사 라벨로 보존한다.

## 이 원장의 판정 방식

`분류`는 파일이 어떻게 만들어졌는지에 대한 기술적 provenance이고, `권리 상태`는 대회에 제출·공개할 법적 근거가 실제로 확인됐는지에 대한 별도 판정입니다. `generated`라고 해서 `own` 또는 권리 확인을 뜻하지 않습니다.

| 분류 | 의미 |
|---|---|
| `own` | 프로젝트/팀의 직접 제작 또는 양도·사용 허락 증거가 저장되어 있어 권리 주체를 확인할 수 있는 것 |
| `generated` | 저장소 문서가 ImageGen, 후처리, procedural/Forge/TRELLIS 등 생성·파생 과정을 명시하는 것. 출력 권리는 별도 확인이 필요함 |
| `external` | 제3자 파일·도구·서비스가 제공한 원본 또는 코드. 해당 라이선스와 대회 공개·배포 범위를 따로 확인해야 함 |
| `unknown` | 원천, 제작자, 제공자 또는 사용 조건을 현재 증거로 추적할 수 없는 것 |

권리 상태는 `확인됨`이라고 적을 수 있는 명시적 소유·허락·라이선스 증거가 없는 한 `미확인·차단`으로 유지한다. 기술 QA의 `PASS`, 매니페스트 등록, 파일이 저장소에 있다는 사실, AI로 생성했다는 사실은 권리 승인 증거가 아니다.

## 공식 권리 게이트

공식 [참가 약관](https://openaigame2026.com/ko/terms)에서 다음을 확인했다.

- 제7조 제3항: 소스코드, 이미지, 영상, 음원, 폰트, 데이터, 오픈소스, **AI 생성물**, 외부 에셋 등에 필요한 권리 또는 사용 허락을 참가자가 확보해야 한다.
- 제7조 제4항: 제출작은 제3자의 저작권·상표권·초상권·개인정보·영업비밀·명예 등 권리를 침해해서는 안 된다.
- 제8조 제6항: OpenAI 서비스, 외부 플랫폼, 라이브러리, 오픈소스, 클라우드, 엔진, 배포 서비스의 약관·정책·라이선스를 참가자가 직접 확인해야 한다.
- 제11조 제4~5항: 참가자는 제출·공개 권한과 제3자 권리 비침해를 보증하며, 침해·라이선스 분쟁 책임을 부담한다. 제11조 제2~3항에 따라 제출 정보는 심사·행사·홍보 목적의 무상·비독점 이용 대상이 될 수 있다.

따라서 ImageGen 출력, chroma-key 후처리, img2threejs/Forge PBR 파생물, TRELLIS GLB, 썸네일, 녹화 영상에 각각 제출·공개·홍보를 포괄하는 권리 증거가 있어야 한다. 이 원장의 `generated` 표기는 이 요건을 충족했다는 뜻이 아니다.

### OpenAI 출력에 관한 별도 공식 근거 — 대회 약관과 분리

대회 약관과 OpenAI 서비스 약관은 서로 다른 게이트다. 아래는 현재 확인한 공식 OpenAI 근거이며, 대회 참가 약관의 권리 보증을 대체하지 않는다.

- 공식 [OpenAI Terms of Use (Rest of World)](https://openai.com/policies/row-terms-of-use/)는 2026-01-01 시행본이다. 해당 약관의 `Output` 조항은 **법이 허용하는 범위에서, 사용자와 OpenAI 사이에서는 사용자가 Output을 소유하고 OpenAI가 자신이 가질 수 있는 권리·권원·이익을 사용자에게 양도한다**고 규정한다.
- 같은 약관은 사용자가 Input에 필요한 권리·라이선스·허락을 보유할 책임, Output이 고유하지 않을 수 있다는 점, 제3자 서비스/Output에는 별도 약관이 적용될 수 있다는 점, Output을 사람의 생성물이라고 가장해서는 안 된다는 점, 정확성·적합성을 사람이 검토해야 한다는 점을 함께 둔다. OpenAI는 비침해를 보증하지 않는다.
- 공식 [OpenAI Service Terms](https://openai.com/policies/service-terms/)의 시각 기능 제한은 사람의 초상을 명시적 동의와 필요한 권리 없이 재현하지 않도록 한다. 이 조항은 안전·사용 조건이지, 이 저장소의 특정 파일에 대한 계정·입력·동의·팀 소유권을 증명하는 기록은 아니다.
- `.codex/generated_images`와 `artifacts/2d-build`의 파일·SHA-256은 로컬 출력 보관·동일성 증거일 뿐, 어느 OpenAI 계정/관할/서비스 약관으로 생성됐는지, Input 권리가 있었는지, 팀 대표자가 제출·홍보권을 갖는지는 증명하지 않는다. 그러므로 위 OpenAI 약관을 근거로 77개 중 어느 것도 `own` 또는 권리 확인으로 승격하지 않는다.
- `img2threejs`/TRELLIS/Forge/Hugging Face 등 외부 파이프라인 결과에는 위 OpenAI Output 조항을 자동 적용하지 않는다. 외부 서비스 약관·입력 권리·출력 권리·팀 권한은 별도로 확인해야 한다.

## 현재 인벤토리와 제출 경계

| 확인 항목 | 현재 관찰값 | 증거 | 판정 |
|---|---:|---|---|
| 매니페스트 자산 | 125개 | `tools/asset-manifest.json` | 기술 목록 확인 |
| 실제 `public/assets` 파일 | 125개 | `public/assets/**` 재귀 목록 | 매니페스트와 수량 일치 |
| 현재 제출 runtime allowlist | 77개 | `tools/submission-assets.mjs`의 `SUBMISSION_RUNTIME_ASSETS` | 아래 77개만 계획상 번들 포함 |
| allowlist 밖 public 자산 | 48개 | 매니페스트와 allowlist 차집합 | 제출 번들에서 제외하도록 설계됨. generic `public/**` 배포로 재포함되지 않는지 별도 확인 필요 |
| 권리 증거 파일 | 법적 권리 증거 없음; 기술 provenance는 77/77 추적 | 직접 출력 8/77, sprite source chain 18/77(원본과 source exact 15 + 원본·생성 로그·변환 재현 3), release-v3 UI atlas chain 19/77, release-v5 의미별 아이콘 atlas chain 32/77, exact original 미검출 0/77. 계정·Input 권리·대표자 권한·대회 공개 허락 기록은 없음 | 기술 provenance 77/77 확인; 법적 권리 0/77·차단 |

`tools/asset-manifest.json`의 `source`는 기술적 생성 경로만 기록하고 저작자, 권리 주체, AI 서비스 약관 버전, 출력물의 상업·공개 허용 범위를 기록하지 않는다. `tools/asset-audit.mjs`도 경로·스키마·소비자·용량을 검사할 뿐 권리를 검사하지 않는다.

## 제출 포함 자산 원장 — 77개

아래 77개는 현재 `tools/submission-assets.mjs` allowlist와 매니페스트의 교집합이다. 전부 기술 provenance는 `generated`로 분류한다. 상태 문구의 `로컬 원본 확인` 또는 `source chain 확인`은 파일 동일성과 경로가 확인됐다는 뜻일 뿐, 권리 상태가 `own` 또는 제출 승인으로 바뀌었다는 뜻이 아니다. `외부 파이프라인` 표시는 출력 파일의 외부 사용권이 확인됐다는 뜻이 아니다.

| ID | 제출 경로 | 분류 | 매니페스트 `source` | 런타임 사용·증빙 경로 | 라이선스/AI 고지 및 미확인 위험 | 권리 상태 |
|---|---|---|---|---|---|---|
| AS-01 | `public/assets/environment/jade-sanctuary-environment-v2.png` | `generated` | `imagegen` | 환경 배경; `tools/asset-manifest.json`, `tools/submission-assets.mjs`, `src/world/SanctuaryCinematicSet.js` | ImageGen 출력과 local `.codex` 원본 SHA가 일치하지만 계정·Input 권리·초상/상표 검토와 대회 공개 허락은 없음 | **로컬 원본 확인·법적 권리 미확인·차단** |
| AS-02 | `public/assets/marketing/yeongheo-contest-keyart-v1.png` | `generated` | `imagegen` | 제목/마케팅 키아트; `tools/asset-manifest.json`, `tools/submission-assets.mjs` | ImageGen 출력과 local `.codex` 원본 SHA가 일치하지만 썸네일·홍보 사용 허락, 인물·상표 검토와 대표자 권한은 없음 | **로컬 원본 확인·법적 권리 미확인·차단** |
| AS-03 | `public/assets/sprites2d/seolryeong-combat-v1.png` | `generated` | `imagegen-chroma-key-alpha` | 주인공 전투 portrait; `src/runtime2d/spriteManifest.js`, `artifacts/2d-qa/SPRITE_ASSET_AUDIT.md` | `sourceUrl`와 ImageGen 원본 SHA가 일치하고 chroma 후처리 경로가 있으나 Input·초상·상표·공개 권리와 정확한 실행 로그는 없음 | **로컬 source chain 확인·법적 권리 미확인·차단** |
| AS-04 | `public/assets/sprites2d/seolryeong-heroine-motion-v4.png` | `generated` | `imagegen-chroma-key-alpha-despill` | 주인공 이동·공격 atlas; `src/runtime2d/spriteManifest.js`, `artifacts/2d-qa/SPRITE_ASSET_AUDIT.md` | ImageGen call `exec-5df835cf-c68d-412d-ab42-4a61628b670b` 원본·revised prompt·후처리 로그를 복구했고 격리 재현 source/runtime이 각각 byte·RGBA exact match. 계정·Input·초상/상표·공개 권리 증거는 없음 | **로컬 source chain 재현 확인·법적 권리 미확인·차단** |
| AS-05 | `public/assets/sprites2d/seolryeong-heroine-east-motion-v1.png` | `generated` | `imagegen-chroma-key-alpha-despill-directional-v1` | 동쪽 방향 atlas; `src/runtime2d/spriteManifest.js`, `artifacts/2d-qa/SPRITE_ASSET_AUDIT.md` | `sourceUrl`와 ImageGen 원본 SHA가 일치하지만 방향성 생성의 Input·초상·상표·공개 권리 및 정확한 실행 로그는 없음 | **로컬 source chain 확인·법적 권리 미확인·차단** |
| AS-06 | `public/assets/sprites2d/seolryeong-heroine-north-motion-v1.png` | `generated` | `imagegen-chroma-key-alpha-despill-directional-v1` | 북쪽 방향 atlas; `src/runtime2d/spriteManifest.js`, `artifacts/2d-qa/SPRITE_ASSET_AUDIT.md` | `sourceUrl`와 ImageGen 원본 SHA가 일치하지만 방향성 생성의 Input·초상·상표·공개 권리 및 정확한 실행 로그는 없음 | **로컬 source chain 확인·법적 권리 미확인·차단** |
| AS-07 | `public/assets/sprites2d/seolryeong-heroine-northeast-motion-v1.png` | `generated` | `imagegen-chroma-key-alpha-despill-directional-v1` | 북동쪽 방향 atlas; `src/runtime2d/spriteManifest.js`, `artifacts/2d-qa/SPRITE_ASSET_AUDIT.md` | `sourceUrl`와 ImageGen 원본 SHA가 일치하지만 방향성 생성의 Input·초상·상표·공개 권리 및 정확한 실행 로그는 없음 | **로컬 source chain 확인·법적 권리 미확인·차단** |
| AS-08 | `public/assets/sprites2d/seolryeong-heroine-south-motion-v1.png` | `generated` | `imagegen-chroma-key-alpha-despill-directional-v1` | 남쪽 방향 atlas; `src/runtime2d/spriteManifest.js`, `artifacts/2d-qa/SPRITE_ASSET_AUDIT.md` | `sourceUrl`와 ImageGen 원본 SHA가 일치하지만 방향성 생성의 Input·초상·상표·공개 권리 및 정확한 실행 로그는 없음 | **로컬 source chain 확인·법적 권리 미확인·차단** |
| AS-09 | `public/assets/sprites2d/yorang-motion-v2.png` | `generated` | `imagegen-chroma-key-alpha-despill` | 일반 적 motion atlas; `src/runtime2d/spriteManifest.js`, `artifacts/2d-qa/SPRITE_ASSET_AUDIT.md` | `sourceUrl`와 ImageGen 원본 SHA가 일치하지만 Input·제3자 유사성·공개 권리와 정확한 후처리 실행 로그는 없음 | **로컬 source chain 확인·법적 권리 미확인·차단** |
| AS-10 | `public/assets/sprites2d/void-sentinel-motion-v2.png` | `generated` | `imagegen-chroma-key-alpha-despill` | 정예 적 motion atlas; `src/runtime2d/spriteManifest.js`, `artifacts/2d-qa/SPRITE_ASSET_AUDIT.md` | `sourceUrl`와 ImageGen 원본 SHA가 일치하지만 Input·제3자 유사성·공개 권리와 정확한 후처리 실행 로그는 없음 | **로컬 source chain 확인·법적 권리 미확인·차단** |
| AS-11 | `public/assets/sprites2d/jade-void-warden-motion-v2.png` | `generated` | `imagegen-chroma-key-alpha-despill` | 보스 motion atlas; `src/runtime2d/spriteManifest.js`, `artifacts/2d-qa/SPRITE_ASSET_AUDIT.md` | `sourceUrl`와 ImageGen 원본 SHA가 일치하지만 Input·제3자 유사성·공개 권리와 정확한 후처리 실행 로그는 없음 | **로컬 source chain 확인·법적 권리 미확인·차단** |
| AS-12 | `public/assets/sprites2d/jade-sanctuary-props-v1.png` | `generated` | `imagegen-chroma-key-alpha-despill` | 환경 소품 atlas; `src/runtime2d/spriteManifest.js`, `artifacts/2d-qa/SPRITE_ASSET_AUDIT.md` | `sourceUrl`와 ImageGen 원본 SHA가 일치하지만 Input·상표·공개 권리와 정확한 후처리 실행 로그는 없음 | **로컬 source chain 확인·법적 권리 미확인·차단** |
| AS-13 | `public/assets/sprites2d/talisman-revenant-motion-v1.png` | `generated` | `imagegen-chroma-key-alpha-despill` | 부적 망령 motion atlas; `src/runtime2d/spriteManifest.js`, `artifacts/2d-qa/SPRITE_ASSET_AUDIT.md` | `sourceUrl`와 ImageGen 원본 SHA가 일치하지만 Input·제3자 유사성·공개 권리와 정확한 후처리 실행 로그는 없음 | **로컬 source chain 확인·법적 권리 미확인·차단** |
| AS-14 | `public/assets/sprites2d/jade-serpent-motion-v1.png` | `generated` | `imagegen-chroma-key-alpha-despill` | 비취 뱀 motion atlas; `src/runtime2d/spriteManifest.js`, `artifacts/2d-qa/SPRITE_ASSET_AUDIT.md` | ImageGen call `exec-784f3722-5ae1-4794-8531-e1e03696b7c5` 원본·revised prompt·후처리 로그를 복구했고 격리 재현 source/runtime이 각각 byte·RGBA exact match. `qa.allowGreenEdge`와 기술 재현은 법적 권리 증거가 아님 | **로컬 source chain 재현 확인·법적 권리 미확인·차단** |
| AS-15 | `public/assets/sprites2d/jade-stone-ghoul-motion-v1.png` | `generated` | `imagegen-chroma-key-alpha-despill` | 석귀 motion atlas; `src/runtime2d/spriteManifest.js`, `artifacts/2d-qa/SPRITE_ASSET_AUDIT.md` | `sourceUrl`와 ImageGen 원본 SHA가 일치하지만 `qa.allowGreenEdge`는 권리 증거가 아니며 Input·공개 권리와 실행 로그가 없음 | **로컬 source chain 확인·법적 권리 미확인·차단** |
| AS-16 | `public/assets/sprites2d/blood-scorpion-motion-v1.png` | `generated` | `imagegen-chroma-key-alpha-despill` | 혈갈 motion atlas; `src/runtime2d/spriteManifest.js`, `artifacts/2d-qa/SPRITE_ASSET_AUDIT.md` | ImageGen call `exec-dfac7553-c13d-4e05-9b7f-4907d1cd50b0` 원본·revised prompt·4단계 후처리 로그를 복구했고 격리 재현 source/runtime이 각각 byte·RGBA exact match. Input·공개 권리 증거는 없음 | **로컬 source chain 재현 확인·법적 권리 미확인·차단** |
| AS-17 | `public/assets/characters/seolryeong-character-reference-v2.png` | `generated` | `imagegen` | 타이틀 캐릭터 reference; `src/ui/TitleScreen.js`, `docs/QUALITY_STATUS.md` | ImageGen 출력과 local `.codex` 원본 SHA가 일치하지만 Input·프롬프트·초상/상표 검토·팀 제출 권리는 없음 | **로컬 원본 확인·법적 권리 미확인·차단** |
| AS-18 | `public/assets/characters/seolryeong-character-reference-v3.png` | `generated` | `imagegen-plus-artifact-template-yeongheo-aaa-asset-brief` | 최신 타이틀 캐릭터 reference; `src/ui/TitleScreen.js`, `docs/QUALITY_STATUS.md` | ImageGen 출력과 local `.codex` 원본 SHA가 일치하지만 템플릿 권리·Input·초상/상표 검토·팀 제출 권리는 없음 | **로컬 원본 확인·법적 권리 미확인·차단** |
| AS-19 | `public/assets/characters/jade-void-warden-boss-reference-v2.png` | `generated` | `imagegen` | 보스 reference; `src/entities/BossManager.js` | ImageGen 출력과 local `.codex` 원본 SHA가 일치하지만 Input·제3자 표식·출력 사용권·팀 제출 권리는 없음 | **로컬 원본 확인·법적 권리 미확인·차단** |
| AS-20 | `public/assets/materials/environment/jade-pavilion-stone-v1.png` | `generated` | `imagegen` | 제단 paver 재질; `src/world/SanctuaryCinematicSet.js`, `docs/QUALITY_STATUS.md` | ImageGen 출력과 local `.codex` 원본 SHA가 일치하지만 텍스처 Input·유사성·공개·상업 사용과 팀 권한은 없음 | **로컬 원본 확인·법적 권리 미확인·차단** |
| AS-21 | `public/assets/materials/environment/jade-highland-ground-v1.png` | `generated` | `imagegen` | 2D 비취 고원 ground 재질; `src/runtime2d/PixiPresentation.js` | ImageGen 출력과 local `.codex` 원본 SHA가 일치하지만 텍스처 Input·유사성·공개·상업 사용과 팀 권한은 없음 | **로컬 원본 확인·법적 권리 미확인·차단** |
| AS-22 | `public/assets/ui/skill-icons-v1/area-formation.png` | `generated` | `imagegen-atlas-crop` | 결계/장판 아이콘; `src/ui/icons.js` | release-v3 4×4 ImageGen 원본 atlas에서 결정적 crop; 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-23 | `public/assets/ui/skill-icons-v1/attack-seal.png` | `generated` | `imagegen-atlas-crop` | 공격 부적 아이콘; `src/ui/icons.js` | 위와 동일 | **source chain 확인·법적 권리 미확인·차단** |
| AS-24 | `public/assets/ui/skill-icons-v1/bagua-array.png` | `generated` | `imagegen-atlas-crop` | 팔괘진 아이콘; `src/ui/icons.js` | 위와 동일 | **source chain 확인·법적 권리 미확인·차단** |
| AS-25 | `public/assets/ui/skill-icons-v1/cooldown-hourglass.png` | `generated` | `imagegen-atlas-crop` | 재사용 대기 아이콘; `src/ui/icons.js` | 위와 동일 | **source chain 확인·법적 권리 미확인·차단** |
| AS-26 | `public/assets/ui/skill-icons-v1/dao-lotus.png` | `generated` | `imagegen-atlas-crop` | 도가 연화 아이콘; `src/ui/icons.js` | 위와 동일 | **source chain 확인·법적 권리 미확인·차단** |
| AS-27 | `public/assets/ui/skill-icons-v1/fire-talisman.png` | `generated` | `imagegen-atlas-crop` | 화염 부적 아이콘; `src/ui/icons.js` | 위와 동일 | **source chain 확인·법적 권리 미확인·차단** |
| AS-28 | `public/assets/ui/skill-icons-v1/flying-sword.png` | `generated` | `imagegen-atlas-crop` | 비검 아이콘; `src/ui/icons.js` | 위와 동일 | **source chain 확인·법적 권리 미확인·차단** |
| AS-29 | `public/assets/ui/skill-icons-v1/frost-palm.png` | `generated` | `imagegen-atlas-crop` | 빙장 아이콘; `src/ui/icons.js` | 위와 동일 | **source chain 확인·법적 권리 미확인·차단** |
| AS-30 | `public/assets/ui/skill-icons-v1/healing-core.png` | `generated` | `imagegen-atlas-crop` | 치유 핵 아이콘; `src/ui/icons.js` | 위와 동일 | **source chain 확인·법적 권리 미확인·차단** |
| AS-31 | `public/assets/ui/skill-icons-v1/qi-shield.png` | `generated` | `imagegen-atlas-crop` | 기 보호막 아이콘; `src/ui/icons.js` | 위와 동일 | **source chain 확인·법적 권리 미확인·차단** |
| AS-32 | `public/assets/ui/skill-icons-v1/soul-eye.png` | `generated` | `imagegen-atlas-crop` | 영안 아이콘; `src/ui/icons.js` | 위와 동일 | **source chain 확인·법적 권리 미확인·차단** |
| AS-33 | `public/assets/ui/skill-icons-v1/spirit-butterfly.png` | `generated` | `imagegen-atlas-crop` | 영접 아이콘; `src/ui/icons.js` | 위와 동일 | **source chain 확인·법적 권리 미확인·차단** |
| AS-34 | `public/assets/ui/skill-icons-v1/thunder-orb.png` | `generated` | `imagegen-atlas-crop` | 천뢰주 아이콘; `src/ui/icons.js` | 위와 동일 | **source chain 확인·법적 권리 미확인·차단** |
| AS-35 | `public/assets/ui/skill-icons-v1/twin-blades.png` | `generated` | `imagegen-atlas-crop` | 쌍검 아이콘; `src/ui/icons.js` | 위와 동일 | **source chain 확인·법적 권리 미확인·차단** |
| AS-36 | `public/assets/ui/skill-icons-v1/vajra.png` | `generated` | `imagegen-atlas-crop` | 금강저 아이콘; `src/ui/icons.js` | 위와 동일 | **source chain 확인·법적 권리 미확인·차단** |
| AS-37 | `public/assets/ui/skill-icons-v1/windstep.png` | `generated` | `imagegen-atlas-crop` | 경신법 아이콘; `src/ui/icons.js` | 위와 동일 | **source chain 확인·법적 권리 미확인·차단** |
| AS-38 | `public/assets/ui/stage-thumbnails-v1/ember.png` | `generated` | `imagegen-atlas-crop` | 적염비경 카드; `src/ui/TitleScreen.js` | release-v3 비경 ImageGen atlas에서 결정적 crop; 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-39 | `public/assets/ui/stage-thumbnails-v1/frost.png` | `generated` | `imagegen-atlas-crop` | 한천비경 카드; `src/ui/TitleScreen.js` | 위와 동일 | **source chain 확인·법적 권리 미확인·차단** |
| AS-40 | `public/assets/ui/stage-thumbnails-v1/jade.png` | `generated` | `imagegen-atlas-crop` | 청람비경 카드; `src/ui/TitleScreen.js` | 위와 동일 | **source chain 확인·법적 권리 미확인·차단** |
| AS-41 | `public/assets/ui/skill-icons-v2/venom-palm.png` | `generated` | `imagegen-skill-atlas-crop-v2` | 독장 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-42 | `public/assets/ui/skill-icons-v2/hidden-needles.png` | `generated` | `imagegen-skill-atlas-crop-v2` | 암기 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-43 | `public/assets/ui/skill-icons-v2/spirit-bell.png` | `generated` | `imagegen-skill-atlas-crop-v2` | 영종 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-44 | `public/assets/ui/skill-icons-v2/wind-blades.png` | `generated` | `imagegen-skill-atlas-crop-v2` | 풍인 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-45 | `public/assets/ui/skill-icons-v2/earth-dragon-spikes.png` | `generated` | `imagegen-skill-atlas-crop-v2` | 지룡극 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-46 | `public/assets/ui/skill-icons-v2/heavenly-lightning.png` | `generated` | `imagegen-skill-atlas-crop-v2` | 천뢰 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-47 | `public/assets/ui/skill-icons-v2/myriad-swords.png` | `generated` | `imagegen-skill-atlas-crop-v2` | 만검귀원 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-48 | `public/assets/ui/skill-icons-v2/inferno-sea.png` | `generated` | `imagegen-skill-atlas-crop-v2` | 분천화해 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-49 | `public/assets/ui/skill-icons-v2/violet-thunder.png` | `generated` | `imagegen-skill-atlas-crop-v2` | 자소신뢰 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-50 | `public/assets/ui/skill-icons-v2/frozen-sky.png` | `generated` | `imagegen-skill-atlas-crop-v2` | 한천빙옥 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-51 | `public/assets/ui/skill-icons-v2/plague-tide.png` | `generated` | `imagegen-skill-atlas-crop-v2` | 역조 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-52 | `public/assets/ui/skill-icons-v2/needle-storm.png` | `generated` | `imagegen-skill-atlas-crop-v2` | 천침폭우 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-53 | `public/assets/ui/skill-icons-v2/heart-method.png` | `generated` | `imagegen-skill-atlas-crop-v2` | 심법 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-54 | `public/assets/ui/skill-icons-v2/sword-riding.png` | `generated` | `imagegen-skill-atlas-crop-v2` | 어검결 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-55 | `public/assets/ui/skill-icons-v2/clone-art.png` | `generated` | `imagegen-skill-atlas-crop-v2` | 분신결 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-56 | `public/assets/ui/skill-icons-v2/destined-bond.png` | `generated` | `imagegen-skill-atlas-crop-v2` | 연분 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-57 | `public/assets/ui/skill-icons-v2/sword-oath.png` | `generated` | `imagegen-dao-atlas-crop-v1` | 검계 맹세 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-58 | `public/assets/ui/skill-icons-v2/returning-edge.png` | `generated` | `imagegen-dao-atlas-crop-v1` | 회귀검선 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-59 | `public/assets/ui/skill-icons-v2/piercing-edge.png` | `generated` | `imagegen-dao-atlas-crop-v1` | 관통검선 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-60 | `public/assets/ui/skill-icons-v2/sword-ring.png` | `generated` | `imagegen-dao-atlas-crop-v1` | 검환 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-61 | `public/assets/ui/skill-icons-v2/frost-oath.png` | `generated` | `imagegen-dao-atlas-crop-v1` | 빙계 맹세 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-62 | `public/assets/ui/skill-icons-v2/frost-shards.png` | `generated` | `imagegen-dao-atlas-crop-v1` | 빙결 파편 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-63 | `public/assets/ui/skill-icons-v2/frost-line.png` | `generated` | `imagegen-dao-atlas-crop-v1` | 빙결 직선 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-64 | `public/assets/ui/skill-icons-v2/ice-wall.png` | `generated` | `imagegen-dao-atlas-crop-v1` | 빙벽 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-65 | `public/assets/ui/skill-icons-v2/spirit-oath.png` | `generated` | `imagegen-dao-atlas-crop-v1` | 영계 맹세 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-66 | `public/assets/ui/skill-icons-v2/purifying-heart.png` | `generated` | `imagegen-dao-atlas-crop-v1` | 정화심 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-67 | `public/assets/ui/skill-icons-v2/echoing-heart.png` | `generated` | `imagegen-dao-atlas-crop-v1` | 공명심 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-68 | `public/assets/ui/skill-icons-v2/shadow-copy.png` | `generated` | `imagegen-dao-atlas-crop-v1` | 그림자 복제 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-69 | `public/assets/ui/skill-icons-v2/void-orb.png` | `generated` | `imagegen-dao-atlas-crop-v1` | 허공주 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-70 | `public/assets/ui/skill-icons-v2/heal.png` | `generated` | `imagegen-dao-atlas-crop-v1` | 회춘단 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-71 | `public/assets/ui/skill-icons-v2/spirit-stones.png` | `generated` | `imagegen-dao-atlas-crop-v1` | 영석 주머니 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-72 | `public/assets/ui/skill-icons-v2/purge.png` | `generated` | `imagegen-dao-atlas-crop-v1` | 정화부 의미별 아이콘; `src/ui/icons.js` | 로컬 ImageGen atlas의 결정적 crop과 SHA 연결은 확인했으나 계정·Input·공개·팀 제출 권리 증거 없음 | **source chain 확인·법적 권리 미확인·차단** |
| AS-73 | `public/assets/materials/environment/jade-sanctuary-ground-material-v2.png` | `generated` | `imagegen` | WorldClaw의 생성 재질+절차 지역 변주 원칙을 적용한 2D 청람 성역 seamless ground; `src/runtime2d/PixiPresentation.js` | ImageGen 직접 출력과 local `.codex` 원본 SHA가 일치하지만 계정·Input 권리·제3자 유사성·공개·상업·대회 사용과 팀 권한 증거는 없음 | **로컬 원본 확인·법적 권리 미확인·차단** |
| AS-74 | `public/assets/sprites2d/magi-remnant-motion-v2.png` | `generated` | `imagegen-chroma-key-alpha-despill-atlas-normalize-v2` | 초반 마기 잔영 적 4×2 이동·공격 atlas; `src/runtime2d/spriteManifest.js`, `src/runtime2d/PixiPresentation.js` | local ImageGen source SHA와 기록된 chroma-key·alpha·atlas 정규화·despill 변환은 확인했지만 생성 계정·Input 권리·제3자 유사성·공개·상업·대회 사용과 팀 권한 증거는 없음 | **로컬 source chain 확인·법적 권리 미확인·차단** |
| AS-75 | `public/assets/sprites2d/jade-shard-guardian-motion-v1.png` | `generated` | `imagegen-chroma-key-alpha-despill-atlas-normalize-v1` | 석귀 군중의 비대칭 옥정 수호자 4×2 이동·공격 atlas; `src/runtime2d/spriteManifest.js`, `src/runtime2d/PixiPresentation.js` | local ImageGen source/original SHA와 runtime 파생물 SHA·후처리 설명은 확인했지만 생성 계정·Input 권리·제3자 유사성·공개·상업·대회 사용과 팀 권한 증거는 없음 | **로컬 source chain 확인·법적 권리 미확인·차단** |
| AS-76 | `public/assets/sprites2d/masked-seal-revenant-motion-v1.png` | `generated` | `imagegen-chroma-key-alpha-despill-atlas-normalize-v1` | 부적 원혼 군중의 가면·부적부채 변형 4×2 이동·공격 atlas; `src/runtime2d/spriteManifest.js`, `src/runtime2d/PixiPresentation.js` | local ImageGen source/original SHA와 runtime 파생물 SHA·후처리·실제 1920×1080/2560×1600 시각 확인은 기록했지만 생성 계정·Input 권리·제3자 유사성·공개·상업·대회 사용과 팀 권한 증거는 없음 | **로컬 source chain 확인·법적 권리 미확인·차단** |
| AS-77 | `public/assets/sprites2d/shadow-seal-duelist-motion-v1.png` | `generated` | `imagegen-chroma-key-alpha-despill-atlas-normalize-v1` | 마수사 군중의 비대칭 쌍검·짧은 장포 변형 4×2 이동·공격 atlas; `src/runtime2d/spriteManifest.js`, `src/runtime2d/PixiPresentation.js` | local ImageGen source/original SHA와 runtime 파생물 SHA·후처리·실제 1920×1080/2560×1600 시각 확인은 기록했지만 생성 계정·Input 권리·제3자 유사성·공개·상업·대회 사용과 팀 권한 증거는 없음 | **로컬 source chain 확인·법적 권리 미확인·차단** |

### 로컬 provenance snapshots — 2026-08-09 기존 / 2026-08-10 release-v3·v5

다음 fingerprint는 현재 작업 트리에서 다시 읽은 값이다. SHA-256·바이트 수·mtime은 파일 동일성/재현 추적용 증거이며, 저작권·대회 제출권을 뜻하지 않는다. 시간은 모두 UTC이고, Git 상태는 snapshot 당시 기준이다.

#### 기존 제출 파일 fingerprint — AS-01~AS-21

| ID | 제출 파일 | 바이트 | SHA-256 | mtime UTC | Git 상태/최근 커밋 |
|---|---|---:|---|---|---|
| AS-01 | `public/assets/environment/jade-sanctuary-environment-v2.png` | 2,683,065 | `712c6563289a297eedc3dfc4c59a6b89f98fc519fb7f6a0392c95f811b114e72` | `2026-08-05T02:14:13.5154941Z` | tracked; `fd84f6c` |
| AS-02 | `public/assets/marketing/yeongheo-contest-keyart-v1.png` | 2,276,786 | `8527f0fec51f289984a3d40c6bbde602fab4977527e86a650b81111b8911764c` | `2026-08-08T19:20:02.5919542Z` | untracked; 커밋 없음 |
| AS-03 | `public/assets/sprites2d/seolryeong-combat-v1.png` | 1,285,439 | `8c493623c9d656d456cc3707801b88fea976804fff07259884ee3fbd067ab605` | `2026-08-07T06:25:21.9218964Z` | untracked; 커밋 없음 |
| AS-04 | `public/assets/sprites2d/seolryeong-heroine-motion-v4.png` | 432,048 | `318035b66d96e46408dcf1f6d08a6a9e99dd2f016cfc35bb31c401c274446de4` | `2026-08-08T17:32:58.3822423Z` | untracked; 커밋 없음 |
| AS-05 | `public/assets/sprites2d/seolryeong-heroine-east-motion-v1.png` | 445,444 | `ec1952a1412bf4103d33f6fbe32c8a950b3d55461412709b66b525ae6255a087` | `2026-08-08T18:21:43.9406828Z` | untracked; 커밋 없음 |
| AS-06 | `public/assets/sprites2d/seolryeong-heroine-north-motion-v1.png` | 404,714 | `6030118d6c1871c7fa8f0d2f0812f1b53ce45934cf8319aadc550225d1266687` | `2026-08-08T18:18:22.0878279Z` | untracked; 커밋 없음 |
| AS-07 | `public/assets/sprites2d/seolryeong-heroine-northeast-motion-v1.png` | 423,323 | `3b501d101053ecf8d116eeb3ebe8ec94fe3a20d0b0561a1abe0e5b2c7a3f14dc` | `2026-08-08T18:21:44.0272399Z` | untracked; 커밋 없음 |
| AS-08 | `public/assets/sprites2d/seolryeong-heroine-south-motion-v1.png` | 451,255 | `d0a563e16a78f0f6737329ed2b4970cb5060a4599477e4d42b252b5e529fcebf` | `2026-08-08T18:21:43.9831049Z` | untracked; 커밋 없음 |
| AS-09 | `public/assets/sprites2d/yorang-motion-v2.png` | 313,360 | `4fbb63e2af8ea8b9c47258b201c748cdc7616cced244f4f545e9d636ec7af256` | `2026-08-08T14:47:58.4695550Z` | untracked; 커밋 없음 |
| AS-10 | `public/assets/sprites2d/void-sentinel-motion-v2.png` | 340,035 | `ebd971d1389a655ce1b20be3dfe5d4c4e08e4ab2e32025b09f61bf06c8292689` | `2026-08-08T14:47:58.6320797Z` | untracked; 커밋 없음 |
| AS-11 | `public/assets/sprites2d/jade-void-warden-motion-v2.png` | 464,009 | `237e3379e3de2a9504cff900bcb7afe1eb1b48d5255f81910752fd3a62ae1736` | `2026-08-08T14:47:58.8083327Z` | untracked; 커밋 없음 |
| AS-12 | `public/assets/sprites2d/jade-sanctuary-props-v1.png` | 360,099 | `88fd95a322948189bab5f47d4c9de5b0d5d7fe77035a978ce94896663e3eb4dc` | `2026-08-08T14:47:58.9936559Z` | untracked; 커밋 없음 |
| AS-13 | `public/assets/sprites2d/talisman-revenant-motion-v1.png` | 548,546 | `946a7a673cafda977d919598a904d238fdb29c5b6ae8ae078674cae8bc508896` | `2026-08-08T14:47:59.1747451Z` | untracked; 커밋 없음 |
| AS-14 | `public/assets/sprites2d/jade-serpent-motion-v1.png` | 453,104 | `4c6206a7360c68a1d7ff96c62ac5d798c48cf6a0933947c14e10b0a98d4676ea` | `2026-08-08T17:17:08.0650600Z` | untracked; 커밋 없음 |
| AS-15 | `public/assets/sprites2d/jade-stone-ghoul-motion-v1.png` | 571,605 | `01a36bb1ffd6fc85dac6b4964b3dc16ac2405b3deab579ecffd7cd80fd8ec3d8` | `2026-08-08T17:19:49.2024346Z` | untracked; 커밋 없음 |
| AS-16 | `public/assets/sprites2d/blood-scorpion-motion-v1.png` | 376,716 | `ef1da217a769370f9a010f40fbf6d87ce17839fd198efa0b49777dcd2d5c65ff` | `2026-08-08T17:19:30.4026521Z` | untracked; 커밋 없음 |
| AS-17 | `public/assets/characters/seolryeong-character-reference-v2.png` | 2,494,541 | `f878b718174410e14284eaa4921ffd8b95984b61d0ef7d085b9c66cd751fb427` | `2026-08-06T14:31:35.9298507Z` | tracked; `6877dfc` |
| AS-18 | `public/assets/characters/seolryeong-character-reference-v3.png` | 2,390,838 | `68014d983704d259ef69e9e64becf4a0972f2ae5e19248f0b5781befa3b13374` | `2026-08-06T22:32:58.4195334Z` | tracked; `0d3027e` |
| AS-19 | `public/assets/characters/jade-void-warden-boss-reference-v2.png` | 2,433,278 | `1d8d7a31e4d0d6326f7948412a1461296df7c137cd8024530b9263911621356b` | `2026-08-06T15:11:05.2333474Z` | tracked; `e43ee89` |
| AS-20 | `public/assets/materials/environment/jade-pavilion-stone-v1.png` | 3,236,400 | `167d2dc0bcf0c2ff5b8849f7f527c0a960da8fc87f49908d5c36f5ed441250c8` | `2026-08-06T20:39:40.4727964Z` | tracked; `05bdd8a` |
| AS-21 | `public/assets/materials/environment/jade-highland-ground-v1.png` | 3,251,533 | `7fd4ab4f3df870264d36c0e88a5bb9e0c270a0b7f6f1e4fe2dd329d39a355d94` | `2026-08-08T15:58:37.7206198Z` | untracked; 커밋 없음 |

#### WorldClaw 원칙 적용 seamless ground fingerprint — AS-73

| ID | 제출 파일 | 바이트 | SHA-256 | mtime UTC | Git 상태/최근 커밋 |
|---|---|---:|---|---|---|
| AS-73 | `public/assets/materials/environment/jade-sanctuary-ground-material-v2.png` | 3,093,492 | `ffcbf223d9c0387d70d921d19c12f176000f460a5aea74cfbcabaafd047b81b9` | `2026-08-11T10:28:45.3568703Z` | untracked; 커밋 없음 |

#### 초반 마기 잔영 runtime fingerprint — AS-74

| ID | 제출 파일 | 바이트 | SHA-256 | mtime UTC | Git 상태/최근 커밋 |
|---|---|---:|---|---|---|
| AS-74 | `public/assets/sprites2d/magi-remnant-motion-v2.png` | 441,793 | `8122d62377adaca9763aedc82f85ebd48192b34708be106128b5912ec44ae903` | `2026-08-11T16:44:01.4237418Z` | 이번 품질 체크포인트에 포함 예정 |

ImageGen 원본 `exec-ac9a1604-30ce-4490-84c7-be1f85920c73.png`의 SHA-256은 `4e63217446f9f869ba97553e40855bdfb8a0911f8462bb4dec09b9b829f2ba6c`이며, 로컬 authoring manifest에 동일 경로와 변환 체인을 기록했다.

#### 비대칭 옥정 수호자 runtime fingerprint — AS-75

| ID | 제출 파일 | 바이트 | SHA-256 | mtime UTC | Git 상태/최근 커밋 |
|---|---|---:|---|---|---|
| AS-75 | `public/assets/sprites2d/jade-shard-guardian-motion-v1.png` | 498,052 | `0b26675c124da1364efb8374dc4259013ba29974e5fc48edcfa85146734a4080` | `2026-08-11T18:33:34.3122670Z` | 이번 품질 체크포인트에 포함 예정 |

ImageGen 원본 `exec-c6a75ee1-2db0-4e25-be1d-635bc146fc4b.png`와 authoring source의 SHA-256은 모두 `dfe6ab4c6dd6ce1c08aaae950eee2eae2ec444fe51ac15637e6eb011b8634e84`이다. runtime atlas는 border-sampled soft matte, magenta despill, bicubic 1024×512 정규화 파생물이며 법적 권리 상태는 계속 차단한다.

#### 가면 부적 원혼 runtime fingerprint — AS-76

| ID | 제출 파일 | 바이트 | SHA-256 | mtime UTC | Git 상태/최근 커밋 |
|---|---|---:|---|---|---|
| AS-76 | `public/assets/sprites2d/masked-seal-revenant-motion-v1.png` | 420,335 | `41a9b151b7b554033d9bcdb0e7da0e35782d91f455cb9a8120f4521027bbaf75` | `2026-08-11T19:26:52.4546578Z` | 이번 품질 체크포인트에 포함 예정 |

ImageGen 원본 `exec-21734e32-edcf-4a3d-807e-ee46418dcd9b.png`와 authoring source의 SHA-256은 모두 `b232c78ebe95487cd210c8c49b2955f1fe02b9ed503157dfa4dee6ecf48745ee`이다. runtime atlas는 chroma soft matte, despill, bicubic 1024×512 정규화와 셀별 12px inset 파생물이다. 실제 Chrome 1920×1080·2560×1600 전투 화면에서 실루엣·접지·크로마 잔여를 확인했지만 법적 권리 상태는 계속 차단한다.

#### 그림자 봉인 쌍검수 runtime fingerprint — AS-77

| ID | 제출 파일 | 바이트 | SHA-256 | mtime UTC | Git 상태/최근 커밋 |
|---|---|---:|---|---|---|
| AS-77 | `public/assets/sprites2d/shadow-seal-duelist-motion-v1.png` | 380,737 | `d6194b0390b582c6dbd1ed0051fbd47a864f1516c30ccdcc5ea3cebbed59ac85` | `2026-08-11T22:13:06.5679447Z` | 이번 품질 체크포인트에 포함 예정 |

ImageGen 원본 `exec-7207b448-ff82-4fe3-8b25-7aa091961bd2.png`와 authoring source의 SHA-256은 모두 `e734edb3ae6410b9ece7b85c5aedbebd803f5d8efa85ac12140d7ca379f1bd8a`이다. runtime atlas는 명시적 `#00ff00` chroma soft matte·despill, 4×2 cell 256·gutter 6·guard 8 정규화 파생물이다. 실제 Chrome 1920×1080·2560×1600의 72체 혼합 화면에서 5/5 외형 분배·실루엣·접지·크로마 잔여를 확인했지만 법적 권리 상태는 계속 차단한다.

#### release-v3 신규 UI fingerprint — AS-22~AS-40

| ID | 제출 파일 | 바이트 | SHA-256 |
|---|---|---:|---|
| AS-22 | `public/assets/ui/skill-icons-v1/area-formation.png` | 183,598 | `8dfee0a87c14154031f0019aee7bc3707ea6e7c5747fd7543a7a95023de5b5ed` |
| AS-23 | `public/assets/ui/skill-icons-v1/attack-seal.png` | 185,450 | `c9fd580709267074e8f32dac58f188f6ec47d060efab7c0315a4f4fd486eeece` |
| AS-24 | `public/assets/ui/skill-icons-v1/bagua-array.png` | 186,668 | `c1ea48fab567d6b10cc5a605dd8c2e537d1b5a06c992a8da98e2dd66d6868944` |
| AS-25 | `public/assets/ui/skill-icons-v1/cooldown-hourglass.png` | 180,250 | `df789d682749e545b4dbeca1c513c34d380314cc1894a8c94201e10a7984afba` |
| AS-26 | `public/assets/ui/skill-icons-v1/dao-lotus.png` | 187,967 | `3ba4242d42f7902ebe928c0d6bbd971201556831909643a840c0668a2d9083e9` |
| AS-27 | `public/assets/ui/skill-icons-v1/fire-talisman.png` | 181,507 | `64c3aa3ebef81acb9eb5756bf31bb336b5a30729703c47fd5a0fdf63043ab410` |
| AS-28 | `public/assets/ui/skill-icons-v1/flying-sword.png` | 183,679 | `0513c3bfa710842698bde769ed44df52e83718626531bb26def5ae4ba89a126d` |
| AS-29 | `public/assets/ui/skill-icons-v1/frost-palm.png` | 197,229 | `36f6a725022dafe490832e6cafa9ae8acab94144edf2ab9a124c2efda0d204f2` |
| AS-30 | `public/assets/ui/skill-icons-v1/healing-core.png` | 179,787 | `930322b6f93daefff022ee87a4cc58a0d406a383e2c0eb46aa999412cb99293d` |
| AS-31 | `public/assets/ui/skill-icons-v1/qi-shield.png` | 189,934 | `968d523060a91a9472c3543bd2aae87a0e4097e09a473b73119598d5bc591bbb` |
| AS-32 | `public/assets/ui/skill-icons-v1/soul-eye.png` | 183,363 | `46033fa7f323ce2f397225fd90a2fda82598d0290a8a772b1e68afc1a5426a49` |
| AS-33 | `public/assets/ui/skill-icons-v1/spirit-butterfly.png` | 187,697 | `d31832f0679bd8ce8c3b60c9477d1cdb8ba05f3d53fbb80f7ca4fb5bbebd90ed` |
| AS-34 | `public/assets/ui/skill-icons-v1/thunder-orb.png` | 189,922 | `cb0f6bbba76b963384c52e3a31f81cb15f309a01ba60beeb5d75b6f3a054c78a` |
| AS-35 | `public/assets/ui/skill-icons-v1/twin-blades.png` | 180,609 | `3bf3d9ec0e3df3c286d54f50295b1047116c302693c52d74cc54ea51b358b8f0` |
| AS-36 | `public/assets/ui/skill-icons-v1/vajra.png` | 173,599 | `09dfe753123092f6f37c80f8faa9e5c0b9d427f92ce5b009d92d0d72b9350298` |
| AS-37 | `public/assets/ui/skill-icons-v1/windstep.png` | 194,405 | `028e0b52998198a7b0c74dec922dde9bc6ad867b545fdbd841ff5b33d6ca4f42` |
| AS-38 | `public/assets/ui/stage-thumbnails-v1/ember.png` | 1,177,445 | `8a5fdc422f51b5907366bd49769fe2c823da852cf52ae9ad800bbd4f549c2680` |
| AS-39 | `public/assets/ui/stage-thumbnails-v1/frost.png` | 1,326,936 | `e763480fb71ae0c976b3a8bcd9d3868bfcffdf13295dbd0c0f38ec6b0c956af3` |
| AS-40 | `public/assets/ui/stage-thumbnails-v1/jade.png` | 1,254,249 | `356f7d1b727043a1d6cbbb22f91fe731d744783c54a4b1c4757dacc07198f6e3` |

#### release-v5 의미별 아이콘 fingerprint — AS-41~AS-72

| ID | 제출 파일 | bytes | SHA-256 |
|---|---|---:|---|
| AS-41 | `public/assets/ui/skill-icons-v2/venom-palm.png` | 176,206 | `fc8c259c6b3fe195bd22104c4fca9e96aca64a1eced46d527f0236bce8601d63` |
| AS-42 | `public/assets/ui/skill-icons-v2/hidden-needles.png` | 161,616 | `ac506174c6b369bc12ffb4f5561bd1a1bc28fdf7a9a3d36e9fdf5d600b876493` |
| AS-43 | `public/assets/ui/skill-icons-v2/spirit-bell.png` | 179,583 | `f90af76dcc0ba92b94c710d06f831d09fcdb6bbe5b30ba11efde346463f5acdd` |
| AS-44 | `public/assets/ui/skill-icons-v2/wind-blades.png` | 187,290 | `2b73263a5844817590b16f08853ee8c6fb2bd68c38958c5e987e2dd100c05faf` |
| AS-45 | `public/assets/ui/skill-icons-v2/earth-dragon-spikes.png` | 176,345 | `82ca99286c46c46219ed50733b1b3f75f5f41f9530829e2fca42e44f7340ceca` |
| AS-46 | `public/assets/ui/skill-icons-v2/heavenly-lightning.png` | 190,620 | `d2d27455f3fd42cde80eab7e2d38fbc8bfaefb1a34f4098c4bbfdc54a3a25f04` |
| AS-47 | `public/assets/ui/skill-icons-v2/myriad-swords.png` | 188,693 | `fac2332726547a04202bcb7cec37c4b0bf8ab3464da5a56dbefd4a848c70659d` |
| AS-48 | `public/assets/ui/skill-icons-v2/inferno-sea.png` | 183,127 | `ea2b96a6b5b6f847e616f4f534cf85e76fd1609c965a7a51820b4eed4dd71b4b` |
| AS-49 | `public/assets/ui/skill-icons-v2/violet-thunder.png` | 188,589 | `3f7e392dce4f73629d44083556c0edaecb659a9f4862beac1e2bd9fca7f903d6` |
| AS-50 | `public/assets/ui/skill-icons-v2/frozen-sky.png` | 197,965 | `6b133766019b61f0428a830fc81c107b4c45ff704e62d1d4f943b4667acbfa65` |
| AS-51 | `public/assets/ui/skill-icons-v2/plague-tide.png` | 185,672 | `7eba44bf5d791993c2850c889e1269ae254618ac163b217555b0747ed417a73b` |
| AS-52 | `public/assets/ui/skill-icons-v2/needle-storm.png` | 174,793 | `998c112322e21c6a55c46308f2d49a111ed050deac4add0feb0633c61841408e` |
| AS-53 | `public/assets/ui/skill-icons-v2/heart-method.png` | 176,031 | `41861208fb6b9dfeeff8c1e9678cd224d7acf9a25c2ea2d6aac78ce51ca4510e` |
| AS-54 | `public/assets/ui/skill-icons-v2/sword-riding.png` | 185,208 | `ac08cbfc8ef2577ceebfa2b64db8d2876e086ee4ac337d3f5e4050f24db97556` |
| AS-55 | `public/assets/ui/skill-icons-v2/clone-art.png` | 186,573 | `2e5f1333c67184317f0993fd40ada3027e436237ccebdc810e955e5768846982` |
| AS-56 | `public/assets/ui/skill-icons-v2/destined-bond.png` | 180,880 | `51d1bc49155c66e50b7761ad69fdb15f276b39010ed37eb76535d4935e958991` |
| AS-57 | `public/assets/ui/skill-icons-v2/sword-oath.png` | 173,751 | `7ec69321039af7e39c5449e0dbbed2ffcf40da23198b3ff9f56cf54b9b5bff0b` |
| AS-58 | `public/assets/ui/skill-icons-v2/returning-edge.png` | 165,602 | `94f04e5e09fb87803ca4c457322915658c97c4344b1494302ad22c048559753f` |
| AS-59 | `public/assets/ui/skill-icons-v2/piercing-edge.png` | 170,968 | `b5551fc885159885c33234aba63ee6a4cbdc3a666fb39cc7ada5dc24a82b0f7b` |
| AS-60 | `public/assets/ui/skill-icons-v2/sword-ring.png` | 169,840 | `1dc7269c5cf4a805a0ce521715ceda90be276c4f80bb64cda632688fd507d386` |
| AS-61 | `public/assets/ui/skill-icons-v2/frost-oath.png` | 183,368 | `7db6936308eae9e054d020bbba969502b2ae948e497392448dc3603b6a4974cb` |
| AS-62 | `public/assets/ui/skill-icons-v2/frost-shards.png` | 178,977 | `dde453074e74ee77657f83474ed19fa134ef7b5626fb1631e59f2681e45c23b1` |
| AS-63 | `public/assets/ui/skill-icons-v2/frost-line.png` | 168,317 | `93b95694f5e56fe4506e4b3194627f946fe9b61e1701ce4b85a03843d54dad82` |
| AS-64 | `public/assets/ui/skill-icons-v2/ice-wall.png` | 189,128 | `72f17971560ebabcea72f8123bebcdbcc3819ed8baa2a54dce56dc32ceaf17fe` |
| AS-65 | `public/assets/ui/skill-icons-v2/spirit-oath.png` | 173,453 | `2734244e2053fa3fca1b0395a7e128195b3edda2d1789e6918a10f88c03e50af` |
| AS-66 | `public/assets/ui/skill-icons-v2/purifying-heart.png` | 183,037 | `965f173d97af9785bd600f1d0fd89cd43ffc534f8b7dc886e8826123284d5d0c` |
| AS-67 | `public/assets/ui/skill-icons-v2/echoing-heart.png` | 167,828 | `faca4a5f160b98789acab21c25be93f7b41c7ecb80f43cbe5de78595b4cbb79d` |
| AS-68 | `public/assets/ui/skill-icons-v2/shadow-copy.png` | 175,477 | `696888964ca6187937354f60caff2202e65cd40f85afeb1b8ac1712df80caa7a` |
| AS-69 | `public/assets/ui/skill-icons-v2/void-orb.png` | 175,019 | `7a8dfc85285392b255e7031af4ffdbd49233e99427ba780063007d97061bb42c` |
| AS-70 | `public/assets/ui/skill-icons-v2/heal.png` | 187,618 | `887d8369dc548e2797ae37f985403fbf101ec410928b6d5dc53f1195c78a0e45` |
| AS-71 | `public/assets/ui/skill-icons-v2/spirit-stones.png` | 175,928 | `4f811caa56a7b5f863dc65f69a9cca08f9bada3ad12827df5f105a51228f67bd` |
| AS-72 | `public/assets/ui/skill-icons-v2/purge.png` | 183,260 | `47d1ddb7ec02027173a2ce89dd68840ccf2ca976f1830f22c63a3c945c8e8b78` |

원천 atlas:

- AS-41~AS-56: `artifacts/2d-build/yeongheo-skill-atlas-v2.png`, 1254×1254, SHA-256 `b8f203c02860ae8220739318ba76ef4fa4a06469bd39497d868d352843ec9e5c`.
- AS-57~AS-72: `artifacts/2d-build/yeongheo-dao-atlas-v1.png`, 1254×1254, SHA-256 `e5e644dbed24896039b6e306d255521c3088c7f12b0022f8cfb09982f37d1565`.
- 두 atlas는 이 개발 세션의 로컬 `.codex/generated_images` 결과와 연결되고 256×256 crop은 동일 격자 규칙으로 생성했다. 이 연결은 기술 provenance이며 법적 권리 승인이 아니다.

#### `.codex/generated_images` 원본 및 sprite source 연결

직접 ImageGen 파일은 제출 파일 SHA와 `.codex/generated_images` 파일 SHA가 정확히 일치한다. 스프라이트는 `src/runtime2d/spriteManifest.js`의 `sourceUrl`을 따라 authoring source와 원본을 비교했다. AS-04·AS-14·AS-16은 원본이 source와 동일 파일은 아니므로 생성 이벤트와 변환 명령을 복구해 격리 재현까지 수행했다. source가 일치하거나 파생물이 재현되어도 법적 권리까지 자동으로 증명되지는 않는다.

| ID | 확인한 source/provenance | 로컬 원본 또는 source fingerprint | 결과 |
|---|---|---|---|
| AS-01 | 매니페스트 `source=imagegen` | `C:\Users\50106\.codex\generated_images\019fce01-ac3b-72b2-9438-4e40eada3f00\exec-90fe5b02-f2a6-4851-88f5-dc13536e64fd.png` | 제출 SHA와 exact match |
| AS-02 | 매니페스트 `source=imagegen` | `C:\Users\50106\.codex\generated_images\019fe2bc-1ddb-7390-910b-8a41a70aa5f0\exec-fe28c711-955d-4927-9839-a9e9538417cd.png` | 제출 SHA와 exact match |
| AS-03 | `spriteManifest.js` → `source/seolryeong-combat-key-v1.png` | source: 1,993,720 bytes; SHA `5ed38c8e81432ecb56bd58cae911999f3408a80ed95c6528a2662d7d083bcfcf`; mtime `2026-08-07T06:24:09.7517542Z`; original `C:\Users\50106\.codex\generated_images\019fdab1-1541-7091-a7c0-69482c8dd950\exec-ea9f0f4c-b433-4699-8aad-01f39117e669.png` | source SHA와 original exact match; runtime은 파생 atlas |
| AS-04 | `spriteManifest.js` → `source/seolryeong-heroine-motion-sheet-v4.png` | source: 422,427 bytes; SHA `c9a07964fa3fa888be0cc6c4ccc732253b9f75299670a173cc6f4a7f7410d62f`; original `C:\Users\50106\.codex\generated_images\019fe266-d780-71f3-afc9-be129253ebb1\exec-5df835cf-c68d-412d-ab42-4a61628b670b.png`, 1,868,987 bytes, SHA `a5b129b84633a4fe3f011b4872f0c90a07e08d180a48c95a1e13ba03f0221837` | archived generation line 727 + transform lines 779/788; reproduced source/runtime byte·RGBA exact match |
| AS-05 | `spriteManifest.js` → `source/seolryeong-heroine-east-sheet-v1.png` | source: 1,757,056 bytes; SHA `17819988c22dc1f65cd853a7cbd170ea7d4f545781affe85613e5929c23e4fff`; mtime `2026-08-08T18:19:18.9868754Z`; original `C:\Users\50106\.codex\generated_images\019fdab1-1541-7091-a7c0-69482c8dd950\exec-6b773248-84d1-4f89-8291-27d155b8170f.png` | source SHA와 original exact match; runtime은 파생 atlas |
| AS-06 | `spriteManifest.js` → `source/seolryeong-heroine-north-sheet-v1.png` | source: 1,706,735 bytes; SHA `9b19b149ad9143ef5240b12659eaa722f36f01e075ba1b0c90d178961bc479b8`; mtime `2026-08-08T18:16:38.4073629Z`; original `C:\Users\50106\.codex\generated_images\019fdab1-1541-7091-a7c0-69482c8dd950\exec-62363f0b-8329-48e8-bf7a-85092ca1148c.png` | source SHA와 original exact match; runtime은 파생 atlas |
| AS-07 | `spriteManifest.js` → `source/seolryeong-heroine-northeast-sheet-v1.png` | source: 1,767,422 bytes; SHA `ab513b960d49fbe676f9738f5a9b1d6bbdd94247d3e6f2e7fb2cad48354ec1e0`; mtime `2026-08-08T18:20:59.1634061Z`; original `C:\Users\50106\.codex\generated_images\019fdab1-1541-7091-a7c0-69482c8dd950\exec-2fe1fdbd-5728-4bef-b260-ff4b2a60dddb.png` | source SHA와 original exact match; runtime은 파생 atlas |
| AS-08 | `spriteManifest.js` → `source/seolryeong-heroine-south-sheet-v1.png` | source: 1,767,943 bytes; SHA `f09c788eb56a9afeefa71e09b21164251d40a3531abe0e23a74dea736865862e`; mtime `2026-08-08T18:20:01.3807632Z`; original `C:\Users\50106\.codex\generated_images\019fdab1-1541-7091-a7c0-69482c8dd950\exec-5e34e726-8cfd-4eeb-b85b-754cbfdd3e02.png` | source SHA와 original exact match; runtime은 파생 atlas |
| AS-09 | `spriteManifest.js` → `source/yorang-motion-sheet-v2.png` | source: 1,517,800 bytes; SHA `f55eaedbb12110ae5d1a2ca754ace261d838032a933707a281989978305820fa`; mtime `2026-08-07T07:23:30.5910015Z`; original `C:\Users\50106\.codex\generated_images\019fdab1-1541-7091-a7c0-69482c8dd950\exec-4758d19e-fd62-4597-88d0-5162a7299d0a.png` | source SHA와 original exact match; runtime은 파생 atlas |
| AS-10 | `spriteManifest.js` → `source/void-sentinel-motion-sheet-v2.png` | source: 1,627,096 bytes; SHA `e94557cb89f6ac16dd4897d55d8d74d9010b1fb42430173b7e5c60491bb9a77b`; mtime `2026-08-07T07:24:47.0038445Z`; original `C:\Users\50106\.codex\generated_images\019fdab1-1541-7091-a7c0-69482c8dd950\exec-43fc96c5-66d2-40d0-a8e2-5ae258a618a1.png` | source SHA와 original exact match; runtime은 파생 atlas |
| AS-11 | `spriteManifest.js` → `source/jade-void-warden-motion-sheet-v2.png` | source: 1,842,978 bytes; SHA `a10f1b2e769883476a8ff5d35bf11d3ef84a93a73901987799d99386b3d98534`; mtime `2026-08-07T07:26:04.3335676Z`; original `C:\Users\50106\.codex\generated_images\019fdab1-1541-7091-a7c0-69482c8dd950\exec-e4aaac89-b0e6-4b78-9ac1-85a0af9ca6cc.png` | source SHA와 original exact match; runtime은 파생 atlas |
| AS-12 | `spriteManifest.js` → `source/jade-sanctuary-props-sheet-v1.png` | source: 1,627,959 bytes; SHA `5321ea710e9ad2a97ecfde7cb597b9f5ca9fdda2dd5cfd86425e875952db7a44`; mtime `2026-08-07T07:27:11.6683534Z`; original `C:\Users\50106\.codex\generated_images\019fdab1-1541-7091-a7c0-69482c8dd950\exec-8c40976d-c6a5-483d-b57b-d0d76042284f.png` | source SHA와 original exact match; runtime은 파생 atlas |
| AS-13 | `spriteManifest.js` → `source/talisman-revenant-motion-sheet-v1.png` | source: 1,942,344 bytes; SHA `57661c15845e8b85b8b0c1f9bbfebe03f3f323c4baae377144e26bd0ffb2feca`; mtime `2026-08-08T14:38:40.2239831Z`; original `C:\Users\50106\.codex\generated_images\019fdab1-1541-7091-a7c0-69482c8dd950\exec-0b1216e8-5c1d-4d41-bdd7-101a84fbcd77.png` | source SHA와 original exact match; runtime은 파생 atlas |
| AS-14 | `spriteManifest.js` → `source/jade-serpent-motion-sheet-v1.png` | source: 406,359 bytes; SHA `4c8e71c4b32b66ecdf6ead25ae004537133e2eb91d51ddba187320dfd4e99a46`; original `C:\Users\50106\.codex\generated_images\019fe25a-e641-7513-afb9-5b7a537cd533\exec-784f3722-5ae1-4794-8531-e1e03696b7c5.png`, 1,805,189 bytes, SHA `d35439e646f0a05e725d3d7643bf0c97a631fcbd34b14ebbbe232d92524b9a53` | archived generation line 516 + transform line 609; reproduced source/runtime byte·RGBA exact match |
| AS-15 | `spriteManifest.js` → `source/jade-stone-ghoul-motion-sheet-v1.png` | source: 2,088,281 bytes; SHA `e3eb279879658520347fd69670f69ecf0d797c3dedce6d60a15f7e0db97a528c`; mtime `2026-08-08T17:12:02.9339095Z`; original `C:\Users\50106\.codex\generated_images\019fe25b-11ce-7c40-97f2-4db6c8be102b\exec-33b49159-0111-4fc5-8ca3-61af1af96ba2.png` | source SHA와 original exact match; runtime은 파생 atlas |
| AS-16 | `spriteManifest.js` → `source/blood-scorpion-motion-sheet-v1.png` | source: 349,872 bytes; SHA `50effaa4ced349aab7326c2fa8cd0166423736eb39824847c744d446ae331c70`; original `C:\Users\50106\.codex\generated_images\019fe25b-4127-77d3-8af4-9204d31df485\exec-dfac7553-c13d-4e05-9b7f-4907d1cd50b0.png`, 1,948,036 bytes, SHA `fc3aab3482991fda6e8d65553328415113e94b588b1c8c931ca1b8140da85143` | archived generation line 524 + transform lines 637/641/654/681; reproduced source/runtime byte·RGBA exact match |
| AS-17 | 매니페스트 `source=imagegen` | `C:\Users\50106\.codex\generated_images\019fd0a2-89c3-7ce0-9260-f4d301e8b95f\exec-e9395321-9bb4-466f-87f1-6b9e3729c8c2.png` | 제출 SHA와 exact match |
| AS-18 | 매니페스트 `source=imagegen-plus-artifact-template-yeongheo-aaa-asset-brief` | `C:\Users\50106\.codex\generated_images\019fd0a2-89c3-7ce0-9260-f4d301e8b95f\exec-e0dcc6f8-eaa7-44fc-b4dc-a6b857f9bc01.png` | 제출 SHA와 exact match; 템플릿 권리는 별도 미확인 |
| AS-19 | 매니페스트 `source=imagegen` | `C:\Users\50106\.codex\generated_images\019fd0a2-89c3-7ce0-9260-f4d301e8b95f\exec-f3b07846-2068-43ce-ad84-4aa2da2798de.png` | 제출 SHA와 exact match |
| AS-20 | 매니페스트 `source=imagegen` | `C:\Users\50106\.codex\generated_images\019fd0a2-89c3-7ce0-9260-f4d301e8b95f\exec-31523ad3-9715-4043-8a16-1a8a5e1811f9.png` | 제출 SHA와 exact match |
| AS-21 | 매니페스트 `source=imagegen` | `C:\Users\50106\.codex\generated_images\019fdab1-1541-7091-a7c0-69482c8dd950\exec-ceb40769-643d-4701-83c1-39a54ef5ed90.png` | 제출 SHA와 exact match |
| AS-73 | 매니페스트 `source=imagegen` | `C:\Users\50106\.codex\generated_images\019fe2bc-1ddb-7390-910b-8a41a70aa5f0\exec-6132a4b5-dc56-42de-b2e2-8ef33c0e01d2.png` | 제출 SHA와 exact match; 생성 call·runtime path·SHA를 이 row에 고정했으나 계정·Input·공개 권리 증거는 아님 |
| AS-74 | `spriteManifest.js` → `source/magi-remnant-key-v1.png` | source: 1,478,497 bytes; SHA `0864931c35fc1e596b855ad8a49ee14add523d448443bfaf1b00fac36a548a13`; mtime `2026-08-11T14:23:06.5331413Z`; original `C:\Users\50106\.codex\generated_images\019fe2bc-1ddb-7390-910b-8a41a70aa5f0\exec-6fbafd22-a756-43db-837f-1f6307bca217.png`, 1,478,497 bytes, same SHA | source SHA와 original exact match; runtime은 기록된 `remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill` 파생물 |
| AS-75 | `spriteManifest.js` → `source/jade-shard-guardian-motion-sheet-v1.png` | source/original: 1,954,876 bytes; SHA `dfe6ab4c6dd6ce1c08aaae950eee2eae2ec444fe51ac15637e6eb011b8634e84`; original `C:\Users\50106\.codex\generated_images\019fe2bc-1ddb-7390-910b-8a41a70aa5f0\exec-c6a75ee1-2db0-4e25-be1d-635bc146fc4b.png`, same SHA; runtime SHA `0b26675c124da1364efb8374dc4259013ba29974e5fc48edcfa85146734a4080` | source SHA와 original exact match; runtime은 authoring manifest에 기록한 soft matte·despill·1024×512 정규화 파생물 |
| AS-76 | `spriteManifest.js` → `source/masked-seal-revenant-motion-sheet-v1.png` | source/original: 1,859,849 bytes; SHA `b232c78ebe95487cd210c8c49b2955f1fe02b9ed503157dfa4dee6ecf48745ee`; original `C:\Users\50106\.codex\generated_images\019fe2bc-1ddb-7390-910b-8a41a70aa5f0\exec-21734e32-edcf-4a3d-807e-ee46418dcd9b.png`, same SHA; runtime SHA `41a9b151b7b554033d9bcdb0e7da0e35782d91f455cb9a8120f4521027bbaf75` | source SHA와 original exact match; runtime은 authoring manifest에 기록한 soft matte·despill·1024×512 정규화·셀별 12px inset 파생물 |
| AS-77 | `spriteManifest.js` → `source/shadow-seal-duelist-motion-sheet-v1.png` | source/original: 1,641,903 bytes; SHA `e734edb3ae6410b9ece7b85c5aedbebd803f5d8efa85ac12140d7ca379f1bd8a`; original `C:\Users\50106\.codex\generated_images\019fe2bc-1ddb-7390-910b-8a41a70aa5f0\exec-7207b448-ff82-4fe3-8b25-7aa091961bd2.png`, same SHA; runtime SHA `d6194b0390b582c6dbd1ed0051fbd47a864f1516c30ccdcc5ea3cebbed59ac85` | source SHA와 original exact match; runtime은 authoring manifest에 기록한 명시적 `#00ff00` soft matte·despill·4×2 atlas 정규화 파생물 |

#### 생성·후처리 스크립트와 증거 한계

| 경로 | 확인된 역할 | 현재 증거/한계 |
|---|---|---|
| `tools/asset-manifest.json` | 123개 자산의 `path`, `source`, `consumer`, 용량 제한을 선언 | 기술 목록만 증명하며 생성 계정·Input 권리·출력 약관·정확한 명령 실행은 기록하지 않음; 현재 작업 트리에서 수정 상태 |
| `src/runtime2d/spriteManifest.js` | runtime atlas와 `sourceUrl` authoring 파일의 연결, `visualApproval: pending`, `productionReady: false` | 의도한 파일 연결은 증명하지만 실제 빌드 시점과 변환 명령은 증명하지 않음 |
| `tools/yeongheo/build_sprite_atlas.py` | 4×2 grid를 cell 256, gutter 6, guard 8의 고정 atlas로 변환 | 파일 존재와 파라미터는 확인; untracked이며 자산별 실제 invocation/input→output 로그는 없음 (mtime `2026-08-08T14:47:44.1773426Z`) |
| `tools/yeongheo/clean_chroma_spill.py` | chroma spill/alpha edge 제거와 RGBA 저장 | 파일 존재와 역할은 확인; untracked이며 AS별 실행 로그·원본 선택·명령 hash는 없음 (mtime `2026-08-07T07:50:31.1198860Z`) |
| `tools/yeongheo/build_alpha_contact_sheet.py`, `report_green_pixels.py` | alpha/green-edge 시각·휴리스틱 QA | 검사 도구이지 권리 또는 production generator가 아님 (각 파일 untracked) |
| `tools/yeongheo/validate_runtime_sprites.py` | PNG/alpha/중복 후보 audit; `SPRITE_ASSET_AUDIT.md`에 `PASS_WITH_REVIEW` 기록 | QA-only이며 `visualApproval: pending`, `productionReady: false`를 유지; 저작권·서비스 권리·재현성은 증명하지 않음 |

현재 저장소에는 77개 결과 각각의 계정·Input 권리·대표자 공개 권한을 고정한 법적 증거가 없다. 그러므로 `sourceUrl`, atlas crop, exact SHA match를 “로컬 provenance 부분 확인”까지만 사용하고 “권리 승인”으로 확장하지 않는다.

#### 프로젝트 커밋·문서 연결

- release-v3 원장 초안 snapshot의 HEAD는 `351541c8acf64029d27c016612b0383e0c79a74d` (`Integrate ImageGen v3 Forge enemy assets`)였고 당시 작업 트리는 dirty였다. 아래 역사 fingerprint의 Git 상태 표시는 그 snapshot을 설명하며 현재 브랜치 상태를 대신하지 않는다.
- AS-74~AS-77은 이번 품질 체크포인트의 runtime/source fingerprint와 변환 명령을 위 원장에 추가했다. 고정 제출 commit/build/deploy/run과 대표자 권리 증거는 별도 최종 게이트에서 다시 연결해야 한다.
- `docs/competition/CODEX_COLLABORATION_EVIDENCE.md`는 dirty checkout, 고정된 final commit/build/run/session 부재, 파일만으로 Codex 저작·대회기간을 주장할 수 없음을 기록한다. 이 문서는 정적 증거 연결이지 저작권 양도·대표자 승인 기록이 아니다.
- 소비/파생 연결은 `tools/submission-assets.mjs`, `src/runtime2d/spriteManifest.js`, `artifacts/2d-qa/SPRITE_ASSET_AUDIT.md`, `docs/QUALITY_STATUS.md` 및 관련 `artifacts/img2threejs/**/README.md`에서 확인했다. 이 문서들은 기술 provenance와 QA를 연결하지만 사람의 권리 선언을 대신하지 않는다.

### 제출 파일의 기술 분류 요약

| 분류 | 개수 | 의미 |
|---|---:|---|
| `generated` | 77 | 매니페스트가 ImageGen 또는 ImageGen 후처리 provenance를 명시 |
| `own` | 0 | 저장소에서 권리 주체를 확인하는 명시적 소유·양도 증거를 찾지 못함 |
| `external` | 0개의 직접 제출 파일 | 직접 외부 원본 파일은 allowlist에 없지만, 생성 서비스·도구 의존성은 아래 별도 게이트 대상 |
| `unknown` | 0개의 기술 원천 | 기술 source 라벨은 있으나 **권리 상태는 77개 전부 미확인** |
| 직접 제출 파일과 `.codex/generated_images` exact match | 8/77 | AS-01, AS-02, AS-17~AS-21, AS-73의 제출 파일 자체가 local generated original과 SHA-256 일치 |
| sprite source와 `.codex/generated_images` exact match | 15/77 | AS-03, AS-05~AS-13, AS-15, AS-74~AS-77의 source sheet가 local generated original과 SHA-256 일치; runtime은 파생물 |
| 원본·생성 이벤트·변환 명령으로 재현한 sprite chain | 3/77 | AS-04, AS-14, AS-16의 source와 runtime을 격리 재생성하여 파일 SHA와 RGBA pixel 모두 exact match |
| release-v3 UI atlas source chain | 19/77 | AS-22~AS-40은 로컬 ImageGen atlas와 결정적 crop 산출물로 연결됨 |
| release-v5 의미별 아이콘 atlas source chain | 32/77 | AS-41~AS-72는 두 로컬 ImageGen atlas와 결정적 256×256 crop 산출물로 연결됨 |
| source는 있으나 exact original 미검출 | 0/77 | 기존 AS-04, AS-14, AS-16 원본과 변환 chain을 복구·재현함 |
| 기술 provenance chain 확인 | 77/77 | 8 direct + 15 exact sprite source + 3 reproduced sprite chain + 19 legacy UI atlas + 32 semantic icon atlas |
| OpenAI 약관의 조건부 Output 근거 후보 | 77/77 | 로컬 생성 chain이 연결된 범위일 뿐 계정·Input·대회 권리 clearance 아님 |
| 법적 권리 증거 확인 | 0/77 | OpenAI 약관의 일반적 Output 조항, 로컬 SHA, QA PASS는 자산별 권리·대회 제출 허락을 증명하지 않음 |

이 표의 `own=0`, `unknown=0`은 기술 source 라벨의 분류이며 안전 판정이 아니다. provenance 연결 수는 권리 승인 수가 아니다. 계정·Input·인물/상표·팀/대표자 권한·대회 공개 허락이 확인되지 않은 상태이므로 제출 가능 수와 최종 권리 확인 수는 현재 0/77로 취급한다.

## allowlist 밖 48개와 외부 파이프라인 위험

아래 파일은 현재 `tools/submission-assets.mjs`의 제출 runtime allowlist에는 없지만 저장소 `public/assets`에 존재한다. 썸네일, 영상, generic static copy, 향후 코드 변경으로 다시 노출되면 즉시 이 원장에 포함시켜 같은 권리 게이트를 적용해야 한다.

| 범위 | 수량 | 기술 분류 | 확인된 provenance | 현재 처리 | 잔여 권리 위험 |
|---|---:|---|---|---|---|
| `public/assets/sprites2d/source/**` 제작 원본·방향 sheet | 22 | `generated` | `imagegen`, `imagegen-directional-source-v1`; `tools/asset-manifest.json` | authoring 전용, 제출 allowlist 제외 | 원본 ImageGen 출력·후처리 권리, 썸네일/영상에 무심코 사용될 위험 |
| `public/assets/sprites2d/yorang-v1.png`, `void-sentinel-v1.png`, `jade-void-warden-v1.png`, `seolryeong-motion-v2.png` | 4 | `generated` | ImageGen chroma/despill; 매니페스트·`artifacts/2d-qa/SPRITE_ASSET_AUDIT.md` | legacy/superseded, allowlist 제외 | 오래된 파일이 generic 배포나 영상 캡처에 들어갈 경우 같은 미확인 위험 |
| `public/assets/characters/seolryeong-turnaround-v4.png`, `models/characters/seolryeong-trellis-v4.glb`, `characters/void-iron-scale-sentinel-reference-v3.png`, `characters/glacier-warden-reference-v1.png` | 4 | `generated` (외부 파이프라인 파생) | `artifacts/img2threejs/seolryeong/character-model-v4/README.md`, `artifacts/img2threejs/void-iron-scale-sentinel-v3/README.md`, `artifacts/img2threejs/glacier-warden-v1/README.md` | 3D/ImageGen/TRELLIS/Forge 개발·QA evidence, 현재 2D 제출 allowlist 제외 | ImageGen 원천 권리와 외부 anonymous Hugging Face/TRELLIS·GitHub 도구 조건의 결합 증거가 없음. video/thumbnail 사용 금지 until cleared |
| `public/assets/materials/characters/moon-silk-brocade-v2.png`, `materials/guardians/{jade-scale-weave-v1,jade-void-armor-v1,void-iron-scale-armor-v1,ember-feather-weave-v1}.png` | 5 | `generated` | `imagegen`; `docs/QUALITY_STATUS.md`, 매니페스트 | 3D/material development asset, allowlist 제외 | ImageGen 재질의 원천·출력 이용권·반복 타일의 제3자 유사성 검토 없음 |
| `public/assets/materials/img2three/**` (Seolryeong 5개 + Void-Iron 4개 + Glacier 4개) | 13 | `generated` (외부 도구 파생) | `img2threejs`, `imagegen-plus-img2threejs-forge`; 각 `artifacts/img2threejs/**/README.md`, `pbr-report.json` | 3D PBR/authoring evidence, allowlist 제외 | Apache-2.0 도구 라이선스가 생성 map의 원천 이미지·서비스 출력 권리를 부여하지 않음 |

### 외부 도구·서비스의 별도 게이트

- `tools/img2threejs/LICENSE`는 `hoainho`의 `img2threejs` **도구 코드**에 대한 Apache License 2.0이다. 이 라이선스는 ImageGen 입력 이미지, Forge/TRELLIS 결과물, 게임의 생성 텍스처 또는 GLB의 소유권·비침해를 보증하지 않는다.
- `artifacts/img2threejs/seolryeong/character-model-v4/README.md`는 ImageGen turnaround를 저장소의 `tools/img2threejs/`로 TRELLIS GLB로 만든 과정을 기록한다. `artifacts/img2threejs/void-iron-scale-sentinel-v3/README.md`와 `glacier-warden-v1/README.md`도 ImageGen·Forge 파이프라인을 기록한다. 이는 생성 경로 증거이지 대회 제출 허락 증거가 아니다.
- v3 README에는 익명 Hugging Face ZeroGPU quota 시도가 기록되어 있다. 외부 서비스 이용약관·입력/출력 권리·공개 권한을 확인하지 않은 3D 결과는 제출·썸네일·영상에서 사용하지 않는다.
- 저장소에서 이미지 생성 서비스의 약관 스냅샷, 계정/출력 권한 영수증, 자산별 creator declaration, 제3자 원본 라이선스, `NOTICE` 파일을 찾지 못했다. 현재 발견된 라이선스 파일은 `tools/img2threejs/LICENSE` 하나다.

## 생성·QA 문서가 증명하는 것과 증명하지 않는 것

| 문서 | 확인 가능한 사실 | 증명하지 않는 것 |
|---|---|---|
| `tools/asset-manifest.json` | 경로, role/tier, source 라벨, consumer, 용량 제한 | 소유권, AI 서비스 이용 조건, 제3자 원천 허락, 상업·공개 권리 |
| `tools/submission-assets.mjs` | 현재 Pages/runtime에 복사할 77개 allowlist와 authoring·legacy 제외 의도 | 실제 배포가 그 allowlist만 사용하는지에 대한 최종 호스팅 확인, 권리 승인 |
| `artifacts/2d-qa/SPRITE_ASSET_AUDIT.md` | PNG 구조, atlas 셀, alpha/green-edge QA, `visualApproval: pending`, `productionReady: false` | 저작권·라이선스·AI 출력 사용권 |
| `docs/QUALITY_STATUS.md` | ImageGen/TRELLIS/img2threejs 기반 authoring과 일부 런타임 연결 기록 | 제출 허용, 외부 원천 권리, 현재 제출 bundle의 권리 완결 |
| `artifacts/img2threejs/**/README.md`, `assessment.json`, `pbr-report.json` | ImageGen 입력, Forge/PBR/TRELLIS 생성·검수 경로와 품질 경계 | ImageGen 계정 권리, 원천 이미지의 제3자 권리, 대회 공개 허락 |
| `tools/img2threejs/LICENSE` | vendored 도구 코드의 Apache-2.0 조건 | 생성된 게임 자산의 권리 또는 비침해 보증 |

## 제출 전 권리 체크리스트

현재는 아래 항목이 모두 완료되기 전까지 제출하지 않는다.

- [ ] AS-01~AS-77 각각에 대해 실제 제작자/권리 주체와 제출 권한을 대표자가 확인한다.
- [ ] AS-01, AS-02, AS-17~AS-21, AS-73의 8개 direct match에 대해 실제 생성 계정·관할·약관 버전·Input 목록을 계정 기록 또는 영수증으로 연결한다. local `.codex/generated_images` 경로만으로 계정 권리를 추정하지 않는다.
- [ ] AS-03, AS-05~AS-13, AS-15, AS-74~AS-77의 15개 source chain은 source 원본·runtime 파생물·정확한 변환 명령·입력/출력 SHA를 하나의 immutable run/build 기록으로 묶는다. source SHA match를 파생물 권리 승인으로 확장하지 않는다.
- [x] AS-04, AS-14, AS-16의 `.codex/generated_images` 원본·생성 이벤트·변환 명령을 복구하고 격리 재현 source/runtime의 byte·RGBA exact match를 `tools/yeongheo/recovered-provenance-manifest.json`과 `artifacts/2d-build/provenance/recovered-imagegen-originals/provenance-comparison-20260810.json`에 고정했다. 원본 3개도 같은 비배포 보관소에 byte exact copy로 보존했다. 이 완료 표시는 기술 provenance만 뜻하며 세 자산의 법적 권리는 계속 차단한다.
- [ ] ImageGen 계정/서비스의 현재 약관 버전, 출력물의 공개·상업·대회 홍보 사용 가능 여부를 확인하고, AI 생성물임을 제출 자산 목록에 고지한다.
- [ ] ImageGen 입력에 사용된 원천 이미지·참조·스타일·로고·실존 인물·제3자 캐릭터가 있다면 원천별 허락·라이선스·초상/상표 검토를 연결한다. 확인할 수 없는 원천은 제거·교체한다.
- [ ] chroma-key, despill, atlas crop, PBR extraction 같은 후처리는 원본의 권리 상태를 바꾸지 않는다는 전제로 원본과 파생물을 함께 기록한다.
- [ ] `img2threejs`를 공개 저장소/배포물에 포함하는 경우 Apache-2.0 저작권·라이선스 고지를 보존한다. 도구 라이선스를 생성 map/GLB 라이선스로 확장 해석하지 않는다.
- [ ] 3D/TRELLIS/Forge 자산을 최종 런타임·썸네일·3분 영상에 넣을 경우, 이 원장의 별도 row를 만들고 ImageGen 원천 및 외부 서비스 권리를 먼저 닫는다. 현재 계획상 제출 runtime은 2D allowlist 77개다.
- [ ] 16:9 썸네일은 실제 사용할 AS ID와 동일한 권리 증거가 있는 파일만 사용한다. `AS-02`가 자동으로 썸네일 권리를 승인하지 않는다.
- [ ] 3분 이내 데모 영상은 녹화에 보이는 모든 이미지·폰트·음원·UI·외부 로고와 화면 속 개인정보를 별도로 검사한다. 영상은 게임 asset ledger를 상속하며, 영상 자체도 제출물 권리 row가 필요하다.
- [ ] build 산출물은 `tools/submission-assets.mjs` allowlist를 사용했는지 확인하고, allowlist 밖 48개가 generic `public/**` 복사·host 설정으로 다시 포함되지 않았는지 실제 배포에서 검증한다.
- [ ] 최종 build/deploy ID, `run_id`, 제출 자산 SHA-256, 권리 증거 경로를 하나의 불변 기록으로 묶는다. 자동 audit/테스트/시각 QA는 권리 승인을 대신하지 않는다.
- [ ] 최종 제출 커밋을 만든 뒤 77개 파일의 SHA-256·크기·mtime과 실제 dist/공개 URL을 다시 캡처한다. 현재 snapshot의 untracked/dirty 상태를 제출 증거로 사용하지 않는다.
- [ ] `docs/competition/CODEX_COLLABORATION_EVIDENCE.md`를 최종 `run_id`·`build_id`·commit과 연결하되, Codex 협업 파일만으로 저작권·팀 소유권·대회 기간을 주장하지 않는다.

## 제출물·권리 증거의 안전한 placeholder

실제 사용자 개인정보, Google 계정, 연락처, 토큰, 개인 식별 가능한 Codex 원문은 이 원장에 넣지 않는다. 아래 값은 대표자가 제출 직전에 채울 외부 증거의 자리표시자다.

```text
asset_id: <AS-01..AS-76 또는 THUMBNAIL/DEMO_VIDEO>
asset_path_or_role: <저장소 경로 또는 제출 역할>
classification: <own|generated|external|unknown>
creator_or_rightsholder: <미입력; 실명·이메일은 이 저장소에 저장하지 않음>
generator_or_provider: <미입력>
source_reference_proof: <미입력; 원천 URL/허락/내부 기록 식별자>
license_or_terms_url: <미입력>
terms_version_or_checked_at: <미입력>
contest_publication_permission: <미확인>
commercial_use_permission: <미확인>
ai_generated_notice: <미입력>
third_party_likeness_trademark_privacy_review: <미확인>
attribution_or_notice_required: <미확인>
evidence_hash: <미입력; SHA-256>
run_id_and_build_id: <미입력>
reviewer_decision: <미확인; 대표자 최종 확인 전 승인 금지>
confirmed_at_kst: <미입력>
```

### 아직 파일로 확정되지 않은 제출 보조 자산

| 제출 역할 | 현재 상태 | 분류 | 권리 게이트 |
|---|---|---|---|
| 16:9 JPG/PNG 썸네일 | 최종 로컬 후보: `output/releases/yeongheo-geomga-thumbnail-v5.2-1920x1080.png`; 실제 최종 release-v5.2 타이틀 화면, 2,341,071 bytes, SHA-256 `CAE7D30361DB3DB5A3A4086A500B88D70355D3F88631FE13DEB6C0E4404D4545` | `generated` composite / AS-02·AS-18·런타임 UI | 파일·규격·실제 화면 대표성은 확인했지만 구성 자산의 권리·AI 고지·제3자 표식·인물 검토, 사용자 시각 승인, 공식 업로드 전까지 차단 |
| 실제 플레이 데모 영상(최대 3분 권장) | release-v5 176.01초 1920×1080 VP8+stereo Opus 실제 플레이·WebAudio 편집본 존재; SHA-256 `A255A1B945D445B92DD1A1EE6E77AB16A7220BF2985DDE555986F89EBC678651`; 공개 URL 없음 | `generated` composite | 영상·오디오 stream, contact sheet, 음량 검수 PASS. 녹화 당시 72개 자산의 차단 상태를 상속하며 AS-73 적용 전 영상이므로 현재 빌드 증거로 사용하지 않음 |
| 공개 호스팅 build/dist | release-v5.2 Web ZIP 104 entries, SHA-256 `9B59B02DD2CAF4533F6C7F1FF9AE444159A6AE76DD338A9FB934870CD1AD00F6`; Windows portable ZIP 113 entries, SHA-256 `605B141DFDC6F9A499E3A4E06267DFE9F32054E6B094B134EB42672A60A9BB3A0`; 최종 공개 URL 없음 | `generated` composite / local review only | 해당 역사 package의 기술 provenance 72/72를 포함하지만 법적 권리 0/72를 상속하며 AS-73 적용 전 package이므로 현재 배포 후보가 아님 |
| Codex 활용 설명·스크린샷 | 제출 보조 자료 placeholder만 있음 | `unknown` | 화면에 사용자 데이터·토큰·권리 불명 자산이 없는지 확인하고, 동일 `run_id`·`build_id`를 연결 |

## 현재 남은 차단 — 사람 확인 없이는 승격하지 않음

- OpenAI 약관의 Output 조항은 기술 chain이 연결된 77/77의 **조건부 후보 근거**일 뿐이다. 로컬 생성물에는 계정·관할·서비스·약관 동의 시점이 완전하게 남아 있지 않으므로, 해당 출력이 실제 그 약관의 적용을 받는다는 사실은 아직 확인되지 않았다.
- 8개 direct output, 18개 sprite source chain, 19개 release-v3 UI chain, 32개 v5 의미 아이콘 chain 모두 Input 원천, 제3자 이미지/캐릭터/로고, 실존 인물 유사성, 상표·개인정보 검토 기록이 없다. OpenAI 약관도 Input 권리와 사람 검토 책임을 사용자에게 둔다.
- AS-04, AS-14, AS-16의 exact `.codex/generated_images` 원본, revised prompt, 변환 명령 및 byte·RGBA exact 재현은 확인됐다. 남은 차단은 원본 부재가 아니라 생성 계정·Input·제3자 권리·팀 귀속·대회 공개 권한의 사람 확인이다.
- 기존 11개 sprite 파생물은 `build_sprite_atlas.py`/`clean_chroma_spill.py`의 존재와 `sourceUrl` 연결만 확인했다. AS-74~AS-77은 별도 chroma-key·soft-matte 변환 명령을 기록했지만 immutable build/run 묶음은 아직 없다. 따라서 AS-04·AS-14·AS-16의 완전 재현 증거와 같은 법적 승격 근거로 사용하지 않는다.
- release-v3 snapshot에서 sprite와 AS-02/AS-21/AS-73은 제출 기준 commit/build/deploy/run이 고정되지 않았다. 현재 AS-77까지 포함한 새 체크포인트도 최종 제출 commit·공개 build·동일 run ID와 대표자 제출 권한을 별도로 고정하기 전에는 권리 승인으로 취급하지 않는다.
- `img2threejs`/TRELLIS/Forge/Hugging Face 등 외부 pipeline, 영상·썸네일에 추가되는 폰트·음원·로고·화면 개인정보, 팀 구성원 간 양도/사용 허락은 이 원장과 OpenAI 약관만으로 승인하지 않는다.

## 현재 최종 판정

```text
submission_runtime_files: 77
technical_classification: generated=77, own=0, external-direct=0, unknown-source=0
local_exact_direct_imagegen_match: 8/77
local_exact_sprite_source_chain: 15/77
local_reproduced_sprite_source_chain: 3/77 (AS-04, AS-14, AS-16)
local_release_v3_ui_atlas_chain: 19/77
local_release_v5_semantic_icon_atlas_chain: 32/77
source_original_not_found: 0/77
technical_provenance_chain_verified: 77/77
conditional_openai_terms_basis: 77/77 (not a rights clearance)
rights_evidence_confirmed: 0/77
rights_gate: BLOCKED
safe_action: 사용자/대표자의 권리 증거 확인 전 제출·공개·썸네일·영상 사용 금지
```

이 원장은 권리 증거가 채워지기 전까지 `확인됨`으로 전환하지 않는다. 실제 신청서 제출·업로드·동의·제출 버튼 클릭을 대신하지 않으며, 미확인 자산을 임의로 승인하지 않는다.
