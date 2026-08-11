# 영허검가 release v5.2 제출 인계서 — 역사 기록

> **대체됨:** 최신 제출 인계서는 [SUBMISSION_HANDOFF_V5_3_2026-08-10.md](./SUBMISSION_HANDOFF_V5_3_2026-08-10.md)입니다. 아래 v5.2 값은 과거 후보 추적용이며 현재 제출값으로 사용하지 않습니다.

> 기준 시각: 2026-08-10 KST
> 대상: `영허검가: 천겁의 맹세` / OpenAI Game 2026 Track 1
> 인계 상태: **로컬 기술 RC PASS / NOT_SUBMITTED / 외부 게이트 BLOCKED**

이 문서는 release-v5.2 후보와 공식 제출 직전의 사람 확인 항목을 분리해 넘기는 인계서입니다. 이 문서 작성 중 공식 신청서에 로그인하거나 제출 버튼을 누르지 않았습니다. 권리 클리어, 현재 v5.2의 공개 URL, 사용자 개인정보·동의, 최종 시청각 승인을 완료했다고 주장하지 않습니다.

최신 로컬 봉인 값은 `output/qa/v5.2-final-seal-20260810.json`을 사용합니다. 이 파일의 `localTechnicalRc=YES`와 `publicReleaseAndSubmission=NO_BLOCKED_BY_EXTERNAL_GATES`는 서로 다른 판정입니다.

## 1. 일정과 현재 판정

| 항목 | 현재 값 | 판정 |
|---|---|---|
| Track 1 공식 접수 창 | 2026-08-04 ~ 2026-08-26 | 공식 일정으로 기록 |
| 내부 안전 마감 | 2026-08-20 | 프로젝트 내부 목표이며 공식 마감 시각이 아님 |
| 공식 제출 상태 | 아직 미제출 | `BLOCKED` |
| runtime 이미지 기술 provenance | 72/72 | `PASS` — 법적 권리와 별도 |
| runtime 이미지 권리 | 0/72 | **`BLOCKED`** |
| 현재 v5.2 공개 HTTPS 플레이 URL | 없음/미배포 | **`TO_BE_FILLED` / `BLOCKED`** |
| 대표자 Google 로그인·개인정보·동의 | 공식 화면에서 미확인 | **사용자 확인 필요 / BLOCKED** |
| 최종 썸네일·스크린샷 시각 승인 | 미승인 | **사용자 확인 필요 / BLOCKED** |
| 최종 영상 시청·청감 승인 | 미승인 | **사용자 확인 필요 / BLOCKED** |

공식 신청 화면은 Google 로그인을 요구하며 이름·이메일·프로필 사진 등 계정 정보와 대표자 신청 정보를 기록합니다. 대표자는 공식 화면에서 참가 약관, 개인정보 처리방침, 개인정보 국외 이전 동의를 직접 읽고 선택해야 합니다. 실제 계정·이름·이메일·전화번호·생년월일·법정대리인 정보는 저장소와 이 문서에 기록하지 않습니다.

공식 근거: [행사·Track 1 안내](https://openaigame2026.com/), [참가 약관](https://openaigame2026.com/ko/terms), [개인정보 처리방침](https://openaigame2026.com/ko/privacy)

## 2. 제품 기준선

- 기본 출품 경로는 `src/main.js`에서 이어지는 PixiJS 2D `src/runtime2d/`입니다. 레거시 Three.js 경로를 release-v5.2의 플레이 약속으로 쓰지 않습니다.
- `public/release.json`의 식별자는 `yeongheo-release-v5.2-20260810`이며, 420초 런·showcase seed `3185791507`·로그인 불필요 메타데이터를 선언합니다. 이 메타데이터는 공개 배포나 제출 완료 증거가 아닙니다.
- release-v5.2의 권위 로컬 기록은 `RELEASE_V5_2_AUDIT_2026-08-10.md`입니다. 새 Web ZIP에서 피해 무효화·시간 점프·보스 강제 소환 없이 정확히 420초 승천, 결과→재도전과 일시정지를 통과했고, 별도 2560×1600 성능 smoke에서 viewport/canvas 일치·overflow 0·콘솔 0을 확인했습니다.
- 출시 플레이 약속은 설령 1명·청람비경 1개입니다. source roster의 잠긴 캐릭터·확장 비경 데이터는 v5.2 출시 플레이 가능 콘텐츠가 아닙니다.
- localStorage에는 메타 진행과 설정만 저장합니다. 진행 중 7분 런은 저장하지 않으며 새로고침·종료 시 사라집니다.
- v5.2 Web/Windows portable ZIP을 같은 dist에서 생성하고 재추출·해시·브라우저 없는 실행을 확인했습니다. 자동 테스트·로컬 런타임 PASS는 공개 URL·권리·사람 승인을 대신하지 않습니다.

## 3. 공식 제출 필드 인계

| 필드 | 준비값 또는 조건 | 현재 상태 / 다음 담당 |
|---|---|---|
| 작품명 | `영허검가: 천겁의 맹세` | 대표자가 최종 승인 |
| 소개문 | 아래 121자 후보 | 실제 공개 빌드와 일치하는지 대표자가 최종 승인 |
| 플레이 URL | 공개 HTTPS URL | 현재 미배포. `TO_BE_FILLED`; 동일 v5.2 build를 익명 새 세션에서 확인한 뒤 입력 |
| 썸네일 | JPG 또는 PNG, 16:9, 10MB 이하를 권장하는 공식 화면 기준 | 후보 파일은 있으나 권리·실제 런타임 대표성·사람 승인·공식 업로드 미완료 |
| 참가자·팀·본선 참석 | 대표자가 공식 화면에서만 입력 | 개인정보를 문서·로그에 저장하지 않음 |
| 필수 동의 | 이용약관, 개인정보 수집·이용, 국외 이전 동의 | 대표자가 공식 화면에서 직접 확인·선택 |
| 선택 영상 | 실제 플레이 포함 3분 이하 | current v5 실제 플레이·WebAudio 176.01초 파일 완성; 공개 링크·권리·사람 시청각 승인 미완료 |
| 선택 Codex 설명 | 사용 위치·구현/해결 범위·사람의 결정을 과장 없이 설명 | 초안 있음; 실제 제출용 최종 문구와 도전 기간 증거 연결 필요 |

### 제목·소개문 후보

> 설령은 마기가 삼킨 청람비경에서 자동 법보와 축지법으로 요괴를 돌파한다. 경지마다 고른 도가 공격과 마지막 천겁을 바꾸는 7분 선협 서바이버 RPG. 내가 만든 검맥·설맥·심맥의 거울, 옥허진장을 쓰러뜨리고 승천하라.

문서상 계산값은 공백·문장부호를 포함한 121자입니다. 공개 URL에서 실제로 재생되는 기능과 최종 권리 검토가 끝나기 전에는 완료형 제출 문구로 확정하지 않습니다. 상세 초안은 [`SUBMISSION_COPY_KO.md`](./SUBMISSION_COPY_KO.md)를 참조합니다.

## 4. 산출물 인계

### 4.1 release-v5.2 로컬 검토 패키지

권리 게이트가 `BLOCKED`이므로 `tools/package-release.ps1`의 기본 실행은 패키징을 거부합니다. 아래 파일은 `-AllowUnclearedRights`를 명시해 만든 **로컬 검토 전용** 산출물이며 공개·제출 허가를 뜻하지 않습니다.

| 역할 | 경로 | bytes | SHA-256 |
|---|---|---:|---|
| Web ZIP | `output/releases/yeongheo-geomga-web-release-v5.2-20260810.zip` | 38,113,389 | `9b59b02dd2caf4533f6c7f1ff9ae444159a6ae76dd338a9fb934870cd1ad00f6` |
| Windows portable ZIP | `output/releases/yeongheo-geomga-windows-portable-v5.2-20260810.zip` | 38,135,379 | `605b141dfc6f9a499e3a4e06267dfe9f32054e6b094b134eb42672a60a9bb3a0` |

Web ZIP은 dist 104개 파일과 경로·SHA가 전부 일치했습니다. Windows ZIP은 113개 entry이며 `게임시작.bat`, UTF-8 PowerShell 스크립트, dist와 고지 문서를 포함합니다. 두 ZIP을 새 폴더에 재추출했고, 추출된 Windows 배치 파일을 Node/npm 없이 브라우저 비활성 테스트 모드로 실행해 HTTP 준비·정상 종료·잔류 포트 0을 확인했습니다.

### 4.2 v5.2 스크린샷 묶음

현재 `output/releases/screenshots-v5.2/`에 있는 최종 실행 payload의 로컬 후보입니다. 제목, 2560×1600 첫 10초, 실제 전투, 도가 맹세와 정확한 420초 승천 결과 5개를 선별했습니다. 마스터의 원본 크기 최종 선택·권리·시각 승인은 미완료입니다.

| 파일 | 크기 | bytes | 현재 파일 SHA-256 |
|---|---:|---:|---|
| `01-title-1920x1080.png` | 1920×1080 | 2,341,071 | `cae7d30361db3db5a3a4086a500b88d70355d3f88631fe13deb6c0e4404d4545` |
| `02-first10-2560x1600.png` | 2560×1600 | 4,647,014 | `8882bcec4de3fe69e1657989790beddad7b66bdf5bd058a83983fdd18e64bc90` |
| `03-gameplay-1920x1080.png` | 1920×1080 | 2,608,954 | `449ce75af7196010ea3bdb6f67a2ebbf5785ce72f34598ca18d45a3e45a10489` |
| `04-dao-vow-1920x1080.png` | 1920×1080 | 700,526 | `d83990af257d74407566c7c31753c43992c08f16ef05cd02876c999ef289e3b1` |
| `05-victory-1920x1080.png` | 1920×1080 | 1,584,731 | `e3f4852564d6b5dbc4f52f6e10dc8c1924a6bcbc1779af86e3ecfcff9c76d89d` |

```text
screenshot_directory: output/releases/screenshots-v5.2/
screenshot_count: 5
screenshot_selection: title, first ten seconds, actual gameplay, Dao vow, victory
winning_run_id: release-v5.2-victory-3185791507-1920x1080-20260810
visual_approval: USER_PENDING
```

### 4.3 선택 제출 영상 — current release-v5

| 항목 | 현재 값 | 판정 |
|---|---|---|
| 파일 | `output/releases/yeongheo-geomga-submission-video-v5-1080p-audio-176s-20260810.webm` | 로컬 파일 존재 |
| 실제 플레이 | current chunk의 420초 승천 런에서 편집한 실제 전투·성장·보스·결과와 같은 세션 WebAudio | 기술 검수 기록 있음 |
| 규격 | 1920×1080, 176.01초, VP8 25fps, stereo Opus 48 kHz | 3분 이하 선택 항목에 맞는 후보 |
| 크기 | 72,538,926 bytes | 확인 |
| SHA-256 | `a255a1b945d445b92dd1a1ee6e77ab16a7220bf2985dde555986f89ebc678651` | 파일 지문 확인 |
| 공개 영상 URL | `TO_BE_FILLED` | 미공개/미확인 |
| 최종 사람 시청·청감 | 미승인 | **BLOCKED** |

이 영상은 선택 가산점 후보이지 제출 완료 증거가 아닙니다. 사람의 시청·청감, 영상에 보이는 자산의 권리, 공개 URL을 같은 최종 build/run 증거로 연결해야 합니다.

### 4.4 썸네일 후보

제출용 복사본은 `output/releases/yeongheo-geomga-thumbnail-v5.2-1920x1080.png`입니다. 실제 최종 release-v5.2 타이틀 화면을 그대로 복사한 16:9 PNG, 2,341,071 bytes, SHA-256 `cae7d30361db3db5a3a4086a500b88d70355d3f88631fe13deb6c0e4404d4545`입니다. 권리·사람의 원본/축소 시각 승인은 제출 직전 다시 확인합니다.

## 5. 미확정 불변값과 외부 연결

```text
release_id: yeongheo-release-v5.2-20260810
v5_2_game_chunk_sha256: 0c2d1293f30cc94122d22b0e5650e6d808087a20ecc62dbc3a08b946c4682ddf
v5_2_dist_file_count: 104
v5_2_dist_bytes: 39227897
v5_2_dist_manifest_sha256: 295fcd5b65572e92db35b0066a4f0aba8495283cd516cf809b56fddb5a5f89b5
v5_2_web_zip_sha256: 9b59b02dd2caf4533f6c7f1ff9ae444159a6ae76dd338a9fb934870cd1ad00f6
v5_2_windows_portable_zip_sha256: 605b141dfc6f9a499e3a4e06267dfe9f32054e6b094b134eb42672a60a9bb3a0
winning_result_screenshot_sha256: e3f4852564d6b5dbc4f52f6e10dc8c1924a6bcbc1779af86e3ecfcff9c76d89d
deployment_url: TO_BE_FILLED
deployment_commit_or_hash: TO_BE_FILLED
deployment_verified_at_kst: TO_BE_FILLED
anonymous_play_run_id: TO_BE_FILLED
thumbnail_candidate_sha256: cae7d30361db3db5a3a4086a500b88d70355d3f88631fe13deb6c0e4404d4545
submission_video_sha256: a255a1b945d445b92dd1a1ee6e77ab16a7220bf2985dde555986f89ebc678651
video_url: TO_BE_FILLED
codex_submission_summary: TO_BE_FILLED
submission_timestamp_kst: TO_BE_FILLED
submission_confirmation_id: TO_BE_FILLED
```

기존 v3/v4/v5/v5.1 해시를 v5.2 값으로 복사하지 않습니다. 서로 다른 run/build의 스크린샷·ZIP·영상·URL을 하나의 제출 증거처럼 섞지 않습니다. 단, v5.2 변경이 1080p에서 비활성이라는 명시된 동등성 경계 안에서만 v5 영상을 사용합니다.

## 6. 제출을 막는 외부 블로커

1. **권리 0/72 BLOCKED:** technical provenance chain은 AS-04·AS-14·AS-16의 원본·generation event·변환 재현을 복구하여 72/72가 됐지만, `ASSET_RIGHTS_LEDGER.md`와 `RIGHTS_CONFIRMATION_KO.md` 기준으로 provenance·SHA·QA PASS는 법적 권리·대회 공개 허락이 아닙니다. 생성 계정·Input·제3자 권리·팀 귀속·대표자 공개 권한은 여전히 사람 확인이 필요합니다.
2. **공개 HTTPS 미배포:** README의 주소는 현재 release-v5.2가 공개 URL에서 동일 build로 재생된다는 증거가 아닙니다. 동일 v5.2 ZIP의 공개 URL·접근 시각·익명 새 세션 재생·build hash를 채우기 전 URL 필드는 비워 둡니다.
3. **사용자 개인정보·동의:** Google 계정 선택, 대표자·팀·국가·생년월일·연락처, 본선 참석 여부 및 해당 시 법정대리인 동의는 마스터/대표자가 공식 화면에서 직접 처리합니다. 이용약관·개인정보·국외 이전 동의를 추정하거나 대행하지 않습니다.
4. **최종 시청각 승인:** v5.2 스크린샷·썸네일과 current-v5 176.01초 영상이 실제 게임을 대표하고 화면·오디오가 제출 목적에 적합한지 사람이 원본 크기와 청감으로 승인해야 합니다. 자동 캡처·decode·headless PASS는 이를 대체하지 않습니다.
5. **도전 기간·Codex 증빙:** 기존 프로젝트의 도전 기간 신규/개선 범위, 실제 Codex 사용 범위, 사람의 수락·수정·반려 판단을 최종 `run_id`·`build_id`와 연결해야 합니다. 프롬프트 원문·개인정보·토큰은 제출 설명에 넣지 않습니다.

## 7. 내부 마감 전 인계 순서

1. 대표자가 제출 직전 공식 메인·약관·개인정보 처리방침의 일정과 필수 동의 항목을 다시 확인합니다.
2. 권리 원장 72개와 썸네일·영상·폰트·음원·외부 도구를 자산별로 검토하고, 불명확한 것은 제거·교체합니다. `rights_evidence_confirmed`가 72/72가 되기 전에는 공개·제출하지 않습니다.
3. 생성된 v5.2 Web ZIP과 Windows portable ZIP의 해시를 권리 승인 직전 다시 계산하고, 현재 로컬 검토본과 동일한지 대조합니다.
4. v5.2 ZIP을 공개 HTTPS에 배포한 뒤, 동일 build hash가 익명 새 세션에서 시작·플레이·결과·재도전까지 재현되는지 사람이 확인합니다.
5. v5.2 스크린샷 묶음과 썸네일을 선택하고 시각 승인합니다. 선택한 파일의 최종 manifest/archive hash를 기록합니다.
6. 176.01초 current-v5 영상을 사람의 눈과 귀로 승인하고 공개 영상 URL을 기록합니다. Codex 설명은 실제 기여와 사람의 결정을 짧게 요약합니다.
7. 모든 필드·동의·파일·URL을 대표자가 다시 읽은 뒤, 대표자가 공식 신청 화면에서만 제출 버튼을 직접 클릭하고 확인 화면·시각·해시를 보관합니다.

## 8. 최종 체크리스트

- [ ] 2026-08-20 내부 마감 전 권리 72/72와 사람 승인 기록 완료
- [ ] 제목·200자 이내 소개·공개 HTTPS 플레이 URL 최종 승인
- [ ] Google 로그인·참가자 정보·이용약관·개인정보·국외 이전 동의를 공식 화면에서 직접 확인
- [ ] 썸네일 JPG/PNG·16:9·10MB 이하 권장 조건과 실제 런타임 대표성 확인
- [x] 로컬 검토용 v5.2 Web ZIP·Windows portable ZIP·dist·승천 결과 스크린샷의 SHA-256 기록
- [ ] 선택 영상 176.01초 공개 URL 및 사람 시청·청감 승인 기록
- [ ] Codex 활용 설명, 도전 기간 변경 범위, 동일 `run_id`·`build_id` 연결
- [ ] 공식 제출 전까지 `NOT_SUBMITTED`; 제출 후에만 확인 ID·시각을 외부 화면과 대조해 갱신

## 9. 근거 문서

- [`README.md`](../../README.md)
- [`OPENGAME2026_SUBMISSION.md`](./OPENGAME2026_SUBMISSION.md)
- [`READINESS_MATRIX.md`](./READINESS_MATRIX.md)
- [`RELEASE_V3_AUDIT_2026-08-10.md`](./RELEASE_V3_AUDIT_2026-08-10.md)
- [`RELEASE_V4_AUDIT_2026-08-10.md`](./RELEASE_V4_AUDIT_2026-08-10.md)
- [`RELEASE_V5_AUDIT_2026-08-10.md`](./RELEASE_V5_AUDIT_2026-08-10.md)
- [`RELEASE_V5_2_AUDIT_2026-08-10.md`](./RELEASE_V5_2_AUDIT_2026-08-10.md)
- [`ASSET_RIGHTS_LEDGER.md`](./ASSET_RIGHTS_LEDGER.md)
- [`RIGHTS_CONFIRMATION_KO.md`](./RIGHTS_CONFIRMATION_KO.md)
- [`CODEX_COLLABORATION_EVIDENCE.md`](./CODEX_COLLABORATION_EVIDENCE.md)
- [`tools/package-release.ps1`](../../tools/package-release.ps1)
