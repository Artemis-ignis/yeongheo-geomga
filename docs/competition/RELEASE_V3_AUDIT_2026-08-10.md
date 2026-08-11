# 영허검가 release-v3 최종 런타임 감사

> 실행일: 2026-08-09~10 KST
> 대상: production PixiJS 2D build / 1920×1080 및 2560×1600
> 기술 판정: **RELEASE CANDIDATE PASS**
> 제출 판정: **BLOCKED — 권리 확인 및 공개 URL 필요**

## 실제 플레이 결과

격리된 Chromium에서 타이틀 → 수사 선택 → 비경 선택 → 출정 확인 → 420초 전투 → 도가 3단계 → 중간·최종 보스 → 승천 결과까지 실제 런을 완료했습니다.

| 항목 | 결과 |
|---|---:|
| 생존 시간 | 420초 / 승리 |
| 레벨 | 35 |
| 처치 | 3,035 |
| 가한 피해 | 865,493 |
| 최종 체력 | 231.306 / 231.306 |
| 보스 처치 | 2 |
| 진화 | 1 |
| 도가 이정표 | 3 |
| 진형 | 5 |
| seed | 3185791507 |

오토플레이 첫 시도는 208.166초에 패배했습니다. 방어 성장·보스 거리 유지·투사체 회피 우선순위를 조정한 뒤 동일한 420초 릴리스 루프를 승리로 재검증했습니다. 패배 결과를 성공으로 숨기지 않았습니다.

## 성능·안정성

- draw calls: 10
- 후반 관찰 개체: enemies 130, projectiles 38, pickups 438
- rolling work p99 3.4ms, simulation p99 0.7ms, draw p99 3.5ms
- long task: 0
- audio cues: started 4,539 / ended 4,539 / dropped 0 / preempted 0
- 게임 런타임 console exception: 0
- 1920×1080·2560×1600 document overflow: 0

빌드 시 Game2D 청크 500kB 초과 경고가 1건 있으나 런타임 실패나 프레임 저하로 이어지지 않았습니다. 출시 후 코드 분할 최적화 후보로 유지합니다.

## 시각·UX 감사

- 단일 반복 지면을 절차적 macro base와 월드 고정 authored crop으로 교체
- 영웅·적·보스·소품을 프레임별 실제 알파 하단 기준으로 접지
- 좁은 contact shadow·contact light·수평 고정 hero marker 적용
- 수사/비경/확인 화면, HUD, 성장/도가 카드, 결과 화면을 옥·금장 테마로 통합
- 전용 스킬 아이콘 16개와 비경 썸네일 3개를 실제 DOM에 연결
- 2560×1600과 1920×1080에서 타이틀·게임·모달·결과 화면 원본 크기 검사

주요 증거는 `output/playwright/visual-qa-*.png`, `release-v2-video-t*.png`, `release-v3-check-t*.png`입니다. release-v3 제출 영상은 접합부 전후 10개 프레임을 원본 크기로 확인했고 검은 프레임·깨진 HUD·정지 화면이 없었습니다.

## 최종 자동 게이트

| 게이트 | 결과 |
|---|---|
| Vitest | 60 files / 678 tests PASS |
| source asset audit | 84 / 84 PASS |
| production build | PASS |
| submission build audit | runtime 40 / missing 0 / unexpected 0 |
| launcher | `게임시작.bat`, exit 0, current release chunk 응답 |
| Web ZIP | 67 files / runtime static 40 / icons 16 / stages 3 |

## 고정 산출물

| 산출물 | 크기 | SHA-256 |
|---|---:|---|
| `output/releases/yeongheo-geomga-web-release-v3-20260810.zip` | 32,353,764 | `2e40270db5baa9882456e26967c1a5045ca621557cac6d514caae2d585da68d5` |
| `output/releases/yeongheo-geomga-submission-video-v3-1080p-audio-170s-20260810.webm` | 153,607,683 | `576a038fecbe214f02b9b1d260e5388c1c61d1580f77d5f1d6f06d3223b76e37` |

영상 메타데이터는 1920×1080, 169.62초, VP9 video, stereo Opus 48kHz입니다. 오디오 decode 결과 peak 0.8758, RMS 0.1056으로 정상 비무음입니다.

## Release Review

코드·플레이·시각·성능·패키지 기준으로는 사람에게 보여줄 수 있는 release candidate입니다. 그러나 대표자 권리 확인 0/40과 공개 배포 URL이 남아 있으므로 실제 대회 제출 승인에는 **NO**입니다. `RIGHTS_CONFIRMATION_KO.md`를 증거와 함께 닫고 동일 ZIP의 공개 URL을 검증한 뒤에만 최종 YES로 전환합니다.
