// DUCK SEQUENCER — Motor de áudio (Web Audio API)
// Todos os sons são sintetizados em tempo real, sem samples externos.

class DuckAudio {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.lookahead = 25; // ms
    this.scheduleAheadTime = 0.1; // s
    this.nextNoteTime = 0;
    this.currentStep = 0;
    this.isPlaying = false;
    this.timerId = null;
    this.masterVolume = 0.8;
    this.onStep = null; // callback (stepIndex) => void
    this.channelMuted = Array(8).fill(false);
    this.channelSolo = Array(8).fill(false);
    this.channelVolume = Array(8).fill(0.85);
    this.bassNotes = Array(64).fill(null); // nota por step
    this.bassOctave = 3;
    this.samples = {}; // chIdx -> AudioBuffer
  }

  async loadSample(chIdx, file) {
    this.init();
    const arrayBuffer = await file.arrayBuffer();
    const buf = await this.ctx.decodeAudioData(arrayBuffer);
    this.samples[chIdx] = buf;
    return buf;
  }

  clearSample(chIdx) {
    delete this.samples[chIdx];
  }

  hasSample(chIdx) {
    return !!this.samples[chIdx];
  }

  playSampleBuffer(buf, vol = 0.85) {
    const t = this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    src.connect(g); g.connect(this.masterGain);
    src.start(t); src.stop(t + 1.3);
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.masterVolume;
    this.masterGain.connect(this.ctx.destination);
  }

  resume() {
    this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMasterVolume(v) {
    this.masterVolume = v;
    if (this.masterGain) this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  now() { return this.ctx ? this.ctx.currentTime : 0; }

  // ===== PLAYBACK SCHEDULER =====
  start(tempo, swing, stepCount, grid, getActiveChannel) {
    this.resume();
    this.isPlaying = true;
    this.currentStep = 0;
    this.nextNoteTime = this.now() + 0.05;

    const secPerBeat = 60 / tempo;
    // grid: array de canais, cada um array de steps
    this.timerId = setInterval(() => {
      while (this.nextNoteTime < this.now() + this.scheduleAheadTime) {
        this.scheduleStep(this.currentStep, secPerBeat, swing, stepCount, grid, getActiveChannel);
        let stepDur = secPerBeat / 4; // 16th notes
        if (swing > 0 && (this.currentStep % 2 === 1)) {
          stepDur += (swing / 100) * secPerBeat * 0.35;
        }
        this.nextNoteTime += stepDur;
        this.currentStep = (this.currentStep + 1) % stepCount;
      }
    }, this.lookahead);
  }

  scheduleStep(step, secPerBeat, swing, stepCount, grid, getActiveChannel) {
    if (this.onStep) this.onStep(step);
    grid.forEach((channelSteps, chIdx) => {
      if (!getActiveChannel(chIdx)) return;
      if (channelSteps[step]) {
        this.triggerChannel(chIdx, this.channelVolume[chIdx]);
      }
      if (chIdx === 7 && this.bassNotes[step] !== null) {
        this.triggerBass(this.bassNotes[step], this.bassOctave, this.channelVolume[chIdx]);
      }
    });
  }

  stop() {
    this.isPlaying = false;
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = null;
  }

  setSoloChannel(chIdx, solo) {
    this.channelSolo[chIdx] = solo;
  }
  getActiveChannel(chIdx) {
    const anySolo = this.channelSolo.some(Boolean);
    if (anySolo) return this.channelSolo[chIdx];
    return !this.channelMuted[chIdx];
  }

  // ===== CHANNEL TRIGGERS =====
  triggerChannel(chIdx, vol = 0.85) {
    if (this.samples[chIdx]) {
      this.playSampleBuffer(this.samples[chIdx], vol);
      return;
    }
    const chGain = this.ctx.createGain();
    chGain.gain.value = vol;
    chGain.connect(this.masterGain);
    switch (chIdx) {
      case 0: this.kick(chGain); break;
      case 1: this.snare(chGain); break;
      case 2: this.hat(chGain); break;
      case 3: this.openHat(chGain); break;
      case 4: this.clap(chGain); break;
      case 5: this.tom(chGain, 180); break;
      case 6: this.tom(chGain, 120); break;
      case 7: break; // bass via bassNotes
    }
  }

  kick(g) {
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    g2.gain.setValueAtTime(1, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(g2); g2.connect(g);
    osc.start(t); osc.stop(t + 0.4);
  }

  snare(g) {
    const t = this.now();
    // noise
    const buf = this.noiseBuf(0.2);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.8;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.8, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    src.connect(bp); bp.connect(ng); ng.connect(g);
    src.start(t); src.stop(t + 0.22);
    // body
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle'; osc.frequency.value = 190;
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.5, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(og); og.connect(g);
    osc.start(t); osc.stop(t + 0.15);
  }

  hat(g) {
    const t = this.now();
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf(0.08);
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 8000;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.4, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    src.connect(hp); hp.connect(ng); ng.connect(g);
    src.start(t); src.stop(t + 0.1);
  }

  openHat(g) {
    const t = this.now();
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf(0.4);
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.35, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    src.connect(hp); hp.connect(ng); ng.connect(g);
    src.start(t); src.stop(t + 0.42);
  }

  clap(g) {
    const t = this.now();
    for (let i = 0; i < 3; i++) {
      const d = t + i * 0.012;
      const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf(0.12);
      const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 1.2;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.5, d);
      ng.gain.exponentialRampToValueAtTime(0.001, d + 0.11);
      src.connect(bp); bp.connect(ng); ng.connect(g);
      src.start(d); src.stop(d + 0.12);
    }
  }

  tom(g, freq) {
    const t = this.now();
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.18);
    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0.8, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g2); g2.connect(g);
    osc.start(t); osc.stop(t + 0.35);
  }

  triggerBass(note, octave, vol = 0.85) {
    const freq = this.noteFreq(note, octave);
    if (!freq) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 1;
    const g2 = this.ctx.createGain();
    const eg = this.ctx.createGain();
    g2.gain.value = vol;
    eg.gain.setValueAtTime(0.0001, t);
    eg.gain.exponentialRampToValueAtTime(0.6, t + 0.01);
    eg.gain.setValueAtTime(0.6, t + 0.1);
    eg.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc.connect(lp); lp.connect(eg); eg.connect(g2); g2.connect(this.masterGain);
    osc.start(t); osc.stop(t + 0.5);
  }

  noteFreq(note, octave) {
    const semis = { C:0, 'C#':1, D:2, 'D#':3, E:4, F:5, 'F#':6, G:7, 'G#':8, A:9, 'A#':10, B:11 };
    if (!(note in semis)) return null;
    const midi = 12 * (octave + 1) + semis[note];
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  noiseBuf(dur) {
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, Math.ceil(sr * dur), sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
}

window.DuckAudio = DuckAudio;
