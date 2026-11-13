const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

export function joystickVector(dx, dy, radius, deadzone = .14) {
  const distance = Math.hypot(dx, dy);
  const amount = clamp(distance / radius, 0, 1);
  if (amount <= deadzone) return { x: 0, y: 0 };
  const speed = (amount - deadzone) / (1 - deadzone);
  return { x: dx / distance * speed, y: -dy / distance * speed };
}

export function assistedAim(angle, player, enemies, dt, attacking = false) {
  let nearest, distance = Infinity;
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    const d = Math.hypot(enemy.x - player.x, enemy.z - player.z);
    if (d < distance) { nearest = enemy; distance = d; }
  }
  if (!nearest) return angle;
  const target = Math.atan2(nearest.x - player.x, nearest.z - player.z);
  const error = wrap(target - angle);
  // Continuous soft lock; an attack may correct at most 20 additional degrees.
  const turn = attacking ? Math.PI / 9 : 7 * dt;
  return wrap(angle + clamp(error, -turn, turn));
}

export function createMobileControls({ root, joystick, knob, attack, dodge, onActivity = () => {} }) {
  let stickPointer = null, dodgeQueued = false, enabled = false;
  let movement = { x: 0, y: 0 };
  const attackPointers = new Set(), dodgePointers = new Set();
  function reset() {
    stickPointer = null;
    movement = { x: 0, y: 0 };
    attackPointers.clear(); dodgePointers.clear(); dodgeQueued = false;
    knob.style.transform = 'translate(0px, 0px)';
    attack.classList.remove('pressed'); dodge.classList.remove('pressed');
  }
  function moveStick(event) {
    const rect = joystick.getBoundingClientRect(), radius = rect.width * .34;
    const dx = event.clientX - rect.left - rect.width / 2;
    const dy = event.clientY - rect.top - rect.height / 2;
    movement = joystickVector(dx, dy, radius);
    const scale = Math.min(1, radius / (Math.hypot(dx, dy) || 1));
    knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
  }
  joystick.addEventListener('pointerdown', event => {
    if (!enabled || event.pointerType === 'mouse' && event.button !== 0 || stickPointer !== null) return;
    event.preventDefault(); onActivity();
    stickPointer = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    moveStick(event);
  });
  joystick.addEventListener('pointermove', event => {
    if (event.pointerId !== stickPointer) return;
    event.preventDefault(); moveStick(event);
  });
  const releaseStick = event => {
    if (event.pointerId !== stickPointer) return;
    stickPointer = null; movement = { x: 0, y: 0 };
    knob.style.transform = 'translate(0px, 0px)';
  };
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) joystick.addEventListener(name, releaseStick);
  function bindButton(element, pointers, isDodge) {
    element.addEventListener('pointerdown', event => {
      if (!enabled || event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault(); onActivity();
      pointers.add(event.pointerId); element.setPointerCapture(event.pointerId);
      element.classList.add('pressed');
      if (isDodge) dodgeQueued = true;
    });
    const release = event => {
      pointers.delete(event.pointerId);
      element.classList.toggle('pressed', pointers.size > 0);
    };
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(name, release);
    element.addEventListener('contextmenu', event => event.preventDefault());
  }
  bindButton(attack, attackPointers, false);
  bindButton(dodge, dodgePointers, true);
  root.addEventListener('contextmenu', event => event.preventDefault());
  return {
    reset,
    setEnabled(value) {
      enabled = value;
      root.classList.toggle('hidden', !value);
      attack.disabled = dodge.disabled = !value;
      if (!value) reset();
    },
    get movement() { return movement; },
    get attackHeld() { return attackPointers.size > 0; },
    consumeDodge() { const value = dodgeQueued; dodgeQueued = false; return value; },
  };
}
