/**
 * 🦆 DUCK - Audio Engine
 * Motor de síntese de áudio e processamento
 *
 * Responsabilidades:
 * - Gerenciar AudioContext
 * - Criar oscillators
 * - Conectar nós de áudio (DAG)
 * - Controlar playback
 */

class AudioEngine {
  constructor() {
    // Contexto de áudio
    this.audioContext = null;
    this.isInitialized = false;

    // Master volume
    this.masterGain = null;

    // Compressor para limitar picos
    this.compressor = null;

    // Banco de sons
    this.instruments = {};

    // Estado
    this.state = {
      isPlaying: false,
      tempo: 120,
      currentTime: 0
    };

    console.log('🦆 AudioEngine inicializado');
  }

  /**
   * Inicializa o AudioContext e os nós principais
   */
  async init() {
    try {
      // Criar ou usar AudioContext existente
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();

      // Criar master gain (volume master)
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.8; // -2dB para headroom

      // Criar compressor para proteção contra clipping
      this.compressor = this.audioContext.createDynamicsCompressor();
      this.compressor.threshold.value = -50;
      this.compressor.knee.value = 40;
      this.compressor.ratio.value = 12;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;

      // Conectar DAG: synths -> masterGain -> compressor -> destination
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.audioContext.destination);

      // Criar instrumentos padrão
      this.createInstruments();

      this.isInitialized = true;
      console.log('✅ AudioEngine inicializado com sucesso');
      console.log('   Sample Rate:', this.audioContext.sampleRate, 'Hz');
      console.log('   Estado:', this.audioContext.state);

      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar AudioEngine:', error);
      return false;
    }
  }

  /**
   * Retoma o AudioContext (necessário por políticas do navegador)
   */
  resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().then(() => {
        console.log('✅ AudioContext retomado');
      });
    }
  }

  /**
   * Cria os instrumentos padrão (Kick, Snare, HiHat, Bass)
   */
  createInstruments() {
    // Kick Drum
    this.instruments.kick = {
      name: 'Kick',
      play: (time = 0, frequency = 150, duration = 0.5) => {
        this.playKick(time, frequency, duration);
      }
    };

    // Snare Drum
    this.instruments.snare = {
      name: 'Snare',
      play: (time = 0, duration = 0.15) => {
        this.playSnare(time, duration);
      }
    };

    // Hi-Hat (closed)
    this.instruments.hihat = {
      name: 'Hi-Hat',
      play: (time = 0, duration = 0.05) => {
        this.playHiHat(time, duration);
      }
    };

    // Bass
    this.instruments.bass = {
      name: 'Bass',
      play: (time = 0, frequency = 55, duration = 0.25) => {
        this.playBass(time, frequency, duration);
      }
    };

    console.log('✅ Instrumentos criados:', Object.keys(this.instruments));
  }

  /**
   * 🥁 Kick Drum - Oscilador com pitch bend
   * Simula um kick acústico com glissando de frequência
   */
  playKick(time = 0, startFreq = 150, duration = 0.5) {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    const startTime = now + time;

    // Oscilador para o pitch
    const osc = this.audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, startTime);

    // Pitch bend rápido (glissando)
    osc.frequency.exponentialRampToValueAtTime(0.01, startTime + 0.08);

    // Envelope de amplitude (ADSR simplificado)
    const amp = this.audioContext.createGain();
    amp.gain.setValueAtTime(1, startTime);
    amp.gain.linearRampToValueAtTime(0, startTime + duration);

    // Conectar: osc -> amp -> masterGain -> output
    osc.connect(amp);
    amp.connect(this.masterGain);

    // Controlar oscilador
    osc.start(startTime);
    osc.stop(startTime + duration);

    console.log(`🥁 Kick @ ${startTime.toFixed(3)}s`);
  }

  /**
   * 🥊 Snare Drum - Ruído branco com decay rápido
   */
  playSnare(time = 0, duration = 0.15) {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    const startTime = now + time;

    // Criar ruído branco
    const bufferSize = this.audioContext.sampleRate * duration;
    const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1; // Random entre -1 e 1
    }

    // Fonte de áudio para o ruído
    const source = this.audioContext.createBufferSource();
    source.buffer = noiseBuffer;

    // Envelope de amplitude
    const amp = this.audioContext.createGain();
    amp.gain.setValueAtTime(0.7, startTime);
    amp.gain.linearRampToValueAtTime(0, startTime + duration);

    // High-pass filter para snare
    const hpf = this.audioContext.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 5000;
    hpf.Q.value = 2;

    // Conectar DAG
    source.connect(hpf);
    hpf.connect(amp);
    amp.connect(this.masterGain);

    // Controlar
    source.start(startTime);
    source.stop(startTime + duration);

    console.log(`🥊 Snare @ ${startTime.toFixed(3)}s`);
  }

  /**
   * ✨ Hi-Hat - Ruído filtered com decay curtíssimo
   */
  playHiHat(time = 0, duration = 0.05) {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    const startTime = now + time;

    // Ruído branco curto
    const bufferSize = this.audioContext.sampleRate * duration;
    const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = noiseBuffer;

    // Envelope de amplitude (muito curto)
    const amp = this.audioContext.createGain();
    amp.gain.setValueAtTime(0.4, startTime);
    amp.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

    // High-pass filter agressivo para frequência alta
    const hpf = this.audioContext.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 9000;
    hpf.Q.value = 1;

    // Conectar
    source.connect(hpf);
    hpf.connect(amp);
    amp.connect(this.masterGain);

    source.start(startTime);
    source.stop(startTime + duration);

    console.log(`✨ HiHat @ ${startTime.toFixed(3)}s`);
  }

  /**
   * 🎸 Bass - Oscilador sine com envelope
   */
  playBass(time = 0, frequency = 55, duration = 0.25) {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    const startTime = now + time;

    // Oscilador sine para o tom
    const osc = this.audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, startTime);

    // Envelope ADSR simplificado
    const amp = this.audioContext.createGain();
    amp.gain.setValueAtTime(0, startTime);
    amp.gain.linearRampToValueAtTime(0.8, startTime + 0.01); // Attack
    amp.gain.linearRampToValueAtTime(0.6, startTime + 0.1);  // Decay
    amp.gain.linearRampToValueAtTime(0, startTime + duration); // Release

    // Conectar
    osc.connect(amp);
    amp.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration);

    console.log(`🎸 Bass ${frequency}Hz @ ${startTime.toFixed(3)}s`);
  }

  /**
   * Toca qualquer instrumento por seu nome
   */
  playInstrument(instrumentName, params = {}) {
    if (!this.isInitialized) {
      console.warn('⚠️ AudioEngine não inicializado');
      return;
    }

    this.resume(); // Garantir que AudioContext está rodando

    const instrument = this.instruments[instrumentName];
    if (instrument) {
      instrument.play(params.time || 0, params.frequency, params.duration);
    } else {
      console.warn(`⚠️ Instrumento não encontrado: ${instrumentName}`);
    }
  }

  /**
   * Define o volume master
   * @param {number} level - Volume de 0 a 1
   */
  setMasterVolume(level) {
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, level)), this.audioContext.currentTime);
      console.log(`🔊 Volume Master: ${(level * 100).toFixed(0)}%`);
    }
  }

  /**
   * Obtém o nível atual do master volume
   */
  getMasterVolume() {
    return this.masterGain ? this.masterGain.gain.value : 0;
  }

  /**
   * Obtém informações do AudioContext
   */
  getInfo() {
    if (!this.audioContext) return null;

    return {
      sampleRate: this.audioContext.sampleRate,
      state: this.audioContext.state,
      currentTime: this.audioContext.currentTime,
      baseLatency: this.audioContext.baseLatency,
      outputLatency: this.audioContext.outputLatency,
      masterVolume: this.masterGain?.gain.value || 0,
      isInitialized: this.isInitialized,
      instrumentCount: Object.keys(this.instruments).length
    };
  }

  /**
   * Teste de som - Toca todos os instrumentos
   */
  playAllInstruments() {
    console.log('🎵 Tocando todos os instrumentos...');
    const delay = 0.2;
    let time = 0;

    this.playInstrument('kick', { time });
    time += delay;

    this.playInstrument('snare', { time });
    time += delay;

    this.playInstrument('hihat', { time });
    time += delay;

    this.playInstrument('bass', { time, frequency: 110 });
  }
}

// Criar instância global
const audioEngine = new AudioEngine();

// Log de inicialização
console.log('%c🦆 DUCK Audio Engine Carregado', 'color: #00e881; font-size: 16px; font-weight: bold;');
console.log('%cPróximo passo: audioEngine.init()', 'color: #7cffbd; font-size: 12px;');
