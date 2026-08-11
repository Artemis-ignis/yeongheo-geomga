# 영허검가 release v5.2 로컬 릴리스 감사

> 기준 시각: 2026-08-10 KST
> release ID: `yeongheo-release-v5.2-20260810`
> 봉인 기록: `output/qa/v5.2-final-seal-20260810.json`
> 판정: **로컬 기술 RC YES / 공개·공식 제출 NO — 외부 게이트 차단**

이 문서는 v5.2의 코드, production build, 원본 크기 화면, 실제 입력을 포함한 420초 완주, 재시작·일시정지, 성능, ZIP 재추출과 체크섬을 같은 release ID로 고정한 최신 권위 기록입니다. 자동 테스트나 격리 브라우저 PASS를 마스터의 원본 화면 승인, 자산 법적 권리 확인, 공개 URL 검증 또는 공식 제출 완료로 바꾸어 말하지 않습니다.

## 1. 이번 변경

목표 노트북의 2560×1600 화면에서 넓은 전장 시야는 유지하면서 설령이 전투의 시각적 중심으로 읽히도록 고해상도 전투 표시 크기만 조정했습니다.

- `src/runtime2d/PixiPresentation.js`: 1080p 설령 높이는 140px로 유지했습니다.
- 고해상도 배율 상한을 1.35에서 1.45로 조정해 1600p에서 189px 대신 203px가 되도록 했습니다.
- 카메라 투영, 전장 시야, 적 밀도, 발 피벗, 접촉 그림자와 플레이어 마커 회전은 바꾸지 않았습니다.
- `test/runtime2d-grounding.test.js`: 1080p·1600p·2160p 크기 계약을 회귀 테스트로 고정했습니다.

## 2. 자동·빌드 게이트

| 게이트 | v5.2 결과 |
|---|---:|
| Vitest | 64 files / **704 tests PASS** |
| source asset manifest | 116/116 |
| runtime allowlist | 72 |
| source 누락 / output 누락 / 예상 밖 dist asset | 0 / 0 / 0 |
| production dependency 취약점 | 0 |
| Vite build | 8.1.5, 765 modules, PASS |
| production `dist` | 104 files / 39,227,897 bytes |
| dist manifest SHA-256 | `295fcd5b65572e92db35b0066a4f0aba8495283cd516cf809b56fddb5a5f89b5` |
| 실행 청크 | `Game2D-BxmAcfZT.js`, 512,894 bytes |
| 실행 청크 SHA-256 | `0c2d1293f30cc94122d22b0e5650e6d808087a20ecc62dbc3a08b946c4682ddf` |

dist manifest는 상대 경로와 파일 SHA-256을 `relative/path=sha256` UTF-8 행으로 만들고, 경로를 대소문자 구분 정렬한 뒤 LF로 결합해 계산했습니다.

## 3. 원본 크기 시각 감사

사용자의 Chrome은 열거나 조작하지 않았습니다. 별도 격리 Chromium 세션을 한 번씩만 사용했고 감사 종료 시 세션과 QA 포트를 모두 닫았습니다.

| 화면 | 증거 |
|---|---|
| 타이틀 1920×1080 | `output/releases/screenshots-v5.2/01-title-1920x1080.png` |
| 첫 10초 2560×1600 | `output/releases/screenshots-v5.2/02-first10-2560x1600.png` |
| 전투 1920×1080 | `output/releases/screenshots-v5.2/03-gameplay-1920x1080.png` |
| 도가 선택 1920×1080 | `output/releases/screenshots-v5.2/04-dao-vow-1920x1080.png` |
| 승천 결과 1920×1080 | `output/releases/screenshots-v5.2/05-victory-1920x1080.png` |

직접 원본 크기로 확인한 로컬 RC 판정은 다음과 같습니다.

- 타이틀, 비경 선택, 전투 HUD와 맹세 선택이 옥·금장 선협 테마로 이어집니다.
- 2560×1600에서 viewport와 canvas가 정확히 일치하고 문서 overflow는 0×0입니다.
- 첫 안내는 `WASD · 방향키로 이동 | Space · 축지법`으로 노출됩니다.
- 설령, 적, 소품의 발 피벗과 접촉 그림자가 지면에 붙고 플레이어 마커는 기울지 않습니다.
- 지면은 한 장의 정적 판을 반복한 방식이 아니라 월드 고정 합성 지형으로 보이며, 주인공·적·투사체가 배경에서 분리됩니다.
- 이 판정은 로컬 개발 책임자의 시각 감사이며, 마스터의 노트북 원본 크기 최종 미학 승인은 아직 `PENDING`입니다.

## 4. 2560×1600 성능·입력 smoke

실제 이동, 축지법과 성장 선택을 포함한 33.52초 플레이 결과입니다.

| 항목 | 결과 |
|---|---:|
| 상태 / 레벨 / 처치 | playing / 3 / 22 |
| 기혈 | 128.8 / 128.8 |
| renderer | PixiJS WebGL2 |
| 적 / draw calls / triangles | 83 / 9 / 734 |
| rolling samples | 600 |
| frame interval p99 / max | 13.4ms / 17.5ms |
| simulation p99 / max | 0.7ms / 1.2ms |
| draw p99 / max | 1.6ms / 2.2ms |
| long tasks | 0 |
| audio dropped / preempted | 0 / 0 |
| console errors / warnings | 0 / 0 |

## 5. 새 Web ZIP의 정확한 420초 완주

Web ZIP을 새 폴더에 재추출해 그 폴더만 HTTP로 제공한 뒤, 실제 WASD 이동·Space 축지법·카드 선택으로 플레이했습니다. 피해 무효화, 시간 점프, 보스 강제 소환은 사용하지 않았습니다.

| 항목 | 결과 |
|---|---|
| run ID | `release-v5.2-victory-3185791507-1920x1080-20260810` |
| seed | `3185791507` |
| 결과 시각 | 정확히 420.000초 |
| 결과 | 승천 / 대승 |
| 레벨 / 처치 / 보스 | 33 / 2,457 / 2 |
| 준 피해 / 받은 피해 | 966,428 / 448.386149 |
| 획득 영석 | 380 |
| 최종 기혈 | 243.2937654 / 243.2937654 |
| 도가 | 심맥 → 심화정화 → 심마 그림자, 3/3 |
| viewport / canvas / overflow | 1920×1080 / 1920×1080 / 0×0 |
| 결과 시점 적 / 투사체 / 영기 | 207 / 73 / 94 |
| frame interval p99 / max | 8.7ms / 19.6ms |
| simulation p99 / max | 0.8ms / 1.2ms |
| draw p99 / max | 2.2ms / 2.4ms |
| long tasks | 0 |
| WebAudio started / ended / dropped / preempted | 11,614 / 11,614 / 0 / 0 |
| console errors / warnings | 0 / 0 |

결과 화면의 `같은 비경 재도전`으로 돌아가면 2.57초 시점의 playing 상태, 레벨 1, 처치 0, 기혈 115/115로 새 런이 시작됐습니다. Esc 일시정지 1.2초 동안 게임 시간 증가는 0초였고, 재개 후 0.6초가 정상 진행됐습니다.

## 6. 패키지와 제출 보조 자산

| 산출물 | entries / bytes | SHA-256 |
|---|---:|---|
| `output/releases/yeongheo-geomga-web-release-v5.2-20260810.zip` | 104 / 38,113,389 | `9b59b02dd2caf4533f6c7f1ff9ae444159a6ae76dd338a9fb934870cd1ad00f6` |
| `output/releases/yeongheo-geomga-windows-portable-v5.2-20260810.zip` | 113 / 38,135,379 | `605b141dfc6f9a499e3a4e06267dfe9f32054e6b094b134eb42672a60a9bb3a0` |
| `output/releases/yeongheo-geomga-thumbnail-v5.2-1920x1080.png` | 2,341,071 bytes | `cae7d30361db3db5a3a4086a500b88d70355d3f88631fe13deb6c0e4404d4545` |
| `output/releases/yeongheo-geomga-submission-video-v5-1080p-audio-176s-20260810.webm` | 72,538,926 bytes | `a255a1b945d445b92dd1a1ee6e77ab16a7220bf2985dde555986f89ebc678651` |

두 ZIP은 재추출 후 source dist와 104/104 SHA parity, unsafe path 0, duplicate path 0을 확인했습니다. 재추출한 Windows portable의 `게임시작.bat`은 브라우저 억제 테스트 모드에서 HTTP ready, exit code 0, 잔류 포트 0을 통과했습니다. 9개 최종 파일 해시는 `output/releases/SHA256SUMS-v5.2-20260810.txt`에 고정했으며 manifest 자체 SHA-256은 `6fba92f41d124ce02d2407d4a4b9b48c9ccef365c005010c26ef7149e1982068`입니다.

v5.2의 표시 크기 변경은 1080p에서는 비활성입니다. 따라서 기존 v5 실제 1080p 영상의 화면·게임플레이 로직은 동등하며, v5.2 정확 패키지 완주는 위 run ID로 별도 증명했습니다. 사람의 최종 시청·청감과 공개 영상 URL은 아직 승인 전입니다.

## 7. Release Review

로컬 제품 책임자의 답은 **“이 빌드는 기술·플레이·시각 검토용 출시 후보로 승인한다”**입니다. 첫 실행부터 전투, 세 번의 도가 선택, 중간·최종 보스, 정확히 7분 결과와 재도전까지 하나의 게임 루프로 성립합니다.

그러나 공개·공식 제출 승인 답은 아직 **NO**입니다. 남은 항목은 코드 작업으로 임의 해결할 수 없는 외부 게이트입니다.

1. runtime 이미지 72개의 기술 provenance는 72/72이지만 대표자의 법적 권리 증거 확인은 0/72입니다.
2. 이 Web ZIP을 공개 HTTPS에 배포하고 익명 새 세션에서 같은 build를 검증해야 합니다.
3. 마스터가 2560×1600 원본 크기 화면과 오디오를 직접 승인해야 합니다.
4. 대표자 계정, 개인정보·약관 동의와 공식 제출 동작이 남아 있습니다.

따라서 `productionReady=false`, `submitted=false`를 유지합니다. 이 네 게이트가 닫히기 전에는 공개 또는 제출 완료라고 선언하지 않습니다.
