/* Gold Exchange — WebGL layer
   A field of gold dust that streams toward the viewer as you scroll, plus
   ingots, coins and nuggets that tumble through the hero and fly past the
   camera as the hero scrolls away. Exposes window.__gx for app.js. */
(function () {
if (!window.THREE) { window.__gx = { setHero(){}, setVelocity(){}, intro(){}, setInvest(){}, spinBar(){}, ready:false }; document.body.classList.add('no-gl'); return; }
const canvas = document.getElementById('gl');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = matchMedia('(max-width: 900px)').matches;

const api = { setHero(){}, setVelocity(){}, intro(){}, setInvest(){}, spinBar(){}, ready:false };
window.__gx = api;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  canvas.remove();
  document.body.classList.add('no-gl');
}

if (renderer && !reduce) {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isMobile ? 1.25 : 1.5));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.physicallyCorrectLights = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);
  camera.position.set(0, 0, 12);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;

  // ---------- lights ----------
  const key = new THREE.DirectionalLight(0xfff1cf, 2.2); key.position.set(6, 9, 7); scene.add(key);
  const rim = new THREE.PointLight(0xF7A51C, 60, 60, 1.6); rim.position.set(-9, -4, 3); scene.add(rim);
  const fill = new THREE.PointLight(0x4F7CC9, 40, 70, 1.6); fill.position.set(8, -7, -6); scene.add(fill);
  scene.add(new THREE.AmbientLight(0x1F2A44, 0.6));

  // ---------- gold material ----------
  const gold = new THREE.MeshPhysicalMaterial({
    color: 0xE8A126, metalness: 1, roughness: 0.2, clearcoat: 0.45, clearcoatRoughness: 0.18,
    envMapIntensity: 1.5, transparent: true, opacity: 1,
  });
  const goldRough = gold.clone(); goldRough.roughness = 0.42; goldRough.color.set(0xD9951F);

  // ---------- geometries ----------
  function ingotGeo(w = 2.1, h = 0.62, d = 0.95) {
    const s = new THREE.Shape();
    const t = 0.82; // top is narrower than base
    s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo((w / 2) * t, h / 2); s.lineTo((-w / 2) * t, h / 2); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3, steps: 1 });
    g.center();
    return g;
  }
  function coinGeo(r = 0.95) {
    const body = new THREE.CylinderGeometry(r, r, 0.13, 72, 1);
    body.rotateX(Math.PI / 2);
    return body;
  }
  function rimGeo(r = 0.95) { return new THREE.TorusGeometry(r - 0.02, 0.055, 16, 96); }
  function nuggetGeo(r = 0.62) {
    const g = new THREE.IcosahedronGeometry(r, 3);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = Math.sin(v.x * 4.1) * Math.cos(v.y * 3.3) * 0.5 + Math.sin(v.z * 5.2 + v.x * 2.0) * 0.5;
      v.multiplyScalar(1 + n * 0.22 + (Math.random() - 0.5) * 0.04);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }

  // ---------- hero objects ----------
  const heroGroup = new THREE.Group(); scene.add(heroGroup);
  const defs = isMobile ? [
    { kind: 'ingot', pos: [1.7, 5.0, -2], s: 0.9 },
    { kind: 'coin', pos: [-1.7, 5.4, -3], s: 0.85 },
    { kind: 'nugget', pos: [3.2, 4.2, -9], s: 0.7 },
    { kind: 'coin', pos: [-3.4, 2.6, -7], s: 1.0 },
    { kind: 'ingot', pos: [3.2, -2.6, -5], s: 0.9 },
  ] : [
    { kind: 'ingot', pos: [6.2, 1.6, -1], s: 1.25 },
    { kind: 'coin', pos: [-6.4, 4.6, -3], s: 1.0 },
    { kind: 'nugget', pos: [7.4, -0.6, -0.5], s: 0.8 },
    { kind: 'coin', pos: [8.6, 2.8, -4], s: 1.3 },
    { kind: 'ingot', pos: [3.6, 5.2, -6], s: 1.1 },
    { kind: 'nugget', pos: [7.2, 5.0, -6], s: 1.0 },
    { kind: 'coin', pos: [-2.2, 5.6, -7.5], s: 1.2 },
    { kind: 'ingot', pos: [1.2, 4.9, -4.5], s: 0.8 },
    { kind: 'nugget', pos: [-8.8, 0.6, -2.5], s: 0.55 },
  ];
  const objs = defs.map((d, i) => {
    let mesh;
    // each object gets its own material so it can fade independently as it flies past the camera
    if (d.kind === 'ingot') mesh = new THREE.Mesh(ingotGeo(), gold.clone());
    else if (d.kind === 'coin') {
      mesh = new THREE.Group();
      mesh.add(new THREE.Mesh(coinGeo(), gold.clone()));
      const r = new THREE.Mesh(rimGeo(), goldRough.clone()); mesh.add(r);
    } else mesh = new THREE.Mesh(nuggetGeo(), goldRough.clone());
    mesh.position.set(...d.pos);
    mesh.scale.setScalar(0.0001);
    mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    heroGroup.add(mesh);
    return {
      mesh, base: new THREE.Vector3(...d.pos), s: d.s,
      spin: new THREE.Vector3((Math.random() - .5) * .5, (Math.random() - .5) * .6, (Math.random() - .5) * .3),
      phase: Math.random() * Math.PI * 2, fly: 14 + i * 1.6 + Math.random() * 3,
    };
  });

  // ---------- investment bar: a large ingot pinned to the Invest section box, spinnable ----------
  const bar = new THREE.Mesh(ingotGeo(2.4, 0.72, 1.15), gold.clone());
  bar.visible = false; scene.add(bar);
  const barState = { on: false, rect: null, vel: 0 };
  bar.rotation.set(0.35, 0.6, 0.08);
  api.setInvest = (on, rect) => { barState.on = on; if (rect) barState.rect = rect; };
  api.spinBar = (dx) => { barState.vel += dx * 0.01; };

  // ---------- gold dust ----------
  const COUNT = isMobile ? 600 : 2000;
  const pos = new Float32Array(COUNT * 3);
  const aSize = new Float32Array(COUNT);
  const aPhase = new Float32Array(COUNT);
  const aTint = new Float32Array(COUNT);
  const spread = { x: 26, y: 15, zNear: 10, zFar: -75 };
  function resetParticle(i, randomZ) {
    pos[i * 3] = (Math.random() - .5) * spread.x * 2;
    pos[i * 3 + 1] = (Math.random() - .5) * spread.y * 2;
    pos[i * 3 + 2] = randomZ ? spread.zFar + Math.random() * (spread.zNear - spread.zFar) : spread.zFar + Math.random() * 6;
    aSize[i] = 0.5 + Math.pow(Math.random(), 2.2) * 2.6;
    aPhase[i] = Math.random() * Math.PI * 2;
    aTint[i] = Math.random();
  }
  for (let i = 0; i < COUNT; i++) resetParticle(i, true);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
  pGeo.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));
  pGeo.setAttribute('aTint', new THREE.BufferAttribute(aTint, 1));
  const pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPR: { value: renderer.getPixelRatio() }, uWarp: { value: 0 }, uFade: { value: 1 } },
    vertexShader: `
      attribute float aSize; attribute float aPhase; attribute float aTint;
      uniform float uTime; uniform float uPR; uniform float uWarp;
      varying float vA; varying float vT;
      void main(){
        vec3 p = position;
        p.x += sin(uTime*0.35 + aPhase)*0.45;
        p.y += cos(uTime*0.28 + aPhase*1.7)*0.45;
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        float d = -mv.z;
        gl_PointSize = aSize * uPR * (150.0 / max(d, 0.5)) * (1.0 + uWarp*0.9);
        float tw = 0.6 + 0.4*sin(uTime*2.2 + aPhase*9.0);
        vA = tw * smoothstep(85.0, 35.0, d) * smoothstep(0.2, 4.0, d);
        vT = aTint;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      precision highp float;
      varying float vA; varying float vT; uniform float uFade;
      void main(){
        vec2 uv = gl_PointCoord - 0.5; float r = length(uv);
        if (r > 0.5) discard;
        float a = pow(smoothstep(0.5, 0.0, r), 1.7);
        vec3 warm = vec3(1.0, 0.86, 0.5);
        vec3 gold = vec3(0.97, 0.65, 0.11);
        vec3 deep = vec3(0.78, 0.46, 0.06);
        vec3 col = mix(gold, warm, vT);
        col = mix(deep, col, smoothstep(0.5, 0.1, r));
        col += vec3(1.0, 0.96, 0.85) * smoothstep(0.16, 0.0, r) * 0.7;
        gl_FragColor = vec4(col, a * vA * uFade);
      }`,
  });
  const dust = new THREE.Points(pGeo, pMat);
  scene.add(dust);

  // ---------- state ----------
  const st = { hero: 0, warp: 0, warpTarget: 0, mx: 0, my: 0, smx: 0, smy: 0, intro: 0, t: 0, visible: true };
  const clock = new THREE.Clock();

  api.setHero = (p) => { st.hero = Math.max(0, Math.min(1, p)); };
  api.setVelocity = (v) => { st.warpTarget = Math.min(2.2, Math.abs(v) / 28); };
  api.intro = () => {
    if (window.gsap) {
      objs.forEach((o, i) => window.gsap.to(o.mesh.scale, { x: o.s, y: o.s, z: o.s, duration: 1.6, ease: 'expo.out', delay: 0.15 + i * 0.07 }));
      window.gsap.to(st, { intro: 1, duration: 2, ease: 'power2.out' });
    } else { objs.forEach(o => o.mesh.scale.setScalar(o.s)); st.intro = 1; }
  };
  api.ready = true;

  addEventListener('pointermove', (e) => {
    st.mx = (e.clientX / innerWidth) * 2 - 1;
    st.my = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
  });
  document.addEventListener('visibilitychange', () => { st.visible = !document.hidden; if (st.visible) clock.getDelta(); });

  const smooth = (a, b, k) => a + (b - a) * k;
  function frame() {
    requestAnimationFrame(frame);
    if (!st.visible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    st.t += dt;
    st.warp = smooth(st.warp, st.warpTarget, 0.08);
    st.warpTarget *= 0.9; // decay if app stops reporting
    st.smx = smooth(st.smx, st.mx, 0.05); st.smy = smooth(st.smy, st.my, 0.05);

    // camera drift with the pointer
    camera.position.x = st.smx * 0.9; camera.position.y = -st.smy * 0.6;
    camera.lookAt(0, 0, 0);

    // dust streams toward the viewer; faster when the page scrolls fast
    const speed = (2.2 + st.warp * 26 + st.hero * 10) * dt;
    for (let i = 0; i < COUNT; i++) {
      let z = pos[i * 3 + 2] + speed * (0.6 + aSize[i] * 0.3);
      if (z > spread.zNear) { resetParticle(i, false); z = pos[i * 3 + 2]; }
      pos[i * 3 + 2] = z;
    }
    pGeo.attributes.position.needsUpdate = true;
    pMat.uniforms.uTime.value = st.t;
    pMat.uniforms.uWarp.value = st.warp;
    pMat.uniforms.uFade.value = st.intro;

    // hero objects: float, tumble, then fly past the camera as the hero scrolls out
    const h = st.hero;
    heroGroup.visible = h < 0.999;
    if (heroGroup.visible) {
      heroGroup.rotation.y = st.smx * 0.08; heroGroup.rotation.x = st.smy * 0.05;
      const e = h * h * (3 - 2 * h);
      objs.forEach((o) => {
        const m = o.mesh;
        m.rotation.x += (o.spin.x + h * 2.5) * dt; m.rotation.y += (o.spin.y + h * 2.0) * dt; m.rotation.z += o.spin.z * dt;
        m.position.x = o.base.x + Math.sin(st.t * 0.6 + o.phase) * 0.25 + o.base.x * e * 0.35;
        m.position.y = o.base.y + Math.cos(st.t * 0.5 + o.phase) * 0.3 + o.base.y * e * 0.25;
        m.position.z = o.base.z + e * o.fly;
        const past = THREE.MathUtils.smoothstep(m.position.z, 8.5, 11.8);
        const op = 1 - past;
        m.traverse((c) => { if (c.isMesh) c.material.opacity = op; });
      });
    }

    // investment bar follows its DOM box (projected onto the z=0 plane)
    if (barState.on && barState.rect) {
      const r = barState.rect;
      const visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const visW = visH * camera.aspect;
      const cx = (r.left + r.width / 2) / innerWidth, cy = (r.top + r.height / 2) / innerHeight;
      bar.position.set(camera.position.x + (cx * 2 - 1) * visW / 2, camera.position.y - (cy * 2 - 1) * visH / 2, 0);
      const boxW = (r.width / innerWidth) * visW;
      const sc = Math.max(0.2, (boxW * 0.78) / 2.4);
      bar.scale.setScalar(sc);
      bar.rotation.y += 0.28 * dt + barState.vel; barState.vel *= 0.93;
      bar.rotation.x = 0.35 + Math.sin(st.t * 0.6) * 0.14;
      bar.visible = r.bottom > 0 && r.top < innerHeight;
    } else bar.visible = false;

    renderer.render(scene, camera);
  }
  frame();
} else {
  // Reduced motion or no WebGL: keep the gradient background only.
  api.ready = false;
  if (canvas.isConnected) canvas.style.display = 'none';
}
})();
