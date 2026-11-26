'use strict';

class StardustNotes extends StardustWords {
  constructor(scene, layer, message) {
    super(scene, layer);
    this.message = message;
    this.openButton = null;
    this.motionScale = 1;
    this.notes = [];
    for (const { element, anchor } of this.labels) {
      const button = element.querySelector('.note-word');
      if (!button) continue;
      this.notes.push({ element, anchor, button });
      // A keyboard visitor can reach either note, even on the far side of the cake.
      button.addEventListener('focus', () => this.faceWord(anchor));
      button.addEventListener('click', event => {
        // Pointer taps are resolved on release so a swipe across a word still turns the cake.
        if (event.detail === 0) this.activate(button);
      });
    }
  }

  faceWord(anchor) {
    this.scene.yaw = Math.atan2(-anchor.current.x, anchor.current.z);
    this.scene.rotationVelocity = 0;
    this.draw();
  }

  activate(button) {
    if (!button && !this.openButton) return;
    this.openButton?.setAttribute('aria-expanded', 'false');
    this.openButton = button === this.openButton ? null : button;
    if (this.openButton) {
      this.openButton.setAttribute('aria-expanded', 'true');
      this.message.textContent = this.openButton.dataset.note;
      document.getElementById('rotate-hint').hidden = true;
    }
    this.message.setAttribute('aria-hidden', String(!this.openButton));
  }

  frameDuration(seconds) {
    // Slow the whole scene clock together so words stay attached to their pink motes.
    const target = this.openButton ? .18 : 1;
    this.motionScale += (target - this.motionScale) * (1 - Math.exp(-6 * seconds));
    if (!this.openButton && this.layer.contains(document.activeElement)) return 0;
    return seconds * this.motionScale;
  }

  draw() {
    super.draw();
    for (const { element, button } of this.notes) {
      button.classList.toggle('in-front', Number(element.style.opacity) >= .48);
    }
  }
}
