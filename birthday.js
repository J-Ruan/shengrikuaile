'use strict';

const byId = id => document.getElementById(id);
const stage = byId('canvas-container');
const wordsLayer = byId('stardust-words');
let scene;
let stardustWords;
const bgm = byId('bgm');
const paletteButton = byId('settings-toggle');
const palettePanel = byId('settings-panel');
const meter = byId('wish-meter');
const surprise = byId('surprise-layer');
const card = byId('flip-card-container');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

let phase = 'intro';
let countdownRemaining = 0;
let digit = 0;
let giftDelay = 0;
let progress = 0;
let holdingSpace = false;
let activePointer = null;
let previousX = 0;
const wishHoldMs = 2000;
let holdStartedAt = null;

function setPaletteOpen(open) {
  palettePanel.hidden = !open;
  paletteButton.setAttribute('aria-expanded', String(open));
}

paletteButton.addEventListener('click', () => setPaletteOpen(palettePanel.hidden));
for (const picker of palettePanel.querySelectorAll('input')) {
  picker.addEventListener('input', () => scene.palette[picker.dataset.layer].set(picker.value));
}

function updateMusicButton() {
  const playing = !bgm.paused;
  const button = byId('music-btn');
  button.setAttribute('aria-pressed', String(playing));
  button.title = playing ? '暂停背景音乐' : '播放背景音乐';
  button.textContent = playing ? '🎵' : '🔇';
}
bgm.addEventListener('play', updateMusicButton);
bgm.addEventListener('pause', updateMusicButton);
byId('music-btn').addEventListener('click', () => {
  if (bgm.paused) bgm.play().catch(updateMusicButton);
  else bgm.pause();
});

byId('start-btn').addEventListener('click', () => {
  if (phase !== 'intro') return;
  phase = 'countdown';
  countdownRemaining = 3.6;
  digit = 3;
  scene.transitionTo('3');
  byId('countdown-label').textContent = '3';
  byId('start-overlay').hidden = true;
  byId('tools').hidden = false;
  paletteButton.hidden = true;
  bgm.volume = 0;
  bgm.play().catch(updateMusicButton);
  stage.focus();
});

function showCake() {
  phase = 'wish';
  scene.transitionTo('cake');
  if (wordsLayer) stardustWords = new StardustWords(scene, wordsLayer);
  const hint = byId('wish-hint');
  if (!scene.mobile) hint.textContent = '按住蛋糕或空格键 2 秒许愿';
  byId('countdown-label').textContent = hint.textContent;
  byId('top-banner').hidden = false;
  byId('wish-controls').hidden = false;
  paletteButton.hidden = false;
  setPaletteOpen(window.innerWidth >= 760);
}

function syncWishHold() {
  if (phase !== 'wish') return;
  if (holdingSpace || activePointer !== null) {
    if (holdStartedAt === null) holdStartedAt = performance.now();
  } else {
    holdStartedAt = null;
    progress = 0;
    meter.value = 0;
  }
}

function advanceWish(now) {
  if (phase !== 'wish' || holdStartedAt === null) return;
  progress = Math.min(1, Math.max(0, (now - holdStartedAt) / wishHoldMs));
  meter.value = progress;
  if (progress === 1) finishWish();
}

function releasePointer() {
  const pointer = activePointer;
  activePointer = null;
  syncWishHold();
  if (scene) scene.dragging = false;
  if (pointer !== null && stage.hasPointerCapture(pointer)) stage.releasePointerCapture(pointer);
}
stage.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0 || activePointer !== null) return;
  if (phase !== 'wish' && phase !== 'free') return;
  activePointer = event.pointerId;
  stage.setPointerCapture(activePointer);
  syncWishHold();
  stage.focus();
  if (phase === 'free') {
    previousX = event.clientX;
    scene.dragging = true;
    scene.rotationVelocity = 0;
  }
});
stage.addEventListener('pointermove', event => {
  if (activePointer !== event.pointerId || !scene.dragging) return;
  if (event.pointerType === 'mouse' && !(event.buttons & 1)) {
    releasePointer();
    return;
  }
  const delta = event.clientX - previousX;
  scene.turn(delta, event.pointerType !== 'mouse');
  previousX = event.clientX;
  if (delta !== 0) byId('rotate-hint').hidden = true;
});
for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  stage.addEventListener(eventName, event => {
    if (activePointer !== event.pointerId) return;
    if (eventName === 'pointerup') advanceWish(performance.now());
    releasePointer();
  });
}
stage.addEventListener('contextmenu', event => event.preventDefault());
// A long press on the cake must not become a tap on the gift that appears under the finger.
stage.addEventListener('touchend', event => event.preventDefault(), { passive: false });

window.addEventListener('keydown', event => {
  if (event.target.closest?.('button, input')) return;
  if (event.code === 'Space' && phase === 'wish') {
    event.preventDefault();
    holdingSpace = true;
    syncWishHold();
  } else if (phase === 'free' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
    event.preventDefault();
    scene.yaw += event.key === 'ArrowLeft' ? -.12 : .12;
    byId('rotate-hint').hidden = true;
  }
});
window.addEventListener('keyup', event => {
  if (event.code !== 'Space' || !holdingSpace) return;
  advanceWish(performance.now());
  holdingSpace = false;
  syncWishHold();
});
function releaseInputs() {
  holdingSpace = false;
  releasePointer();
}
window.addEventListener('blur', releaseInputs);

function finishWish() {
  phase = 'celebration';
  holdingSpace = false;
  holdStartedAt = null;
  setPaletteOpen(false);
  paletteButton.hidden = true;
  byId('wish-controls').hidden = true;
  byId('countdown-label').textContent = '蜡烛吹灭了';
  giftDelay = 1.5;
}

// Reserve the final paragraph layout from the start, so the card stays still as the lines appear.
function prepareLetter() {
  let inkDelay = .42;
  for (const paragraph of byId('letter').querySelectorAll('p')) {
    const words = paragraph.textContent;
    const spoken = document.createElement('span');
    spoken.className = 'visually-hidden';
    spoken.textContent = words;
    const ink = document.createElement('span');
    ink.setAttribute('aria-hidden', 'true');
    for (const character of words) {
      const glyph = document.createElement('span');
      glyph.className = 'letter-ink';
      glyph.textContent = character;
      glyph.style.setProperty('--delay', inkDelay.toFixed(2) + 's');
      inkDelay += .055;
      ink.append(glyph);
    }
    paragraph.textContent = '';
    paragraph.append(spoken, ink);
    inkDelay += .48;
  }
}

function setCardFace(flipped) {
  card.classList.toggle('flipped', flipped);
  byId('card-front').inert = flipped;
  byId('card-front').setAttribute('aria-hidden', String(flipped));
  byId('card-back').inert = !flipped;
  byId('card-back').setAttribute('aria-hidden', String(!flipped));
}

function openCard() {
  phase = 'card';
  if (wordsLayer) wordsLayer.hidden = true;
  releaseInputs();
  setPaletteOpen(false);
  paletteButton.hidden = true;
  byId('rotate-hint').hidden = true;
  byId('floating-gift-btn').hidden = true;
  byId('reveal-btn').hidden = true;
  surprise.hidden = false;
  card.hidden = false;
  setCardFace(false);
  byId('flip-btn').focus();
}
byId('reveal-btn').addEventListener('click', openCard);
byId('floating-gift-btn').addEventListener('click', openCard);
byId('flip-btn').addEventListener('click', () => {
  setCardFace(true);
  byId('close-card-btn').focus();
});
byId('close-card-btn').addEventListener('click', () => {
  phase = 'free';
  surprise.hidden = true;
  card.hidden = true;
  stage.classList.add('free');
  paletteButton.hidden = false;
  byId('rotate-hint').hidden = false;
  byId('floating-gift-btn').hidden = false;
  if (wordsLayer) wordsLayer.hidden = false;
  stage.focus();
});

let lastTick = performance.now();
document.addEventListener('visibilitychange', () => {
  lastTick = performance.now();
  if (!document.hidden) return;
  releaseInputs();
});

function render(now) {
  requestAnimationFrame(render);
  const elapsed = Math.max(0, (now - lastTick) / 1000);
  lastTick = now;
  if (document.hidden) return;
  if (!bgm.paused && bgm.volume < .5) bgm.volume = Math.min(.5, bgm.volume + elapsed * .25);

  if (phase === 'countdown') {
    countdownRemaining -= elapsed;
    const nextDigit = Math.ceil(countdownRemaining / 1.2);
    if (nextDigit <= 0) {
      showCake();
    } else if (digit !== nextDigit) {
      digit = nextDigit;
      scene.transitionTo(String(digit));
      byId('countdown-label').textContent = String(digit);
    }
  } else if (phase === 'wish') {
    advanceWish(now);
  } else if (phase === 'celebration' && surprise.hidden) {
    giftDelay -= elapsed;
    if (giftDelay <= 0) {
      surprise.hidden = false;
      byId('reveal-btn').focus();
    }
  }
  if (phase === 'free') stardustWords?.layout();
  scene.draw(Math.min(elapsed, .1), phase, progress, reducedMotion.matches);
  if (phase === 'free') stardustWords?.draw();
}
// Some mobile attachment viewers display HTML while blocking scripts or canvas.
// Keep the native disclosure usable until the first interactive frame has rendered.
function enableInteractiveStart() {
  const basicCard = byId('basic-card');
  if (basicCard.open) {
    // If the visitor started reading during a slow load, wait until they close the letter.
    basicCard.addEventListener('toggle', enableInteractiveStart, { once: true });
    return;
  }
  try {
    scene = new BirthdayParticles(stage, Boolean(wordsLayer));
    scene.draw(1 / 60, phase, progress, reducedMotion.matches);
    requestAnimationFrame(render);
  } catch (error) {
    console.warn('动画未能启动，可继续阅读贺卡。', error);
    return;
  }
  prepareLetter();
  const cover = byId('birthday-cover');
  if (wordsLayer && !cover.complete) {
    cover.classList.add('loading');
    const showCover = () => cover.classList.remove('loading');
    cover.addEventListener('load', showCover, { once: true });
    cover.addEventListener('error', showCover, { once: true });
  }
  byId('card-front').prepend(cover);
  document.querySelector('.letter-body').append(byId('letter'));
  byId('basic-preview').hidden = true;
  byId('start-btn').hidden = false;
  document.documentElement.classList.add('interactive');
}
enableInteractiveStart();
