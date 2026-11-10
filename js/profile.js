// ===================== Profile（履歴書風） =====================
// HOMEの中で出し入れする画面（main.js から開く）。
// 動くのは証明写真（APNG）だけで、写真は画像そのものが動くので、ここでは画面を出す・しまうだけをする

export function createProfile({ onBack }) {
  const root = document.getElementById('profile');
  if (!root) return { open() {}, close() {} };

  const backBtn = root.querySelector('#pf-back');
  backBtn.addEventListener('click', () => onBack());

  function open() {
    root.hidden = false;
    root.scrollTop = 0;
    if (window.gsap) window.gsap.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power1.out' });
    backBtn.focus({ preventScroll: true });
  }

  function close() {
    root.hidden = true;
  }

  return { open, close };
}
