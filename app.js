import { DEVICES, AMBIENT_TEMPERATURE, FREEZE_TEMPERATURE } from "./devices.mjs";
import { createRoomClock, getRoomDateParts, getRoomTimeParts } from "./room-time.mjs";

const $ = (selector) => document.querySelector(selector);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const approach = (value, target, tau, dt) => value + (target - value) * (1 - Math.exp(-dt / tau));

const ui = {
  applianceTabs: $("#applianceTabs"), sceneCanvas: $("#sceneCanvas"), soundMeter: $("#soundMeter"),
  cartoonStage: $("#cartoonStage"), startCurtain: $("#startCurtain"), sceneNumber: $("#sceneNumber"),
  machineStatus: $("#machineStatus"), applianceName: $("#applianceName"), applianceChinese: $("#applianceChinese"),
  applianceCaption: $("#applianceCaption"), powerButton: $("#powerButton"), gearButtons: $("#gearButtons"),
  modeButton: $("#modeButton"), modeLabel: $("#modeLabel"), modeHint: $("#modeHint"),
  volumeRange: $("#volumeRange"), volumeOutput: $("#volumeOutput"), temperatureValue: $("#temperatureValue"),
  temperatureMood: $("#temperatureMood"), mercury: $("#mercury"), thermometerWrap: $("#thermometerWrap"),
  chillFill: $("#chillFill"), chillScore: $("#chillScore"), frostVignette: $("#frostVignette"),
  windReadout: $("#windReadout"), rpmReadout: $("#rpmReadout"), modeReadout: $("#modeReadout"),
  speedOutput: $("#speedOutput"), muteButton: $("#muteButton"), wallCalendar: $("#wallCalendar"),
  calendarWeekday: $("#calendarWeekday"), calendarDay: $("#calendarDay"), calendarMonth: $("#calendarMonth"),
  calendarYear: $("#calendarYear"), wallClock: $("#wallClock"), clockHour: $("#clockHour"),
  clockMinute: $("#clockMinute"), clockSecond: $("#clockSecond"), humidityValue: $("#humidityValue"),
  windDirection: $("#windDirection")
};

const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

const state = {
  deviceIndex: 0,
  powered: false,
  unlocked: false,
  muted: false,
  reducedMotion: reducedMotionQuery.matches,
  gearIndex: 0,
  target: 0,
  level: 0,
  actionLevel: 0,
  rpm: 0,
  rotorAngle: 0,
  flapPhase: 0,
  headPhase: 0,
  mode: false,
  compressorOn: true,
  compressorClock: 0,
  compressorMix: 1,
  manualBurst: 0,
  pointerAim: 0,
  temperature: AMBIENT_TEMPERATURE,
  particles: [],
  particleCarry: 0,
  audioClock: 0,
  lastFrame: performance.now()
};

reducedMotionQuery.addEventListener("change", (event) => {
  state.reducedMotion = event.matches;
  if (event.matches) state.particles.length = 0;
});

const scene = ui.sceneCanvas.getContext("2d");
const meter = ui.soundMeter.getContext("2d");
const grain = Array.from({ length: 260 }, (_, i) => ({
  x: (i * 137.508) % 960,
  y: (i * 73.721) % 600,
  r: .35 + (i % 4) * .18,
  a: .025 + (i % 5) * .008
}));

class CartoonAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.panner = null;
    this.analyser = null;
    this.nodes = null;
    this.waveform = new Uint8Array(512);
  }

  makeNoise(seconds, brown = false) {
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      previous = (previous + .021 * white) / 1.021;
      data[i] = brown ? previous * 3.2 : white;
    }
    return buffer;
  }

  build() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) throw new Error("Web Audio is not supported in this browser");
    this.ctx = new AudioCtx();
    const ctx = this.ctx;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -13;
    limiter.knee.value = 8;
    limiter.ratio.value = 9;
    limiter.attack.value = .005;
    limiter.release.value = .2;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = .78;
    this.waveform = new Uint8Array(this.analyser.fftSize);
    this.master = ctx.createGain();
    this.master.gain.value = Number(ui.volumeRange.value) / 100;
    this.panner = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    const bus = ctx.createGain();
    bus.gain.value = .72;
    bus.connect(this.panner);
    this.panner.connect(this.master);
    this.master.connect(limiter);
    limiter.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    const airSource = ctx.createBufferSource();
    airSource.buffer = this.makeNoise(3.1);
    airSource.loop = true;
    const airHigh = ctx.createBiquadFilter();
    airHigh.type = "highpass";
    airHigh.frequency.value = 75;
    const airLow = ctx.createBiquadFilter();
    airLow.type = "lowpass";
    airLow.Q.value = .65;
    const airGain = ctx.createGain();
    airGain.gain.value = 0;
    airSource.connect(airHigh).connect(airLow).connect(airGain).connect(bus);

    const rumbleSource = ctx.createBufferSource();
    rumbleSource.buffer = this.makeNoise(3.7, true);
    rumbleSource.loop = true;
    const rumbleLow = ctx.createBiquadFilter();
    rumbleLow.type = "lowpass";
    rumbleLow.frequency.value = 115;
    rumbleLow.Q.value = 1.2;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0;
    rumbleSource.connect(rumbleLow).connect(rumbleGain).connect(bus);

    const motor = ctx.createOscillator();
    motor.type = "sine";
    const motorGain = ctx.createGain();
    motorGain.gain.value = 0;
    motor.connect(motorGain).connect(bus);

    const bladeTone = ctx.createOscillator();
    bladeTone.type = "triangle";
    const bladeGain = ctx.createGain();
    bladeGain.gain.value = 0;
    bladeTone.connect(bladeGain).connect(bus);

    const compressor = ctx.createOscillator();
    compressor.type = "sine";
    compressor.frequency.value = 57;
    const compressorGain = ctx.createGain();
    compressorGain.gain.value = 0;
    compressor.connect(compressorGain).connect(bus);

    airSource.start();
    rumbleSource.start();
    motor.start();
    bladeTone.start();
    compressor.start();
    this.nodes = { airLow, airGain, rumbleLow, rumbleGain, motor, motorGain, bladeTone, bladeGain, compressor, compressorGain };
  }

  async unlock() {
    if (!this.ctx) this.build();
    if (this.ctx.state !== "running") await this.ctx.resume();
    return this.ctx.state === "running";
  }

  click(strength = 1) {
    if (!this.ctx || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(270 + strength * 70, now);
    oscillator.frequency.exponentialRampToValueAtTime(82, now + .055);
    gain.gain.setValueAtTime(.055 * strength, now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + .07);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + .075);

    const snap = this.ctx.createBufferSource();
    snap.buffer = this.makeNoise(.025);
    const snapFilter = this.ctx.createBiquadFilter();
    snapFilter.type = "highpass";
    snapFilter.frequency.value = 1800;
    const snapGain = this.ctx.createGain();
    snapGain.gain.setValueAtTime(.035 * strength, now);
    snapGain.gain.exponentialRampToValueAtTime(.0001, now + .026);
    snap.connect(snapFilter).connect(snapGain).connect(this.master);
    snap.start(now);
  }

  setVolume(value) {
    if (this.master) this.master.gain.setTargetAtTime(value, this.ctx.currentTime, .035);
  }

  apply(device, level, windPulse, pan, compressorMix, hot) {
    if (!this.ctx || !this.nodes) return;
    const now = this.ctx.currentTime;
    const n = this.nodes;
    const audible = clamp(level * windPulse, 0, 1.18);
    const motorFrequency = lerp(device.sound.motor[0], device.sound.motor[1], clamp(level, 0, 1)) * (hot ? .91 : 1);
    const bladePass = Math.max(18, state.rpm / 60 * device.blades);
    const filterCutoff = lerp(device.sound.cutoff[0], device.sound.cutoff[1], clamp(audible, 0, 1));

    n.airLow.frequency.setTargetAtTime(filterCutoff, now, .07);
    n.airGain.gain.setTargetAtTime(device.sound.air * Math.pow(audible, 1.25) * .28, now, .075);
    n.rumbleLow.frequency.setTargetAtTime(lerp(72, 142, clamp(level, 0, 1)), now, .1);
    n.rumbleGain.gain.setTargetAtTime(device.sound.rumble * level * .34, now, .12);
    n.motor.frequency.setTargetAtTime(Math.max(20, motorFrequency), now, .075);
    n.motorGain.gain.setTargetAtTime(device.sound.tone * level * .22, now, .08);
    n.bladeTone.frequency.setTargetAtTime(Math.min(9000, bladePass), now, .06);
    n.bladeGain.gain.setTargetAtTime(device.sound.tone * audible * .105, now, .08);
    n.compressor.frequency.setTargetAtTime(57 + level * 7, now, .16);
    n.compressorGain.gain.setTargetAtTime(device.id === "ac" ? .075 * level * compressorMix : 0, now, .2);
    if (this.panner.pan) this.panner.pan.setTargetAtTime(pan, now, .07);
  }

  getWaveform() {
    if (!this.analyser) return null;
    this.analyser.getByteTimeDomainData(this.waveform);
    return this.waveform;
  }
}

const audio = new CartoonAudio();
const currentDevice = () => DEVICES[state.deviceIndex];

function renderRoomTime(value) {
  const date = getRoomDateParts(value);
  const time = getRoomTimeParts(value);
  ui.wallCalendar.dateTime = date.iso;
  ui.calendarWeekday.textContent = date.weekday;
  ui.calendarDay.textContent = date.day;
  ui.calendarMonth.textContent = date.month;
  ui.calendarYear.textContent = date.year;
  ui.wallClock.dateTime = `${date.iso}T${time.hour}:${time.minute}:${time.second}`;
  ui.clockHour.textContent = time.hour;
  ui.clockMinute.textContent = time.minute;
  ui.clockSecond.textContent = `${time.second} SEC`;
}

const roomClock = createRoomClock(renderRoomTime);
roomClock.start();
window.addEventListener("pagehide", () => roomClock.stop());
window.addEventListener("pageshow", () => roomClock.start());

function makeApplianceTabs() {
  ui.applianceTabs.replaceChildren(...DEVICES.map((device, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "appliance-tab";
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(index === state.deviceIndex));
    button.style.setProperty("--device-main", device.palette.main);
    button.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><use href="assets/appliance-icons.svg#${device.icon}"></use></svg><span><b>${device.key} · ${device.short}</b><small>${device.zh}</small></span>`;
    button.addEventListener("click", () => selectDevice(index));
    return button;
  }));
}

function makeGearButtons() {
  const device = currentDevice();
  ui.gearButtons.replaceChildren(...device.gears.map((gear, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gear-button";
    button.textContent = gear.label;
    button.setAttribute("aria-label", `${gear.label}, ${Math.round(gear.level * 100)} percent intensity`);
    button.setAttribute("aria-pressed", String(state.powered && state.gearIndex === index));
    button.addEventListener("click", async () => {
      await ensureAudio();
      audio.click(1 + index * .14);
      state.gearIndex = index;
      state.target = gear.level;
      state.powered = true;
      updateControls();
    });
    return button;
  }));
}

async function ensureAudio() {
  try {
    const running = await audio.unlock();
    state.unlocked = running;
    if (running) ui.startCurtain.classList.add("hidden");
    return running;
  } catch (error) {
    state.unlocked = false;
    ui.startCurtain.querySelector("em").textContent = "This browser could not start Web Audio.";
    return false;
  }
}

function selectDevice(index) {
  state.deviceIndex = index;
  state.gearIndex = 0;
  state.target = state.powered ? currentDevice().gears[0].level : 0;
  state.mode = false;
  state.compressorOn = true;
  state.compressorClock = 0;
  state.manualBurst = 0;
  if (state.unlocked) audio.click(.75);
  applyPalette();
  makeApplianceTabs();
  makeGearButtons();
  updateDeviceCopy();
  updateControls();
}

function applyPalette() {
  const { palette } = currentDevice();
  document.documentElement.style.setProperty("--device-main", palette.main);
  document.documentElement.style.setProperty("--device-trim", palette.trim);
}

function updateDeviceCopy() {
  const device = currentDevice();
  ui.sceneNumber.textContent = `SCENE ${state.deviceIndex + 1}`;
  ui.applianceName.textContent = device.name;
  ui.applianceChinese.textContent = device.zh;
  ui.applianceCaption.textContent = device.caption;
  ui.modeLabel.textContent = device.mode.short;
  ui.modeHint.textContent = device.mode.kind === "manual" ? "CLICK!" : device.mode.kind === "heat" ? "COLD / HOT" : "PULL";
}

function updateControls() {
  const device = currentDevice();
  ui.powerButton.setAttribute("aria-pressed", String(state.powered));
  ui.powerButton.querySelector("b").textContent = state.powered ? "ON" : "OFF";
  ui.powerButton.setAttribute("aria-label", state.powered ? "Turn appliance off" : "Turn appliance on");
  ui.modeButton.setAttribute("aria-pressed", String(state.mode));
  [...ui.gearButtons.children].forEach((button, index) => button.setAttribute("aria-pressed", String(state.powered && index === state.gearIndex)));
  ui.speedOutput.textContent = state.powered ? device.gears[state.gearIndex].label : `GEAR ${state.gearIndex + 1} · READY`;
  ui.muteButton.setAttribute("aria-pressed", String(state.muted));
  ui.muteButton.querySelector("b").textContent = state.muted ? "SOUND OFF" : "MUTE";
  updateMachineStatus();
}

function updateMachineStatus() {
  const device = currentDevice();
  const starting = state.powered && state.level < state.target - .07;
  const stopping = !state.powered && state.level > .025;
  const message = starting
    ? "WARMING UP..."
    : stopping
      ? "COASTING TO A STOP..."
      : state.powered
        ? device.id === "dryer" && state.mode ? "HOT BLAST—AT YOU!" : "BREEZE COMING AT YOU!"
        : "TAKING A NAP";
  if (ui.machineStatus.textContent !== message) ui.machineStatus.textContent = message;
  ui.cartoonStage.setAttribute("aria-label", `${device.name}. ${message}. ${device.gears[state.gearIndex].label}.`);
}

async function togglePower() {
  await ensureAudio();
  audio.click(1.15);
  state.powered = !state.powered;
  state.target = state.powered ? currentDevice().gears[state.gearIndex].level : 0;
  updateControls();
}

function triggerMode() {
  const device = currentDevice();
  if (state.unlocked) audio.click(.92);
  if (device.mode.kind === "manual") {
    state.manualBurst = Math.min(1.2, state.manualBurst + .72);
    ui.modeButton.setAttribute("aria-pressed", "true");
    window.setTimeout(() => ui.modeButton.setAttribute("aria-pressed", "false"), 170);
    spawnHandFanBurst();
    return;
  }
  state.mode = !state.mode;
  updateControls();
}

function effectiveWind(time) {
  const device = currentDevice();
  if (device.id === "handfan") {
    const pulse = .34 + .66 * Math.pow(Math.max(0, Math.sin(state.flapPhase)), 2.5);
    return clamp(state.level * pulse + state.manualBurst, 0, 1.25);
  }
  if (device.id === "ac") return clamp(state.level * (.78 + .22 * state.compressorMix), 0, 1.05);
  return state.level;
}

function coolingEffect(wind) {
  const device = currentDevice();
  let effect = device.cooling * wind;
  if (device.mode.kind === "dry" && state.mode) effect *= 1.18;
  if (device.mode.kind === "heat" && state.mode) effect = -Math.max(4, device.cooling * 1.65) * wind;
  return effect;
}

function step(dt, time) {
  const device = currentDevice();
  const desired = state.powered ? state.target : 0;
  state.level = approach(state.level, desired, desired > state.level ? .58 : 1.25, dt);
  state.manualBurst = approach(state.manualBurst, 0, .34, dt);
  const motionScale = state.reducedMotion ? .12 : 1;
  state.flapPhase += dt * lerp(2.1, 7.2, state.level) * motionScale;
  state.headPhase += dt * lerp(.62, 1.05, state.level) * motionScale;
  const wind = effectiveWind(time);
  state.actionLevel = approach(state.actionLevel, wind, .06, dt);

  const rpmTarget = wind < .001 ? 0 : lerp(device.rpm[0] * .28, device.rpm[1], clamp(wind, 0, 1));
  state.rpm = approach(state.rpm, rpmTarget, state.powered ? .42 : 1.4, dt);
  state.rotorAngle += state.rpm / 60 * Math.PI * 2 * dt * motionScale;

  if (device.compressor && state.level > .02) {
    state.compressorClock += dt;
    const phaseLength = state.compressorOn ? device.compressor.on : device.compressor.off;
    if (state.compressorClock >= phaseLength) {
      state.compressorClock = 0;
      state.compressorOn = !state.compressorOn;
    }
    state.compressorMix = approach(state.compressorMix, state.compressorOn ? 1 : .12, .72, dt);
  } else {
    state.compressorClock = 0;
    state.compressorOn = true;
    state.compressorMix = approach(state.compressorMix, 1, .45, dt);
  }

  const effect = coolingEffect(wind);
  state.temperature -= effect * .044 * dt;
  state.temperature += (AMBIENT_TEMPERATURE - state.temperature) * .0032 * dt;
  state.temperature = clamp(state.temperature, 13.5, AMBIENT_TEMPERATURE + 7);

  updateParticles(dt, time, wind);
  state.audioClock += dt;
  if (state.audioClock > .045) {
    state.audioClock = 0;
    const pan = device.mode.kind === "oscillate" && state.mode ? Math.sin(state.headPhase) * .72 : 0;
    const pulse = device.id === "handfan" ? clamp(.18 + wind * 1.1, .18, 1.2) : 1;
    audio.apply(device, state.level, pulse, pan, state.compressorMix, device.mode.kind === "heat" && state.mode);
  }
}

function emit(kind, x, y, vx, vy, life, size = 1) {
  if (state.particles.length > 330) return;
  state.particles.push({ kind, x, y, vx, vy, life, age: 0, size, phase: Math.random() * Math.PI * 2, spin: (Math.random() - .5) * 5 });
}

function emitToward(kind, x, y, wind, spread = 1) {
  if (state.particles.length > 330) return;
  const angle = Math.random() * Math.PI * 2;
  const speed = (58 + Math.random() * 76) * spread;
  state.particles.push({
    kind,
    x: x + Math.cos(angle) * Math.random() * 18,
    y: y + Math.sin(angle) * Math.random() * 13,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed * .64,
    life: .58 + Math.random() * .54,
    age: 0,
    size: .28 + Math.random() * .34,
    phase: angle,
    spin: (Math.random() - .5) * 2,
    toward: true,
    wind
  });
}

function spawnHandFanBurst() {
  for (let i = 0; i < 10; i++) emitToward(i % 3 ? "leaf" : "sweat", 475, 292, 1.2, 1.45);
}

function updateParticles(dt, time, wind) {
  const device = currentDevice();
  if (state.reducedMotion) {
    state.particles.length = 0;
    state.particleCarry = 0;
    return;
  }
  state.particleCarry += wind * 36 * dt;
  while (state.particleCarry >= 1) {
    state.particleCarry -= 1;
    if (device.id === "fan") emitToward("wind", 463 + (state.mode ? Math.sin(state.headPhase) * 55 : 0), 285, wind);
    if (device.id === "ac") emitToward(Math.random() < .55 ? "fog" : "wind", 395, 282, wind, .9);
    if (device.id === "dryer") emitToward(state.mode ? (Math.random() < .28 ? "spark" : "hotwind") : (Math.random() < .26 ? "snow" : "wind"), 540, 280, wind, 1.12);
    if (device.id === "handfan") emitToward("wind", 470, 290, wind, 1.05);
  }
  if (device.id === "ac" && state.level > .2 && Math.random() < dt * state.level * 2.2) emit("drop", 535 + Math.random() * 70, 408, (Math.random() - .5) * 12, 65 + Math.random() * 45, 1.1, .8);
  for (const particle of state.particles) {
    particle.age += dt;
    const depth = particle.toward ? 1 + Math.pow(particle.age / particle.life, 1.7) * 4.5 : 1;
    particle.x += particle.vx * depth * dt;
    particle.y += particle.vy * depth * dt;
    if (particle.toward) particle.size += dt * (1.2 + particle.wind * 2.1);
    if (!particle.toward && ["leaf", "sweat", "drop", "spark", "snow"].includes(particle.kind)) particle.vy += 55 * dt;
    particle.phase += particle.spin * dt;
  }
  state.particles = state.particles.filter((particle) => particle.age < particle.life && particle.x > -80 && particle.x < 1060 && particle.y > -80 && particle.y < 680);
}

function resetCanvas(ctx, canvas) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function ink(ctx, width = 6) {
  ctx.strokeStyle = "#30241f";
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function paintedShape(ctx, fill, width = 6) {
  ctx.fillStyle = fill;
  ink(ctx, width);
  ctx.fill();
  ctx.stroke();
}

function drawRoom(ctx, device, time) {
  const coolAmount = clamp((AMBIENT_TEMPERATURE - state.temperature) / 18, 0, 1);
  const hot = device.id === "dryer" && state.mode && state.actionLevel > .05;
  const wall = hot ? "#e8a07d" : lerpColor("#b9d5c7", "#cbe4df", coolAmount);
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, 960, 455);
  ctx.fillStyle = "rgba(255,244,204,.21)";
  for (let x = -40; x < 1000; x += 74) {
    ctx.beginPath();
    for (let y = 0; y <= 455; y += 34) ctx.lineTo(x + Math.sin(y * .035) * 7, y);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(70,87,70,.12)";
    ctx.stroke();
  }
  ctx.fillStyle = "#b97a51";
  ctx.fillRect(0, 455, 960, 145);
  ctx.fillStyle = "#e4c889";
  ctx.fillRect(0, 438, 960, 21);
  ink(ctx, 5); ctx.beginPath(); ctx.moveTo(0, 455); ctx.lineTo(960, 455); ctx.stroke();
  ctx.strokeStyle = "rgba(76,45,30,.2)"; ctx.lineWidth = 3;
  for (let x = -50; x < 1050; x += 95) { ctx.beginPath(); ctx.moveTo(x, 600); ctx.lineTo(x + 58, 455); ctx.stroke(); }

  ctx.save(); ctx.translate(105, 110); ctx.rotate(-.02);
  ctx.fillStyle = "#f0dfb4"; ink(ctx, 5); ctx.beginPath(); ctx.roundRect(-45, -58, 160, 150, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#7eb3c1"; ctx.fillRect(-26, -39, 122, 112); ctx.strokeRect(-26, -39, 122, 112);
  ctx.strokeStyle = "#30241f"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(35, -39); ctx.lineTo(35, 73); ctx.moveTo(-26, 17); ctx.lineTo(96, 17); ctx.stroke();
  ctx.fillStyle = "rgba(255,244,204,.55)"; ctx.beginPath(); ctx.arc(15, -2, 18, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.fillStyle = "rgba(73,45,30,.16)";
  ctx.beginPath(); ctx.ellipse(485, 490, 245 + state.actionLevel * 18, 31 - state.actionLevel * 3, 0, 0, Math.PI * 2); ctx.fill();
  for (const dot of grain) { ctx.globalAlpha = dot.a; ctx.fillStyle = dot.x % 2 ? "#3d2a22" : "#fff7da"; ctx.beginPath(); ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
}

function lerpColor(a, b, t) {
  const pa = a.match(/\w\w/g).map((x) => parseInt(x, 16));
  const pb = b.match(/\w\w/g).map((x) => parseInt(x, 16));
  return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(",")})`;
}

function drawRotor(ctx, device, radius, blades, blur = false) {
  ctx.save();
  ctx.rotate(state.rotorAngle);
  if (blur && state.actionLevel > .58) {
    ctx.strokeStyle = `${device.palette.main}77`;
    ctx.lineWidth = 18 + state.actionLevel * 11;
    ctx.setLineDash([42, 16]);
    ctx.beginPath(); ctx.arc(0, 0, radius * .77, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
  for (let index = 0; index < blades; index++) {
    ctx.save(); ctx.rotate(index / blades * Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(7, -5);
    ctx.bezierCurveTo(radius * .25, -radius * .35, radius * .85, -radius * .28, radius * .88, -radius * .05);
    ctx.bezierCurveTo(radius * .78, radius * .14, radius * .28, radius * .17, 8, 7);
    ctx.closePath(); paintedShape(ctx, device.palette.main, 4); ctx.restore();
  }
  ctx.beginPath(); ctx.arc(0, 0, Math.max(8, radius * .13), 0, Math.PI * 2); paintedShape(ctx, device.palette.trim, 4);
  ctx.restore();
}

function drawFan(ctx, device, time) {
  const high = Math.max(0, state.actionLevel - .55);
  const shake = high * high * 12;
  const headSweep = state.mode ? Math.sin(state.headPhase) * 55 : 0;
  ctx.save();
  ctx.translate(463 + headSweep + Math.sin(time * 39) * shake, 285 + Math.cos(time * 33) * shake * .28);
  ctx.scale(1 + Math.sin(time * 20) * high * .028, 1 - Math.sin(time * 20) * high * .022);

  ctx.beginPath(); ctx.roundRect(-13, 118, 26, 146, 10); paintedShape(ctx, "#d8b76f", 6);
  ctx.beginPath(); ctx.ellipse(0, 269, 118, 29, 0, 0, Math.PI * 2); paintedShape(ctx, "#c89a55", 7);
  ctx.fillStyle = "#e9c879"; ctx.beginPath(); ctx.ellipse(-18, 261, 55, 9, -.08, 0, Math.PI * 2); ctx.fill();

  ctx.save(); ctx.translate(0, 0);
  ctx.beginPath(); ctx.arc(0, 0, 137, 0, Math.PI * 2); paintedShape(ctx, device.palette.pale, 8);
  drawRotor(ctx, device, 108, device.blades, true);
  ink(ctx, 3); ctx.strokeStyle = "rgba(48,36,31,.65)";
  for (let r = 36; r <= 124; r += 22) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); }
  for (let i = 0; i < 16; i++) { ctx.save(); ctx.rotate(i / 16 * Math.PI * 2); ctx.beginPath(); ctx.moveTo(23, 0); ctx.lineTo(130, 0); ctx.stroke(); ctx.restore(); }
  ctx.beginPath(); ctx.arc(0, 0, 137, 0, Math.PI * 2); ink(ctx, 8); ctx.stroke();
  ctx.restore();

  const pinY = state.mode ? -166 : -145;
  ctx.beginPath(); ctx.roundRect(-10, pinY, 20, 37, 8); paintedShape(ctx, "#d5a83e", 5);
  ctx.beginPath(); ctx.ellipse(0, pinY, 19, 10, 0, 0, Math.PI * 2); paintedShape(ctx, "#e7c461", 4);

  // The ribbon grows wider as it drops toward the bottom edge: a foreshortened cue that the air is coming out of the screen.
  const ribbonWave = state.actionLevel * 15;
  const ribbonSwing = Math.sin(time * 8.5) * ribbonWave;
  ctx.beginPath(); ctx.arc(122, -57, 10, 0, Math.PI * 2); paintedShape(ctx, device.palette.trim, 4);
  ctx.beginPath();
  ctx.moveTo(127, -61);
  ctx.bezierCurveTo(151 + ribbonSwing, -44, 126 - ribbonSwing * .35, -6, 158 + ribbonSwing * .6, 24);
  ctx.bezierCurveTo(187 - ribbonSwing * .45, 55, 168 + ribbonSwing, 85, 201 + ribbonSwing * .6, 119);
  ctx.lineTo(182 + ribbonSwing * .5, 137);
  ctx.lineTo(165 + ribbonSwing * .42, 111);
  ctx.bezierCurveTo(141 + ribbonSwing * .55, 79, 157 - ribbonSwing * .4, 54, 137 + ribbonSwing * .45, 34);
  ctx.bezierCurveTo(111 - ribbonSwing * .35, 6, 137 + ribbonSwing * .35, -31, 118, -49);
  ctx.closePath(); paintedShape(ctx, device.palette.trim, 5);
  ctx.fillStyle = "rgba(255,236,190,.24)"; ctx.beginPath(); ctx.ellipse(170 + ribbonSwing * .45, 81, 7, 30, -.52, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawAC(ctx, device, time) {
  const shake = state.level * state.compressorMix * 3.5;
  ctx.save(); ctx.translate(485 + Math.sin(time * 31) * shake, 280 + Math.cos(time * 27) * shake * .35);
  ctx.beginPath(); ctx.roundRect(-275, -150, 550, 300, 30); paintedShape(ctx, device.palette.main, 9);
  ctx.beginPath(); ctx.roundRect(-244, -116, 308, 218, 15); paintedShape(ctx, "#6f8378", 6);
  ctx.fillStyle = "#d8dcc0"; ctx.strokeStyle = "#30241f"; ctx.lineWidth = 3;
  for (let y = -94; y <= 80; y += 18) { for (let x = -222; x <= 38; x += 25) { ctx.beginPath(); ctx.roundRect(x, y, 15, 6, 3); ctx.fill(); ctx.stroke(); } }
  ctx.beginPath(); ctx.roundRect(92, -112, 148, 205, 17); paintedShape(ctx, device.palette.pale, 6);
  ctx.beginPath(); ctx.arc(139, -63, 28, 0, Math.PI * 2); paintedShape(ctx, "#e7bd61", 5);
  ctx.beginPath(); ctx.arc(197, -63, 28, 0, Math.PI * 2); paintedShape(ctx, "#e7bd61", 5);
  ink(ctx, 4); ctx.beginPath(); ctx.moveTo(139, -63); ctx.lineTo(151, -77); ctx.moveTo(197, -63); ctx.lineTo(186, -79); ctx.stroke();
  ctx.fillStyle = state.mode ? "#79ad6e" : "#5a483b"; ink(ctx, 3); ctx.beginPath(); ctx.arc(143, 38, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = state.compressorMix > .5 ? "#d95745" : "#745c4a"; ctx.beginPath(); ctx.arc(194, 38, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  const louverAngle = Math.sin(state.headPhase * 1.4) * (state.level * .24);
  ctx.save(); ctx.translate(-90, 123); ctx.rotate(louverAngle); ink(ctx, 5);
  for (let x = -145; x <= 145; x += 42) { ctx.beginPath(); ctx.moveTo(x, -14); ctx.lineTo(x + 17, 18); ctx.stroke(); }
  ctx.restore();
  ctx.restore();
}

function drawDryer(ctx, device, time) {
  const high = Math.max(0, state.actionLevel - .58);
  const shake = high * 9;
  ctx.save(); ctx.translate(455 + Math.sin(time * 46) * shake, 280 + Math.cos(time * 39) * shake * .3); ctx.rotate(-.035);
  // The body recedes to the left while the oversized nozzle points out of the screen.
  ctx.beginPath(); ctx.moveTo(-205, -71); ctx.quadraticCurveTo(-128, -113, 37, -91); ctx.lineTo(91, -61); ctx.lineTo(91, 61); ctx.lineTo(37, 91); ctx.quadraticCurveTo(-128, 113, -205, 71); ctx.closePath(); paintedShape(ctx, device.palette.main, 8);
  ctx.beginPath(); ctx.ellipse(-181, 0, 43, 56, 0, 0, Math.PI * 2); paintedShape(ctx, device.palette.pale, 6);
  ink(ctx, 3); for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(-198 + i * 7, -33); ctx.lineTo(-186 + i * 7, 34); ctx.stroke(); }

  ctx.beginPath(); ctx.moveTo(-43, 72); ctx.lineTo(18, 76); ctx.lineTo(1, 242); ctx.quadraticCurveTo(-28, 267, -62, 237); ctx.closePath(); paintedShape(ctx, "#d1a359", 8);
  ctx.beginPath(); ctx.roundRect(-39, 111, 35, 48, 13); paintedShape(ctx, state.mode ? "#e76b43" : "#7eb6c0", 4);
  ctx.beginPath(); ctx.moveTo(-28, 242); ctx.bezierCurveTo(-4, 286, 76, 266, 101, 307); ink(ctx, 6); ctx.stroke();

  if (state.level > .05) {
    ctx.globalAlpha = state.mode ? .28 + state.actionLevel * .18 : .13;
    ctx.fillStyle = state.mode ? "#ed7449" : "#d9f3ee";
    ctx.beginPath(); ctx.ellipse(86, 0, 111 + state.actionLevel * 24, 136 + state.actionLevel * 22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.beginPath(); ctx.ellipse(86, 0, 104, 127, 0, 0, Math.PI * 2); paintedShape(ctx, device.palette.trim, 9);
  ctx.beginPath(); ctx.ellipse(86, 0, 72, 91, 0, 0, Math.PI * 2); paintedShape(ctx, "#40372f", 6);
  const tunnel = ctx.createRadialGradient(72, -19, 4, 86, 0, 72);
  tunnel.addColorStop(0, state.mode ? "#f69b64" : "#e8fbf6");
  tunnel.addColorStop(.55, state.mode ? "#b6473b" : "#7eb7c0");
  tunnel.addColorStop(1, "#342923");
  ctx.fillStyle = tunnel; ctx.beginPath(); ctx.ellipse(86, 0, 59, 76, 0, 0, Math.PI * 2); ctx.fill();
  ink(ctx, 3); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,230,.28)"; ctx.beginPath(); ctx.ellipse(65, -27, 20, 36, -.3, 0, Math.PI * 2); ctx.fill();
  if (state.level > .05) {
    ctx.fillStyle = "#f7e8ba"; ctx.font = "italic 900 19px Georgia"; ctx.textAlign = "center";
    ctx.fillText(state.mode ? "HOT!" : "B-R-R-R!", 86, 7);
  }
  ctx.restore();
}

function drawHandFan(ctx, device, time) {
  const automatic = Math.sin(state.flapPhase) * lerp(.18, .72, state.level);
  const aim = state.pointerAim * .32;
  const burst = Math.sin(state.manualBurst * Math.PI) * .55;
  ctx.save(); ctx.translate(455, 340); ctx.rotate(-.18 + automatic + aim + burst);
  ctx.beginPath();
  ctx.moveTo(-18, 70);
  ctx.bezierCurveTo(-185, -28, -198, -215, -43, -247);
  ctx.bezierCurveTo(42, -265, 126, -206, 112, -118);
  ctx.bezierCurveTo(103, -60, 50, 14, 18, 72);
  ctx.closePath(); paintedShape(ctx, device.palette.main, 9);
  ctx.fillStyle = "rgba(255,239,175,.18)"; ctx.beginPath(); ctx.ellipse(-55, -125, 83, 121, -.4, 0, Math.PI * 2); ctx.fill();
  ink(ctx, 4); ctx.strokeStyle = "#5f6e45";
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(0, 63); ctx.quadraticCurveTo(i * 34, -90, i * 25 - 28, -218); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0, 62); ctx.lineTo(-55, 230); paintedShape(ctx, "#d19b4e", 8);
  ctx.beginPath(); ctx.roundRect(-70, 207, 42, 87, 18); paintedShape(ctx, "#c4843d", 7);
  ctx.restore();
  if (state.actionLevel > .65) {
    ctx.fillStyle = "#30241f"; ctx.font = "italic 900 22px Georgia";
    ctx.save(); ctx.translate(650, 175); ctx.rotate(-.08); ctx.fillText("FLAP!", 0, 0); ctx.restore();
  }
}

function drawParticles(ctx) {
  for (const p of state.particles) {
    const alpha = Math.max(0, 1 - p.age / p.life);
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(p.x, p.y); ctx.rotate(p.phase); ctx.scale(p.size, p.size);
    if (["wind", "hotwind"].includes(p.kind)) {
      ctx.beginPath(); ctx.moveTo(-30, 0); ctx.bezierCurveTo(-12, -9, 10, 8, 34, 0); ctx.lineCap = "round";
      ctx.strokeStyle = "#30241f"; ctx.lineWidth = 7; ctx.stroke();
      ctx.strokeStyle = p.kind === "hotwind" ? "#f4a26e" : "#f7f2d7"; ctx.lineWidth = 4; ctx.stroke();
    } else if (p.kind === "fog") {
      ctx.fillStyle = "rgba(246,252,238,.82)"; ink(ctx, 2); ctx.beginPath(); ctx.arc(-9, 2, 12, 0, Math.PI * 2); ctx.arc(4, -5, 17, 0, Math.PI * 2); ctx.arc(20, 3, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (p.kind === "spark") {
      ctx.fillStyle = "#f1b642"; ink(ctx, 3); ctx.beginPath(); ctx.moveTo(0,-10); ctx.lineTo(3,-3); ctx.lineTo(11,0); ctx.lineTo(3,3); ctx.lineTo(0,11); ctx.lineTo(-3,3); ctx.lineTo(-10,0); ctx.lineTo(-3,-3); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (p.kind === "snow") {
      ctx.strokeStyle = "#eefcf7"; ctx.lineWidth = 4; for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(-9,0); ctx.lineTo(9,0); ctx.stroke(); }
    } else if (p.kind === "drop" || p.kind === "sweat") {
      ctx.fillStyle = "#70bfd0"; ink(ctx, 3); ctx.beginPath(); ctx.moveTo(0,-12); ctx.bezierCurveTo(12,2,8,13,0,14); ctx.bezierCurveTo(-8,13,-12,2,0,-12); ctx.fill(); ctx.stroke();
    } else if (p.kind === "leaf") {
      ctx.fillStyle = p.x % 2 > 1 ? "#7ca267" : "#d59b4a"; ink(ctx, 3); ctx.beginPath(); ctx.moveTo(-13,0); ctx.quadraticCurveTo(0,-12,14,0); ctx.quadraticCurveTo(0,12,-13,0); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
}

function airSource(device) {
  if (device.id === "fan") return { x: 463 + (state.mode ? Math.sin(state.headPhase) * 55 : 0), y: 285, oval: .78 };
  if (device.id === "ac") return { x: 395, y: 282, oval: .58 };
  if (device.id === "dryer") return { x: 540, y: 280, oval: 1.18 };
  return { x: 470, y: 290, oval: .72 };
}

function drawTowardViewerGust(ctx, device, time) {
  const wind = state.actionLevel;
  if (wind < .025 || state.reducedMotion) return;
  const source = airSource(device);
  const hot = device.id === "dryer" && state.mode;
  const color = hot ? "244,142,91" : "244,248,224";
  const cycles = 5;

  // Broken expanding rings read as air travelling along the camera axis, not across the room.
  for (let index = 0; index < cycles; index++) {
    const progress = (time * (.42 + wind * .48) + index / cycles) % 1;
    const eased = progress * progress;
    const radius = 24 + eased * (330 + wind * 150);
    const alpha = Math.sin(progress * Math.PI) * (.08 + wind * .22);
    ctx.save();
    ctx.translate(source.x, source.y);
    ctx.scale(1, source.oval + eased * .22);
    ctx.rotate(Math.sin(time * 1.7 + index) * .035);
    ctx.setLineDash([42 + index * 7, 19 + index * 3]);
    ctx.lineDashOffset = -time * (34 + wind * 64);
    ctx.strokeStyle = `rgba(48,36,31,${alpha * .72})`;
    ctx.lineWidth = 9 + eased * 10;
    ctx.beginPath(); ctx.arc(0, 0, radius, -.86, 3.95); ctx.stroke();
    ctx.strokeStyle = `rgba(${color},${alpha})`;
    ctx.lineWidth = 5 + eased * 8;
    ctx.stroke();
    ctx.restore();
  }

  // Radial speed strokes flare into the foreground and make the browser edge feel like the destination.
  const rayCount = 13;
  for (let index = 0; index < rayCount; index++) {
    const angle = index / rayCount * Math.PI * 2 + Math.sin(index * 9.2) * .08;
    const progress = (time * (.65 + wind * .75) + index * .137) % 1;
    const near = 46 + progress * progress * 385;
    const far = near + 30 + progress * 82;
    const squash = .68;
    ctx.beginPath();
    ctx.moveTo(source.x + Math.cos(angle) * near, source.y + Math.sin(angle) * near * squash);
    ctx.quadraticCurveTo(
      source.x + Math.cos(angle + .025) * (near + far) * .52,
      source.y + Math.sin(angle + .025) * (near + far) * .52 * squash,
      source.x + Math.cos(angle) * far,
      source.y + Math.sin(angle) * far * squash
    );
    ctx.lineCap = "round";
    ctx.strokeStyle = `rgba(48,36,31,${(.04 + wind * .13) * (1 - progress * .42)})`;
    ctx.lineWidth = 7 + progress * 10;
    ctx.stroke();
    ctx.strokeStyle = `rgba(${color},${(.08 + wind * .28) * (1 - progress * .42)})`;
    ctx.lineWidth = 3 + progress * 7;
    ctx.stroke();
  }

  if (wind > .34) {
    const pop = clamp((wind - .34) * 2.2, 0, 1);
    ctx.save();
    ctx.translate(785, 82); ctx.rotate(-.08);
    ctx.globalAlpha = pop * (.76 + Math.sin(time * 7) * .08);
    ctx.fillStyle = hot ? "#d94f43" : "#f5e5a9";
    ctx.strokeStyle = "#30241f"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.roundRect(-125, -29, 250, 58, 18); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#30241f"; ctx.font = "italic 900 23px Georgia"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(hot ? "HOT BLAST—AT YOU!" : "WHOOSH—AT YOU!", 0, 1);
    ctx.restore();
  }
}

function drawScene(time) {
  resetCanvas(scene, ui.sceneCanvas);
  const device = currentDevice();
  drawRoom(scene, device, time);
  const high = Math.max(0, state.actionLevel - .68);
  scene.save();
  scene.translate(480, 300);
  scene.scale(1 + Math.sin(time * 19) * high * .012, 1 - Math.sin(time * 19) * high * .009);
  scene.translate(-480, -300);
  ({ fan: drawFan, ac: drawAC, dryer: drawDryer, handfan: drawHandFan })[device.renderer](scene, device, time);
  scene.restore();
  drawParticles(scene);
  drawTowardViewerGust(scene, device, time);
}

function drawSoundMeter(time) {
  resetCanvas(meter, ui.soundMeter);
  meter.fillStyle = "#ecd6a3"; meter.fillRect(0, 0, 320, 105);
  ink(meter, 3); meter.beginPath(); meter.moveTo(22, 78); meter.quadraticCurveTo(160, -35, 298, 78); meter.stroke();
  meter.fillStyle = "#30241f"; meter.font = "900 10px Georgia"; meter.textAlign = "center"; meter.fillText("RACKET-O-METER", 160, 96);
  for (let i = 0; i <= 8; i++) {
    const angle = lerp(Math.PI * .84, Math.PI * .16, i / 8);
    const x1 = 160 + Math.cos(angle) * 112, y1 = 82 - Math.sin(angle) * 77;
    const x2 = 160 + Math.cos(angle) * 101, y2 = 82 - Math.sin(angle) * 69;
    meter.beginPath(); meter.moveTo(x1,y1); meter.lineTo(x2,y2); meter.lineWidth = i % 2 ? 2 : 4; meter.stroke();
  }
  const wave = audio.getWaveform();
  let amplitude = state.actionLevel * .72;
  if (wave) {
    let sum = 0;
    for (let i = 0; i < wave.length; i += 8) { const v = (wave[i] - 128) / 128; sum += v * v; }
    amplitude = clamp(Math.sqrt(sum / (wave.length / 8)) * 3.8, 0, 1);
  }
  const needleAngle = lerp(Math.PI * .82, Math.PI * .18, amplitude);
  meter.save(); meter.translate(160,82); meter.rotate(-needleAngle + Math.PI / 2); meter.fillStyle = "#d94f43"; ink(meter, 3); meter.beginPath(); meter.moveTo(-5,4); meter.lineTo(0,-76); meter.lineTo(5,4); meter.closePath(); meter.fill(); meter.stroke(); meter.restore();
  meter.beginPath(); meter.arc(160,82,10,0,Math.PI*2); paintedShape(meter,"#e0a94a",3);
}

function updateFeedback() {
  const chill = clamp((AMBIENT_TEMPERATURE - state.temperature) / (AMBIENT_TEMPERATURE - FREEZE_TEMPERATURE), 0, 1);
  const drop = chill * 88;
  ui.temperatureValue.textContent = state.temperature.toFixed(1);
  ui.mercury.style.setProperty("--mercury-drop", `${drop}%`);
  ui.chillFill.style.width = `${Math.round(chill * 100)}%`;
  ui.chillScore.textContent = `${Math.round(chill * 100)}%`;
  ui.frostVignette.style.opacity = String(clamp((chill - .18) * 1.45, 0, .78));
  document.documentElement.style.setProperty("--body-top", lerpColor("#f3cb83", "#b8e0df", chill));
  document.documentElement.style.setProperty("--body-bottom", lerpColor("#e6b76e", "#82bac1", chill));
  ui.thermometerWrap.classList.toggle("frozen", state.temperature < 21);
  ui.thermometerWrap.classList.toggle("cracked", state.temperature < 17.2);
  ui.temperatureMood.textContent = state.temperature > 37 ? "TOO DARN HOT!" : state.temperature > 32 ? "A LITTLE BETTER" : state.temperature > 26 ? "NICE & BREEZY" : state.temperature > 20 ? "BRRRR..." : "FROZEN SOLID!";

  const device = currentDevice();
  const drying = device.mode.kind === "dry" && state.mode;
  const heating = device.mode.kind === "heat" && state.mode;
  const simulatedHumidity = Math.round(clamp(54 - state.actionLevel * 13 - (drying ? 9 : 0) + (heating ? 6 : 0), 28, 68));
  const windAngle = device.mode.kind === "oscillate" && state.mode ? Math.sin(state.headPhase) * 24 : device.id === "handfan" ? state.pointerAim * 22 : 0;
  ui.humidityValue.textContent = `${simulatedHumidity}%`;
  ui.windDirection.setAttribute("aria-label", `Virtual wind aimed ${Math.abs(windAngle) < 5 ? "at you" : windAngle < 0 ? "slightly left" : "slightly right"}`);
  document.documentElement.style.setProperty("--airflow", state.actionLevel.toFixed(3));
  document.documentElement.style.setProperty("--wind-angle", `${windAngle.toFixed(1)}deg`);
  document.documentElement.classList.toggle("appliance-running", state.powered && state.level > .025);
  ui.windReadout.textContent = `${(state.actionLevel * (2.1 + device.cooling * .57)).toFixed(1)} m/s`;
  ui.rpmReadout.textContent = device.id === "handfan" ? `${Math.round(state.rpm)} flaps/min` : `${Math.round(state.rpm).toLocaleString()} rpm`;
  if (!state.powered && state.level < .02) ui.modeReadout.textContent = "standby";
  else if (device.mode.kind === "heat") ui.modeReadout.textContent = state.mode ? "hot & sparky" : "cold & icy";
  else if (device.mode.kind === "oscillate") ui.modeReadout.textContent = state.mode ? "swinging" : "straight ahead";
  else if (device.mode.kind === "dry") ui.modeReadout.textContent = state.mode ? "drying" : state.compressorOn ? "compressor on" : "compressor resting";
  else ui.modeReadout.textContent = state.manualBurst > .05 ? "extra flap!" : "auto flapping";
  updateMachineStatus();
}

ui.startCurtain.addEventListener("click", async () => {
  if (await ensureAudio()) {
    audio.click(1.25);
    state.powered = true;
    state.gearIndex = 1;
    state.target = currentDevice().gears[1].level;
    makeGearButtons();
    updateControls();
  }
});
ui.powerButton.addEventListener("click", togglePower);
ui.modeButton.addEventListener("click", triggerMode);
ui.muteButton.addEventListener("click", async () => {
  await ensureAudio();
  state.muted = !state.muted;
  audio.setVolume(state.muted ? 0 : Number(ui.volumeRange.value) / 100);
  updateControls();
});
ui.volumeRange.addEventListener("input", (event) => {
  const value = Number(event.target.value);
  ui.volumeOutput.value = value;
  ui.volumeOutput.textContent = value;
  state.muted = value === 0;
  audio.setVolume(state.muted ? 0 : value / 100);
  updateControls();
});
ui.sceneCanvas.addEventListener("pointermove", (event) => {
  if (currentDevice().id !== "handfan") return;
  const box = ui.sceneCanvas.getBoundingClientRect();
  state.pointerAim = clamp(((event.clientX - box.left) / box.width - .5) * 2, -1, 1);
});
ui.sceneCanvas.addEventListener("pointerdown", () => {
  if (currentDevice().id === "handfan") triggerMode();
});

window.addEventListener("keydown", async (event) => {
  if (event.target instanceof HTMLInputElement) return;
  if (event.code === "Space" && event.target instanceof HTMLButtonElement) return;
  const deviceIndex = DEVICES.findIndex((device) => device.key === event.key);
  if (deviceIndex >= 0) selectDevice(deviceIndex);
  if (event.code === "Space") { event.preventDefault(); await togglePower(); }
  if (event.key.toLowerCase() === "m") triggerMode();
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    await ensureAudio();
    const direction = event.key === "ArrowUp" ? 1 : -1;
    state.gearIndex = clamp(state.gearIndex + direction, 0, currentDevice().gears.length - 1);
    state.powered = true;
    state.target = currentDevice().gears[state.gearIndex].level;
    audio.click(1 + state.gearIndex * .13);
    makeGearButtons(); updateControls();
  }
});

function animate(now) {
  const frameDt = Math.min(.05, (now - state.lastFrame) / 1000);
  state.lastFrame = now;
  let remaining = frameDt;
  while (remaining > 0) {
    const dt = Math.min(1 / 120, remaining);
    step(dt, now / 1000);
    remaining -= dt;
  }
  drawScene(now / 1000);
  drawSoundMeter(now / 1000);
  updateFeedback();
  requestAnimationFrame(animate);
}

applyPalette();
makeApplianceTabs();
makeGearButtons();
updateDeviceCopy();
updateControls();
requestAnimationFrame(animate);
