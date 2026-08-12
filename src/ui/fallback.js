/** Replace the game with a readable explanation instead of a black screen. */
export function showFallback(reason) {
  const el = document.getElementById('fallback')
  if (!el) return
  el.innerHTML = `
    <div>
      <h1>실행할 수 없습니다</h1>
      <p>이 게임은 WebGL2가 필요합니다.<br />
      Chrome, Edge, Firefox 최신 버전에서 다시 열어주세요.</p>
      <p class="reason">사유: ${String(reason)}</p>
    </div>`
  el.hidden = false
  const scene = document.getElementById('scene')
  const hud = document.getElementById('hud')
  if (scene) scene.style.display = 'none'
  if (hud) hud.style.display = 'none'
}
