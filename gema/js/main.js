/**
 * 🦆 DUCK - Main Controller
 * Orquestrador da aplicação
 */

class DuckController {
  constructor() {
    this.audioEngine = audioEngine;
    this.state = {
      isPlaying: false,
      tempo: 120,
      currentStep: 0,
      tracks: {
        kick: { active: [] },
        snare: { active: [] },
        hihat: { active: [] },
        bass: { active: [] }
      }
    };

    this.animationId = null;
    this.stepDuration = 0;

    console.log('🦆 DUCK Controller inicializado');
  }

  /**
   * Inicializa a aplicação
   */
  async init() {
    // Inicializar audio engine
    const audioReady = await this.audioEngine.init();

    if (!audioReady) {
      console.error('❌ Falha ao inicializar áudio');
      this.updateStatus('❌ Erro ao inicializar áudio');
      return;
    }

    // Registrar event listeners
    this.registerEventListeners();

    // Obter informações de áudio
    const info = this.audioEngine.getInfo();
    console.log('📊 Informações de Áudio:', info);

    this.updateStatus('✅ DUCK pronto para usar | Clique em PLAY');
  }

  /**
   * Registra todos os event listeners da UI
   */
  registerEventListeners() {
    // Transport controls
    const playBtn = document.getElementById('play-btn');
    const stopBtn = document.getElementById('stop-btn');
    const exportBtn = document.getElementById('export-btn');

    playBtn?.addEventListener('click', () => this.togglePlayback());
    stopBtn?.addEventListener('click', () => this.stopPlayback());
    exportBtn?.addEventListener('click', () => this.exportProject());

    // Sequenciador - clicks nos steps
    document.querySelectorAll('.step').forEach((stepEl) => {
      stepEl.addEventListener('click', (e) => this.toggleStep(e));
    });

    // Controles de BPM
    const tempoInput = document.getElementById('tempo');
    tempoInput?.addEventListener('input', (e) => this.updateTempo(e));
    tempoInput?.addEventListener('change', (e) => this.updateTempo(e));

    // Mixer - faders
    document.querySelectorAll('input[type="range"]').forEach((fader) => {
      fader.addEventListener('input', (e) => this.updateVolume(e));
    });

    // Instrumentos - click para tocar
    document.querySelectorAll('.instrument-card').forEach((card) => {
      card.addEventListener('click', (e) => this.playInstrumentDemo(e));
    });

    console.log('✅ Event listeners registrados');
  }

  /**
   * Alterna playback (Play/Pause)
   */
  togglePlayback() {
    if (this.state.isPlaying) {
      this.pausePlayback();
    } else {
      this.startPlayback();
    }
  }

  /**
   * Inicia reprodução do sequenciador
   */
  startPlayback() {
    this.state.isPlaying = true;
    this.state.currentStep = 0;
    this.state.playStartTime = this.audioEngine.audioContext.currentTime;

    document.getElementById('play-btn').textContent = '⏸ Pause';
    this.updateStatus('▶️ Sequência em reprodução...');

    this.scheduleSequence();
  }

  /**
   * Pausa reprodução
   */
  pausePlayback() {
    this.state.isPlaying = false;
    document.getElementById('play-btn').textContent = '▶ Play';
    this.updateStatus('⏸ Pausado');

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  /**
   * Para reprodução completamente
   */
  stopPlayback() {
    this.state.isPlaying = false;
    this.state.currentStep = 0;
    document.getElementById('play-btn').textContent = '▶ Play';
    document.querySelectorAll('.step.current').forEach((s) => s.classList.remove('current'));
    this.updateStatus('⏹ Parado');

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  /**
   * Agenda a reprodução do sequenciador
   * Usa requestAnimationFrame para atualizar UI
   */
  scheduleSequence() {
    if (!this.state.isPlaying) return;

    const currentTime = this.audioEngine.audioContext.currentTime;
    const elapsedTime = currentTime - this.state.playStartTime;
    const stepDurationSeconds = (60 / this.state.tempo) / 4; // 16th note

    // Calcular qual step deve estar tocando
    this.state.currentStep = Math.floor(elapsedTime / stepDurationSeconds) % 16;

    // Tocar notas ativas neste step
    this.triggerStep(this.state.currentStep);

    // Atualizar UI
    this.updateStepDisplay();
    this.updatePositionDisplay();

    // Agendar próxima atualização
    this.animationId = requestAnimationFrame(() => this.scheduleSequence());
  }

  /**
   * Dispara todos os instrumentos ativos no step atual
   */
  triggerStep(step) {
    // Kick
    if (this.state.tracks.kick.active.includes(step)) {
      this.audioEngine.playInstrument('kick');
    }

    // Snare
    if (this.state.tracks.snare.active.includes(step)) {
      this.audioEngine.playInstrument('snare');
    }

    // Hi-Hat
    if (this.state.tracks.hihat.active.includes(step)) {
      this.audioEngine.playInstrument('hihat');
    }

    // Bass
    if (this.state.tracks.bass.active.includes(step)) {
      this.audioEngine.playInstrument('bass', { frequency: 110 });
    }
  }

  /**
   * Alterna um step (ativa/desativa)
   */
  toggleStep(event) {
    const stepEl = event.target;
    if (!stepEl.classList.contains('step')) return;

    stepEl.classList.toggle('active');

    // Determinar qual track e step
    const trackEl = stepEl.closest('.track');
    const trackName = trackEl?.querySelector('.track-name').textContent.toLowerCase();
    const stepNumber = parseInt(stepEl.dataset.step);

    if (this.state.tracks[trackName]) {
      const activeList = this.state.tracks[trackName].active;

      if (stepEl.classList.contains('active')) {
        if (!activeList.includes(stepNumber)) {
          activeList.push(stepNumber);
        }
        this.updateStatus(`✓ ${trackName} step ${stepNumber} ativado`);
      } else {
        const idx = activeList.indexOf(stepNumber);
        if (idx > -1) {
          activeList.splice(idx, 1);
        }
        this.updateStatus(`✗ ${trackName} step ${stepNumber} desativado`);
      }
    }

    // Tocar preview
    this.audioEngine.playInstrument(trackName);
  }

  /**
   * Atualiza a exibição dos steps atuais
   */
  updateStepDisplay() {
    document.querySelectorAll('.step.current').forEach((s) => s.classList.remove('current'));

    const currentStepEl = document.querySelector(`.step[data-step="${this.state.currentStep}"]`);
    if (currentStepEl) {
      currentStepEl.classList.add('current');
    }
  }

  /**
   * Atualiza exibição da posição
   */
  updatePositionDisplay() {
    const bar = Math.floor(this.state.currentStep / 4) + 1;
    const beat = (this.state.currentStep % 4) + 1;

    const posEl = document.getElementById('position');
    if (posEl) {
      posEl.textContent = `${bar}:${beat}`;
    }
  }

  /**
   * Atualiza o BPM
   */
  updateTempo(event) {
    const tempo = parseInt(event.target.value);
    this.state.tempo = tempo;

    document.getElementById('tempo-display').textContent = tempo;
    this.updateStatus(`🎵 BPM: ${tempo}`);
  }

  /**
   * Atualiza volumes do mixer
   */
  updateVolume(event) {
    const volume = parseFloat(event.target.value) / 100;
    event.target.nextElementSibling.textContent = event.target.value;

    // Atualizar volume master do engine
    if (event.target.parentElement.querySelector('label').textContent.includes('Master')) {
      this.audioEngine.setMasterVolume(volume);
    }
  }

  /**
   * Toca um instrumento como demo (quando clica no card)
   */
  playInstrumentDemo(event) {
    const instrumentName = event.currentTarget.dataset.instrument;
    event.currentTarget.style.transform = 'scale(0.95)';

    setTimeout(() => {
      event.currentTarget.style.transform = 'scale(1)';
    }, 100);

    this.audioEngine.playInstrument(instrumentName);
    this.updateStatus(`🎵 Tocando: ${instrumentName}`);
  }

  /**
   * Exporta o projeto como JSON
   */
  exportProject() {
    const projectData = {
      name: document.querySelector('h2')?.textContent || 'Projeto DUCK',
      version: '0.1.0',
      tempo: this.state.tempo,
      tracks: this.state.tracks,
      timestamp: new Date().toISOString()
    };

    const json = JSON.stringify(projectData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `duck-project-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    this.updateStatus('✅ Projeto exportado como JSON');
    console.log('📥 Projeto exportado:', projectData);
  }

  /**
   * Atualiza mensagem de status
   */
  updateStatus(message) {
    const statusLine = document.getElementById('status-line');
    if (statusLine) {
      statusLine.textContent = message;
    }
  }

  /**
   * Toca todos os instrumentos (teste)
   */
  playAllInstruments() {
    this.audioEngine.playAllInstruments();
    this.updateStatus('🎵 Reproduzindo todos os instrumentos...');
  }
}

/**
 * Inicializa a aplicação quando o DOM estiver pronto
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('%c🦆 DUCK Aplicação Iniciando...', 'color: #00e881; font-size: 16px; font-weight: bold;');

  // Criar controller
  const app = new DuckController();

  // Fazer global para debugging
  window.duck = app;

  // Inicializar
  await app.init();

  // Teste: tocar som ao iniciar (comentado para não irritar)
  // setTimeout(() => app.playAllInstruments(), 1000);

  console.log('%c✅ DUCK Pronto!', 'color: #00e881; font-size: 14px; font-weight: bold;');
  console.log('%cDigite window.duck no console para acessar a API', 'color: #7cffbd; font-size: 12px;');
});

/**
 * Retomar áudio quando clica em qualquer lugar da página
 * (Necessário por políticas de autoplay do navegador)
 */
document.addEventListener('click', () => {
  if (audioEngine && audioEngine.audioContext) {
    audioEngine.resume();
  }
});

console.log('%c🦆 DUCK Main Script Carregado', 'color: #ff9d3d; font-size: 14px; font-weight: bold;');
