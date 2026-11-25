// Adapted from the Three.js particle scene in mnbvcxzz1375/HappyBirthday, revision ecb8da3.
'use strict';

const TAU = 2 * Math.PI;

function circleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, 'white');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function numberShape(digit) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 250;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 120px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(digit, 125, 125);
  const pixels = ctx.getImageData(0, 0, 250, 250).data;
  const points = [];
  for (let y = 0; y < 250; y += 2) {
    for (let x = 0; x < 250; x += 2) {
      if (pixels[(y * 250 + x) * 4 + 3] <= 128) continue;
      points.push({
        position: new THREE.Vector3((x - 125) / 1.75, (125 - y) / 1.75, 0),
        kind: 'text', color: 0xffffff
      });
    }
  }
  return points;
}

function cakeShape(mobile) {
  const points = [];
  function place(radius, angle, height, kind, color, layer) {
    points.push({
      position: new THREE.Vector3(radius * Math.cos(angle), height, radius * Math.sin(angle)),
      kind, color, layer
    });
  }
  const tiers = [
    { y: -16, r: 18, h: 10, layer: 'bottom' },
    { y: -6, r: 13, h: 8, layer: 'top' }
  ];
  for (const tier of tiers) {
    for (let i = 0; i < (mobile ? 800 : 1500); i++) {
      place(tier.r * (.95 + Math.random() * .05), Math.random() * TAU,
        tier.y + Math.random() * tier.h, 'cake', 0xffffff, tier.layer);
    }
    for (let i = 0; i < 500; i++) {
      place(tier.r * Math.random(), Math.random() * TAU, tier.y + tier.h, 'cake', 0xffffff, 'cream');
    }
    for (let i = 0; i < 100; i++) {
      const sugar = new THREE.Color().setHSL(Math.random(), 1, .6);
      place(tier.r + .2, Math.random() * TAU, tier.y + Math.random() * tier.h, 'cake', sugar);
    }
  }
  const candleBase = tiers[1].y + tiers[1].h;
  for (let i = 0; i < 300; i++) {
    const h = Math.random() * 12;
    const angle = Math.random() * TAU;
    const stripe = Math.sin(h * 1.5 + angle) > 0 ? 0xff0000 : 0xffffff;
    place(Math.random() * .8, angle, candleBase + h, 'candle', stripe);
  }
  for (let i = 0; i < 400; i++) {
    const u = Math.random();
    let color = 0xffa500;
    if (u < .2) color = 0x0000ff;
    if (u > .7) color = 0xff4500;
    place((1 - u) * 2 * Math.random(), Math.random() * TAU, candleBase + 12 + u * 7, 'flame', color);
  }
  return points;
}

// The same positions and colors can be projected into a 2D canvas on browsers without WebGL.
class CanvasPointRenderer {
  constructor(container) {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.sprites = new Map();
    container.append(this.canvas);
  }

  resize(width, height) {
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  sprite(r, g, b) {
    const key = r * 256 + g * 16 + b;
    if (this.sprites.has(key)) return this.sprites.get(key);
    const tile = document.createElement('canvas');
    tile.width = tile.height = 16;
    const ctx = tile.getContext('2d');
    const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    const rgb = [r * 17, g * 17, b * 17].join(',');
    gradient.addColorStop(0, 'rgb(' + rgb + ')');
    gradient.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 16, 16);
    this.sprites.set(key, tile);
    return tile;
  }

  render(scene) {
    const { width, height, positions, colors, yaw } = scene;
    const focal = height / (2 * Math.tan(THREE.MathUtils.degToRad(scene.camera.fov / 2)));
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < scene.count; i++) {
      const pos = i * 3, rgba = i * 4;
      const depth = scene.camera.position.z - positions[pos + 2] * cos + positions[pos] * sin;
      if (depth < 1) continue;
      const x = width / 2 + (positions[pos] * cos + positions[pos + 2] * sin) * focal / depth;
      const y = height / 2 - positions[pos + 1] * focal / depth;
      const size = Math.min(48, Math.max(.8, .6 * height / depth));
      if (x < -size || x > width + size || y < -size || y > height + size) continue;
      const sprite = this.sprite(Math.round(colors[rgba] * 15), Math.round(colors[rgba + 1] * 15),
        Math.round(colors[rgba + 2] * 15));
      ctx.globalAlpha = .8 * colors[rgba + 3];
      ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    }
  }
}

class BirthdayParticles {
  constructor(container, withWords = false) {
    this.container = container;
    this.withWords = withWords;
    this.dustLightness = withWords ? .43 : .6;
    this.reducedTimeScale = withWords ? 0 : .18;
    this.mobile = matchMedia('(pointer: coarse)').matches;
    this.count = this.mobile ? 4000 : 7500;
    this.palette = {
      bottom: new THREE.Color('#ff69b4'), top: new THREE.Color('#ffb6c1'), cream: new THREE.Color('#ffffff')
    };
    this.shapes = { cake: cakeShape(this.mobile) };
    for (const digit of ['3', '2', '1']) this.shapes[digit] = numberShape(digit);
    this.time = 0;
    this.yaw = 0;
    this.rotationVelocity = 0;
    this.dragging = false;
    this.target = new THREE.Vector3();
    this.camera = new THREE.PerspectiveCamera(75, 1, .1, 1000);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, .002);
    this.positions = new Float32Array(this.count * 3);
    this.colors = new Float32Array(this.count * 4);
    this.particles = Array.from({ length: this.count }, (_, i) => {
      const current = new THREE.Vector3((Math.random() - .5) * 300,
        (Math.random() - .5) * 300, (Math.random() - .5) * 200);
      const color = this.palette.bottom.clone();
      current.toArray(this.positions, i * 3);
      color.toArray(this.colors, i * 4);
      this.colors[i * 4 + 3] = 1;
      return {
        current, base: current.clone(), color, kind: 'bg', layer: null,
        angle: Math.random() * TAU, radius: 20 + Math.random() * 40,
        orbitSpeed: (Math.random() - .5) * .02, noise: Math.random() * 100
      };
    });
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: !this.mobile, alpha: true, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      this.renderer.setClearColor(0x000000, 0);
      container.append(this.renderer.domElement);
      this.geometry = new THREE.BufferGeometry();
      this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
      this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 4).setUsage(THREE.DynamicDrawUsage));
      const material = new THREE.PointsMaterial({
        size: 1.2, vertexColors: true, map: circleTexture(), transparent: true, opacity: .8,
        depthWrite: false, blending: THREE.AdditiveBlending
      });
      this.cloud = new THREE.Points(this.geometry, material);
      this.cloud.frustumCulled = false;
      this.scene.add(this.cloud);
    } catch {
      this.canvasRenderer = new CanvasPointRenderer(container);
    }
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.camera.aspect = this.width / this.height;
    const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    if (this.withWords) {
      // The final scene keeps the approved cake and sprite scale, independently of the word orbits.
      const focal = this.height / (2 * tanHalfFov);
      const halfWidth = this.width / 2 - Math.min(46, this.width * .12);
      this.camera.position.z = Math.max(62, Math.hypot(26, 26 * focal / halfWidth));
    } else {
      const fitDistance = 22 / (tanHalfFov * this.camera.aspect);
      this.camera.position.z = Math.max(50, Math.hypot(18, fitDistance));
    }
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    if (this.canvasRenderer) this.canvasRenderer.resize(this.width, this.height);
    else this.renderer.setSize(this.width, this.height, false);
  }

  transitionTo(shape) {
    const targets = this.shapes[shape];
    this.particles.forEach((p, i) => {
      const next = targets[i];
      this.colors[i * 4 + 3] = this.withWords && next?.kind === 'flame' ? 0 : 1;
      if (next) {
        p.base.copy(next.position);
        p.kind = next.kind;
        p.layer = next.layer;
        p.color.set(next.color);
        p.current.x += (Math.random() - .5) * 3;
        p.current.y += (Math.random() - .5) * 3;
        p.current.z += (Math.random() - .5) * 3;
      } else {
        const a = Math.random() * TAU;
        const radius = 40 + Math.random() * 40;
        p.base.set(radius * Math.cos(a), (Math.random() - .5) * 60, radius * Math.sin(a));
        p.kind = 'bg';
        p.layer = null;
        p.color.setHex(0x222222);
      }
    });
  }

  turn(delta, isTouch) {
    if (this.withWords) {
      this.yaw += delta * (isTouch ? .012 : .006);
      return;
    }
    this.rotationVelocity = delta * (isTouch ? .015 : .008);
    this.yaw += this.rotationVelocity;
  }

  draw(dt, phase, wishProgress, reducedMotion) {
    const frames = dt * 60;
    this.time += frames * .02 * (reducedMotion ? this.reducedTimeScale : 1);
    const t = this.time;
    const gather = 1 - .92 ** frames;
    const tint = 1 - .9 ** frames;
    const remaining = 1 - wishProgress;
    const flameOpacity = remaining * remaining;
    const afterWish = phase === 'celebration' || phase === 'card' || phase === 'free';
    const orbitAngle = this.withWords ? 0 : t * .1;
    const target = this.target;
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i];
      const fixedFlame = this.withWords && p.kind === 'flame';
      target.copy(p.base);
      if (phase === 'intro') {
        const a = p.angle + t * .05;
        const r = (p.radius + Math.sin(t * .5 + i * .01) * 10) * 3;
        target.x = Math.cos(a) * r;
        target.z = Math.sin(a) * r;
        target.y += Math.sin(t * .5 + target.x * .05) * 20;
        p.color.setHSL(.8 + Math.sin(t * .1 + target.x * .01) * .1, .7, .6);
      } else if (afterWish && p.kind === 'bg') {
        const a = p.angle + orbitAngle + p.orbitSpeed;
        const inCluster = p.clusterPhase !== undefined;
        const r = p.radius + (inCluster ? .4 * Math.sin(t * .6 + p.clusterPhase) : Math.sin(t + i) * 5);
        target.x = Math.cos(a) * r;
        target.z = Math.sin(a) * r;
        target.y += inCluster ? .32 * Math.sin(t + p.clusterPhase) : Math.sin(t + p.noise) * 2;
        p.color.setHSL(.9 + Math.sin(t + i * .01) * .05, .8, inCluster ? .67 : this.dustLightness);
      } else if (p.kind === 'flame' && !this.withWords) {
        target.x += Math.sin(t * 6 + p.noise) * .6;
        if (wishProgress > .1) {
          const lift = afterWish ? 60 : wishProgress * 25;
          target.y += lift;
          target.x += (Math.random() - .5) * lift * .8;
        }
      } else if (afterWish && (p.kind === 'candle' || p.kind === 'cake')) {
        target.y += Math.sin(p.base.x * .5) * .5;
      }
      p.current.lerp(target, gather);
      p.current.toArray(this.positions, i * 3);
      const rgba = i * 4;
      const color = this.palette[p.layer] || p.color;
      const light = p.kind === 'flame' && !fixedFlame ? remaining : 1;
      this.colors[rgba] += (color.r * light - this.colors[rgba]) * tint;
      this.colors[rgba + 1] += (color.g * light - this.colors[rgba + 1]) * tint;
      this.colors[rgba + 2] += (color.b * light - this.colors[rgba + 2]) * tint;
      if (fixedFlame) {
        const alpha = this.colors[rgba + 3];
        this.colors[rgba + 3] = afterWish ? 0 : alpha + (flameOpacity - alpha) * tint;
      }
    }

    if (phase === 'free') {
      if (!this.withWords && !this.dragging) {
        this.rotationVelocity *= .96 ** frames;
        this.yaw += (this.rotationVelocity + (reducedMotion ? 0 : .005)) * frames;
      }
    } else if (phase !== 'card') {
      this.yaw = phase === 'intro' ? 0 : Math.sin(t * .15) * .15;
    }
    if (this.canvasRenderer) {
      this.canvasRenderer.render(this);
    } else {
      this.cloud.rotation.y = this.yaw;
      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.color.needsUpdate = true;
      this.renderer.render(this.scene, this.camera);
    }
  }
}
