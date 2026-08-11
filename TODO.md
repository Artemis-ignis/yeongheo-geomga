# 남은 작업

완료된 항목은 반복하지 않고, 현재 실제로 남은 작업만 기록합니다.

1. **P0 — 지면 깊이와 변주**
   - 평평하고 반복적인 ground를 줄이고, 지역/공유 레이아웃과 접촉 그림자가 플레이 화면에서 깊이와 위치를 읽게 합니다.
   - 원본 크기 Windows Chromium 시각 확인으로 strict visual FAIL이 해소됐는지 판정합니다.

2. **P0 — 초반 threat/action feedback**
   - 첫 적 접근, 피해·피격, 처치·위험 전조가 초반부터 즉시 읽히도록 시각·오디오·HUD feedback을 보강합니다.
   - 실제 플레이에서 자동 PASS가 아닌 사용자 가독성으로 확인합니다.

3. **P1 — 현재 빌드 7분 E2E**
   - 동일 immutable build/run ID로 title→combat→level-up→boss/result의 7분 current-build 실플레이를 다시 기록합니다.
   - 시간 점프·피해 무효화·강제 소환 없이, 정확한 Windows Chromium 원본 크기 증거를 남깁니다.

4. **P0 — 권리 증거와 법적 게이트**
   - runtime asset 73개 각각의 법적 권리 상태와 증거를 확보·검토합니다.
   - 0/73 상태가 해소되기 전까지 rights gate는 `BLOCKED`로 유지합니다.

5. **P1 — Game2D 번들 경고**
   - 약 548.17 kB Game2D chunk의 bundle warning을 분할·축소하거나, 남겨야 한다면 근거와 영향 범위를 문서화합니다.
   - 이 경고가 사라져도 release approval이나 A-grade를 자동 부여하지 않습니다.
