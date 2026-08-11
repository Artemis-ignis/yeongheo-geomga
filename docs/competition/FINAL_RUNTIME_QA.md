# 최종 로컬 런타임 QA — 천겁의 맹세

> **역사적 후보 기록:** 아래 run/build는 최신 후보가 아닙니다. 최신 권위 로컬 후보는 [RELEASE_V5_AUDIT_2026-08-10.md](./RELEASE_V5_AUDIT_2026-08-10.md)의 release-v5 실행과 Web/Windows ZIP입니다. 아래 수치와 해시는 과거 증거 보존용으로만 사용합니다.

> 기록일: 2026-08-09 KST
> 상태: 로컬 production build 런타임 PASS / 공개 배포·권리·사람의 최종 제출 승인 미완료

## 불변 식별자

```text
build_id: d8b67ef7c5978e2f7bf9e953ec455a9f91f0b5a03ad058e7dc256d2a37d6264e
build_id_method: 최종 권위 게임 entry dist/assets/Game2D-JWWUvW74.js의 SHA-256
dist_manifest_id: 2c2666a6e3be5935e15aef2bc078adcbf7058deba2783f15bb5e59d211e1154e
dist_manifest_id_method: dist 전체 파일의 상대 경로와 SHA-256을 정렬한 manifest hash
dist_index_sha256: 11bf46c519017e250ef5314668c89d1fc5bf6a87e0b1405b0eba50e1dce68bff
run_id: final-locked-2026-08-08T22-15-03-925Z
started_at_kst: 2026-08-09T07:15:03.925+09:00
completed_at_kst: 2026-08-09T07:22:00+09:00 이전
local_preview_url: http://127.0.0.1:4179/
deployment_url: 미고정
codex_record_id: 019fe2bc-1ddb-7390-910b-8a41a70aa5f0
```

`local_preview_url`은 `npm run build`로 생성한 `dist/`를 Vite preview로 제공한
로컬 검증 주소입니다. 공개 배포 URL 또는 제출 완료 증거가 아닙니다.

## 빌드·자동 검증

| 검사 | 결과 |
|---|---|
| `npm test` | PASS — 56 files, 639 tests |
| `npm run assets:audit` | PASS — 65/65, errors 0 |
| `npm run build` | PASS — Vite 8.1.5, 765 modules transformed |
| `npm run assets:build-audit` | PASS — runtime assets 21, missing 0, unexpected 0 |
| `git diff --check` | PASS — whitespace error 0; 줄바꿈 경고만 존재 |
| `dist/` | 48 files, 26,644,211 bytes |

## 실제 브라우저 단일 런

Windows Chrome의 최종 `dist/` 프리뷰에서 제목 화면의 `천겁에 들기` 버튼으로
시작해 다음 순서를 한 번의 런으로 확인했습니다.

| 시각 | 확인한 상태 |
|---:|---|
| 시작 | 제목 → 실제 전투 진입 |
| 20초 이후 | 검맥 맹세 선택, `sword-fan` 전투 효과 |
| 125초 | POI·진·HUD·검격·적 투사체가 함께 표시; 검맥 1/3 배지 겹침 없음 |
| 165초 이후 | `회귀검선` 심화 선택, 반환 검선과 두 번째 mirror phase 추가 |
| 180초 | 중간보스 `요왕 창랑` 6,000 HP 실제 출현·교전 |
| 270초 이후 | `검환` 완성, 검맥 3/3 및 세 번째 mirror phase 추가 |
| 330초 | 최종 보스 `옥허진장` 28,000 HP 출현; 선택한 검맥 패턴 사용 |
| 353초 | 최종 보스 처치, `승천` 결과 화면 진입 |

최종 결과는 생존 05:53, 도달 경지 대승 37층, 처치 3,151,
가한 피해 582,877, 획득 영석 +262, seed 3185791507,
보스 처치 2, 검맥·회귀검선·검환 완성으로 기록됐습니다. Chrome의
`Log.entryAdded`와 `Runtime.exceptionThrown` 이벤트는 0건이었습니다.
결과 화면의 `같은 비경 다시 도전` 버튼을 실제 클릭한 뒤 연기 1층·00:01·
처치 0·영석 0의 새 전투로 복귀하는 것도 같은 브라우저 세션에서 확인했습니다.

## 성능

전면 활성 탭에서 텔레메트리를 초기화한 뒤 600-frame rolling window를 반복
채취했습니다. 백그라운드 탭의 Chrome throttle 샘플은 폐기했습니다.

| 구간 | 부하 | interval p95 | interval p99 | long task |
|---|---|---:|---:|---:|
| 57초 | 적 29, 투사체 39, 픽업 105 | 8.1ms | 8.1ms | 0 |
| 116.77초 | 적 48, 투사체 32, 픽업 263 | 8.1ms | 8.2ms | 0 |
| 172.18초 | 적 73, 투사체 38 | 8.1ms | 8.2ms | 0 |

렌더러는 PixiJS WebGL2, GPU는 NVIDIA GeForce RTX 5070 Laptop GPU의
ANGLE/D3D11 경로였습니다. 위 채취 구간의 draw p99는 최대 1.4ms였습니다.

## 다중 해상도 독립 시각 감사

최종 entry `Game2D-JWWUvW74.js`를 별도 브라우저 세션에서 교차 검토했습니다.
1920×1080과 2560×1440 모두 지형 경계선, HUD 겹침, 영웅 가독성,
콘솔 warning/error 0건으로 PASS 판정을 받았습니다.

- `output/playwright/jwwuv-w74-cross-1920-1786227305289-combat.png`
- `output/playwright/jwwuv-w74-cross-2560-1786227325900-combat.png`

이 감사에서 이전 직선 지평선 결함의 원인이었던 `mapDecalLayer`의 hard mask를
alpha blend mask로 교체한 최종 화면을 확인했습니다. 자동·독립 시각 감사 PASS는
마스터의 미학적 최종 수락 또는 스프라이트 권리 승인을 대신하지 않습니다.

## QA 조작과 증거 경계

이 단일 런은 화면 흐름·보스 스케줄·결과 전환·성능을 끝까지 관찰하기 위해
페이지 메모리에만 다음 임시 QA 조작을 적용했습니다.

- 플레이어 피해 함수를 무효화해 장시간 관찰 중 사망을 방지했습니다.
- `levelUp`과 `daoVow` 모달에서는 첫 번째 카드를 자동 선택했습니다.
- WASD 입력을 자동 전송해 이동을 관찰했고, 보스와 멀어졌을 때 실제 좌표를
  확인한 뒤 교전 방향으로 복귀시켰습니다.

이 조작은 소스와 `dist/`를 변경하지 않았고 결과 캡처 후 제거했습니다. 따라서
이 런은 무피해 업적, 일반 사용자 밸런스 또는 사람 조작 숙련도의 증거가 아닙니다.
별도 비조작 밸런스 시뮬레이션에서는 seed 1/17/123/999가 180초까지 생존했고
XP·영석 원장 오차가 0임을 자동 테스트로 확인했습니다.

오디오는 사용자의 저장된 음소거 설정이 `true`여서 이 런에서 청감 승인하지
않았습니다. 음성 수 제한 32와 이벤트 계약은 자동 테스트로 확인했지만 실제
믹스의 사람 청감 승인은 별도 게이트입니다.

## 현재 판정

- 로컬 production build·전체 실제 흐름·브라우저 성능·콘솔 안정성: **PASS**
- 다중 해상도 독립 시각 감사(1920×1080, 2560×1440): **PASS**
- 스프라이트 사람 시각 승인과 실제 오디오 믹스: **미승인**
- 당시 40개 runtime asset 법적 권리 확인: **0/40, 차단** (현재 release-v5는 0/72이며 최신 감사 문서를 우선)
- 공개 HTTPS URL의 동일 build 배포: **미완료**
- 사용자 대표자 정보·약관 동의·최종 제출 클릭: **사용자 승인 전 금지**

따라서 이 문서는 로컬 제품 후보의 실재성을 증명하지만 `productionReady: true`,
공개 출시 또는 대회 제출 완료를 선언하지 않습니다.
