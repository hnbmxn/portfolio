// ===================== ローディング画面 =====================
// 読み込みの進み具合を％とバーで見せ、終わったら自動でHOMEへ進む（「○でスタート」は挟まない）。
// main.js は HOMEの準備ができたら window.omoriLoader.finish() を呼び、
// ローディング画面が消えはじめるのを待ってから、玉を登場させる。
// 見た目（踊る人の速さ・コマ数、バーの色や幅）は css/style.css の「ローディング画面」で変える

(() => {
  const MIN_SHOW = 3.5;  // 0→100％に最低かける秒数。読み込みが一瞬で終わっても、踊る人が見えるようにする
  const HOLD = 0.25;     // 100％になってから、消えはじめるまでの秒数
  const FADE = 0.5;      // 消えるのにかける秒数（style.css の .loader の transition と合わせる）
  const MAX_WAIT = 12;   // 何かが読み込めなくても、この秒数で必ず100％にして消す

  const root = document.getElementById('loader');

  // ブラウザの「戻る」で帰ってきたとき（index.html の head で no-loader を付けている）や、
  // ローディング画面がないときは、何もせずにすぐHOMEを始める
  if (!root || document.documentElement.classList.contains('no-loader')) {
    if (root) root.remove();
    window.omoriLoader = { finish: () => Promise.resolve() };
    return;
  }

  const fill = root.querySelector('.loader-fill');
  const num = root.querySelector('.loader-num');
  const bar = root.querySelector('.loader-bar');
  const screen = document.querySelector('.screen');
  if (screen) screen.inert = true; // 読み込み中は、後ろのボタンにTabで移れないようにする

  // ---------- 進み具合 = 終わった仕事の重さ ÷ 全部の重さ ----------
  let total = 0;
  let done = 0;
  function track(promise, weight = 1) {
    total += weight;
    Promise.resolve(promise).catch(() => {}).then(() => { done += weight; }); // 失敗しても「終わった」に数える
  }
  const loaded = (el, ev = 'load') => new Promise((r) => {
    el.addEventListener(ev, r, { once: true });
    el.addEventListener('error', r, { once: true });
  });

  // 1. 文字：英字（Press Start 2P）と数字（DotGothic16）。読み込めてから％の数字を出す
  const fonts = document.fonts
    ? Promise.all([
        document.fonts.load('16px "Press Start 2P"', 'Portfolio'),
        document.fonts.load('16px "DotGothic16"', '0123456789%'),
      ])
    : null;
  Promise.resolve(fonts).catch(() => {}).then(() => root.classList.add('is-font'));
  track(fonts, 1);

  // 2. ページの中の画像（プロフィールの写真など）。重いので1枚2つ分に数える
  [...document.images].forEach((img) => track(img.complete ? null : loaded(img), 2));

  // 3. ページ全体（GSAPなど）
  track(document.readyState === 'complete' ? null : loaded(window), 1);

  // 4. HOMEの準備（Three.js の読み込みと玉の用意）。main.js が finish() を呼んだら終わり
  let homeReady;
  track(new Promise((r) => { homeReady = r; }), 2);

  // ---------- 表示：実際の進み具合を、上限の速さで追いかける ----------
  const start = performance.now();
  let last = start;
  let shown = 0;
  let lastPct = -1;
  let opened;
  const opening = new Promise((r) => { opened = r; });

  function render() {
    fill.style.transform = `scaleX(${shown / 100})`;
    const pct = Math.floor(shown);
    if (pct === lastPct) return;
    lastPct = pct;
    num.textContent = `${pct}%`;
    bar.setAttribute('aria-valuenow', String(pct));
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); // タブが裏にあった分を一気に進めない
    last = now;
    const target = (now - start) / 1000 > MAX_WAIT ? 100 : (done / total) * 100;
    shown = Math.min(target, shown + dt * (100 / MIN_SHOW));
    render();
    if (shown >= 100) { setTimeout(hide, HOLD * 1000); return; }
    requestAnimationFrame(frame);
  }

  // 消えはじめたらHOMEを始める（玉の登場と、ローディング画面のフェードを重ねる）
  function hide() {
    root.classList.add('is-done');
    if (screen) screen.inert = false;
    opened();
    setTimeout(() => root.remove(), FADE * 1000 + 50);
  }

  window.omoriLoader = {
    finish() { homeReady(); return opening; },
  };
  requestAnimationFrame(frame);
})();
