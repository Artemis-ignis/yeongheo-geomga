# 영허검가 release v5.3 로컬 릴리스 감사

> 기준 시각: 2026-08-10 KST
> release ID: `yeongheo-release-v5.3-20260810`
> 봉인 기록: `output/qa/v5.3-final-seal-20260810.json`
> 판정: **로컬 기술·플레이 RC YES / 공개·공식 제출 NO — 외부 게이트 차단**

이 문서는 반복 지면, 접지, 2560×1600 프레이밍과 실제 입력 난이도를 다시 다듬은 v5.3의 최신 권위 기록입니다. 자동 PASS를 사람의 원본 화면·청감 승인이나 자산 법적 권리 확인, 공개 URL 검증, 공식 제출 완료로 바꾸어 말하지 않습니다.

## 1. 이번 릴리스에서 해결한 문제

- 청람비경 원본 한 장을 그대로 반복하는 인상을 줄이기 위해 절차적 macro 지면 위에 서로 다른 authored crop을 월드 고정 배치하고, crop 크기·원점·4방향 미러를 seed별로 바꿨습니다.
- 같은 완전 원형 문양이 청크마다 도장처럼 반복되던 표현을 제거하고, 침식 초승달·붕괴 삼각·어긋난 봉인석·광맥 균열처럼 일부만 남은 seed별 지형 흔적으로 교체했습니다.
- 캐릭터·적·보스·장식물은 실제 알파 하단에서 접점 피벗을 샘플링하고 실루엣별 좁은 접촉 그림자를 사용합니다. 주인공의 원형 표식은 지면층으로 내리고 회전·크기·알파를 억제했습니다.
- 1920×1080 실제 브라우저 판이 06:31에 사망한 문제를 숨기지 않고, 같은 seed와 실제 브라우저 입력 주기를 고정 틱 테스트에서 408.17초 사망으로 재현했습니다.
- 최종보스의 25·55·85초 단계 전환에 18% 회복, 1.15초 보호, 적탄 정리를 추가했습니다. 숨은 무적이나 부활이 아니라 보이는 회복 숫자·링과 함께 단계 전환의 숨 고르기를 제공합니다.
- 실제 브라우저 입력 주기 회귀 테스트를 추가해 이 경로가 420초 승리와 생존 상태를 유지하도록 고정했습니다.
- 실제 1080p 최종보스 화면에서 전투 알림이 화면 상단에 잘리는 문제를 발견했습니다. 보스 스택 CSS 변수가 형제 요소에 전달되지 않던 원인을 고쳐 HUD 루트 변수와 명시적 fallback을 사용하고, 선택 모달 뒤로 알림을 내렸습니다. 1920×1080에서 타이머 겹침 0·모달 가림 0을 확인하고 3개 회귀 테스트로 고정했습니다.

## 2. 자동·정적 게이트

| 게이트 | v5.3 결과 |
|---|---|
| Vitest | 65 files / **709 tests PASS** |
| focused release regression | launcher + grounding + browser cadence + HUD layout가 전체 suite에 포함되어 PASS |
| production build | Vite 8.1.5 / 765 modules / PASS |
| source asset audit | 116/116 / 경고 없음 |
| runtime asset audit | 72/72 / sourceMissing 0 / outputMissing 0 / unexpected 0 |
| production dependency audit | 취약점 0 |
| dist | 104 files / 39,230,215 bytes |
| dist manifest SHA-256 | `6ab88ac40e5af59dbbf216c4fba8ef2e83e701e5caaaf920437f47fbd723142f` |
| 실행 청크 | `Game2D-CfY6A-CR.js`, 515,121 bytes |
| 실행 청크 SHA-256 | `4e9f58de4496264d2a9613057beb1ee3a1c412e576f0614449d4b4dbadd29b0a` |

## 3. 정확한 Web ZIP 420초 실플레이

`output/qa/v5.3-bannerfix-package-verify-20260810/web`은 최종 v5.3 Web ZIP을 새 디렉터리에 실제로 풀어 만든 검증 대상입니다. 소스 `dist`가 아니라 이 추출본을 격리 Chromium에서 실행했습니다.

| 항목 | 결과 |
|---|---|
| run ID | `release-v5.3-bannerfix-3185791507-1920x1080-20260810-084524` |
| seed / 해상도 | `3185791507` / 1920×1080 |
| 입력 경계 | 실제 WASD·Space·카드 클릭; 피해 무효화·시간 점프·보스 강제 소환 없음 |
| 결과 | **승천 / 07:00** |
| 경지 / 처치 | 대승 33층 / 2,394 |
| 가한 피해 / 영석 | 887,955 / +366 |
| 보스 / 도가 | 보스 2체 / 심맥 3/3 |
| 최종 HP | 244/244 |
| 결과→재도전 | 최신 패키지의 결과 UI 회귀에서 00:03, HP 115/115; 이 420초 영상 런 자체에는 재도전 입력 미포함 |
| 일시정지 | 동일 실행 청크의 이전 실제 패키지 런과 자동 회귀에서 PASS; 이 영상 런 자체에는 미포함 |
| 콘솔 | errors 0 / warnings 0 / page errors 0 |

### 장시간 오디오와 성능 경계

| 항목 | 결과 |
|---|---:|
| 영상 캡처 frame interval p99 / max | 50.1ms / 66.6ms — SwiftShader 소프트웨어 렌더링과 동시 영상 인코딩 값이므로 출시 성능 판정에 사용하지 않음 |
| 영상 캡처 simulation p99 / max | 1.1ms / 4.2ms |
| 영상 캡처 draw p99 / max | 4.3ms / 10.3ms |
| 영상 캡처 long tasks | 56 — 인코딩 교란값 |
| 결과 화면 WebAudio started / ended / active | 11,438 / 11,437 / 1 |
| dropped / preempted | 0 / 0 |

## 4. 2560×1600 교차 검증

동일 추출 Web ZIP을 마스터의 노트북 해상도와 같은 2560×1600으로 다시 실행했습니다.

- viewport 2560×1600, canvas CSS 2560×1600, backing buffer 2560×1600 일치
- 문서 overflow X/Y 모두 0
- 실제 이동·축지법·피격·회복·검맥 선택 후 playing 상태
- 실제 WebGL2/NVIDIA 렌더링에서 frame interval p99 8.7ms, max 15.7ms, long task 0
- 별도 최신 패키지 1920×1080 완주에서 콘솔 error/warning/page error 0
- 실제 이동 후 접지가 분명한 캡처만 제출 후보에 남겼습니다.

## 5. 패키지·launcher

| 산출물 | entries / bytes | SHA-256 |
|---|---:|---|
| `output/releases/yeongheo-geomga-web-release-v5.3-20260810.zip` | 104 / 38,114,148 | `df12aaae11241a0a7fb48515b1cc40cbc972a3377b57a6481b1196dc1ca08c80` |
| `output/releases/yeongheo-geomga-windows-portable-v5.3-20260810.zip` | 113 / 38,136,138 | `b8fefe0fbcb6e009651f1f3a1cb2c214e274cd341bbe330bee5d12143ac89546` |
| `output/releases/yeongheo-geomga-thumbnail-v5.3-1920x1080.png` | 2,341,071 bytes | `cae7d30361db3db5a3a4086a500b88d70355d3f88631fe13deb6c0e4404d4545` |

- Web 추출본과 Windows 내부 dist는 source dist와 각각 104/104 SHA parity입니다.
- 양쪽 `release.json`은 `yeongheo-release-v5.3-20260810`입니다.
- Windows 추출본의 `게임시작.bat`은 `YEONGHEO_NO_BROWSER=1`, `YEONGHEO_TEST_MODE=1` 실동작에서 HTTP ready, exit code 0, 잔류 QA 포트 0을 통과했습니다.
- 최종 파일 해시는 `output/releases/SHA256SUMS-v5.3-20260810.txt`에 고정했고 manifest SHA-256은 `c75027102fde1c1b86c820a2854d91c344c7d3734fa4f68ee7b56ca78d989c96`입니다.

## 6. 스크린샷

`output/releases/screenshots-v5.3/`에 최종 Web ZIP의 1920×1080 타이틀·첫 10초·중간보스·도가 선택·최종보스·승천·재도전과 2560×1600 타이틀·전투를 보관합니다. 모두 실제 런타임 캡처이며 합성 목업이 아닙니다. 재도전 장면은 결과 상태를 통제 설정한 뒤 실제 UI 버튼을 눌러 얻은 최신 패키지 회귀 캡처이고, 나머지 전투·승천 장면은 자연 진행 런입니다.

## 7. 동일 빌드 3분 이하 제출 영상

`output/qa/v5.3-bannerfix-package-verify-20260810/web`을 실행한 `release-v5.3-bannerfix-3185791507-1920x1080-20260810-084524` 런에서 실제 WASD·Space·35번의 카드 클릭으로 07:00 승천했습니다. 피해 무효화·시간 점프·보스 강제 소환은 사용하지 않았고, 대승 33층·2,394처치·887,955 피해·영석 +366·심맥 3/3·최종 HP 244/244로 종료했습니다. 콘솔 error/warning과 page error는 모두 0입니다.

이 실행의 화면과 WebAudio를 동기화한 뒤 타이틀·첫 10초·초반 성장·중간보스·완성 도가·최종보스·승천만 6구간으로 편집했습니다.

| 항목 | 값 |
|---|---|
| 파일 | `output/releases/yeongheo-geomga-submission-video-v5.3-1080p-audio-166s-20260810.webm` |
| 길이 / 크기 | 166.468초 / 82,978,078 bytes |
| 영상 | VP8, 1920×1080, 25fps, yuv420p |
| 오디오 | Opus, 48kHz stereo, 192kbps |
| 음량 | integrated -15.1 LUFS / true peak -0.7 dBFS |
| SHA-256 | `83697d44cfd57dc317afa28968887db13c8e6b0f836d3de92f754b1c9bdd75d8` |
| 무결성 | 전체 decode error 0 / encoder timestamp warning 0 / 0.35초 이상 black interval 0 |

첫 편집 후보에서 오디오 타임스탬프 경고를 발견해 출시 폴더에서 제외했고, 샘플 시간축을 다시 생성한 무경고 파일만 위 경로에 남겼습니다. 원본 런 기록은 `output/playwright/v5.3-bannerfix-current-package-video/fullrun-record-report.json`입니다.

## 8. Release Review

로컬 제품 책임자의 답은 **“v5.3은 실제 플레이와 시각 검토가 가능한 로컬 출시 후보로 승인한다”**입니다. 시작, 성장, 세 번의 도가 선택, 피격과 회복, 중간·최종 보스, 정확한 7분 승천, 결과와 재도전이 하나의 게임 루프로 작동합니다.

공개·공식 제출 승인은 아직 **NO**입니다. 남은 항목은 다음 외부 게이트입니다.

1. runtime 이미지 72개의 기술 provenance는 72/72이지만 대표자의 법적 권리 증거 확인은 0/72입니다.
2. 공개 HTTPS URL에 v5.3을 배포하지 않았고 익명 새 세션의 동일 build hash도 확인하지 않았습니다.
3. 동일 빌드 제출 영상은 준비됐지만 마스터의 원본 크기 최종 시각 승인과 실제 청감 승인이 없습니다.
4. `openaigame2026.com` 계정 로그인·공식 제출은 수행하지 않았습니다.

따라서 v5.3을 **로컬 RC**라고 부를 수는 있지만, 위 네 항목이 닫히기 전에는 공개 제출 완료나 대회 우승 가능 빌드라고 선언하지 않습니다.
