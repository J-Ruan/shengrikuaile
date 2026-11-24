'use strict';

// Alternate high and low orbits. Each word follows the same 3D anchor as its motes.
class StardustWords {
  constructor(scene, layer) {
    this.scene = scene;
    this.layer = layer;
    this.point = new THREE.Vector3();
    this.vertical = new THREE.Vector3(0, 1, 0);
    const dust = scene.particles.filter(particle => particle.kind === 'bg');
    const count = layer.childElementCount;
    const perCluster = 7;
    this.labels = Array.from(layer.children, (element, index) => {
      const upper = index % 2 === 1;
      const slots = upper ? Math.floor(count / 2) : Math.ceil(count / 2);
      const slot = Math.floor(index / 2) + (upper ? .4 : 0);
      const angle = Math.PI / 2 + .32 + TAU * slot / slots;
      const variation = Math.sin(index * 2.4);
      const radius = (upper ? 34 : 31.5) + 1.15 * variation;
      const height = (upper ? 13.6 : -20.8) + 1.65 * variation;
      const cluster = dust.slice(index * perCluster, (index + 1) * perCluster);
      const anchor = cluster[0];
      for (let j = 0; j < perCluster; j++) {
        const particle = cluster[j];
        const spread = j === 0 ? 0 : (Math.random() - .5);
        particle.angle = angle + spread * .23;
        particle.radius = radius + (j === 0 ? 0 : (Math.random() - .5) * 1.8);
        particle.base.y = height + (j === 0 ? 0 : (Math.random() - .5) * 1.3);
        particle.orbitSpeed = 0;
        particle.clusterPhase = index * 2;
      }
      return { element, anchor, cluster, height, halfWidth: 0 };
    });
    document.fonts?.ready.then(() => { this.lastWidth = 0; });
  }

  layout() {
    if (this.layer.hidden) return;
    const { width, height, camera } = this.scene;
    if (width === this.lastWidth && height === this.lastHeight) return;
    this.lastWidth = width;
    this.lastHeight = height;
    const banner = document.getElementById('top-banner');
    const gift = document.getElementById('floating-gift-btn');
    const inset = this.labels[0].element.offsetHeight * 1.03 + 17;
    const upperRoom = height / 2 - banner.offsetTop - banner.offsetHeight - inset;
    const lowerRoom = gift.offsetTop - height / 2 - inset;
    const focal = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    for (const label of this.labels) {
      label.halfWidth = label.element.offsetWidth / 2;
      const room = label.height > 0 ? upperRoom : lowerRoom;
      // Fit just this word and its motes at their nearest point to the viewer.
      // The small margins cover their radial and vertical drift.
      const depth = camera.position.z - label.anchor.radius - .4;
      const maxHeight = Math.max(1, room * depth / focal - .4);
      const newHeight = Math.sign(label.height) * Math.min(Math.abs(label.height), maxHeight);
      const shift = newHeight - label.anchor.base.y;
      for (const mote of label.cluster) {
        mote.base.y += shift;
        mote.current.y += shift;
      }
    }
  }

  draw() {
    if (this.layer.hidden) return;
    const { width, height, camera, yaw } = this.scene;
    for (const { element, anchor, halfWidth } of this.labels) {
      this.point.copy(anchor.current).applyAxisAngle(this.vertical, yaw);
      const depth = this.point.z / anchor.radius;
      const visibility = THREE.MathUtils.smoothstep(depth, .68, .96);
      this.point.project(camera);
      const x = (this.point.x + 1) * width / 2;
      const below = anchor.base.y < 0;
      const y = (1 - this.point.y) * height / 2 + (below ? 5 : -7);
      const scale = .75 + .28 * visibility;
      const edgeRoom = Math.min(x, width - x) - halfWidth * scale;
      const edgeFade = THREE.MathUtils.smoothstep(edgeRoom, 3, 20);
      element.style.opacity = String(visibility * edgeFade);
      element.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%, ${below ? '0%' : '-100%'}) scale(${scale})`;
    }
  }
}
