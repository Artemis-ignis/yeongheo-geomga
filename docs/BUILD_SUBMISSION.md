# 영허검가 제출 빌드 정책

> 최신 기준: 2026-08-10 KST / release-v5.3 지면·접지·밸런스 리빌드
> 최신 권위 감사: [RELEASE_V5_3_AUDIT_2026-08-10.md](competition/RELEASE_V5_3_AUDIT_2026-08-10.md)
> 아래 v5.2 수치표는 역사 기록이며, 현재 패키지·해시는 v5.3 감사와 `output/qa/v5.3-final-seal-20260810.json`을 우선합니다.

`public/`은 원본·authoring·QA 자료를 보존합니다. `npm run build`가 생성하는 `dist/`에서만 `tools/submission-assets.mjs`의 runtime allowlist를 적용하여 제작 중간물과 미사용 자산을 제거합니다.

## 재현 명령

```powershell
npm ci
npm test
npm run assets:audit
npm run build
npm run assets:build-audit
```

빌드 게이트는 다음을 검증합니다.

- source manifest 116개와 실제 `public/assets` 116개 일치
- runtime 필수 자산 72개가 `public/assets`와 `dist/assets`에 존재
- `dist/assets`에 allowlist 밖의 정적 이미지·모델·오디오가 없음
- `public`과 `dist`의 플레이 가이드·개인정보·NOTICE·AI 고지·release metadata SHA parity
- 정리 대상은 `dist` 내부뿐이며 `public/` 원본은 삭제하지 않음

## release-v5.2 측정치

| 산출물 | 파일 수 | 바이트 | MiB |
|---|---:|---:|---:|
| `public/assets` source | 116 | 99,222,696 | 94.63 |
| 제출 런타임 정적 자산 | 72 | 38,101,194 | 36.34 |
| production `dist` 전체 | 104 | 39,227,897 | 37.41 |

최종 판정은 `sourceMissing=0`, `outputMissing=0`, `unexpected=0`입니다. dist는 104 files / 39,227,897 bytes, manifest SHA-256은 `295fcd5b65572e92db35b0066a4f0aba8495283cd516cf809b56fddb5a5f89b5`입니다. 실행 청크 `Game2D-BxmAcfZT.js`는 512,894 bytes, SHA-256 `0c2d1293f30cc94122d22b0e5650e6d808087a20ecc62dbc3a08b946c4682ddf`입니다.

## allowlist 범위

runtime 72개는 다음으로 구성됩니다.

- 환경·키아트·캐릭터 reference 5개
- 전용 법보·공법·도가 UI 아이콘 v1 16개와 의미 분리 v2 32개
- 청람·적염·한천 비경 썸네일 3개
- 지면 재질 2개
- 설령 방향 아틀라스와 적·보스·소품 아틀라스 14개

`sprites2d/source/**`, legacy PNG, 3D GLB, PBR/reference 제작 자료는 source에는 남지만 제출 `dist`에는 포함하지 않습니다. 출시 플레이 범위는 설령·청람비경이며, allowlist에 확장용 썸네일이 존재한다고 해서 해당 비경을 v5.2 플레이 가능 콘텐츠로 선언하지 않습니다.

## release-v5.2 로컬 검토 산출물

| 산출물 | files | bytes | SHA-256 |
|---|---:|---:|---|
| `output/releases/yeongheo-geomga-web-release-v5.2-20260810.zip` | 104 | 38,113,389 | `9b59b02dd2caf4533f6c7f1ff9ae444159a6ae76dd338a9fb934870cd1ad00f6` |
| `output/releases/yeongheo-geomga-windows-portable-v5.2-20260810.zip` | 113 | 38,135,379 | `605b141dfc6f9a499e3a4e06267dfe9f32054e6b094b134eb42672a60a9bb3a0` |

두 ZIP은 같은 dist에서 만들어졌고, 별도 폴더에 재추출한 뒤 이름·SHA를 대조했습니다. Web은 104/104, Windows 내부 dist도 104/104가 source dist와 일치합니다. Windows ZIP의 `게임시작.bat`은 재추출 위치에서 Node/npm 없이 브라우저 비활성 테스트 모드로 HTTP ready와 exit 0을 통과했습니다.

`output/releases/SHA256SUMS-v5.2-20260810.txt`에 최신 배포 후보, v5.2 스크린샷, 썸네일과 동등 1080p 영상의 해시 9개를 고정했습니다. checksum manifest 자체 SHA-256은 `6fba92f41d124ce02d2407d4a4b9b48c9ccef365c005010c26ef7149e1982068`입니다. 기존 v5/v5.1 checksum은 역사 기록으로 보존합니다.

## 권리 guard와 로컬 검토 override

`public/AI_ASSET_DISCLOSURE_KO.txt`가 권리 `BLOCKED`를 선언하면 패키저는 기본적으로 실패합니다.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\package-release.ps1
```

권리 확인 전 로컬 QA 패키지가 꼭 필요할 때만 명시적으로 override합니다.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\package-release.ps1 -AllowUnclearedRights
```

override 산출물은 `local-review-candidate-only`이며 공개, 업로드, 제출 허가가 아닙니다.

## current-chunk 제출 영상

`output/releases/yeongheo-geomga-submission-video-v5-1080p-audio-176s-20260810.webm`은 실제 420초 승천 플레이에서만 잘라 만든 1920×1080, 176.01초, VP8 25fps + stereo Opus 48kHz 파일입니다. 크기는 72,538,926 bytes, SHA-256은 `a255a1b945d445b92dd1a1ee6e77ab16a7220bf2985dde555986f89ebc678651`입니다. 평균/최대 음량은 -19.0/-0.5 dB이며 첫 성장, 초반 전투, 중간보스, 후반 성장, 최종보스, 승천 결과를 포함합니다.

v5.2에서 바뀐 고해상도 배율은 1080p에서 작동하지 않으므로 이 영상의 화면·게임플레이 로직은 v5.2와 동등합니다. v5.2 ZIP 자체의 별도 420초 완주는 `release-v5.2-victory-3185791507-1920x1080-20260810`으로 고정했습니다.

사람의 최종 시청·청감, 자산 권리, 공개 영상 URL과 공식 업로드는 여전히 승인 전입니다.

## 역사적 release-v3 영상

`output/releases/yeongheo-geomga-submission-video-v3-1080p-audio-170s-20260810.webm`은 1920×1080, 169.62초, VP9 + stereo Opus 48kHz, 153,607,683 bytes이며 SHA-256은 `576a038fecbe214f02b9b1d260e5388c1c61d1580f77d5f1d6f06d3223b76e37`입니다.

이 영상은 release-v3 화면이므로 최신 v5 UI를 보여 주는 파일로 표기하거나 current-chunk 증거와 섞지 않습니다.

## 남은 게이트

기술 빌드 PASS는 권리 승인이나 공개 제출을 뜻하지 않습니다. `docs/competition/RIGHTS_CONFIRMATION_KO.md`의 자산별 법적 증거가 72/72로 닫히고, 동일 v5.2 build를 공개 URL의 익명 새 세션에서 확인하기 전까지 권리·배포 게이트는 차단 상태입니다.
