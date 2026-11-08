// ===================== 調整用の値 =====================
const ORB_COUNT = 7;                      // 玉の数（原作は7）
const ORB_SIZE = 1.2;                     // 玉の大きさ（1で最初の大きさ）
const ORB_SPEED = (Math.PI * 2) / 2.8;    // 玉が輪にそって進む速さ（約2.8秒で1周）
const TUMBLE_SPEED = Math.PI / 2.8;       // 輪そのものが回る速さ（約2.2秒ごとに横向きになる）
const TRAIL = 0.4;                       // 光の尾（0で尾なし。1に近いほど長く残る）
const LEAVE_MS = 1250;                    // 決定してから次の画面が出るまで

// 玉の集まり方：等間隔 → 6つ → 等間隔 → 5つ → 等間隔 → 4つ → 等間隔 → 3つ → 等間隔 → 2つ → 等間隔 … をくり返す
//  等間隔（7つ）の合間に集まる形。数字は輪の上に並ぶ塊ごとの玉の数で、合計を玉の数（7）にする
const GATHER_STEPS = [
  [1, 2, 1, 1, 1, 1],          // 6つ
  [1, 2, 1, 2, 1],             // 5つ：2個の塊×2＋1個×3
  [3, 1, 2, 1],                // 4つ
  [3, 3, 1],                   // 3つ：3個の塊×2＋1個
  [3, 4],                      // 2つ
];
const GATHER_HOLD = 1.2;       // 1つの形で止まっている秒数
const GATHER_MOVE = 1.8;       // 次の形へ移り変わる秒数
const GATHER_GAP = 0.1;       // 塊の中の玉どうしのすき間（0で完全に重なる）

// 項目ごとの輪の形。カーソルを動かすと、ここの値へなめらかに移る
//  radius : 輪の大きさ / tumble: 輪の回る速さの倍率 / axis: 回転軸の傾き
const FORMATIONS = {
  portfolio: { spread: 1.0, radius: 1.0,  tumble: 1.0,  axis: -0.8 },
  profile:   { spread: 1.0, radius: 0.92, tumble: 0.75, axis: 0.3 },
  contact:   { spread: 1.0, radius: 0.86, tumble: 1.25, axis: 0.8 },
};
// =====================================================

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (sel) => document.querySelector(sel);
const menuEl = $('#menu');
const items = [...menuEl.querySelectorAll('a')];
const keys = items.map((a) => a.dataset.key);
const pageEl = $('#page');
const pageTitle = $('#page-title');
const backBtn = $('#back-btn');
const soundBtn = $('#sound-btn');
const soundLabel = $('#sound-label');
const anchorEl = $('#orb-anchor');

// GSAPが読み込めなかったときは、アニメーションなしで値だけ切り替える
const TWEEN_KEYS = ['duration', 'ease', 'delay', 'overwrite', 'onComplete'];
function to(target, vars) {
  if (window.gsap) return window.gsap.to(target, vars);
  const v = { ...vars };
  TWEEN_KEYS.forEach((k) => delete v[k]);
  Object.assign(target, v);
  if (vars.onComplete) vars.onComplete();
  return null;
}

// ===================== 音（Web Audioで合成。音声ファイルなし） =====================
const sound = (() => {
  let ctx = null, master, sfxBus, ambGain, noiseBuf, on = false;

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);

    noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;

    // 環境音：低い持続音をローパスでこもらせ、フィルターをゆっくり揺らす
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 0.8;
    ambGain = ctx.createGain(); ambGain.gain.value = 0;
    lp.connect(ambGain).connect(master);
    [[110, 'triangle', 0.55], [164.8, 'sine', 0.32], [220.7, 'sine', 0.16]].forEach(([f, type, v]) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = v;
      o.connect(g).connect(lp); o.start();
    });
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.12;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 120;
    lfo.connect(lfoAmt).connect(lp.frequency); lfo.start();
    return true;
  }

  const now = () => ctx.currentTime;

  function ambient(level, sec) {
    if (!ctx) return;
    const g = ambGain.gain;
    g.cancelScheduledValues(now());
    g.setValueAtTime(g.value, now());
    g.linearRampToValueAtTime(level, now() + sec);
  }

  // 画面が出たときに一度ふくらんで、数秒で落ち着く
  function swell() {
    if (!on) return;
    ambient(0.1, 0.7);
    ambGain.gain.linearRampToValueAtTime(0.05, now() + 4.5);
  }

  function tone(freq, start, dur, peak, type = 'sine') {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(sfxBus);
    o.start(start); o.stop(start + dur + 0.02);
  }

  function click(start, freq, peak) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 1.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.018);
    s.connect(bp).connect(g).connect(sfxBus);
    s.start(start); s.stop(start + 0.03);
  }

  return {
    get on() { return on; },
    // ボタンのクリック内で呼ぶ（ブラウザの自動再生制限はここで解除される）
    async set(next) {
      if (next && !ctx && !build()) return false;
      on = next;
      if (!ctx) return on;
      master.gain.cancelScheduledValues(now());
      if (on) {
        await ctx.resume();
        master.gain.setTargetAtTime(1, now(), 0.05);
        swell();
      } else {
        master.gain.setTargetAtTime(0, now(), 0.06);
        setTimeout(() => { if (!on) ctx.suspend(); }, 450);
      }
      return on;
    },
    cursor() { if (!on) return; const t = now(); tone(640, t, 0.07, 0.12); click(t, 3600, 0.18); },
    decide() {
      if (!on) return;
      const t = now();
      [440, 587.3, 784].forEach((f, i) => tone(f, t + i * 0.03, 0.5, 0.075));
      tone(1568, t + 0.06, 0.25, 0.02);
      ambient(0.012, 1.2);
    },
    back() { if (!on) return; const t = now(); tone(587.3, t, 0.09, 0.09); tone(440, t + 0.07, 0.14, 0.09); },
    swell,
  };
})();

// ===================== 光の玉（Three.js / WebGL） =====================
async function createOrbs() {
  const THREE = await import('three');
  const [{ EffectComposer }, { RenderPass }, { AfterimagePass }, { OutputPass }] = await Promise.all([
    import('three/addons/postprocessing/EffectComposer.js'),
    import('three/addons/postprocessing/RenderPass.js'),
    import('three/addons/postprocessing/AfterimagePass.js'),
    import('three/addons/postprocessing/OutputPass.js'),
  ]);

  const canvas = document.getElementById('orbs');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  } catch (err) {
    return null; // WebGLが使えない環境ではメニューだけで動かす
  }
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.z = 10;

  // 前のフレームを薄く残して光の尾を出す
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new AfterimagePass(reduceMotion ? 0.5 : TRAIL));
  composer.addPass(new OutputPass());

  // 玉は「芯」と「にじみ」の2枚のぼかし画像を加算合成で重ねる
  function glowTexture(size, stops) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([o, col]) => grd.addColorStop(o, col));
    g.fillStyle = grd; g.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const coreTex = glowTexture(64, [[0, 'rgba(255,255,255,1)'], [0.22, 'rgba(225,244,255,0.95)'], [0.5, 'rgba(130,195,255,0.35)'], [1, 'rgba(60,120,220,0)']]);
  const haloTex = glowTexture(128, [[0, 'rgba(110,175,255,0.55)'], [0.35, 'rgba(60,125,230,0.22)'], [1, 'rgba(20,60,160,0)']]);
  const material = (map) => new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
  const orbs = Array.from({ length: ORB_COUNT }, () => {
    const halo = new THREE.Sprite(material(haloTex));
    const core = new THREE.Sprite(material(coreTex));
    scene.add(halo, core);
    return { halo, core };
  });

  // GSAPで動かすのはこの数値だけ。玉の位置は毎フレームここから計算する
  const P = { spread: 0, radius: 0.6, tumble: 1, axis: 0, speed: 1, glow: 0, size: 1, nudgeY: 0 };
  const motion = reduceMotion ? 0.3 : 1;
  let ringPhase = Math.random() * Math.PI * 2;
  let tumblePhase = 0.5;
  let t = 0;
  let last = performance.now();
  const euler = new THREE.Euler(0, 0, 0, 'ZYX');
  const quat = new THREE.Quaternion();
  const v = new THREE.Vector3();

  // 塊に集まったときの、各玉の位置（角度）。sizes がなければ等間隔
  function gatherAngles(sizes) {
    const base = Array.from({ length: ORB_COUNT }, (_, i) => (i / ORB_COUNT) * Math.PI * 2);
    if (!sizes || sizes.reduce((a, b) => a + b, 0) !== ORB_COUNT) return base;
    const n = sizes.length;
    const group = sizes.flatMap((len, g) => Array(len).fill(g));                              // 何番目の塊か
    const offset = sizes.flatMap((len) => Array.from({ length: len }, (_, m) => m - (len - 1) / 2)); // 塊の中での位置
    // 塊どうしは等間隔。全体の向きは、元の位置からの移動が一番少なくなるように合わせる
    const shift = base.reduce((sum, b, i) => sum + b - (group[i] / n) * Math.PI * 2, 0) / ORB_COUNT;
    return base.map((_, i) => (group[i] / n) * Math.PI * 2 + shift + offset[i] * GATHER_GAP);
  }
  const gather = GATHER_STEPS.flatMap((sizes) => [gatherAngles(), gatherAngles(sizes)]);
  let gT = 0;

  let W = 1, H = 1, k = 1; // k = 画面1pxあたりの3D空間の長さ
  function resize() {
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    composer.setPixelRatio(dpr);
    composer.setSize(W, H);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    k = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z) / H;
  }
  resize();
  new ResizeObserver(resize).observe(canvas);

  function frame(nowMs) {
    const dt = Math.min((nowMs - last) / 1000, 0.05);
    last = nowMs;
    t += dt * motion;
    ringPhase += dt * ORB_SPEED * P.speed * motion;
    tumblePhase += dt * TUMBLE_SPEED * P.tumble * P.speed * motion;

    // 軸の移動：X軸まわりに回しつつ、Y軸で揺らし、Z軸（画面の向き）で回転軸そのものを傾ける
    euler.set(tumblePhase, 0.55 * Math.sin(t * 0.31), 0.35 + P.axis + 0.45 * Math.sin(t * 0.17));
    quat.setFromEuler(euler);

    const a = anchorEl.getBoundingClientRect();
    const cx = (a.left + a.width / 2 - W / 2) * k;
    const cy = -(a.top + a.height / 2 + P.nudgeY - H / 2) * k;
    const baseR = a.width * 0.42 * k;
    const R = Math.max(baseR * P.radius, 1e-4);

    // 間隔の移動：等間隔と GATHER_STEPS の形を交互に移っていく
    gT = Math.max(0, gT + dt * motion * P.speed); // 最初の1フレームはdtがマイナスになることがあるので0未満にしない
    const step = Math.floor(gT / (GATHER_HOLD + GATHER_MOVE));
    const local = gT - step * (GATHER_HOLD + GATHER_MOVE);
    const from = gather[step % gather.length];
    const next = gather[(step + 1) % gather.length];
    const x = Math.max(0, local - GATHER_HOLD) / GATHER_MOVE;
    const p = 0.5 - 0.5 * Math.cos(Math.PI * x); // ゆっくり動き出して、ゆっくり止まる

    for (let i = 0; i < ORB_COUNT; i++) {
      const rel = (from[i] + (next[i] - from[i]) * p) * P.spread;
      const ang = ringPhase + rel;
      v.set(Math.cos(ang) * R, Math.sin(ang) * R, 0).applyQuaternion(quat);
      const d = (v.z / R + 1) / 2; // 0 = 奥、1 = 手前
      const { core, halo } = orbs[i];
      core.position.set(cx + v.x, cy + v.y, v.z);
      halo.position.copy(core.position);
      const s = baseR * P.size * ORB_SIZE;
      // 奥の玉ほど芯が小さく暗く、にじみの割合が増える（＝ぼけて見える）
      core.scale.setScalar(s * 0.2 * (0.65 + 0.5 * d));
      halo.scale.setScalar(s * 0.8 * (0.85 + 0.3 * d));
      core.material.opacity = P.glow * (0.3 + 0.7 * d);
      halo.material.opacity = P.glow * (0.45 + 0.25 * d);
    }

    composer.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    // カーソル移動：その項目の形へ移る
    formation(key, nudge = 0) {
      to(P, { ...FORMATIONS[key], speed: 1, nudgeY: nudge, duration: reduceMotion ? 0.3 : 0.9, ease: 'power3.out', overwrite: 'auto' });
    },
    // 縦位置だけ合わせ直す（フォント読み込み・リサイズ時）
    nudge(px) { to(P, { nudgeY: px, duration: 0.4, ease: 'power2.out', overwrite: 'auto' }); },
    // 登場：一点に集まった玉が、数珠つなぎに伸びて輪になる
    intro(key, nudge = 0) {
      if (window.gsap) window.gsap.killTweensOf(P);
      const f = FORMATIONS[key];
      Object.assign(P, { ...f, spread: 0, radius: f.radius * 0.6, glow: 0, size: 1, speed: 1, nudgeY: nudge });
      ringPhase = Math.random() * Math.PI * 2;
      gT = 0;
      to(P, { glow: 1, duration: 0.5, ease: 'power1.out' });
      to(P, { spread: f.spread, radius: f.radius, duration: reduceMotion ? 0.4 : 1.4, ease: 'power2.out' });
    },
    // 決定：ブレーキをかけるように止まりながら、小さく暗くなって消える
    leave() {
      to(P, { speed: 0.05, duration: 1.1, ease: 'power2.out', overwrite: 'auto' });
      to(P, { glow: 0, size: 0.55, radius: P.radius * 0.8, duration: 1.05, ease: 'power1.in' });
    },
  };
}

// ===================== メニュー =====================
let current = 0;
let mode = 'boot'; // boot → menu → leaving → page → intro → menu
let orbs = null;

// 選択中＝青、1つ隣＝グレー、それより離れた項目＝暗いグレー
function paint() {
  items.forEach((a, i) => { a.dataset.dist = String(Math.min(Math.abs(i - current), 2)); });
}

// 選択中の項目の高さへ、玉を少し寄せる（縦並びのスマホでは寄せない）
function nudgeFor(i) {
  if (window.matchMedia('(max-width: 640px)').matches) return 0;
  const m = menuEl.getBoundingClientRect();
  const r = items[i].getBoundingClientRect();
  return (r.top + r.height / 2 - (m.top + m.height / 2)) * 0.35;
}

function select(i, opts = {}) {
  if (mode !== 'menu') return;
  i = Math.max(0, Math.min(items.length - 1, i));
  if (opts.focus) items[i].focus({ preventScroll: true });
  if (i === current) return;
  current = i;
  paint();
  sound.cursor();
  if (orbs) orbs.formation(keys[i], nudgeFor(i));
}

function decide(i = current) {
  if (mode !== 'menu') return;
  if (i !== current) { current = i; paint(); }
  mode = 'leaving';
  sound.decide();
  menuEl.classList.add('is-hidden'); // 文字は決定と同時に消す
  if (orbs) orbs.leave();
  setTimeout(openPage, orbs ? (reduceMotion ? 350 : LEAVE_MS) : 150);
}

function openPage() {
  pageTitle.textContent = items[current].textContent;
  pageEl.hidden = false;
  if (window.gsap) window.gsap.fromTo(pageEl, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power1.out' });
  mode = 'page';
  backBtn.focus({ preventScroll: true });
}

function closePage() {
  if (mode !== 'page') return;
  sound.back();
  pageEl.hidden = true;
  startMenu(true);
}

function startMenu(focusItem) {
  mode = 'intro';
  menuEl.classList.add('is-hidden');
  if (orbs) orbs.intro(keys[current], nudgeFor(current));
  sound.swell();
  setTimeout(() => {
    menuEl.classList.remove('pre', 'is-hidden'); // 輪ができかけたところで文字を出す
    mode = 'menu';
    if (focusItem) items[current].focus({ preventScroll: true });
  }, orbs && !reduceMotion ? 750 : 0);
}

items.forEach((a, i) => {
  a.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') select(i); });
  a.addEventListener('focus', () => select(i));
  a.addEventListener('click', (e) => { e.preventDefault(); decide(i); });
});

document.addEventListener('keydown', (e) => {
  if (mode === 'page' && (e.key === 'Escape' || e.key === 'Backspace')) { e.preventDefault(); closePage(); return; }
  if (mode !== 'menu') return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); select(current + 1, { focus: true }); }
  else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); select(current - 1, { focus: true }); }
  else if ((e.key === 'Enter' || e.key === ' ') && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); decide(); }
});

backBtn.addEventListener('click', closePage);

soundBtn.addEventListener('click', async () => {
  const state = await sound.set(!sound.on);
  soundBtn.setAttribute('aria-pressed', String(state));
  soundLabel.textContent = state ? 'SOUND ON' : 'SOUND OFF';
});

// ===================== 起動 =====================
paint();
const orbsLoading = createOrbs().catch((err) => { console.warn('光の玉を表示できませんでした', err); return null; });
const first = await Promise.race([orbsLoading, new Promise((r) => setTimeout(() => r('timeout'), 4000))]);
if (first !== 'timeout') orbs = first;
startMenu(false);
if (first === 'timeout') {
  orbsLoading.then((o) => { if (o) { orbs = o; o.intro(keys[current], nudgeFor(current)); } });
}

const realign = () => { if (orbs && mode === 'menu') orbs.nudge(nudgeFor(current)); };
if (document.fonts) document.fonts.ready.then(realign);
window.addEventListener('resize', realign);
