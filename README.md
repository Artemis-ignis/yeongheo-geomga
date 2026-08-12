# 영허검가

미소녀 선협 세계관의 PixiJS 브라우저 뱀서라이크입니다. 설령으로 7분간 청람비경을 돌파하고 세 맹세로 빌드를 완성해 최종 보스를 쓰러뜨리는 수직 슬라이스를 개발하고 있습니다.

웹 플레이: https://yeongheo-geomga.vercel.app

## 실행

Windows에서는 루트의 `영허검가 실행.vbs`만 더블클릭합니다. 실행기는 최소화된 상태로 로컬 서버를 유지하며 브라우저를 한 번만 엽니다. 개발 환경은 Node.js 20.19 이상을 사용합니다.

```powershell
npm ci
npm test
npm run build
npm run preview
```

`npm run dev`는 브라우저를 자동으로 열지 않습니다.

## 조작

- 이동: `WASD` 또는 방향키
- 축지법: `Space`
- 상호작용: `E`
- 일시정지: `Esc`
- 성장 선택: 마우스, `1`·`2`·`3`, 방향키 + `Enter`

공격은 자동입니다. 영기를 모아 법보·공법·진화와 검맥·설맥·심맥을 선택합니다.

## 현재 구조

```text
src/main.js       production 진입점
src/runtime2d/    전투·맵·보스·PixiJS 표시
src/ui/           타이틀·HUD·성장·결과
src/data/         적·무기·웨이브·스테이지 데이터
public/assets/    runtime 이미지와 2D 원본 시트
styles/           UI 테마와 반응형 배치
test/             현재 제품 계약 테스트
tools/            빌드·자산·권리·Windows 실행 도구
```

구형 Three.js/GLB/img2three 경로, 구버전 릴리스 문서와 임시 QA 덤프는 제거했습니다.

현재 구현·검증 결과·실제 남은 결함·설계 결정·레퍼런스 원칙은 [PROJECT_STATE.md](PROJECT_STATE.md) 한 곳에서 관리합니다. 자동 테스트는 코드·파일·실행 회귀만 검사하며 시각 품질이나 재미를 승인하지 않습니다.
