// ===================== 作品データ =====================
//  title : 作品名（右上と詳細画面に出る）
//  desc  : 紹介文（詳細画面に出る。2〜3行くらい）
//  url   : 「見に行く」の行き先
//  model : 3Dアイコン（.glb）のファイル名。あればこれを使う。アニメーションが入っていれば常に再生する
//  icon  : 平面アイコン（画像）のファイル名。model がないときに立方体の面に貼る
//          model も icon もないときは、番号入りの仮の立方体になる
//  bg    : 詳細画面の背景の4隅の色 ['左上', '右上', '左下', '右下']。書かなければ DETAIL_BG の色
const ASSET_DIR = '../assets/works/';     // model / icon を置くフォルダ（works/index.html から見た場所）
const WORKS = [
  { title: '作品01', desc: 'ここに作品の紹介文が入ります。どんな作品で、何を担当したかを2〜3行でまとめます。', url: '#', model: '', icon: '' },
  { title: '作品02', desc: 'ここに作品の紹介文が入ります。どんな作品で、何を担当したかを2〜3行でまとめます。', url: '#', model: '', icon: '' },
  { title: '作品03', desc: 'ここに作品の紹介文が入ります。どんな作品で、何を担当したかを2〜3行でまとめます。', url: '#', model: '', icon: '' },
  { title: '作品04', desc: 'ここに作品の紹介文が入ります。どんな作品で、何を担当したかを2〜3行でまとめます。', url: '#', model: '', icon: '' },
  { title: '作品05', desc: 'ここに作品の紹介文が入ります。どんな作品で、何を担当したかを2〜3行でまとめます。', url: '#', model: '', icon: '' },
  { title: '作品06', desc: 'ここに作品の紹介文が入ります。どんな作品で、何を担当したかを2〜3行でまとめます。', url: '#', model: '', icon: '' },
  { title: '作品07', desc: 'ここに作品の紹介文が入ります。どんな作品で、何を担当したかを2〜3行でまとめます。', url: '#', model: '', icon: '' },
  { title: '作品08', desc: 'ここに作品の紹介文が入ります。どんな作品で、何を担当したかを2〜3行でまとめます。', url: '#', model: '', icon: '' },
  { title: '作品09', desc: 'ここに作品の紹介文が入ります。どんな作品で、何を担当したかを2〜3行でまとめます。', url: '#', model: '', icon: '' },
  { title: '作品10', desc: 'ここに作品の紹介文が入ります。どんな作品で、何を担当したかを2〜3行でまとめます。', url: '#', model: '', icon: '' },
  { title: '作品11', desc: 'ここに作品の紹介文が入ります。どんな作品で、何を担当したかを2〜3行でまとめます。', url: '#', model: '', icon: '' },
  { title: '作品12', desc: 'ここに作品の紹介文が入ります。どんな作品で、何を担当したかを2〜3行でまとめます。', url: '#', model: '', icon: '' },
];

// ===================== 調整用の値 =====================
const COLS = 5;                 // PCの列数（参照元と同じ5列）
const COLS_SP = 3;              // SP（幅640px以下）の列数
const ROWS_VISIBLE = 4;         // 一度に見える行数。これより行が多いと、▲▼が出てスクロールする
const GAP_X = 1.75;             // アイコンの横の間隔
const GAP_Y = 1.55;             // アイコンの縦の間隔
const TILT = 0.7;               // グリッドの床の傾き（ラジアン）。大きいほど上の行が奥へ遠ざかって小さくなる
const ICON_SIZE = 1;            // アイコンの大きさ（どのアイコンも一番長い辺をこの長さにそろえる）
const CUBE_TILT = [0.38, -0.62]; // 立方体アイコンの傾き [上下, 左右]。3つの面が見える角度
const POP_STAGGER = 0.08;       // 登場のとき、アイコンが1つ出るごとの間隔（秒）
const LIGHT_POWER = 1;          // 選択中のライトの強さ（0で消える）
const DETAIL_SPIN = 0.9;        // 詳細画面でアイコンが回る速さ（ラジアン/秒。6.28で1秒に1周）
const DIM = 0.18;               // 詳細画面で、選んでいないアイコンをどこまで薄くするか（0で消える、1でそのまま）
const GRID_BG = ['#8f8f8a', '#5f5e58', '#4a4943', '#1b1a15'];   // 一覧の背景 [左上, 右上, 左下, 右下]
const DETAIL_BG = ['#b8283f', '#2a9c48', '#2b2bc8', '#1a8c6a']; // 詳細画面の背景（作品ごとに bg で変えられる）
// =====================================================

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mqSP = window.matchMedia('(max-width: 640px)'); // works.css の切り替え幅と合わせる
const SPEED = reduceMotion ? 0.4 : 1;                  // 演出の長さの倍率
const TAU = Math.PI * 2;
const N = WORKS.length;
const BLACK = ['#000', '#000', '#000', '#000'];

const $ = (sel) => document.querySelector(sel);
const canvas = $('#scene');
const headEl = $('.head');
const guideEl = $('.guide');
const selTitle = $('#sel-title');
const loadingEl = $('#loading');
const arrowUp = $('#arrow-up');
const arrowDown = $('#arrow-down');
const detailEl = $('#detail');
const detailTitle = $('#detail-title');
const detailDesc = $('#detail-desc');
const goLink = $('#detail-go');
const okBtn = $('#btn-ok');
const backBtn = $('#btn-back');

// GSAPが読み込めなかったときは、アニメーションなしで値だけ切り替える（HOMEと同じしくみ）
const TWEEN_KEYS = ['duration', 'ease', 'delay', 'overwrite', 'onComplete'];
function to(target, vars) {
  if (window.gsap) return window.gsap.to(target, { ...vars, duration: (vars.duration ?? 0.5) * SPEED, delay: (vars.delay ?? 0) * SPEED });
  const v = { ...vars };
  TWEEN_KEYS.forEach((k) => delete v[k]);
  Object.assign(target, v);
  if (vars.onComplete) vars.onComplete();
  return null;
}
function fade(el, on, delay = 0) {
  if (window.gsap) window.gsap.to(el, { opacity: on ? 1 : 0, duration: 0.3 * SPEED, delay: delay * SPEED, overwrite: 'auto' });
  else el.style.opacity = on ? '1' : '0';
}
const wait = (sec) => new Promise((r) => setTimeout(r, sec * 1000 * SPEED));

// HOMEへ戻る。HOMEから来たときは「ブラウザの戻る」と同じ動きにして、履歴を増やさない
const HOME_URL = new URL('../', location.href);
function goHome() {
  let fromHome = false;
  try {
    const ref = new URL(document.referrer);
    fromHome = ref.origin === location.origin && ref.pathname.replace(/index\.html$/, '') === HOME_URL.pathname;
  } catch (err) { /* 直接開いたときは referrer が空 */ }
  if (fromHome && history.length > 1) history.back();
  else location.href = HOME_URL.href;
}

// 作品一覧（ふだんは見えない。Tabキーや読み上げで作品を選べるようにする）
const links = WORKS.map((w) => {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.href = w.url || '#';
  a.textContent = w.title;
  li.append(a);
  $('#work-list').append(li);
  return a;
});
$('#count').textContent = `${N} WORKS`;

let mode = 'boot'; // boot → intro → grid ⇄ (opening → detail → closing)。HOMEへ戻るときは leaving
let sel = 0;

// ===================== 3D（Three.js / WebGL） =====================
async function createView() {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (err) {
    return null;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200); // 画角を広めにして、奥の行ほど小さく見えるようにする

  // ---- 背景：画面いっぱいの板に、4隅の色をなめらかにつないで塗る（PS2の背景と同じしくみ） ----
  const bgU = { tl: { value: new THREE.Color(0, 0, 0) }, tr: { value: new THREE.Color(0, 0, 0) }, bl: { value: new THREE.Color(0, 0, 0) }, br: { value: new THREE.Color(0, 0, 0) } };
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: bgU,
    depthTest: false,
    depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform vec3 tl; uniform vec3 tr; uniform vec3 bl; uniform vec3 br;
      varying vec2 vUv;
      void main() {
        vec3 c = mix(mix(bl, br, vUv.x), mix(tl, tr, vUv.x), vUv.y);
        // ごく小さなノイズを混ぜて、グラデーションの縞（バンディング）を目立たなくする
        c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  bg.frustumCulled = false;
  bg.renderOrder = -1;
  scene.add(bg);
  // 色を4隅それぞれ、なめらかに変える（colors は ['左上', '右上', '左下', '右下']）
  function paintBg(colors, duration) {
    ['tl', 'tr', 'bl', 'br'].forEach((k, n) => {
      const c = new THREE.Color().setStyle(colors[n], THREE.LinearSRGBColorSpace); // 書いた色の値をそのまま使う
      if (window.gsap) window.gsap.killTweensOf(bgU[k].value);
      if (duration > 0) to(bgU[k].value, { r: c.r, g: c.g, b: c.b, duration, ease: 'power1.inOut' });
      else bgU[k].value.copy(c);
    });
  }

  // ---- 光：全体を照らす光と、選択中のアイコンだけを照らすライト ----
  scene.add(new THREE.HemisphereLight(0xffffff, 0x4d4a42, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-2, 4, 6);
  scene.add(sun);
  const lamp = new THREE.PointLight(0xffffff, 0, 3.4, 1);
  scene.add(lamp);

  // 選択中のアイコンの後ろに灯る光（ぼかした白い丸を加算合成で重ねる）
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 128;
  const gctx = glowCanvas.getContext('2d');
  const grd = gctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  [[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,255,250,0.85)'], [0.45, 'rgba(255,250,235,0.28)'], [1, 'rgba(255,250,235,0)']].forEach(([o, c]) => grd.addColorStop(o, c));
  gctx.fillStyle = grd;
  gctx.fillRect(0, 0, 128, 128);
  const glowTex = new THREE.CanvasTexture(glowCanvas);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  scene.add(glow);

  // ---- アイコン ----
  // 仮の立方体に番号を描くので、先にフォントを読み込んでおく（1.5秒待っても来なければそのまま進む）
  if (document.fonts) await Promise.race([document.fonts.load('48px "Press Start 2P"'), wait(1.5)]).catch(() => {});

  const gltfLoader = new GLTFLoader();
  const texLoader = new THREE.TextureLoader();
  const hitGeo = new THREE.BoxGeometry(1.25, 1.25, 1.25);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false }); // クリック判定用の見えない箱

  // どのアイコンも、中心を原点に合わせ、一番長い辺を ICON_SIZE にそろえる
  function fit(obj) {
    const holder = new THREE.Group();
    holder.add(obj);
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return holder;
    const size = box.getSize(new THREE.Vector3());
    obj.position.sub(box.getCenter(new THREE.Vector3()));
    holder.scale.setScalar(ICON_SIZE / Math.max(size.x, size.y, size.z, 1e-6));
    return holder;
  }

  // 仮のアイコン：色付きの面に番号
  function placeholderTexture(i) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const hue = (i * 47 + 200) % 360;
    g.fillStyle = `hsl(${hue}, 50%, 42%)`;
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = `hsl(${hue}, 65%, 72%)`;
    g.lineWidth = 12;
    g.strokeRect(16, 16, 224, 224);
    g.fillStyle = '#fff';
    g.font = '60px "Press Start 2P", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(i + 1).padStart(2, '0'), 132, 136);
    return new THREE.CanvasTexture(c);
  }

  // 3Dアイコンがない作品：平面アイコン（なければ仮の絵）を6面に貼った立方体
  async function makeCube(w, i) {
    let map = null;
    if (w.icon) {
      try { map = await texLoader.loadAsync(ASSET_DIR + w.icon); }
      catch (err) { console.warn(`平面アイコンを読み込めませんでした: ${w.icon}`, err); }
    }
    if (!map) map = placeholderTexture(i);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map, roughness: 0.6, metalness: 0 }));
    cube.rotation.set(CUBE_TILT[0], CUBE_TILT[1], 0);
    return cube;
  }

  async function loadIcon(it) {
    const { w } = it;
    let obj = null;
    if (w.model) {
      try {
        const gltf = await gltfLoader.loadAsync(ASSET_DIR + w.model);
        obj = gltf.scene;
        // glbに入っている動きは、すべてくり返し再生する（毎フレーム mixer.update で進める）
        if (gltf.animations.length) {
          it.mixer = new THREE.AnimationMixer(obj);
          gltf.animations.forEach((clip) => it.mixer.clipAction(clip).play());
        }
      } catch (err) {
        console.warn(`3Dアイコンを読み込めませんでした: ${w.model}`, err);
      }
    }
    if (!obj) obj = await makeCube(w, it.i);
    const holder = fit(obj);
    // 詳細画面でほかのアイコンを薄くするため、素材を半透明にできる設定にしておく
    holder.traverse((o) => {
      if (!o.isMesh) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
        m.transparent = true;
        it.mats.push([m, m.opacity]);
      });
    });
    it.spin.add(holder);
  }

  //  root : 置き場所と大きさ（一覧 ⇄ 詳細で動く） / spin : 詳細画面での回転
  const items = WORKS.map((w, i) => {
    const root = new THREE.Group();
    const spin = new THREE.Group();
    const hit = new THREE.Mesh(hitGeo, hitMat);
    root.add(spin, hit);
    root.visible = false;
    scene.add(root);
    const it = { w, i, root, spin, hit, mats: [], mixer: null, pop: 0, vis: 1, visTarget: 1, dim: -1 };
    it.loaded = loadIcon(it).catch((err) => console.warn(err));
    return it;
  });

  // ---- 配置 ----
  const L = { cols: COLS, rows: ROWS_VISIBLE, sp: false, detail: new THREE.Vector3(), detailScale: 2 };
  const S = { scroll: 0, target: 0 }; // スクロール位置（行単位）。target は行き先
  const D = { t: 0, spin: 0 };        // 詳細画面への移り具合（0 = 一覧、1 = 詳細）と回転の角度
  const G = { on: 0, flash: 1 };      // 選択中のライトの点き具合
  let W = 1, H = 1;
  const v3 = new THREE.Vector3();

  // i番目のアイコンの、一覧での位置。上の行ほど奥（zがマイナス）へ下がる
  function slot(i, out) {
    const c = i % L.cols;
    const r = Math.floor(i / L.cols);
    const ly = ((L.rows - 1) / 2 - (r - S.scroll)) * GAP_Y;
    return out.set((c - (L.cols - 1) / 2) * GAP_X, ly * Math.cos(TILT), -ly * Math.sin(TILT));
  }
  function toScreen(x, y, z) {
    v3.set(x, y, z).project(camera);
    return [((v3.x + 1) / 2) * W, ((1 - v3.y) / 2) * H];
  }

  // 画面の大きさに合わせて、カメラの距離・▲▼の位置・詳細画面でのアイコンの置き場所を決める
  function layout() {
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);
    const aspect = W / H;
    L.sp = mqSP.matches;
    L.cols = L.sp ? COLS_SP : COLS;
    L.rows = Math.min(ROWS_VISIBLE, Math.ceil(N / L.cols)); // 行が少ないときは、ある行だけで画面の中央にそろえる

    // グリッドが画面の横（PC 60% / SP 90%）・縦（PC 64% / SP 56%）に収まる距離までカメラを引く
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const gridW = (L.cols - 1) * GAP_X + ICON_SIZE * 1.4;
    const gridH = ((L.rows - 1) * GAP_Y + ICON_SIZE * 1.4) * Math.cos(TILT);
    const camZ = Math.max(gridW / 2 / ((L.sp ? 0.9 : 0.6) * tan * aspect), gridH / 2 / ((L.sp ? 0.56 : 0.64) * tan));
    camera.aspect = aspect;
    camera.position.set(0, 0, camZ);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    // 詳細画面：PCは左寄せ、SPは上寄せ。カメラに少し近づけて大きく見せる
    const dist = camZ * 0.7;
    const hh = dist * tan;
    const hw = hh * aspect;
    if (L.sp) {
      L.detail.set(0, hh * 0.4, camZ - dist);
      L.detailScale = Math.min(hh * 0.56, hw * 0.9) / ICON_SIZE;
    } else {
      L.detail.set(-hw * 0.46, 0, camZ - dist);
      L.detailScale = Math.min(hh * 0.72, hw * 0.55) / ICON_SIZE;
    }

    // ▲▼は一番上の行の上、一番下の行の下。Loading... はグリッドの中央
    const edge = ((L.rows - 1) / 2 + 0.72) * GAP_Y;
    const [ux, uy] = toScreen(0, edge * Math.cos(TILT), -edge * Math.sin(TILT));
    const [dx, dy] = toScreen(0, -edge * Math.cos(TILT), edge * Math.sin(TILT));
    arrowUp.style.transform = `translate(${ux - 9}px, ${uy - 11}px)`;
    arrowDown.style.transform = `translate(${dx - 9}px, ${dy}px)`;
    loadingEl.style.top = `${toScreen(0, 0, 0)[1]}px`;

    ensureVisible(true);
  }

  // 選択中の行が見える範囲に入るようにスクロールし、範囲外の行のアイコンをしまう
  function ensureVisible(instant = false) {
    const rowsAll = Math.ceil(N / L.cols);
    const r = Math.floor(sel / L.cols);
    let top = S.target;
    if (r < top) top = r;
    else if (r >= top + L.rows) top = r - L.rows + 1;
    top = Math.max(0, Math.min(top, rowsAll - L.rows));
    const changed = top !== S.target;
    S.target = top;
    if (instant) {
      if (window.gsap) window.gsap.killTweensOf(S);
      S.scroll = top;
    } else if (changed) {
      to(S, { scroll: top, duration: 0.45, ease: 'power2.out', overwrite: 'auto' });
    }
    items.forEach((it) => {
      const row = Math.floor(it.i / L.cols);
      const v = row >= top && row < top + L.rows ? 1 : 0;
      if (v === it.visTarget && !instant) return;
      it.visTarget = v;
      if (instant) {
        if (window.gsap) window.gsap.killTweensOf(it, 'vis');
        it.vis = v;
        return;
      }
      // 新しく見える行は、左から順にポンと出す（参照元のスクロールと同じ）
      to(it, { vis: v, duration: v ? 0.35 : 0.22, ease: v ? 'back.out(2)' : 'power2.in', delay: v ? 0.12 + (it.i % L.cols) * 0.06 : 0, overwrite: 'auto' });
    });
    updateArrows();
  }

  function updateArrows() {
    const show = mode === 'grid' || mode === 'intro';
    arrowUp.classList.toggle('is-on', show && S.target > 0);
    arrowDown.classList.toggle('is-on', show && S.target + L.rows < Math.ceil(N / L.cols));
  }

  // 画面上の位置にあるアイコンの番号（なければ -1）
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(x, y) {
    ndc.set((x / W) * 2 - 1, -(y / H) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const targets = items.filter((it) => it.root.visible && it.vis > 0.5).map((it) => it.hit);
    const hit = ray.intersectObjects(targets, false)[0];
    return hit ? items.findIndex((it) => it.hit === hit.object) : -1;
  }

  // ---- 毎フレームの描画 ----
  const pos = new THREE.Vector3();
  const lampAt = new THREE.Vector3();
  let last = performance.now();
  let t = 0;
  function frame(now) {
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
    last = now;
    t += dt;
    if (mode === 'opening' || mode === 'detail') D.spin += dt * DETAIL_SPIN * D.t;

    for (const it of items) {
      slot(it.i, pos);
      let s = it.pop * it.vis;
      if (it.i === sel && D.t > 0) {
        // 選んだアイコンは、一覧の位置から詳細画面の位置へ移りながら大きくなり、回る
        pos.lerp(L.detail, D.t);
        s *= 1 + (L.detailScale - 1) * D.t;
        it.spin.rotation.y = D.spin;
      } else {
        it.spin.rotation.y = 0;
      }
      it.root.position.copy(pos);
      it.root.scale.setScalar(Math.max(s, 1e-4));
      it.root.visible = s > 0.002;
      const dim = it.i === sel ? 1 : 1 - (1 - DIM) * D.t;
      if (dim !== it.dim) {
        it.dim = dim;
        it.mats.forEach(([m, base]) => { m.opacity = base * dim; });
      }
      if (it.mixer) it.mixer.update(dt); // アニメーションは全部のアイコンで常に動かす
    }

    // ライトは選択中のアイコンへすっと移る
    const cur = items[sel].root;
    lampAt.lerp(cur.position, 1 - Math.exp(-dt * 22));
    const power = LIGHT_POWER * G.on * G.flash * (1 - D.t) * (1 + 0.05 * Math.sin(t * 3.2));
    glow.position.set(lampAt.x, lampAt.y - 0.24 * ICON_SIZE, lampAt.z - 0.5 * ICON_SIZE);
    glow.scale.setScalar(ICON_SIZE * 2.1 * Math.min(1, items[sel].pop));
    glow.material.opacity = Math.min(1, 0.85 * power);
    lamp.position.set(lampAt.x, lampAt.y + 0.35 * ICON_SIZE, lampAt.z + 1.0 * ICON_SIZE);
    lamp.intensity = 7 * power;

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  layout();
  window.addEventListener('resize', layout);
  mqSP.addEventListener('change', layout);
  requestAnimationFrame(frame);

  return {
    canvas, items, pick, ensureVisible, updateArrows, layout,
    get cols() { return L.cols; },

    // 登場：背景が明るくなり、Loading... の間にアイコンが左上から1つずつ出る
    async intro() {
      mode = 'intro';
      items.forEach((it) => { it.pop = 0; });
      D.t = 0;
      D.spin = 0;
      G.on = 0;
      detailEl.hidden = true;
      headEl.style.opacity = '0';
      guideEl.style.opacity = '0';
      selTitle.textContent = WORKS[sel].title;
      paintBg(BLACK, 0);
      paintBg(GRID_BG, 0.9);
      fade(headEl, true, 0.3);
      fade(guideEl, true, 0.3);
      ensureVisible(true);
      loadingEl.classList.add('is-on');
      await wait(0.35);
      for (const it of items.filter((x) => x.visTarget === 1)) {
        await Promise.race([it.loaded, wait(4)]); // 読み込みに時間がかかっても4秒で次へ
        if (mode !== 'intro') return;
        to(it, { pop: 1, duration: 0.4, ease: 'back.out(2.2)' });
        if (it.i === sel) to(G, { on: 1, duration: 0.5 });
        await wait(POP_STAGGER);
      }
      items.forEach((it) => { if (it.visTarget === 0) it.pop = 1; }); // 見えていない行は、スクロールで出すときにポンと出る
      loadingEl.classList.remove('is-on');
      to(G, { on: 1, duration: 0.3 });
      mode = 'grid';
      updateArrows();
    },

    // 選択中のライトを一瞬弱めてから戻す（カーソルが移ったことがわかるように）
    flash() {
      G.flash = 0.45;
      to(G, { flash: 1, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
    },

    // 決定：背景が作品の色に変わり、アイコンが左へ移って大きくなり、右に詳細が出る
    open() {
      const w = WORKS[sel];
      paintBg(w.bg || DETAIL_BG, 0.7);
      to(D, { t: 1, duration: 0.8, ease: 'power3.inOut', overwrite: 'auto', onComplete: () => { if (mode === 'opening') mode = 'detail'; } });
    },

    // 戻る：逆の動きで一覧へ。回転はちょうど正面を向くところで止める
    close(done) {
      paintBg(GRID_BG, 0.6);
      to(D, { t: 0, spin: Math.ceil(D.spin / TAU) * TAU, duration: 0.7, ease: 'power3.inOut', overwrite: 'auto', onComplete: () => { D.spin = 0; done(); } });
    },

    // HOMEへ：アイコンを引っ込めて、背景を黒に戻す
    leave() {
      to(G, { on: 0, duration: 0.2, overwrite: 'auto' });
      items.filter((it) => it.root.visible).forEach((it, k) => {
        to(it, { pop: 0, duration: 0.25, ease: 'back.in(2)', delay: k * 0.02, overwrite: 'auto' });
      });
      paintBg(BLACK, 0.6);
    },
  };
}

// ===================== 操作 =====================
let view = null;

function select(i, opts = {}) {
  if (!view || mode !== 'grid' || i < 0 || i >= N) return;
  if (i !== sel) {
    sel = i;
    selTitle.textContent = WORKS[i].title;
    view.ensureVisible();
    view.flash();
  }
  if (opts.focus) links[i].focus({ preventScroll: true });
}

// 行単位で上下に動く（↑↓キー・スワイプ・ホイール）
function moveRows(n) {
  select(Math.max(0, Math.min(N - 1, sel + n * view.cols)), { focus: true });
}

function open() {
  if (mode !== 'grid') return;
  mode = 'opening';
  const w = WORKS[sel];
  detailTitle.textContent = w.title;
  detailDesc.textContent = w.desc;
  goLink.href = w.url || '#';
  view.open();
  view.updateArrows();
  fade(headEl, false);
  detailEl.hidden = false;
  detailEl.style.opacity = '0';
  fade(detailEl, true, 0.45);
  goLink.focus({ preventScroll: true });
}

function close() {
  if (mode !== 'detail' && mode !== 'opening') return;
  mode = 'closing';
  fade(detailEl, false);
  fade(headEl, true, 0.35);
  setTimeout(() => { if (mode !== 'detail' && mode !== 'opening') detailEl.hidden = true; }, 300 * SPEED);
  links[sel].focus({ preventScroll: true });
  view.close(() => { mode = 'grid'; view.updateArrows(); });
}

function leave() {
  if (mode !== 'grid' && mode !== 'intro') return;
  mode = 'leaving';
  loadingEl.classList.remove('is-on');
  view.updateArrows();
  view.leave();
  fade(headEl, false);
  fade(guideEl, false);
  setTimeout(goHome, 650 * SPEED);
}

// ○ 決定
function ok() {
  if (mode === 'grid') open();
  else if (mode === 'detail' || mode === 'opening') goLink.click();
}
// × 戻る：詳細画面なら一覧へ、一覧ならHOMEへ
function back() {
  if (!view) { goHome(); return; }
  if (mode === 'detail' || mode === 'opening') close();
  else leave();
}

okBtn.addEventListener('click', ok);
backBtn.addEventListener('click', back);

function bindInput() {
  const { canvas: cv } = view;

  // マウス：乗せると選択、選択中のアイコンをクリックで決定
  cv.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || mode !== 'grid') return;
    const i = view.pick(e.clientX, e.clientY);
    cv.style.cursor = i >= 0 ? 'pointer' : '';
    if (i >= 0) select(i);
  });

  // タップ：1回目で選択、選択中をもう一度タップで決定。縦にスワイプすると行が動く
  let press = null;
  cv.addEventListener('pointerdown', (e) => { if (e.isPrimary) press = { x: e.clientX, y: e.clientY }; });
  cv.addEventListener('pointercancel', () => { press = null; });
  cv.addEventListener('pointerup', (e) => {
    if (!press || !e.isPrimary) return;
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    press = null;
    if (mode !== 'grid') return;
    if (Math.abs(dy) > 30 && Math.abs(dy) > Math.abs(dx)) {
      moveRows(-Math.sign(dy) * Math.max(1, Math.round(Math.abs(dy) / 80)));
      return;
    }
    if (Math.hypot(dx, dy) > 10) return;
    const i = view.pick(e.clientX, e.clientY);
    if (i < 0) return;
    if (i === sel) open();
    else select(i);
  });

  // マウスホイール：1行ずつ動く
  let wheelLock = 0;
  cv.addEventListener('wheel', (e) => {
    if (mode !== 'grid' || Math.abs(e.deltaY) < 4) return;
    e.preventDefault();
    if (performance.now() < wheelLock) return;
    wheelLock = performance.now() + 160;
    moveRows(Math.sign(e.deltaY));
  }, { passive: false });

  // 見えない作品一覧：Tabで移ると選択、Enterで決定
  links.forEach((a, i) => {
    a.addEventListener('focus', () => select(i));
    a.addEventListener('click', (e) => {
      e.preventDefault();
      if (mode !== 'grid') return;
      select(i);
      open();
    });
  });

  // キーボード：矢印で選択、Enter / Space / O で決定、Esc / Backspace / X で戻る
  document.addEventListener('keydown', (e) => {
    const k = e.key;
    const onControl = e.target instanceof HTMLAnchorElement || e.target instanceof HTMLButtonElement;
    const decideKey = k === 'o' || k === 'O' || ((k === 'Enter' || k === ' ') && !onControl);
    if (k === 'Escape' || k === 'Backspace' || k === 'x' || k === 'X') { e.preventDefault(); back(); return; }
    if (mode === 'grid') {
      if (k === 'ArrowRight') { e.preventDefault(); select(Math.min(N - 1, sel + 1), { focus: true }); }
      else if (k === 'ArrowLeft') { e.preventDefault(); select(Math.max(0, sel - 1), { focus: true }); }
      else if (k === 'ArrowDown') { e.preventDefault(); moveRows(1); }
      else if (k === 'ArrowUp') { e.preventDefault(); moveRows(-1); }
      else if (decideKey) { e.preventDefault(); open(); }
    } else if ((mode === 'detail' || mode === 'opening') && decideKey) {
      e.preventDefault();
      goLink.click();
    }
  });
}

// ===================== 起動 =====================
try {
  view = await createView();
} catch (err) {
  console.warn('3Dを表示できませんでした', err);
}
if (view) {
  bindInput();
  view.intro();
} else {
  // WebGLが使えない環境：作品一覧をそのまま表示して、リンクで各作品へ
  document.documentElement.classList.add('no-webgl');
  canvas.hidden = true;
}

// HOMEへ戻ったあと「ブラウザの進む」で戻ってきたとき、引っ込めたアイコンをもう一度出す
window.addEventListener('pageshow', (e) => {
  if (e.persisted && view && mode === 'leaving') view.intro();
});
