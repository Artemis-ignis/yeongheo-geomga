# 영허검가 release-v5.1 로컬 릴리스 감사

> 기준일: 2026-08-10 KST
> release ID: `yeongheo-release-v5.1-20260810`
> 실행 청크: `Game2D-zM17W9tE.js` / SHA-256 `6e115fab7ec43d25852f26342aa08a2c254732043c70969dcf52a40a0c4e1706`
> 최종 dist manifest SHA-256: `6a12ad39e15eb1212b9e212a45f6f0dca656fb8f545e5b3bdadb317ac2918c88`
> 판정: **로컬 기술 RC PASS / 공개·권리·사람 승인 BLOCKED**

이 문서는 release-v5의 코드, 최종 production dist, 격리 브라우저 플레이, Web/Windows ZIP, 스크린샷을 하나의 로컬 후보로 묶은 권위 기록입니다. 자동 테스트나 한 번의 완주만으로 상용 출시·법적 권리·대회 제출 완료를 주장하지 않습니다.

v5.1 패키지·기술 provenance·동일 게임 청크 런타임 증거·외부 차단 요소의 기계 판독 가능한 최종 묶음은 `output/qa/v5.1-final-seal-20260810.json`입니다.

## 1. 출시 후보 범위

- production 진입점: PixiJS 2D `src/runtime2d/`
- 플레이어블: 설령 1명
- 출시 비경: 청람비경 1개
- 한 런: 420초
- 추천 시연 seed: `3185791507`
- 저장: 메타 진행·설정만 저장, active run은 저장하지 않음
- 로그인·광고·외부 telemetry: 없음
- 패키지 상태: `local-review-candidate-only`

잠긴 수사와 적염·한천 비경 데이터는 확장용 source roster이며 release-v5 플레이 약속이 아닙니다.

## 2. v5에서 닫은 핵심 품질 문제

- 첫 12초는 전체 화면 성장 모달을 막아 주인공·이동·자동 공격·축지법을 먼저 읽게 했고, 첫 힌트에 WASD와 Space를 함께 표시했습니다.
- 타이틀→수사→비경→출정 흐름을 옥·금장 선협 테마, 설령 초상, 비경 썸네일, 명확한 CTA로 재구성했습니다.
- 한 장 배경 확대 표현을 절차적 macro 지면과 월드 고정 authored crop decal 조합으로 바꾸고, 반복 경계와 정적 배경판 인상을 줄였습니다.
- 영웅·적·보스·소품은 프레임별 실제 알파 하단에서 발 pivot을 산출하고, 좁은 접촉 그림자·접촉광으로 지면에 붙였습니다.
- 기울어져 보이던 원형 marker는 지면 레이어로 내리고 회전 0, 크기·alpha를 줄였습니다.
- 주인공 뒤에 normal-blend 동일 텍스처의 얇은 수묵 림을 넣어 어두운 지면·후반 효과 속 silhouette를 분리했습니다. 필터를 쓰지 않아 얼굴 번짐과 별도 draw call 증가를 피했습니다.
- 법보·공법·진화·도가 선택은 고유 의미 아이콘, 종류, 이름, 단계, 효과, 키보드 포커스와 접근성 라벨을 갖습니다. runtime 아이콘은 v2 의미 아이콘까지 포함해 중복 의미를 분리했습니다.
- 피격·회복·축지법·처치에 위치 피드백과 semantic audio cue를 연결했고, 일반 무기 impact와 generic hit의 중복 재생은 제거했습니다.
- 행운은 모든 가중치에 같은 상수를 곱하던 무효 계산을 고쳐 신규 법보·공법과 진화 기회에 상대 가중치로 작동합니다.
- 최종보스 구간의 일반 군세 밀도를 줄여 보스 전조·패턴·주인공이 가려지지 않게 했습니다.

## 3. 자동 게이트

| 게이트 | release-v5 결과 |
|---|---|
| `npm test` | 64 files / 703 tests PASS |
| `npm audit --json` | 취약점 0 |
| `npm run assets:audit` | source manifest 116 / 실제 116 / 오류 0 |
| `npm run build` | Vite 8.1.5, 765 modules, PASS |
| `npm run assets:build-audit` | runtime 72/72, missing 0, unexpected 0 |
| production dist | 104 files / 39,227,369 bytes |
| 콘솔 | current-chunk full run error 0 / warning 0 |

`Game2D` 청크는 512,894 bytes(gzip 152.13 kB)라 Vite의 500kB 경고가 남습니다. 실제 7분 WebGL2 완주 2회와 현재 패키지의 2560×1600 성능 smoke가 아래 게이트를 통과했으므로 이번 후보에서 대규모 코드 분할은 회귀 위험 대비 이득이 작다고 판단했습니다.

## 4. 최종 실행 청크의 실제 420초 런

사용자 Chrome 탭·프로필·로그인 세션은 조작하지 않았습니다. 최종 ZIP에서 재추출한 dist를 로컬 HTTP로 제공하고 격리 Playwright Chromium 세션 하나만 사용했습니다. 이동은 WASD 네 방향을 순환하고 Space 축지법을 사용했으며, 성장·도 선택은 보이는 카드를 실제 클릭했습니다. 피해 무효화, 시간 점프, 적 삭제, 보스 강제 소환은 사용하지 않았습니다.

| current chunk 완주 | 결과 | 레벨 / 처치 | 가한 피해 | 획득 영석 | 도가 | 콘솔 |
|---|---|---:|---:|---:|---|---|
| `release-v5-hpfix-victory-3185791507-1920x1080-20260810` | 정확히 420초 승천 | 35 / 2,690 | 1,031,071 | +384 | 심맥 | error 0 / warning 0 |
| `release-v5-av-victory-3185791507-1920x1080-20260810` | 정확히 420초 승천 | 34 / 2,395 | 1,181,238 | +376 | 심맥 | error 0 / warning 0 |

두 번째 완주는 같은 세션의 실제 WebAudio를 MediaRecorder로 받아 영상과 합쳤습니다. 이 원본에서 첫 성장·초반 전투·중간보스·후반 성장·최종보스·승천을 176.01초로 편집한 `output/releases/yeongheo-geomga-submission-video-v5-1080p-audio-176s-20260810.webm`을 만들었습니다. 영상은 1920×1080 VP8 25fps, 오디오는 48kHz stereo Opus이며 평균/최대 음량은 -19.0/-0.5 dB, SHA-256은 `a255a1b945d445b92dd1a1ee6e77ab16a7220bf2985dde555986f89ebc678651`입니다.

최종 패키지의 2560×1600 exact-chunk 성능 smoke도 별도로 반복했습니다.

| 항목 | 값 |
|---|---:|
| viewport / canvas / overflow | 2560×1600 / 2560×1600 / `[0,0]` |
| 관측 구간 | 실제 33.717초 / 600 rolling samples |
| frame interval average / p99 / max | 7.743 / 8.6 / 19.9 ms |
| frame work average / p99 / max | 0.586 / 1.5 / 2.0 ms |
| simulation p99 / max | 0.6 / 0.7 ms |
| draw p99 / max | 1.5 / 1.9 ms |
| draw calls / triangles | 9 / 694 |
| long task | 0 |
| audio started / active / dropped / preempted | 271 / 7 / 0 / 0 |
| console error / warning | 0 / 0 |

자세한 기계 판독값은 `output/qa/v5-final-package-run-20260810.json`에 고정했습니다. 종료 후 격리 브라우저 세션은 0개, QA 서버 4195 listener는 0개임을 확인했습니다.

### 마지막 실플레이 결함과 재봉인

최초 녹화 중 현재 기혈을 `ceil`, 최대 기혈을 `round`로 표시해 `153 / 152`처럼 보일 수 있는 HUD 결함을 발견했습니다. `formatHpReadout`에서 두 값을 일관되게 올림하고 현재값을 최대값으로 clamp하도록 수정했으며, 경계값 회귀 테스트 2개를 추가했습니다. 실제 화면에서 `153 / 153`을 확인한 뒤 전체 701 테스트, build, 두 번의 420초 완주, ZIP 재생성·재추출·launcher smoke를 반복했습니다. v5.1에서는 provenance 회귀 2개가 추가되어 전체 703 테스트를 통과했으며 게임 실행 청크는 동일합니다. 수정 전 영상·ZIP·스크린샷은 `pre-hp-readout-fix` 이름으로 보존해 최종 증거와 섞이지 않게 했습니다.

## 5. 무작위 seed·도가 분기 공정성

추천 seed 하나에만 맞춘 게임이 되지 않도록 8개 seed × 6개 완전 도가 분기, 총 48회를 일반 first-card·cardinal 이동 정책으로 420초까지 돌렸습니다.

| 분기 | 최종보스 진입 | 승천 | 승률 | 진입 HP 최저 |
|---|---:|---:|---:|---:|
| 검맥·회귀검선 | 8/8 | 7/8 | 87.5% | 72.7% |
| 검맥·관통검선 | 8/8 | 8/8 | 100% | 100% |
| 설맥·빙결파편 | 8/8 | 7/8 | 87.5% | 65.0% |
| 설맥·빙결직선 | 8/8 | 7/8 | 87.5% | 62.8% |
| 심맥·정화심화 | 8/8 | 8/8 | 100% | 100% |
| 심맥·공명심마 | 8/8 | 8/8 | 100% | 100% |

전체는 최종보스 진입 48/48, 승천 45/48, 승률 93.75%입니다. 자동 정책 승률이 사람의 재미를 대신하지는 않지만, 특정 도가가 구조적으로 막히거나 최종보스에 도달하지 못하는 P1 불공정은 발견되지 않았습니다. 원본 행은 `output/qa/v5-branch-balance-decoupled.jsonl`입니다.

## 6. 최종 시각 검사

최종 실행 payload에서 다음을 원본 크기로 확인했습니다.

- 1920×1080 타이틀: 키아트, 설령, 게임 약속, 추천/직접 준비 CTA가 한 화면에서 읽힘
- 2560×1600 초반 전투: 영웅 림·발 접점·marker가 지면과 일치하고, 지형 decal·소품·적이 서로 다른 깊이로 분리됨
- 1920×1080 돌파·맹세: 카드별 고유 아이콘, 법보/공법/도가 종류·단계·효과가 중복 없이 읽힘
- 2560×1600 승천: 도가 결과, 7분·층·처치·피해·영석·업적·빌드 아이콘·재도전 CTA가 한 화면에 표시됨

출시 후보 묶음은 동일 게임 청크를 캡처한 `output/releases/screenshots-v5/`의 5개 파일이며, 최신 패키지와 함께 `output/releases/SHA256SUMS-v5.1-20260810.txt`에 지문을 고정했습니다. 자동 시각 검사와 제가 한 미학적 검토는 마스터의 실제 Windows 원본 크기 승인과 사람 청감을 대신하지 않습니다.

## 7. 최종 로컬 검토 패키지

권리 gate가 `BLOCKED`라 패키저 기본 실행은 의도적으로 실패합니다. 아래 ZIP은 `-AllowUnclearedRights`를 명시한 로컬 검토 후보입니다.

| 산출물 | entries | bytes | SHA-256 |
|---|---:|---:|---|
| `yeongheo-geomga-web-release-v5.1-20260810.zip` | 104 | 38,113,389 | `f216c87998d4699d8c768a7aa447d87035586e693110dcda20b5fd4106517286` |
| `yeongheo-geomga-windows-portable-v5.1-20260810.zip` | 113 | 38,135,379 | `b4925183e0f4549df2d474982cf902375157b8aaaeb70bfde81f85a6ff6b62fe` |

- Web ZIP 104/104, Windows 내부 dist 104/104가 최종 dist와 경로·크기·SHA까지 일치
- ZIP 상위 경로·절대 경로·중복 entry 0
- 별도 새 폴더 재추출 후 두 dist parity difference 0
- 재추출한 Windows `게임시작.bat`: Node/npm 없이 HTTP ready, exit 0, 잔류 4173 listener 0
- 사용자 브라우저를 열지 않도록 `YEONGHEO_NO_BROWSER=1`, 종료 검증을 위해 `YEONGHEO_TEST_MODE=1`만 사용

## 8. 조사 결과의 실제 적용 경계

`docs/product/RESEARCH_LEDGER_2026-08-10.md`에는 동종 Steam 작품, Hunyuan3D-WorldClaw, Riot 가시성/VFX 자료, Reynolds steering, 고정 timestep, PCG·자동 밸런스 연구, PixiJS 성능 지침, GitHub 라이브러리·라이선스 후보를 기록했습니다.

이번 후보에 실제 반영한 것은 화면 판독성 림, 지면→지역 decal→개별 prop→접점의 coarse-to-fine 통합, fixed-tick/seed 다중 분기 sweep, spritesheet·pool·blend batching, semantic audio와 high-contrast UI입니다. ECS 전환, WFC, 런타임 DDA, 무거운 bloom/outline, 검증되지 않은 GitHub clone·외부 에셋은 마감 직전 회귀·권리·성능 위험 때문에 도입하지 않았습니다.

## 9. 냉정한 Release Review

다음은 **YES**입니다.

- 더블클릭 실행 경로와 정리
- 첫 10초·핵심 전투·성장·도가·중간/최종보스·420초 결과·재도전
- 1920×1080 / 2560×1600 화면, 리사이즈, 일시정지·재개
- 랜덤 seed·6개 도가 분기 공정성
- 콘솔·성능·오디오 voice lifecycle·ZIP 무결성
- 타이틀·전투·선택·결과의 로컬 시각 RC
- current-chunk 실제 오디오가 포함된 176.01초 제출 영상
- runtime 이미지 technical provenance chain `72/72` (AS-04·AS-14·AS-16 byte·RGBA exact 재현 포함)

다음은 아직 **NO / BLOCKED**입니다.

1. runtime 이미지 법적 권리 증빙 `0/72` (technical provenance `72/72`와 별개)
2. 동일 최종 Web ZIP의 공개 HTTPS 배포와 익명 새 세션 검증
3. 마스터의 실제 노트북 원본 크기 시각 승인과 사람 청감 승인
4. 대표자 계정·개인정보·약관 동의·최종 제출

따라서 release-v5는 더 이상 placeholder 중심의 기술 데모가 아니라 시작부터 승천까지 성립하는 **로컬 공개 시연용 release candidate**입니다. 그러나 권리·공개 배포·사람 승인 없이 `productionReady: true`, 상용 출시 완료, 대회 제출 완료로 선언하지 않습니다.
