# 영허검가

애니메이션 미소녀와 선협 세계를 결합한 **PixiJS 2.5D 뱀서라이크(Vampire Survivors-like)** 웹 게임입니다.

> 네가 고른 도가, 네가 싸울 마존을 만든다.
>
> **Build your Dao. Fight its mirror.**

## 현재 제품 경계

현재 공개 진입점은 2D 런타임입니다.

- src/main.js는 기본적으로 src/runtime2d/Game2D.js를 로드합니다.
- 렌더링은 PixiJS 8.19 기반이며 WebGL을 우선 사용하고, 소프트웨어 렌더러에서는 Canvas 백엔드를 선택할 수 있습니다.
- src/core/Game.js와 Three.js/GLB 자산은 개발자가 비교·검수할 때만 사용하는 legacy 3D 경로입니다. 개발 서버에서만 renderer=3d 쿼리로 열리며, production build의 기본 플레이 경로가 아닙니다.
- WorldClaw 원칙은 지역/공유 레이아웃/접점 QA에만 선택적으로 적용했으며, 전체 3D 포트나 파노라마 전환은 하지 않았습니다.
- 전투 시뮬레이션은 고정 60Hz timestep, 타입 배열 기반 풀, 공간 해시, 결정론적 RNG를 사용합니다.
- 사운드는 외부 음원 파일 대신 Web Audio 합성으로 만들며, 브라우저 자동 재생을 피하기 위해 기본 음소거입니다.

저장소에는 15분 캠페인용 웨이브 테이블과 여러 캐릭터·비경·법보·공법·메타 진행 데이터가 남아 있습니다. 그러나 현재 live 2D 전투는 ContestPacing2D의 420초 하드 타임아웃을 사용합니다. 900초 테이블은 contest 첫 경험이 아니라 레거시·확장 콘텐츠 데이터입니다.

## contest 수직 슬라이스: 천겁의 맹세

출품용 제품 약속은 420초입니다.

설령이 청람비경에서 경지를 돌파하며 검맥·설맥·심맥 중 하나의 도를 선택합니다. 선택한 도는 이동·자동공격·완성 효과를 바꾸고, 마지막 옥허진장(최종 보스)은 그 도를 거울처럼 복사합니다.

출품 목표 범위는 다음과 같습니다.

- 설령 1명
- 청람비경 1개
- 식별 가능한 일반 적 4종
- 중간 보스 1명과 최종 보스 1명
- 세 맹세의 기본·심화·완성
- 기본 법보 14종·진화 6종의 고유 행동 계약, 한 런 최대 6종 장착
- 제단·정예 봉인 POI
- 7분 안에 승천 또는 좌화로 끝나는 결과 화면

현재 코드에는 420초 pacing과 다음 시스템이 연결되어 있습니다.

- ContestPacing2D: 20초 첫 맹세, 120초 POI 강조, 180초 중간 보스, 330초 최종 보스, 420초 좌화 타임아웃 이벤트
- DaoVows2D: 검맥·설맥·심맥의 기본·심화·완성 선택과 전투 보정. 현재 선택 창은 20초·165초·270초에 열린다.
- BossPatterns2D: 최종 옥허진장이 선택한 도를 읽어 3개 체력 페이즈별 전조·거울 패턴을 실행한다.
- FormationDirector2D: 75초·140초·215초·290초·365초의 ring·wall·pincer 진을 한 번씩 생성하고, 용량 부족 시 같은 이벤트를 재시도한다.
- WorldInteractions2D: seed·비경·청크에 따라 재현되는 제단·보물·정예 봉인·회복 샘 POI와 E 상호작용·보상.

다만 이 연결은 제출 완료 선언이 아닙니다. 원클릭 quickStart는 showcase seed `3185791507`로 POI·진·선택·보스 경로를 재현하며, 상세 시작은 저장 진행과 새 seed를 유지합니다. 권위 타임라인은 첫 맹세 0:20, POI 강조 2:00, 맹세 심화 2:45, 중간 보스 3:00, 맹세 완성 4:30, 최종 보스 5:30, 승천/좌화 결과 7:00입니다. 현재 exact commit `6516321`에서 무치트 420초 승천·결과→재도전·이동까지 실제 Chrome 한 탭 검증을 통과했습니다. 공개 URL과 대표자 권리 확인 게이트는 여전히 남아 있으며, 최신 세부 근거는 [PROJECT_STATE.md](PROJECT_STATE.md)를 기준으로 합니다.

## 현재 상태

2026-08-11 품질 패스에서 인계된 검증 사실입니다.

- npm test: 67개 테스트 파일, 752개 테스트 통과
- npm audit: 알려진 취약점 0
- npm run build: 통과. Game2D bundle은 약 548.17 kB, gzip은 약 162.68 kB입니다.
- npm run assets:audit: 통과. 매니페스트 117개와 실제 파일 117개가 일치합니다.
- npm run assets:build-audit: 런타임 73/73, 누락 0입니다.
- `YEONGHEO_NO_BROWSER=1` launcher의 실제 smoke를 통과했습니다.
- 420초 pacing, DaoVows2D, BossPatterns2D, FormationDirector2D, WorldInteractions2D의 구조·로직 계약이 현재 테스트 묶음에 포함되어 통과합니다.
- 최종 실행 청크 `Game2D-CfY6A-CR.js`(SHA-256 `4e9f58de…add29b0a`)를 담은 새 Web ZIP에서 일반 피해 조건, 실제 이동·축지법·선택으로 정확히 07:00 승천(레벨 33·2,394처치·보스 2·도가 3/3)을 확인했습니다. 같은 최신 패키지의 결과 화면→재도전 UI 회귀와, 동일 실행 청크의 별도 실플레이에서 일시정지·재개까지 확인했습니다.
- Windows Chromium 정확한 1920×1080·2560×1600에서 title/combat·level-up DOM을 확인했고 console error는 0이었습니다. title visual과 최신 enemy contact는 PASS입니다.
- Web ZIP 104개 entry와 Windows portable ZIP 113개 entry를 만들고, 각각 재추출해 source dist와 104/104 SHA 일치를 확인했습니다.
- v5.3 Web ZIP을 다시 실제 플레이해 타이틀·첫 10초·중간보스·완성 도가·최종보스·07:00 승천을 담은 166.468초 1920×1080 영상 `output/releases/yeongheo-geomga-submission-video-v5.3-1080p-audio-166s-20260810.webm`을 봉인했습니다. 실제 WebAudio만 사용했고 콘솔·페이지·디코드·인코더 타임스탬프 오류는 0입니다. 이전 v5 176.01초 영상은 역사 후보일 뿐 v5.3 제출본이 아닙니다.
- 자동 테스트·빌드·자산 감사와 격리 자동 완주는 외부 일반 사용자 테스트나 대표자의 권리 승인을 대신하지 않습니다.
- 전체 commercial visual gate는 **strict FAIL**입니다. 후반 전투에서 겹치는 지면 원·범위 장판·보스 예고가 접지와 위험 우선순위를 흐리고 적 군집도 반복적으로 보입니다.
- rights audit는 **BLOCKED**이며 법적 증거는 0/76입니다. 3D 모델·ImageGen·TRELLIS 산출물은 개발/자산 QA 증거이며, contest용 AAA 최종 모델이나 권리 clearance로 홍보하지 않습니다.

따라서 지금의 정확한 상태는 **PixiJS 2D production 경로의 구조·빌드·자산·런처와 현재 build 무치트 7분 전체 루프는 확인됐지만, 지면 효과의 의미·접지 가독성과 후반 적 군집 반복 때문에 전체 commercial visual은 strict FAIL이고 법적 권리 증거·번들 경고 정리가 남은 로컬 QA 후보**입니다. release approval, A-grade, rights clearance, 공식 제출 승인은 선언하지 않습니다.

## 실행

Node.js LTS를 설치한 뒤 프로젝트 루트에서 실행합니다. Vite 8 기준으로 Node.js 20.19 이상 또는 22.12 이상을 권장합니다.

### Windows에서 실행

배포 폴더에 포함된 `게임시작.bat`을 더블클릭하면 준비된 `dist/` production build를 `http://127.0.0.1:4173/`에서 실행하고 게임 창을 한 번 엽니다. 이미 서버가 실행 중이면 서버 프로세스는 중복 생성하지 않고 게임 주소만 다시 엽니다. 서버가 실행되는 검은 창을 닫으면 게임도 종료됩니다. 개발 소스만 받은 경우에는 먼저 아래 터미널 명령으로 `npm ci`와 `npm run build`를 실행해야 합니다.

### 터미널에서 실행

~~~bash
npm ci
npm run dev       # 개발 서버, 기본 http://localhost:5173
npm run build     # dist/ production build
npm run preview   # 이미 생성한 dist/를 preview
npm start         # build 후 preview --open
npm test          # Vitest 순수 로직·런타임 계약 테스트
npm run assets:audit  # public/assets와 tools/asset-manifest.json 대조
~~~

npm run assets:audit는 배포 전에 반드시 통과해야 합니다. 현재 GitHub Pages workflow는 npm ci → npm test → npm run assets:audit → npm run build 순서로 검사한 뒤에만 dist를 배포하도록 되어 있습니다.

시각 캡처가 필요할 때만 개발 서버를 다음처럼 실행합니다.

~~~bash
# macOS/Linux
VITE_ENABLE_CAPTURE=1 npm run dev
~~~

~~~powershell
# PowerShell
$env:VITE_ENABLE_CAPTURE='1'; npm run dev
~~~

dist/index.html을 직접 더블클릭하지 마십시오. file://에서는 ES 모듈과 정적 자산이 제대로 로드되지 않으므로 빈 화면이 나올 수 있습니다. 반드시 npm run preview, npm start 또는 게임시작.bat처럼 HTTP 서버를 사용하십시오.

## 브라우저와 배포

최신 Chrome·Edge·Firefox를 권장합니다. WebGL2가 우선 대상이며, Pixi backend가 소프트웨어 렌더러를 감지하면 Canvas로 전환할 수 있습니다. 성능·시각 승인 증거는 WebGL2 Chromium 환경에서 별도로 기록해야 합니다.

GitHub Pages 배포 목표 주소는 다음과 같습니다.

<https://artemis-ignis.github.io/yeongheo-geomga/>

release-v5.3은 현재 이 주소에 배포됐다고 확인되지 않았습니다. `public/release.json`의 `deploymentStatus`도 `not-deployed`입니다. 최신 GitHub Actions와 익명 새 세션에서 동일 build hash를 확인하기 전에는 이 주소를 제출 URL로 사용하지 마십시오.

## 조작

| 입력 | 동작 |
|---|---|
| W/A/S/D, 방향키 | 이동. 대각선 속도는 정규화됩니다. |
| Space | 축지법(대시, 짧은 무적). 메뉴에서는 확인으로도 사용됩니다. |
| P 또는 Esc | 전투 일시정지/재개 |
| E | 가까운 제단·보물·정예 봉인·회복 샘 상호작용 |
| Enter | 메뉴·돌파 보상 확인 |
| 1/2/3 | 캐릭터·돌파 보상 카드 선택 |
| M | 음소거 전환 |
| 마우스 휠, +/− | 전투 카메라 확대·축소. 스크롤 가능한 메뉴에서는 메뉴 스크롤이 우선입니다. |
| F3 | 디버그 오버레이 |
| F4 | 화질 순환: 자동 → 낮음 → 높음 |
| 게임패드 왼쪽 스틱 | 이동 |
| 게임패드 남쪽 버튼 또는 R1 | 대시/확인 |
| 게임패드 Start | 일시정지 |
| 게임패드 동쪽 버튼 | 확인 |
| 게임패드 서쪽 버튼 | 상호작용 |
| 게임패드 D-pad | 메뉴 방향 선택 |

공격은 자동입니다. 플레이어의 핵심 판단은 이동 경로, 축지법 사용 시점, 영기 회수, 경지·맹세 선택입니다.

## 현재 런타임의 주요 시스템

- 플레이어: src/runtime2d/CombatWorld2D.js의 설령 상태, 기혈·영기·영석·축지법
- 전투: 자동 법보, 투사체, 적 추격·분리, 보스, 피해 이벤트·피해 숫자
- pacing·빌드: 420초 ContestPacing2D, DaoVows2D 세 맹세, BossPatterns2D 거울 패턴, FormationDirector2D 진
- 세계: seed 기반 청람비경 청크, 제단·보물·정예 봉인·회복 샘 POI
- UI: HUD, 경지 돌파 카드, 일시정지, 결과, 단전, 도감, 디버그 오버레이
- 진행: localStorage 기반 메타 영석·해금·기록과 설정. 진행 중 active run은 저장하지 않으므로 새로고침·종료 시 현재 7분 런이 사라집니다.
- 오디오: 비경별 합성 모드, 전투 강도 변화, 돌파·보스·승천·좌화·UI cue
- 성능: Pixi ParticleContainer, 고정 용량 풀, 적·투사체·픽업 예산, 자동 화질 조절

주요 구현 디렉터리는 다음과 같습니다.

~~~text
src/
  main.js                 production 진입과 개발용 legacy 3D 분기
  runtime2d/              Game2D, CombatWorld2D, PixiPresentation, 월드·성능 계약
  data/                   캐릭터·법보·공법·적·웨이브·비경·보스 수치
  combat/                 스탯·피해·업그레이드·법보 로직
  audio/                  Web Audio 합성·비경별 이론·SFX
  ui/                     타이틀·HUD·돌파·일시정지·결과·단전·도감
  core/                   시간·입력·RNG·풀·공간 해시
  art/, world/, entities/ legacy Three.js 개발 경로와 자산 검수 도구
test/                     DOM/WebGL 없이 실행하는 Vitest 계약 테스트
public/assets/             production 2D 스프라이트·환경·재질·마케팅 자산
~~~

현재 기본 실행은 2D 자산을 사용합니다. 3D 폴더와 img2threejs 도구가 저장소에 있어도, 그것만으로 3D 플레이 화면이나 AAA 자산 승인을 의미하지 않습니다.

## 밸런스·콘텐츠 데이터

주요 밸런스 테이블은 src/data/에서 관리합니다.

- characters.js: 캐릭터 기본 스탯과 특성
- weapons.js: 법보·진화의 레벨별 피해·쿨다운·개수·범위
- passives.js: 공법 효과
- enemies.js: 적 스탯·행동·시간 스케일
- waves.js: 900초 레거시·확장 웨이브 테이블. 현재 CombatWorld2D는 contest 중간·최종 보스를 180초·330초에 배치
- formations.js: 7분 안에 읽히는 ring·wall·pincer 이벤트와 420초 이후 확장 진
- stages.js: 비경 팔레트·로스터·보스 선택
- bosses.js: 보스 정의
- realms.js: 경지·영기 요구량
- trials.js: 기본 시련 계층
- metaUpgrades.js, unlocks.js: 단전 영구 강화와 해금

부팅 시 data/validate.js가 참조 무결성과 웨이브 계약을 검사합니다. 런타임 풀 용량·렌더 예산처럼 presentation에 속하는 제한은 src/runtime2d/에 있습니다.

## 검증과 품질 표기

다음은 서로 다른 판정입니다.

1. 구조/로직 PASS: npm test, data validation, asset manifest 검사
2. 빌드 PASS: npm run build
3. 실제 런타임 PASS: Windows Chromium에서 입력·상태·프레임·화면을 확인
4. contest 출품 PASS: 천겁의 맹세 Gate 1–6과 제출 자료를 모두 확인

현재 구조/로직·빌드·자산·런처와 무치트 7분 전체 루프는 확인됐지만, 전체 commercial visual은 strict FAIL입니다. contest 출품 PASS, release approval, A-grade를 선언하지 않으며, rights audit는 법적 증거 0/76으로 BLOCKED이고 공개 URL·마스터의 시청각 승인·공식 제출도 남아 있습니다.

오류가 나면 boot fallback 패널과 콘솔 로그를 먼저 확인하십시오. F3에서 renderer, FPS, frame/simulation/draw 시간, 엔티티 수, 품질 배율을 볼 수 있지만, 실제 성능 보고서에는 p95 실측과 브라우저·해상도·build ID를 함께 기록해야 합니다.

## 문서

- [contest 수직 슬라이스: 천겁의 맹세](docs/product/CONTEST_VERTICAL_SLICE.md)
- [OpenAI Game Builders Seoul 제출 준비](docs/competition/OPENGAME2026_SUBMISSION.md)
- [release-v5.3 로컬 릴리스 감사](docs/competition/RELEASE_V5_3_AUDIT_2026-08-10.md)
- [release-v5.3 제출 인계서](docs/competition/SUBMISSION_HANDOFF_V5_3_2026-08-10.md)
- [제출 빌드 정책과 패키지 해시](docs/BUILD_SUBMISSION.md)
- [제출 카피 초안](docs/competition/SUBMISSION_COPY_KO.md)
- [최종 로컬 런타임 QA](docs/competition/FINAL_RUNTIME_QA.md)
- [품질 기준선과 현재 자산 연결 상태](docs/QUALITY_STATUS.md)
- [기존 선협 서바이버 설계](docs/superpowers/specs/2026-07-27-xianxia-survivors-design.md)
- [기존 구현 계획](docs/superpowers/plans/2026-07-27-xianxia-survivors*.md)

OpenAI Game Builders Seoul의 공식 일정·제출 필드·Codex 협업 증빙·권리 체크는 제출 준비 문서를 따르되, 실제 제출·동의·배포 상태는 공식 사이트와 최신 workflow 결과를 직접 확인하십시오.
