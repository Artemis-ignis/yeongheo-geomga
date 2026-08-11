# 영허검가 2560×1600 release-candidate 감사

> **역사적 후보:** 이 문서의 무음 영상·48-file ZIP·0/21 권리 수치는 2026-08-09 snapshot입니다. 최신 release-v5 실행·Web/Windows ZIP과 0/72 권리 게이트는 [RELEASE_V5_AUDIT_2026-08-10.md](./RELEASE_V5_AUDIT_2026-08-10.md)를 우선합니다.

> 감사일: 2026-08-09 (Asia/Seoul)
> 판정 범위: 로컬 production build의 실행·실플레이·화면·성능·회귀
> 로컬 gameplay verdict: **PASS**
> 공개 제출 verdict: **BLOCKED** — 권리, 공개 URL, 실제 오디오 청감, 대표자 제출 확인이 남아 있음

이 문서는 과거 후보 런의 증거를 덮어쓰지 않는다. 아래 해시와 결과는 마지막 결과 화면
레이아웃 수정까지 포함한 `Game2D-sdl-jNO3.js` production 후보에만 해당한다.

## 1. 빌드 식별

| 항목 | 값 |
|---|---|
| build time | `2026-08-09T20:43:26+09:00` |
| runtime entry | `dist/assets/Game2D-sdl-jNO3.js` |
| runtime entry SHA-256 | `15f87dc3b9125303e30c3dd34a1c2a30ffc530bd13a2369db639d5291848a2be` |
| CSS entry | `dist/assets/index-CoNHvamB.css` |
| CSS entry SHA-256 | `7e7639273e33f7d2d012ddc465773b45d855ef7cabc3c157800a5fc6ea685249` |
| `dist/index.html` SHA-256 | `ebea8cef72a34a7fad88f4b162b53129dc5db4b1e3220c445e0cd9dff8450d68` |
| dist | 48 files / 26,662,872 bytes |

## 2. 실제 플레이 조건

- 전체 런은 격리된 Chromium 세션 `release-final-1920`, 최종 2560 화면 교차 검증은
  신규 격리 세션 `root-final-2560`; 사용자의 Chrome 탭·세션은 사용하지 않음.
- 전체 런 viewport `1920×1080`; 동일 최종 build의 노트북 기준 viewport `2560×1600`에서
  제목→실제 이동→축지법→맹세→성장 선택→00:28 전투를 다시 확인.
- 로컬 production preview `http://127.0.0.1:4173/`.
- 첫 화면의 `천겁에 들기`로 showcase seed `3185791507` 시작.
- 내부 시간 점프, 무적화, boss 강제 소환, HP 변경 없음.
- WASD를 8초 간격의 평범한 사각 경로로 유지하고 Space 대시를 약 1.7초마다 시도.
- 화면에 실제로 열린 성장·맹세 카드만 34회 선택. 체력 선택지가 있으면 저체력 회복을 우선하고, 아니면 도가·진화를 우선 선택.
- 입력은 결과가 날 때까지 한 Playwright command 안에서 연속 유지. 상태 보고 사이 무입력 공백 없음.
- 신규 저장 상태에서 오디오는 기본 활성화. WebAudio context `running`, 음악·효과음 동작과 voice lifecycle을 진단했으나 자동화는 사람의 청감 승인을 대체하지 않음.

## 3. 최종 실플레이 결과

| 항목 | 결과 |
|---|---|
| state | `result` |
| victory | `true` |
| survival time | 정확히 `420s` (`07:00`) |
| level | 32 |
| HP | `132.25 / 132.25` |
| kills | 3,425 |
| damage | 852,907 |
| earned spirit stones | 334 |
| Dao | 검맥 3/3 — 관통검선, 검환 완성 |
| bosses | 2 kills |
| final boss spawn | `330s` (`05:30`) |
| final boss phase gates | encounter elapsed `25/55/85s`, 즉 run `05:55/06:25/06:55` 부근 |
| final result | final boss 처치 뒤 보호된 승리 연출을 거쳐 `07:00` 승천 |

최종 보스는 이전 후보에서 약 34초 만에 끝나 420초 계약을 깨뜨렸다. 이번 후보는
실제 330초 encounter에만 25/55/85초 phase floor를 적용했다. 녹화본을 별도 격리
브라우저에서 직접 seek해 05:54에 약 67%, 06:24에 약 34%, 06:53에 약 1% 체력과
각 구간의 전투를 시각 확인했다. 보스를 쓰러뜨리면 남은 짧은 구간은 무적이 보장된
승리 연출로 유지되고 정확히 07:00에 결과 화면으로 전환된다. 보스를 처치하지 못한
경우만 420초 타임아웃 패배다.

## 4. 같은 런의 증거

| 증거 | 파일 | SHA-256 |
|---|---|---|
| 1920×1080 실제 420초 전체 런 영상 | `output/playwright/yeongheo-1920x1080-final-420s-20260809.webm` (172,249,914 bytes) | `ea5f8b4ec2df1d1690cf2e88f4a2ecf6128ba3ea4c05ea656fe2d862fe9a3923` |
| 1920×1080 최종 승천 화면 | `.playwright-cli/page-2026-08-09T11-55-37-734Z.png` (1,884,888 bytes) | `f6adecbf9a9c8452c4198ac1de4e0097c1c894977726d382ecf4c13f43ea43c5` |
| 2560×1600 동일 최종 build 00:28 실제 전투 | `.playwright-cli/page-2026-08-09T12-20-22-751Z.png` (5,965,046 bytes) | `587c77988393b1bac1c6bb4293d030aec598b3dde7cefc590d85e28ee973c220` |
| 1080p 제출용 기술 편집본 | `output/releases/yeongheo-geomga-submission-cut-1080p-silent-170s-final-20260809.webm` (125,077,099 bytes; 170.211초; 무음) | `fe26fbd4c0ce2de0cf18b0f251c453fe77156e742bfac97860ffd55b58454452` |
| 이식 가능한 최종 web ZIP | `output/releases/yeongheo-geomga-web-final-portable-20260809.zip` (25,609,425 bytes; 48 entries) | `d945df3b39b3b7a66187ba5e371857cb708d4b98d08079e557f218615abc85c2` |

결과 화면에서 승천, 07:00, 대승 32층, 3,425 처치, 852,907 피해,
검맥 3단계, 재도전·문파 복귀 CTA가 겹침 없이 보인다.

마스터의 2560×1600 해상도 지적 뒤 마지막 CSS까지 포함한 production 후보를 별도 신규
세션으로 다시 열었다. CSS viewport와 PNG가 정확히 2560×1600임을 확인하고, 제목의
`천겁에 들기`부터 WASD 이동, Space 축지법, 설맥 선택, 성장 카드 선택, 00:28 전투까지
실제 입력했다. 콘솔 warning/error는 0/0이었다. 넓은 화면에서도 월드 FOV, HUD 안전
여백, 주인공 aura·marker, 투사체와 지면 디테일이 유지됐고 사각 지면 경계는 보이지 않았다.

## 5. 이번 실제 플레이가 찾아 고친 문제

1. 2560×1600에서 카메라가 과도하게 가까웠던 투영을 동일 world FOV로 수정했다.
2. 큰 사각형으로 반복되던 지면 사진 chunk를 하나의 world-panning jade floor material로 바꿔 경계를 제거했다.
3. 4분대 군중 속 주인공이 묻히던 문제를 hero aura·marker 강화로 완화했다.
4. 290초 18마리 옥사 협공진이 화면을 닫고 즉사시키던 문제를 12마리·더 넓은 전개로 조정했다.
5. 연속 접촉 피해의 판독 시간을 0.68초로 늘리고 돌파 회복을 최대 HP의 7.5%로 조정했다.
6. 6,000 HP라 약 4초에 사라지던 중간 보스를 12,000 HP로 조정했다. 별도 실제 런에서는 3:15에도 8,444/12,000으로 살아 전조가 노출됐다.
7. 14,000 HP 최종 보스가 완성 빌드에 3.7초 만에 사라지던 문제를 encounter 전용 3-phase floor로 해결했다.
8. result 진입 시 성장 modal 잔존, held-key 자동 재시작, retry 뒤 boss HUD 잔존을 각각 종료·입력 quarantine·HUD reset으로 회귀 방지했다.
9. 피해 숫자 프레임 예산을 6개, 풀을 12개로 제한하고 주인공과 겹친 적 실루엣을 부분 투명화해 고밀도 가독성을 개선했다.
10. 신규 플레이가 기본 음소거였던 문제를 수정하고 메인 조작 안내에 `M 소리`를 추가했다. 저장된 명시적 음소거 선택은 유지한다.
11. 최종 보스 조기 처치로 06:04에 끝나던 런을 3단계 90초 encounter와 07:00 결과 계약으로 수정했다.
12. 1920×1080 전체 런에서 승천 제목과 하단 CTA가 잘리는 문제를 찾아 결과 업적을 2열로
    재배치하고 낮은 높이 화면용 compact 규칙을 추가했다. 1920×1080과 1280×720에서
    결과 banner와 CTA가 모두 viewport 안에 있는 것을 DOM bounds와 원본 화면으로 확인했다.

## 6. 자동 회귀·자산·런처

| 게이트 | 결과 |
|---|---|
| Vitest | 59 files / 673 tests PASS |
| production build | 765 modules / PASS |
| runtime asset audit | 65/65, errors 0 |
| submission build asset audit | runtime 21, missing 0, unexpected 0 |
| `게임시작.bat` smoke | 서버 없음→신규 preview→HTTP 200 cold-start 통과. 최종 재실행은 `YEONGHEO_NO_BROWSER=1`에서 exit 0, 기존 PID 유지, 중복 서버 0. 실제 더블클릭은 서버가 이미 있어도 게임 주소를 한 번 다시 열도록 수정 |
| `git diff --check` | whitespace error 0; CRLF 안내만 존재 |

테스트 stderr의 `missing test asset`은 자산 로딩 실패 시 title로 복귀하는 의도적 오류-path
테스트가 `console.error`를 관찰한 기록이며 테스트는 PASS했다. 실제 브라우저 콘솔과 무관하다.

## 7. 런타임·성능

- renderer: PixiJS WebGL2
- GPU: NVIDIA GeForce RTX 5070 Laptop GPU / ANGLE D3D11
- browser console: warnings 0 / errors 0
- rolling 600 samples:
  - frame interval p95 `8.30ms`, p99 `8.70ms`, max `8.70ms`
  - work p95 `2.50ms`
  - simulation p95 `0.60ms`
  - draw p95 `2.60ms`
  - long tasks `0`
- audio after the victory tail: active `0/32`, started `10,399`, ended `10,399`, dropped `0`, preempted `0`
- result 화면은 32fps menu cap이므로 전투 프레임 판정으로 사용하지 않는다.

## 8. 냉정한 release review

로컬 gameplay 후보는 승인한다. 실행, 2560×1600 표시, 정확히 7분 연속 전투, 세 맹세,
중간·최종 보스, 최종 3페이즈, 승천 결과, 재도전 UI, 성능과 콘솔 게이트가 한 production
후보에서 확인됐다.

그러나 공개 제출은 아직 승인하지 않는다.

- `ASSET_RIGHTS_LEDGER.md`의 법적 권리 확인이 0/21이다.
- 실제 스피커/헤드폰 오디오 믹스를 사람이 청감하지 않았다.
- 같은 build hash의 공개 HTTPS URL과 새 세션 접근 검증이 없다.
- 썸네일 권리·사람 승인, 제출 문구·대표자 동의와 실제 제출 기록이 없다.
- 동일 build의 170.211초 1080p 기술 편집본은 시각·경계 검수를 통과했지만 오디오 트랙이
  없어 최종 제출 영상으로 승인하지 않는다. 실제 게임 사운드가 포함된 캡처와 사람의 청감이 남았다.

따라서 정확한 상태는 **로컬 gameplay vertical slice PASS, 공개 release/submission BLOCKED**다.
