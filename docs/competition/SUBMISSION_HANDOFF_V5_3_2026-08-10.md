# 영허검가 release v5.3 제출 인계서

> 기준: 2026-08-10 KST
> release ID: `yeongheo-release-v5.3-20260810`
> 로컬 기술 RC: **YES**
> 공개·공식 제출: **NO — 외부 게이트 차단**

이 문서는 v5.3 로컬 후보와 실제 제출 직전 사람 확인 항목을 분리합니다. 공식 신청서 로그인·동의·제출 버튼은 실행하지 않았고, 공개 URL·권리 승인·사람의 원본 시청각 승인을 완료했다고 주장하지 않습니다.

## 현재 고정 산출물

| 항목 | 경로 | bytes | SHA-256 |
|---|---|---:|---|
| Web ZIP | `output/releases/yeongheo-geomga-web-release-v5.3-20260810.zip` | 38,114,148 | `df12aaae11241a0a7fb48515b1cc40cbc972a3377b57a6481b1196dc1ca08c80` |
| Windows portable ZIP | `output/releases/yeongheo-geomga-windows-portable-v5.3-20260810.zip` | 38,136,138 | `b8fefe0fbcb6e009651f1f3a1cb2c214e274cd341bbe330bee5d12143ac89546` |
| 3분 이하 실제 플레이 영상 | `output/releases/yeongheo-geomga-submission-video-v5.3-1080p-audio-166s-20260810.webm` | 82,978,078 | `83697d44cfd57dc317afa28968887db13c8e6b0f836d3de92f754b1c9bdd75d8` |
| 썸네일 | `output/releases/yeongheo-geomga-thumbnail-v5.3-1920x1080.png` | 2,341,071 | `cae7d30361db3db5a3a4086a500b88d70355d3f88631fe13deb6c0e4404d4545` |
| 스크린샷 묶음 | `output/releases/screenshots-v5.3/` | 9 files | `SHA256SUMS-v5.3-20260810.txt` 참조 |
| checksum manifest | `output/releases/SHA256SUMS-v5.3-20260810.txt` | 1,446 | `c75027102fde1c1b86c820a2854d91c344c7d3734fa4f68ee7b56ca78d989c96` |

정확 패키지 런과 성능 값은 [release v5.3 감사](./RELEASE_V5_3_AUDIT_2026-08-10.md)와 `output/qa/v5.3-final-seal-20260810.json`을 우선합니다.

## 제출 필드 상태

| 필드 | 현재 값 | 상태 |
|---|---|---|
| 게임명 | 영허검가 | 준비됨 |
| 한 줄 소개 | 네가 고른 도가, 네가 맞설 천겁을 만든다 | 준비됨 |
| 장르 | 미소녀 선협 2.5D survivor-like | 준비됨 |
| 플레이 URL | `TO_BE_FILLED` | **BLOCKED — v5.3 미배포** |
| 저장소/협업 증거 URL | `TO_BE_FILLED` | 사람 확인 필요 |
| 썸네일 | v5.3 1920×1080 PNG | 파일 준비 / 권리·시각 승인 차단 |
| 스크린샷 | v5.3 9장 | 파일 준비 / 권리·시각 승인 차단 |
| 3분 이하 영상 | v5.3 실제 승천 166.468초 / AV·decode 검수 완료 | 파일 준비 / 사람 시청각 승인 대기 |
| 에셋 권리 | 기술 provenance 72/72 | **BLOCKED — 법적 증거 0/72** |
| 개인정보/동의 | 로그인·외부 telemetry 없음 | 공식 신청서 사람 확인 필요 |
| 공식 제출 | 미수행 | **BLOCKED** |

## 로컬 검증 요약

- 65 files / 709 tests PASS
- Vite 8.1.5 / 765 modules / production build PASS
- source assets 116/116, runtime assets 72/72, 누락·예상 밖 파일 0
- production dependency vulnerability 0
- 새 Web ZIP 추출본에서 실제 WASD·Space·카드 클릭으로 07:00 승천
- 레벨 33, 2,394처치, 887,955 피해, 영석 +366, 보스 2체, 심맥 3/3, 최종 HP 244/244
- 최신 패키지 결과 UI→재도전 회귀, 동일 실행 청크의 별도 실제 런 일시정지→재개, 최신 420초 런 콘솔 error/warning/page error 0
- 영상 캡처 런은 SwiftShader+동시 인코딩이라 성능 판정에서 제외
- 2560×1600 viewport/canvas 일치, overflow 0, p99 8.7ms, long task 0
- Windows portable `게임시작.bat` 추출본 smoke exit 0, 잔류 포트 0
- 동일 Web ZIP의 실제 입력 런으로 만든 166.468초 제출 영상, 콘솔·페이지·decode·인코더 타임스탬프 오류 0

## 공식 제출 전 순서

1. `docs/competition/RIGHTS_CONFIRMATION_KO.md`에서 runtime 72개 자산의 법적 근거를 대표자가 확인합니다.
2. v5.3 Web ZIP을 공개 HTTPS에 배포하고, 익명 새 세션에서 release ID·chunk SHA·시작·플레이를 확인합니다.
3. 마스터가 1920×1080·2560×1600 원본 스크린샷과 166.468초 영상의 화면·청감을 승인합니다.
4. 실제 신청 화면에서 URL·파일 규격·필수 동의·마감 시각을 다시 확인합니다.
5. 마스터 승인 후에만 공식 계정으로 업로드·제출합니다.

## 금지되는 과장

- 로컬 RC를 공개 배포 완료라고 쓰지 않습니다.
- 기술 provenance 72/72를 법적 권리 승인 72/72로 쓰지 않습니다.
- 역사적 v5 영상을 현재 v5.3 제출 영상과 혼동하지 않습니다.
- 자동·headless PASS를 마스터의 원본 시각·청감 승인이라고 쓰지 않습니다.
- 실제 제출 버튼을 누르기 전 `submitted`, `winner-ready`, `완료`라고 선언하지 않습니다.
