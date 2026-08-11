# 영허검가 제작 기술·레퍼런스 조사 장부

- 조사 기준일: 2026-08-10
- 목적: 링크 수집이 아니라 2026-08-20 출시 후보에 적용할 근거와 배제 결정을 남긴다.
- 원칙: 논문은 아이디어 근거, 상용작은 품질 기준, GitHub는 라이선스와 유지보수 상태를 확인한 뒤에만 코드 후보로 사용한다.
- 권리 경계: 아래 자료를 참고했다는 사실은 에셋 사용 권리를 뜻하지 않는다. Steam 스크린샷·논문 그림·프로젝트 페이지 이미지는 런타임에 복제하거나 포함하지 않는다.

## 지금 채택한 결론

| 문제 | 근거 | 영허검가 적용 | 상태 |
|---|---|---|---|
| 주인공과 배경의 값·색이 겹침 | Riot VALORANT의 캐릭터 실루엣/프레넬 가시성 원칙, PixiJS의 blend-mode 배치 규칙 | 필터 대신 동일 애니메이션 텍스처를 normal blend로 뒤에 1.035배 배치한 얇은 수묵색 림. 얼굴과 본체는 원본이 덮고 가장자리만 노출 | 1920×1080·2560×1600 실화면 승인, draw call 10 유지 |
| 오브젝트가 지면에서 뜨거나 한 장 배경 위에 붙은 느낌 | WorldClaw의 coarse-to-fine 구성과 render-based scale/pose/contact refinement | 절차적 macro 지면 + 월드 고정 authored crop decal + 프레임별 발 접점 + 접촉 그림자/접촉광 | 구현·2560×1600 실화면 확인 완료 |
| 대규모 적 충돌 비용 | uniform-grid broad phase, data-oriented hot loop | 자체 SpatialHash + 타입 배열 + 재사용 query buffer. 가까운 이웃에만 분리력 적용 | 이미 구현, 유지 |
| 수백 개 투사체/VFX 비용 | PixiJS ParticleContainer 및 spritesheet 권장 | 고정 풀, atlas, 선언한 dynamic property만 갱신, 효과 밀도 예산 | 이미 구현, 유지 |
| 한 시드만 맞는 밸런스 | 자동 밸런싱/다중 에이전트·다중 목적 평가 연구 | 48개 분기/시드 sweep, 분기별 승률 gate, 실시간 420초 수동 검증 병행 | 구현·검증 중 |
| 랜덤 맵이 잡음처럼 보임 | Bridson blue-noise, WorldClaw coarse-to-fine, PCG quality-diversity | 주요 지형은 authored landmark cluster, 일반 prop은 chunk당 1~2개와 가장자리 margin. 현재 밀도에서는 Poisson 라이브러리를 추가하지 않음 | 의도적 보류 |

## 1. 동종·인접 상용작 품질 기준

### Death Must Die

- URL: https://store.steampowered.com/app/2334730/Death_Must_Die/
- 볼 것: 어두운 바닥과 밝은 플레이어/VFX의 명도 분리, 신/장비 선택의 시너지 언어, 영웅별 차별화.
- 가져오지 않을 것: 픽셀 아트 외형, UI 레이아웃, 아이콘 또는 수치의 직접 복제.

### Halls of Torment

- URL: https://store.steampowered.com/app/2218750/Halls_of_Torment/
- 볼 것: 제한된 색 팔레트 안에서도 적·위험·보상을 구분하는 방식, 단계별 보스와 장기 성장량.
- 영허검가 결정: 배경 채도는 낮추고 보상/위험/주인공의 의미색을 보존한다.

### Cultivation Story: Reincarnation

- URL: https://store.steampowered.com/app/1866880/
- 볼 것: 선협 소재를 시스템 이름과 조합 성장으로 연결하는 방법, 200개 이상 업그레이드와 조합의 반복 동기.
- 영허검가 결정: 단순 서양식 perk 명칭이 아니라 법보·공법·진화·도 선택으로 역할을 즉시 드러낸다.

### Otherworld Cultivation Survivors / Chronicle of Wuxia & Xianxia Survivors

- URLs:
  - https://store.steampowered.com/app/4542830/Otherworld_Cultivation_Survivors/
  - https://store.steampowered.com/app/4521730/Chronicle_of_Wuxia_Xianxia_Survivors/
- 볼 것: 같은 장르·소재의 직접 경쟁작이 어떤 문구와 화면으로 판타지를 전달하는지.
- 위험: 미출시·변경 가능 제품은 기능 완성도 근거로 쓰지 않고 시장 포지셔닝 비교에만 사용한다.

## 2. 그래픽·에셋 통합·가시성

### Hunyuan3D-WorldClaw

- Project: https://tencent-hunyuan.github.io/Hunyuan3D-WorldClaw/
- Paper: https://arxiv.org/abs/2608.05248
- 핵심: plan → global terrain → regional objects의 coarse-to-fine 제작, 이후 렌더 결과를 보고 scale·pose·object-terrain contact를 교정한다.
- 영허검가 적용: 한 장 완성 배경을 바닥처럼 늘이는 방식을 폐기하고, macro 바닥/지역 decal/개별 prop/접점/그림자 순으로 평가한다.
- 배제: 논문의 전체 생성 파이프라인은 Blender 5.1.1과 대형 GPU 구성을 전제로 한다. 10일 마감과 노트북 런타임에는 직접 도입하지 않는다.

### Riot Games — VALORANT Shaders and Gameplay Clarity

- URL: https://www.riotgames.com/en/news/valorant-shaders-and-gameplay-clarity
- 핵심: 사실성보다 판독성을 우선하며, 캐릭터에는 윤곽/프레넬 성격의 추가 조명을 주고 저사양에서도 gameplay feature를 유지한다.
- 영허검가 적용: 주인공 림은 핵심 gameplay feature로 취급하고 효과 품질 밀도와 독립시킨다.

### Riot Games — VFX 교육 및 League VFX Style Guide

- URLs:
  - https://www.riotgames.com/en/artedu/visual-effects
  - https://nexus.leagueoflegends.com/en-us/2017/10/dev-leagues-vfx-style-guide/
  - https://nexus.leagueoflegends.com/wp-content/uploads/2017/10/VFX_Styleguide_final_public_hidpjqwx7lqyx0pjj3ss.pdf
- 핵심: 만족감·명료성·테마를 동시에 만족시키고, 효과가 어느 캐릭터/행동에서 왔는지 일관되게 보여준다.
- 영허검가 적용: 무기마다 형태·궤적·충돌·상태 의미축을 두고 진화는 최소 두 시각축을 변경한다.

### Clarity in League / Data Feel

- URLs:
  - https://www.leagueoflegends.com/en-us/news/dev/clarity-in-league/
  - https://arxiv.org/abs/2210.03800
- 핵심: 개별 효과가 예뻐도 누적된 시각 잡음은 판단을 방해하며, VFX는 세계 상태를 이해하게 해야 한다.
- 영허검가 적용: 후반 효과는 무작정 증식시키지 않고 particle sampling budget을 사용하며, 보스 전조는 라벨+지면 도형으로 중복 전달한다.

## 3. 타격감·조작감

### What Features Influence Impact Feel?

- Paper: https://arxiv.org/abs/2208.06155
- 저자 PDF: https://faculty.washington.edu/weicaics/paper/papers/ZhonghaoLDWC2022.pdf
- 핵심: 조사 프레임워크에서 hit stop, sound coherence, camera control이 타격감에 강한 영향을 보였다.
- 영허검가 적용: hit flash, 방향성 impact, 적 사망 효과, 상황별 screen shake, 무기별 음색은 유지한다.
- 주의: 자동 공격이 초당 수십 번 적중하는 뱀서라이크에서 모든 타격에 hit stop을 넣으면 조작과 시뮬레이션을 끊는다. 보스 파괴/진화 발동처럼 희소한 사건만 후보이며 이번 림 수정과 섞지 않는다.

### Designing Game Feel: A Survey

- URL: https://arxiv.org/abs/2011.09201
- 핵심: juicing은 장식이 아니라 사건의 중요도와 결과를 명확하게 전달하는 증폭이다.
- 영허검가 적용: 일반 적중·치명타·보스 전조·보스 사망의 피드백 세기를 같은 값으로 만들지 않는다.

## 4. 적 군집·충돌·게임 루프 알고리즘

### Craig Reynolds — Steering Behaviors for Autonomous Characters

- URL: https://www.red3d.com/cwr/steer/gdc99/
- 핵심: action selection, steering, locomotion을 분리하고 seek/avoidance/separation 등을 결합한다.
- 영허검가 적용: 적의 목표 선택과 이동 표현을 분리하고, 플레이어 추적 뒤 local separation만 가산한다. 현재의 uniform grid 때문에 O(n²) 전체 비교를 피한다.
- 보류: cohesion/alignment를 강하게 쓰면 생존 장르의 포위 압박이 새 떼처럼 뭉쳐 보이므로 적용하지 않는다.

### RBush

- GitHub: https://github.com/mourner/rbush
- License: MIT
- 용도: 정적/복합 사각형이 많은 경우의 R-tree 후보.
- 결정: 매 틱 움직이는 점형 적군에는 현재 uniform grid가 더 단순하고 재사용 배열과 잘 맞는다. 맵에 대량의 정적 충돌물이 생기기 전에는 추가하지 않는다.

### bitECS

- GitHub: https://github.com/NateTheGreatt/bitECS
- License: MPL-2.0
- 용도: TypeScript data-oriented ECS.
- 결정: 영허검가의 핵심 전투는 이미 structure-of-arrays 타입 배열이다. 마감 직전 ECS 이관은 회귀 위험만 키우므로 구조 아이디어만 참고한다.

### Fix Your Timestep

- URL: https://gafferongames.com/post/fix_your_timestep/
- 보조 논문: https://users.iit.uni-miskolc.hu/~mileff/pubs/Game_Loop_TheHeartOfTheGameEngine_Mileff_2023.pdf
- 핵심: 시뮬레이션 고정 틱과 렌더 보간을 분리하고 과도한 catch-up을 제한한다.
- 영허검가 적용: 고정 시뮬레이션, 렌더 alpha 보간, deterministic seed를 유지해 밸런스 sweep과 실플레이가 같은 규칙을 사용하게 한다.

### EasyStar.js / PathFinding.js

- GitHub:
  - https://github.com/prettymuchbryce/easystarjs — MIT, asynchronous A* for grid games
  - https://github.com/qiao/PathFinding.js — MIT, A*·Dijkstra·JPS 등 여러 grid finder
- 후보: 충돌 지형과 좁은 통로가 있는 별도 비경의 엘리트/보스 이동.
- 현재 결정: 청람비경은 열린 생존 arena이며 장식 prop은 비충돌이다. 수백 적에게 A*를 붙이면 경로 품질 이득 없이 CPU와 군집 경직만 늘어난다. 실제 blocking terrain이 생길 때 flow field 또는 소수 지휘자 경로부터 검토한다.

### seedrandom

- GitHub: https://github.com/davidbau/seedrandom
- License: MIT
- 핵심: 명시적 seed와 PRNG state 저장/복원이 가능한 JS 구현.
- 현재 결정: 영허검가는 이미 자체 stateful deterministic RNG와 저장/복원 계약을 갖고 있다. 전역 `Math.random` 교체 위험을 피하고 새 의존성을 추가하지 않는다.

## 5. 절차적 맵과 배치

### Robert Bridson — Fast Poisson Disk Sampling

- PDF: https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph07-poissondisk.pdf
- 핵심: 최소 거리 r을 유지하는 blue-noise 샘플을 O(N)에 생성할 수 있다.
- 후보: 향후 풀·돌·등불처럼 같은 계층의 prop 수가 chunk당 6개 이상일 때 사용한다.
- 현재 결정: chunk당 일반 prop이 1~2개이고 landmark는 수작업 cluster이므로 런타임 코드/의존성 추가 이득이 없다. 대신 chunk edge margin과 authored plaza를 유지한다.

### FastNoise Lite

- GitHub: https://github.com/Auburn/FastNoiseLite
- License: MIT
- 특징: JS/TS, OpenSimplex2·Cellular·Perlin·domain warp 등.
- 후보: 신규 비경의 biome mask, 안개 밀도, mineral vein 생성.
- 현재 결정: 이미 제작된 지면을 또 노이즈로 덮으면 AI 생성 데모 같은 잡음이 늘 수 있다. 새 비경을 실제 제작할 때 미리 bake하는 도구 후보로만 둔다.

### WaveFunctionCollapse

- GitHub: https://github.com/mxgmn/WaveFunctionCollapse
- Code license: MIT. 저장소 LICENSE는 제공 sample image/tile은 소프트웨어 라이선스에 포함되지 않는다고 명시한다.
- 후보: 규칙 기반 건축/폐허 조립.
- 현재 결정: 연속형 생존 맵과 10일 마감에는 과도하다. 비경 방/길 규칙과 실패 복구 설계가 준비되기 전에는 도입하지 않는다.

### PCG Quality Diversity / scenario diversity

- URLs:
  - https://arxiv.org/abs/1907.04053
  - https://arxiv.org/abs/2404.15192
  - https://arxiv.org/abs/2207.02100
- 핵심: 하나의 최고 결과보다 품질을 만족하는 여러 행동/경험 영역을 명시적으로 측정한다.
- 영허검가 적용: 시드별 승패만 보지 않고 도 분기, 피해량, 보스 처치, 레벨, 남은 HP를 함께 기록한다.

## 6. 밸런싱·자동 플레이·QA

### Automatic Game Balancing / MCTS / autonomous agents

- URLs:
  - https://arxiv.org/abs/1603.03795
  - https://arxiv.org/abs/1908.01423
  - https://arxiv.org/abs/2304.08699
  - https://arxiv.org/abs/2602.06232
- 핵심: 여러 목적과 서로 다른 실력/정책의 에이전트를 사용해 한 전략에 과적합된 밸런스를 피한다.
- 영허검가 적용: deterministic multi-seed branch sweep + 실제 사람 입력과 유사한 이동 정책 + 420초 실시간 실행을 함께 사용한다.
- 다음 개선: 정면 돌파형, 원형 kite형, 초보형 세 정책의 결과를 별도 gate로 저장한다.
- 보류: Bayesian optimization이나 LLM 에이전트를 런타임에 넣지 않는다. 오프라인 tuning 도구로만 평가한다.

### Dynamic Difficulty Adjustment

- URLs:
  - https://arxiv.org/abs/2006.15545
  - https://www.sciencedirect.com/science/article/abs/pii/S1875952124000314
- 결론: 효과가 설계 목적과 플레이어 상호작용에 따라 혼재한다. 플레이 도중 몰래 피해/체력을 바꾸면 공정성을 훼손할 수 있다.
- 영허검가 결정: 이번 출시는 고정 규칙과 명확한 시련 선택을 유지한다. DDA는 텔레메트리와 사용자 연구 없이 넣지 않는다.

## 7. PixiJS 렌더링·성능

### PixiJS official performance guide

- URL: https://pixijs.com/8.x/guides/concepts/performance-tips
- 핵심: spritesheet를 사용하고, texture/blend 순서를 묶으며, 필터·mask·매 프레임 Text 변경을 제한한다.
- 영허검가 적용: 주인공 림에 OutlineFilter를 쓰지 않고 normal-blend 동일 텍스처를 사용한다. 적·투사체는 atlas/pool로 묶는다.

### PixiJS ParticleContainer

- URL: https://pixijs.com/8.x/guides/components/scene-objects/particle-container
- 핵심: 불필요한 기능을 없애고 dynamic property를 선언해 대량 particle을 처리한다. API는 stable이지만 experimental 표시가 있다.
- 영허검가 적용: 투사체·픽업은 이미 ParticleContainer를 사용한다. 버전 고정과 회귀 테스트 없이 업그레이드하지 않는다.

### pixi-filters / particle-emitter

- GitHub:
  - https://github.com/pixijs/filters — MIT
  - https://github.com/pixijs-userland/particle-emitter — MIT
- 결정: 구현 예시와 저작 도구는 참고하되 이번 빌드에 무거운 bloom/outline 의존성을 추가하지 않는다. 자체 고정 풀은 성능 계측과 deterministic 재현에 유리하므로 유지한다.

### Basis Universal

- GitHub: https://github.com/BinomialLLC/basis_universal
- License: Apache-2.0
- 후보: WebGL 배포의 대형 texture 메모리/다운로드 축소.
- 현재 결정: 마감 직전 PNG atlas 전체 전환은 브라우저 호환성과 색/알파 회귀 위험이 있다. v5 실제 전송 크기와 GPU memory가 gate를 넘을 때만 별도 브랜치에서 검증한다.

## 8. 합법적 에셋 후보와 권리 정책

### Poly Haven / ambientCG

- URLs:
  - https://polyhaven.com/license
  - https://ambientcg.com/
- License: 각 사이트는 제공 에셋을 CC0로 명시한다.
- 용도: 향후 3D 제작용 재질/HDRI/환경 참고 후보.
- 영허검가 제한: 지금의 2D 선협 화풍에 실사 PBR을 그대로 섞으면 에셋이 따로 논다. 팔레트·선명도·원근·광원·접점 패스를 거쳐야 하며 다운로드 즉시 런타임 투입하지 않는다.

### 권리 gate

- 출처 URL, 파일 해시, 원본 라이선스 사본, 수정 내역, 런타임 포함 여부가 없는 에셋은 release-cleared가 아니다.
- GitHub 저장소가 permissive license여도 sample images/tiles/assets는 별도 조건일 수 있다.
- 검색 결과의 `free`, `royalty-free`, `AI generated` 문구만으로 상업 사용을 승인하지 않는다.
- 현재 런타임 에셋 권리 장부의 미해결 항목은 출시 차단 조건으로 유지한다.

## 9. 접근성·정보 전달

### Game Accessibility Guidelines

- Text/UI contrast: https://gameaccessibilityguidelines.com/provide-high-contrast-between-text-ui-and-background/
- Sound redundancy: https://gameaccessibilityguidelines.com/ensure-no-essential-information-is-conveyed-by-sounds-alone/
- 영허검가 적용: UI 텍스트는 복잡한 배경 위 반투명 panel/outline을 유지하고, 보스 전조·피격·보상은 소리만이 아니라 도형·색·텍스트 상태로도 전달한다.

## 10. 오디오·입력 반응

### MDN Web Audio for games / best practices

- URLs:
  - https://developer.mozilla.org/en-US/docs/Games/Techniques/Audio_for_Web_Games
  - https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
- 핵심: 브라우저 autoplay 정책에 맞춘 사용자 gesture unlock, Web Audio graph 재사용, game state와 동기화된 재생이 필요하다.
- 영허검가 적용: 첫 입력에서 audio context를 unlock하고, 동시 SFX voice cap·drop/preemption 진단·pause ducking을 유지한다. 2560×1600 실플레이에서 140회 SFX 시작/종료, drop 0을 확인했다.

### Audio assessment and player experience

- DOI: https://doi.org/10.1145/3677069
- 핵심: 게임 오디오 평가 연구 26편을 검토하며 플레이어 경험과 연결되는 평가 방식의 공백을 지적한다.
- 영허검가 결정: `소리가 난다`를 완료 기준으로 삼지 않고 무기 정체성, 타격-시각 동기, 위험 전조, voice starvation을 별도 검사한다.

### Input latency research

- URLs:
  - https://arxiv.org/abs/2105.10498
  - https://web.cs.wpi.edu/~claypool/papers/delay-action-wpi/
- 핵심: action game의 입력-화면 지연은 플레이 성능과 체감 품질을 낮춘다.
- 영허검가 적용: 이동/축지법 입력은 DOM UI round-trip 없이 fixed tick의 입력 상태로 직접 들어가며, 렌더는 보간만 담당한다. 모달 중 입력 누수와 키 repeat는 회귀 테스트 대상으로 유지한다.

## 11. 속성 기반·시뮬레이션 검증

### fast-check

- GitHub: https://github.com/dubzzz/fast-check
- License: MIT
- 용도: JavaScript/TypeScript property-based testing과 실패 입력 축소.
- 현재 결정: 이번 빌드의 deterministic branch sweep은 이미 명시적 seed와 재현 로그를 남긴다. 라이브러리를 즉시 추가하지 않고, 새 RNG/배치 알고리즘이 들어갈 때 최소거리·결정성·저장복원 property를 fast-check 후보로 둔다.

### Metamorphic testing for simulations

- Sources:
  - https://www.nist.gov/publications/metamorphic-testing-continuum-verification-and-validation-simulation-models
  - https://arxiv.org/abs/2211.12003
- 핵심: 정답 하나를 미리 알기 어려운 시뮬레이션은 입력 변환 전후에 반드시 성립해야 할 관계로 검증할 수 있다.
- 영허검가 적용 후보: 같은 seed+입력은 동일 결과, 렌더 해상도 변경은 전투 결과 불변, 장식 밀도 변경은 피해/승패 불변, 공격력 증가가 동일 조건의 누적 피해를 감소시키지 않음. 이 네 관계를 release regression으로 확장한다.

## 도입하지 않을 것

1. 장르명만 맞는 무명 survivor clone 저장소의 코드를 통째로 가져오지 않는다. 품질·권리·보안·구조 적합성을 검증하기 어렵다.
2. WorldClaw/Hunyuan 전체 파이프라인을 런타임 의존성으로 넣지 않는다. 결과를 평가하는 제작 순서를 참고한다.
3. WFC, ECS 전환, 런타임 DDA 같은 대규모 구조 변경을 8월 20일 전에 시작하지 않는다.
4. bloom/outline/filter를 화면 전체에 쌓아 그래픽 품질을 가장하지 않는다. fill-rate와 명료성을 실제 노트북에서 계측한다.
5. CC0라도 화풍이 다른 에셋을 무가공으로 섞지 않는다.

## 다음 실행 순서

1. 완료: 신규 주인공 수묵 림을 1920×1080·2560×1600에서 검증했다. 이중상/얼굴 번짐 없음, draw call 10, 콘솔 오류·경고 0.
2. 기존 48-run sweep에 초보형/원형 kite형 정책 분리를 추가할지 비용 대비 효과를 결정한다.
3. 렌더 해상도와 장식 밀도가 전투 결과를 바꾸지 않는 metamorphic regression을 추가한다.
4. 새 비경을 제작할 때만 FastNoise/Poisson을 offline authoring 후보로 실험한다.
5. 모든 외부 에셋은 권리 장부가 green이 되기 전 release package에 포함하지 않는다.
