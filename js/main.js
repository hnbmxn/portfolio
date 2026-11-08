// ===================== 調整用の値 =====================
const ORB_COUNT = 7;                      // 玉の数（原作は7）
const ORB_SIZE = 1.2;                     // 玉の大きさ（1で最初の大きさ）
const ORB_SPEED = (Math.PI * 2) / 2.8;    // 玉が輪にそって進む速さ（約2.8秒で1周）
const TUMBLE_SPEED = Math.PI / 2.8;       // 輪そのものが回る速さ（約2.2秒ごとに横向きになる）
const TRAIL = 0.4;                       // 光の尾（0で尾なし。1に近いほど長く残る）
const LEAVE_MS = 1250;                    // 決定してから次の画面が出るまで

// SP版（幅640px以下）：選択肢を縦に回るドラムにして、一周させる
const WHEEL_ANGLE = 26;                   // 項目どうしの角度（度）。大きいほど上下の項目が強く傾く
const WHEEL_RADIUS = 96;                  // ドラムの半径（px）。大きいほど項目の間隔が広がる
const WHEEL_DRAG = 44;                    // 1項目ぶん回すのに指を動かす距離（px）

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

// ===================== SP版の回る選択肢 =====================
// 本物の3項目に、見た目だけの複製を3つ足して6段の輪にする。中央の上下2段ずつ（計5段）が見え、
// 中央＝青、1段離れる＝グレー、2段離れる＝暗いグレーになる
const wheel = (() => {
  const mq = window.matchMedia('(max-width: 640px)'); // style.cssの切り替え幅と合わせる
  const stageEl = document.querySelector('.stage');
  const listEl = menuEl.querySelector('ul');
  const lis = items.map((a) => a.parentElement);
  const n = items.length;
  const rad = (WHEEL_ANGLE * Math.PI) / 180;
  let els = lis, clones = [];
  let pos = 0;      // ドラムの回転位置（項目単位）。整数のとき、その項目がちょうど中央
  let aim = 0;      // 回している先の位置
  let tw = null;    // 回転中のGSAP
  let drag = null;  // 指で回している最中の情報
  let lastPointer = -1e9;

  const api = { active: false };
  const wrap = (i) => ((i % n) + n) % n;

  // 位置をもとに、各段の傾き・高さ・透明度・色を決める
  api.draw = () => {
    if (!api.active) return;
    const total = els.length;
    els.forEach((li, b) => {
      let off = (((b - pos) % total) + total) % total;
      if (off >= total / 2) off -= total;              // 中央からの段数（-3〜+3）
      const th = off * rad;
      const y = WHEEL_RADIUS * Math.sin(th);
      const z = WHEEL_RADIUS * (Math.cos(th) - 1);
      li.style.transform = `translate(-50%, -50%) translate3d(0, ${y.toFixed(2)}px, ${z.toFixed(2)}px) rotateX(${(-off * WHEEL_ANGLE).toFixed(2)}deg)`;
      li.style.opacity = String(Math.max(0, Math.min(1, (2.9 - Math.abs(off)) / 0.7)));
      li.firstElementChild.dataset.dist = String(Math.min(Math.round(Math.abs(off)), 2));
    });
  };

  // 位置を動かし、中央の項目が変わったら選択を切り替える（音と玉の形もここで変わる）
  function setPos(p) {
    pos = p;
    api.draw();
    const idx = wrap(Math.round(pos));
    if (idx !== current && mode === 'menu') select(idx, { fromWheel: true });
  }

  function roll(target) {
    aim = target;
    if (tw) tw.kill();
    const dist = Math.abs(target - pos);
    if (!window.gsap || dist < 1e-3) { tw = null; setPos(target); return; }
    const st = { p: pos };
    tw = window.gsap.to(st, {
      p: target, duration: reduceMotion ? 0.15 : Math.min(0.3 + 0.12 * dist, 0.9), ease: 'power3.out',
      onUpdate: () => setPos(st.p), onComplete: () => { tw = null; },
    });
  }

  api.stop = () => { if (tw) tw.kill(); tw = null; aim = pos; };
  // i番目の項目へ、近いほうの向きに回す（キーボード・フォーカス用）
  api.goTo = (i) => {
    const base = Math.round(aim);
    let d = wrap(i - base);
    if (d > n / 2) d -= n;
    roll(base + d);
  };
  // 選択中の項目がちょうど中央に来る位置へ合わせる（メニューに戻ったとき用）
  api.sync = () => { api.stop(); const base = Math.round(pos); let d = wrap(current - base); if (d > n / 2) d -= n; pos = aim = base + d; api.draw(); };
  api.recentPointer = () => performance.now() - lastPointer < 800;

  function setActive(on) {
    if (on === api.active) return;
    api.active = on;
    api.stop();
    if (on) {
      clones = lis.map((li) => {
        const c = li.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        c.inert = true;
        c.firstElementChild.setAttribute('tabindex', '-1');
        listEl.appendChild(c);
        return c;
      });
      els = [...lis, ...clones];
      pos = aim = current;
      api.draw();
    } else {
      clones.forEach((c) => c.remove());
      clones = []; els = lis;
      lis.forEach((li) => { li.style.transform = ''; li.style.opacity = ''; });
      paint();
    }
  }

  // ---- 指・マウスで回す ----
  stageEl.addEventListener('pointerdown', (e) => {
    if (!api.active || mode !== 'menu' || !e.isPrimary || e.button > 0) return;
    lastPointer = performance.now();
    api.stop();
    drag = { id: e.pointerId, y0: e.clientY, p0: pos, moved: false, hist: [[e.timeStamp, pos]] };
    stageEl.setPointerCapture(e.pointerId);
  });
  stageEl.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dy) < 8) return;     // 少し動いただけならタップ扱い
    drag.moved = true;
    setPos(drag.p0 - dy / WHEEL_DRAG);
    drag.hist.push([e.timeStamp, pos]);
    while (drag.hist.length > 2 && e.timeStamp - drag.hist[0][0] > 100) drag.hist.shift();
  });
  function release(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    lastPointer = performance.now();
    if (e.type === 'pointercancel') { roll(Math.round(pos)); return; }
    if (d.moved) {
      // 指を離したときの勢いで少し回り続け、項目の位置でぴたりと止まる
      const [t0, p0] = d.hist[0];
      const v = e.timeStamp > t0 ? (pos - p0) / (e.timeStamp - t0) : 0; // 項目/ミリ秒
      const fling = Math.max(-5, Math.min(5, v * 200));
      roll(Math.round(pos + fling));
      return;
    }
    // タップ：中央の項目なら決定、ほかの項目ならそこまで回す
    const r = menuEl.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    const s = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / WHEEL_RADIUS));
    const target = Math.round(pos + Math.asin(s) / rad);
    if (target === Math.round(pos)) { setPos(target); decide(); }
    else roll(target);
  }
  stageEl.addEventListener('pointerup', release);
  stageEl.addEventListener('pointercancel', release);

  // マウスホイール（幅の狭いPCのウィンドウ用）
  let wheelLock = 0;
  stageEl.addEventListener('wheel', (e) => {
    if (!api.active || mode !== 'menu' || Math.abs(e.deltaY) < 4) return;
    e.preventDefault();
    if (performance.now() < wheelLock) return;
    wheelLock = performance.now() + 140;
    roll(Math.round(aim) + Math.sign(e.deltaY));
  }, { passive: false });

  mq.addEventListener('change', (e) => setActive(e.matches));
  setActive(mq.matches);
  return api;
})();

// 選択中＝青、1つ隣＝グレー、それより離れた項目＝暗いグレー
function paint() {
  if (wheel.active) { wheel.draw(); return; } // SP版はドラムの位置で色を決める
  items.forEach((a, i) => { a.dataset.dist = String(Math.min(Math.abs(i - current), 2)); });
}

// 選択中の項目の高さへ、玉を少し寄せる（SP版は選択中がいつも中央なので寄せない）
function nudgeFor(i) {
  if (window.matchMedia('(max-width: 640px)').matches) return 0;
  const m = menuEl.getBoundingClientRect();
  const r = items[i].getBoundingClientRect();
  return (r.top + r.height / 2 - (m.top + m.height / 2)) * 0.35;
}

function select(i, opts = {}) {
  if (mode !== 'menu') return;
  if (wheel.active && !opts.fromWheel) { wheel.goTo(i); return; } // SP版はドラムを回して選ぶ
  const n = items.length;
  i = wheel.active ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i));
  if (opts.focus) items[i].focus({ preventScroll: true });
  if (i === current) return;
  current = i;
  paint();
  sound.cursor();
  if (orbs) orbs.formation(keys[i], nudgeFor(i));
}

function decide(i = current) {
  if (mode !== 'menu') return;
  if (wheel.active) wheel.stop();
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
  if (wheel.active) wheel.sync();
  if (orbs) orbs.intro(keys[current], nudgeFor(current));
  sound.swell();
  setTimeout(() => {
    menuEl.classList.remove('pre', 'is-hidden'); // 輪ができかけたところで文字を出す
    mode = 'menu';
    if (focusItem) items[current].focus({ preventScroll: true });
  }, orbs && !reduceMotion ? 750 : 0);
}

items.forEach((a, i) => {
  a.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !wheel.active) select(i); });
  a.addEventListener('focus', () => { if (!(wheel.active && wheel.recentPointer())) select(i); });
  a.addEventListener('click', (e) => {
    e.preventDefault();
    if (wheel.active && wheel.recentPointer()) return; // SP版のタップはドラム側で処理する
    decide(i);
  });
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
