# 영허검가 release-v4 로컬 릴리스 감사

> 기준일: 2026-08-10 KST
> release ID: `yeongheo-release-v4-20260810`
> build ID: `yeongheo-v4-b9690c3df668`
> 판정: **로컬 기술 RC PASS / 공개·권리·사람 승인 BLOCKED**

이 문서는 release-v4의 코드, production dist, 실제 브라우저 플레이, 배포 ZIP을 하나의 로컬 후보로 묶은 기록입니다. 테스트나 자동 완주만으로 Steam급 완성도·법적 권리·공개 제출 완료를 주장하지 않습니다.

## 1. 제품 범위

- production 진입점: PixiJS 2D `src/runtime2d/`
- 플레이어블: 설령 1명
- 출시 비경: 청람비경 1개
- 한 런: 420초
- showcase seed: `3185791507`
- 저장: 메타 진행·설정만 저장, active run은 저장하지 않음
- 로그인·외부 telemetry: 없음

잠긴 캐릭터와 적염/한천 비경 데이터는 확장용 source roster이며 release-v4 플레이 약속이 아닙니다. Jade 기본 경로에서 캐릭터·일반 적·중간 보스·최종 보스 외형 계약의 정적 P0/P1은 0건입니다.

## 2. 플레이어가 바로 보는 변화

- 타이틀→설령 선택→청람비경 선택→출정 확인을 옥·금장 선협 테마로 재구성하고, 초상·비경 썸네일·상태 배지·명확한 CTA를 연결했습니다.
- 화면 전체에 한 장을 늘여 놓던 지면 표현을 월드 고정 procedural base와 feathered authored crop decal 조합으로 바꿨습니다.
- 영웅·적·보스·소품의 실제 알파 하단을 프레임별로 분석해 발 pivot을 보정하고, 좁은 접촉 그림자와 접촉광을 적용했습니다.
- 기울어져 보이던 영웅 원형 marker를 지면 레이어로 내리고 회전·크기·투명도를 줄였습니다.
- 영웅·적·영기·공격의 명도와 silhouette 분리를 보강하고, 종별 tint와 contact profile을 적용했습니다.
- HUD와 돌파 선택 카드에 법보·공법·진화·도 종류, 이름, 단계, 효과, 실제 아이콘과 접근성 라벨을 연결했습니다.
- 1920×1080과 2560×1600에서 카메라·레이아웃·모달·결과 화면을 교차 확인했습니다.

## 3. 자동 게이트

| 게이트 | 결과 |
|---|---|
| `npm test` | 61 files / 685 tests PASS |
| `npm audit --json` | 취약점 0 |
| `npm run assets:audit` | source manifest 84 / 실제 84 / 오류 0 |
| `npm run build` | Vite 8.1.5, 765 modules, PASS |
| `npm run assets:build-audit` | runtime 40/40, missing 0, unexpected 0 |
| production dist | 72 files / 33,476,184 bytes |
| dist manifest SHA-256 | `b9690c3df6685167bc549875635e2647ad7548664698cf036ff1a7e1076dffc4` |
| 콘솔 | winning run error 0 / warning 0 / unhandled rejection 0 |

Vite의 약 506kB Game2D 청크 경고는 남지만, 로컬 7분 런의 draw/work 계측에서 프레임 안정성을 막는 오류는 관측되지 않았습니다.

## 4. 실제 브라우저 검증

사용자 Chrome 탭이나 로그인 세션을 조작하지 않았습니다. 격리된 Playwright Chromium 세션 하나만 열어 다음 순서로 검증한 뒤 닫았고, 종료 시 브라우저 세션과 4173 listener가 모두 0임을 확인했습니다.

1. 1920×1080: 타이틀, 캐릭터, 비경, 출정 확인, 초기 전투, 이동, 돌파 선택, 일시정지
2. 키보드 이동, 대각선 이동, 축지법, 카드 선택, 일시정지·재개
3. 2560×1600: 타이틀, 실제 전투, 보스 구간, 패배 결과, 최종 승천 결과
4. 1280×720 축소: 결과 버튼 노출과 overflow `[0,0]`
5. 결과→같은 비경 다시 도전: 새 seed와 시간·처치·HP 초기화 확인

일시정지 중 1.2초 동안 runTime은 정확히 정지했고, 재개 후 0.5초 동안 약 0.5초 진행했습니다. 이동은 원점에서 x/z ±2.18 이상 변화했고 축지법 무적 상태가 활성화됐습니다.

### 최종 2560×1600 승천 런

| 항목 | 값 |
|---|---:|
| run ID | `yeongheo-release-v4-20260810-showcase-3185791507-2560x1600` |
| 결과 | 420.000초 승천, 생존 |
| 레벨 / 처치 | 38 / 3,234 |
| 기혈 | 231.306 / 231.306 |
| 보스 처치 | 2 |
| 맹세 단계 / 진 | 3 / 5 |
| 진화 | 1 |
| 누적 피해 / 피격 피해 | 735,230 / 583.716 |
| final enemies / projectiles / pickups | 144 / 76 / 763 |
| draw calls | 11 |
| frame interval avg / p99 / max | 7.865 / 16.9 / 18.2 ms |
| frame work avg / p99 / max | 0.926 / 2.3 / 2.7 ms |
| simulation p99 / max | 0.7 / 0.8 ms |
| draw avg / p99 / max | 1.428 / 2.0 / 2.4 ms |
| JS heap used / limit | 26,848,249 / 4,395,630,592 bytes |
| audio voices started / dropped | 12,565 / 0 |

리소스 요청은 43개, 모두 `http://127.0.0.1:4173` origin이었고 non-200 0, zero-status 0이었습니다. viewport와 canvas는 모두 2560×1600, overflow는 `[0,0]`이었습니다.

## 5. 실패도 포함한 관측

- 한 무작위 상세 시작 런은 383.116초, 레벨 33, 2,910처치에서 최종 보스에게 패배했습니다. 이를 승리 증거로 사용하지 않았습니다.
- 첫 자동 경로 드라이버는 가장 가까운 적에게서 계속 멀어지는 정책 때문에 120m 밖으로 이탈해 244.85초에 사망했습니다. 실제 인간 이동과 다른 드라이버 결함으로 판단해, WASD 네 방향을 8초씩 순환하고 주기적으로 축지법을 쓰는 고정 cardinal driver로 다시 검증했습니다.
- 최종 cardinal run만 release-v4 승천 수치로 사용합니다. 서로 다른 실행의 수치나 캡처를 하나의 immutable run처럼 섞지 않습니다.

## 6. 패키지와 재추출

권리 게이트가 `BLOCKED`이므로 패키저 기본 실행은 실패하도록 했습니다. 아래 파일은 `-AllowUnclearedRights`를 명시한 로컬 검토용이며 공개·제출용 승인본이 아닙니다.

| 산출물 | bytes | SHA-256 |
|---|---:|---|
| `yeongheo-geomga-web-release-v4-20260810.zip` | 32,362,805 | `b7f3388b214c25291a4d267cfdd80813089e910b78398cb6f29702e4df6a5d34` |
| `yeongheo-geomga-windows-portable-v4-20260810.zip` | 32,382,352 | `19a6e878552a0a6b267f243dc2e4f8adbf63cdc42bd048842c21b3165d1a0fe1` |

- Web ZIP 72개 entry와 source dist의 이름·SHA가 72/72 일치
- Windows ZIP 81개 entry, 필수 launcher·고지·dist 누락 0
- 역슬래시·상위 경로·source map·비결정 timestamp 0
- 별도 폴더 재추출 후 Web/Windows dist 각각 72/72 SHA 일치
- 재추출한 `게임시작.bat`을 Node/npm 없는 테스트 모드로 실행: HTTP ready, exit 0, 잔류 프로세스·포트 0
- 재추출한 Web root를 임의 포트로 직접 서빙: HTTP 200, release ID v4, rights `BLOCKED`, deployment `not-deployed` 확인

## 7. 제출 자료 경계

- 대표 썸네일 후보: `output/releases/yeongheo-geomga-thumbnail-v4-1672x941.png`, 1672×941, 2,276,786 bytes, SHA-256 `8527f0fec51f289984a3d40c6bbde602fab4977527e86a650b81111b8911764c`
- 승천 결과 캡처: `output/releases/screenshots-v4/16-result-victory-2560x1600.png`, SHA-256 `b3052ea5f033f06bba2e91c19a748252ba6ef83b519aa596c650227df8532416`
- 기존 169.62초 영상은 release-v3 화면입니다. 포맷·오디오 decode는 통과했지만 최신 v4 UI를 보여 주는 영상으로 과장하지 않으며, 사람의 시청·청감과 권리 승인 전에는 제출하지 않습니다.

## 8. 냉정한 최종 판정

실행, 핵심 전투 루프, 7분 승천, 카메라·접지·가시성, title→result UI 흐름, 2560×1600, 콘솔, 성능, 배치 실행, ZIP 무결성은 **로컬 기술 RC PASS**입니다.

그러나 다음 네 항목이 남아 있어 공개 release 또는 대회 제출을 승인하지 않습니다.

1. runtime 자산 권리 증빙 0/40 — `BLOCKED`
2. 동일 v4의 공개 HTTPS URL — 미배포
3. 마스터의 원본 크기 시각·오디오·재미 승인 — 대기
4. 공식 Google 계정·개인정보·약관 동의와 최종 제출 — 미수행

따라서 현재 결과는 “조악한 프로토타입” 단계에서는 벗어난 로컬 release candidate이지만, 권리·배포·사람 승인까지 끝난 상용 출시 완료본은 아닙니다.
