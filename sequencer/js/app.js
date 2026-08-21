// DUCK SEQUENCER — App principal
const LS_KEY = 'duck_sequencer_patterns';
const CHANNELS = [
  { name: 'Bumbo', icon: '🥁', color: '#39ff6a' },
  { name: 'Caixa', icon: '🔉', color: '#7dffb0' },
  { name: 'Chimbau', icon: '🎛️', color: '#39ff6a' },
  { name: 'Chimbau Aberto', icon: '📀', color: '#7dffb0' },
  { name: 'Clap', icon: '👏', color: '#39ff6a' },
  { name: 'Tom Baixo', icon: '🪘', color: '#7dffb0' },
  { name: 'Tom Alto', icon: '🪘', color: '#39ff6a' },
  { name: 'Baixo', icon: '🎸', color: '#a7ff3a' },
];

const NOTE_CHOICES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', null];

class App {
  constructor() {
    this.audio = new DuckAudio();
    this.grid = CHANNELS.map(() => Array(64).fill(false));
    this.velocity = CHANNELS.map(() => Array(64).fill(1));
    this.bassNotes = Array(64).fill(null);
    this.tempo = 120;
    this.swing = 0;
    this.stepCount = 16;
    this.patterns = [];
    this.channelVol = Array(8).fill(0.85);
    this.isPlaying = false;
    this.midiInput = null;
    this.ollamaModels = [];

    this.ui = {
      play: document.getElementById('btnPlay'),
      stop: document.getElementById('btnStop'),
      tempo: document.getElementById('tempo'),
      stepCount: document.getElementById('stepCount'),
      swing: document.getElementById('swing'),
      grid: document.getElementById('stepGrid'),
      mixer: document.getElementById('mixerStrip'),
      save: document.getElementById('btnSave'),
      exportBtn: document.getElementById('btnExport'),
      importBtn: document.getElementById('btnImport'),
      fileImport: document.getElementById('fileImport'),
      patternList: document.getElementById('patternList'),
      status: document.getElementById('status'),
      toast: document.getElementById('toast'),
      channelCount: document.getElementById('channelCount'),
      midiStatus: document.getElementById('midiStatus'),
      btnN8n: document.getElementById('btnN8n'),
      btnOllama: document.getElementById('btnOllama'),
      ollamaModel: document.getElementById('ollamaModel'),
      ollamaDensity: document.getElementById('ollamaDensity'),
      ollamaVariation: document.getElementById('ollamaVariation'),
    };

    this.bind();
    this.render();
    this.loadPatterns();
    this.initMidi();
    this.loadOllamaModels();
  }

  bind() {
    this.ui.play.addEventListener('click', () => this.togglePlay());
    this.ui.stop.addEventListener('click', () => this.stopPlay());
    this.ui.tempo.addEventListener('change', () => {
      this.tempo = clamp(parseInt(this.ui.tempo.value) || 120, 40, 240);
      this.ui.tempo.value = this.tempo;
      this.setStatus('Tempo ' + this.tempo + ' BPM');
    });
    this.ui.stepCount.addEventListener('change', () => {
      this.stepCount = parseInt(this.ui.stepCount.value);
      this.render();
    });
    this.ui.swing.addEventListener('input', () => {
      this.swing = parseInt(this.ui.swing.value);
    });
    this.ui.save.addEventListener('click', () => this.savePatternModal());
    this.ui.exportBtn.addEventListener('click', () => this.exportJSON());
    this.ui.importBtn.addEventListener('click', () => this.ui.fileImport.click());
    this.ui.fileImport.addEventListener('change', (e) => this.importJSON(e));

    if (this.ui.btnN8n) {
      this.ui.btnN8n.addEventListener('click', () => this.exportToN8n());
    }
    if (this.ui.btnOllama) {
      this.ui.btnOllama.addEventListener('click', () => this.generateWithOllama());
    }

    this.audio.onStep = (step) => {
      document.querySelectorAll('.step-cell').forEach(cell => {
        const ch = parseInt(cell.dataset.ch);
        const st = parseInt(cell.dataset.step);
        cell.classList.toggle('current', st === step);
      });
    };

    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.code === 'Space') { e.preventDefault(); this.togglePlay(); }
      if (e.code === 'Escape') this.stopPlay();
    });
  }

  togglePlay() {
    if (this.isPlaying) { this.stopPlay(); return; }
    this.audio.resume();
    this.isPlaying = true;
    this.ui.play.classList.add('active');
    this.audio.start(this.tempo, this.swing, this.stepCount, this.grid,
      (ch) => this.audio.getActiveChannel(ch));
    this.setStatus('▶ Tocando');
  }

  stopPlay() {
    this.isPlaying = false;
    this.audio.stop();
    this.ui.play.classList.remove('active');
    document.querySelectorAll('.step-cell.current').forEach(c => c.classList.remove('current'));
    this.setStatus('■ Parado');
  }

  render() {
    this.ui.channelCount.textContent = CHANNELS.length;
    this.renderGrid();
    this.renderMixer();
  }

  renderGrid() {
    const host = this.ui.grid;
    host.innerHTML = '';
    CHANNELS.forEach((ch, chIdx) => {
      const row = el('div', 'channel-row');
      if (this.audio.channelMuted[chIdx]) row.classList.add('muted');

      const label = el('div', 'ch-label');
      label.innerHTML = `<span class="ch-icon">${ch.icon}</span><span>${ch.name}</span>`;

      const sampleBtn = el('button');
      sampleBtn.textContent = '📀';
      sampleBtn.title = 'Carregar sample';
      sampleBtn.style.cursor = 'pointer';
      sampleBtn.addEventListener('click', () => {
        if (this.audio.hasSample(chIdx)) {
          if (confirm('Remover sample deste canal?')) this.clearSample(chIdx);
        } else {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'audio/*';
          input.addEventListener('change', () => {
            if (input.files[0]) this.handleSampleUpload(chIdx, input.files[0]);
          });
          input.click();
        }
      });
      label.appendChild(sampleBtn);

      row.appendChild(label);

      const steps = el('div', 'steps');
      for (let s = 0; s < this.stepCount; s++) {
        const cell = el('div', 'step-cell');
        cell.dataset.ch = chIdx;
        cell.dataset.step = s;
        if (s % 4 === 0) cell.classList.add('beat');
        if (this.grid[chIdx][s]) cell.classList.add('on');

        const velBar = el('div', 'vel-bar');
        velBar.style.height = (this.velocity[chIdx][s] * 100) + '%';
        cell.appendChild(velBar);

        cell.addEventListener('click', () => this.toggleStep(chIdx, s, cell));
        cell.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.cycleBassNote(chIdx, s, cell);
        });
        steps.appendChild(cell);
      }
      row.appendChild(steps);
      host.appendChild(row);
    });
  }

  toggleStep(chIdx, step, cell) {
    this.grid[chIdx][step] = !this.grid[chIdx][step];
    cell.classList.toggle('on', this.grid[chIdx][step]);
    if (this.grid[chIdx][step]) {
      // velocidade randômica sutil para groove (50% chance 0.8-1.0)
      this.velocity[chIdx][step] = Math.random() < 0.5 ? (0.8 + Math.random() * 0.2) : 1;
      const velBar = cell.querySelector('.vel-bar');
      velBar.style.height = (this.velocity[chIdx][step] * 100) + '%';
    }
  }

  cycleBassNote(chIdx, step, cell) {
    if (chIdx !== 7) return;
    const cur = this.bassNotes[step];
    const idx = NOTE_CHOICES.indexOf(cur);
    const next = NOTE_CHOICES[(idx + 1) % NOTE_CHOICES.length];
    this.bassNotes[step] = next;
    if (next === null) {
      cell.classList.remove('on');
      cell.style.background = '';
      cell.textContent = '';
    } else {
      cell.classList.add('on');
      cell.style.background = '#a7ff3a';
      cell.style.boxShadow = '0 0 10px rgba(167,255,58,.6)';
      cell.textContent = next;
      cell.style.fontSize = '9px';
      cell.style.fontWeight = '700';
      cell.style.color = '#0a1209';
      cell.style.display = 'flex';
      cell.style.alignItems = 'center';
      cell.style.justifyContent = 'center';
    }
  }

  renderMixer() {
    const host = this.ui.mixer;
    host.innerHTML = '';
    CHANNELS.forEach((ch, chIdx) => {
      const mch = el('div', 'mixer-ch');

      const icon = el('div', 'mch-icon'); icon.textContent = ch.icon;
      const name = el('div', 'mch-name'); name.textContent = ch.name;

      const fader = el('div', 'fader');
      const fill = el('div', 'fill');
      const knob = el('div', 'knob');
      const val = this.channelVol[chIdx];
      fill.style.height = (val * 100) + '%';
      knob.style.bottom = (val * 100 - 6) + '%';
      fader.appendChild(fill); fader.appendChild(knob);

      fader.addEventListener('click', (e) => {
        const rect = fader.getBoundingClientRect();
        const pct = 1 - (e.clientY - rect.top) / rect.height;
        const v = clamp(pct, 0, 1);
        this.channelVol[chIdx] = v;
        this.audio.channelVolume[chIdx] = v * 0.85;
        fill.style.height = (v * 100) + '%';
        knob.style.bottom = (v * 100 - 6) + '%';
        faderLabel.textContent = Math.round(v * 100);
      });

      const faderLabel = el('div', 'fader-label');
      faderLabel.textContent = Math.round(val * 100);

      const btns = el('div', 'mixer-btns');
      const mBtn = el('button'); mBtn.textContent = 'M';
      const sBtn = el('button'); sBtn.textContent = 'S';
      mBtn.addEventListener('click', () => {
        this.audio.channelMuted[chIdx] = !this.audio.channelMuted[chIdx];
        mBtn.classList.toggle('on', this.audio.channelMuted[chIdx]);
        const gridRow = document.querySelector(`.channel-row:nth-child(${chIdx + 1})`);
        if (gridRow) gridRow.classList.toggle('muted', this.audio.channelMuted[chIdx]);
      });
      sBtn.addEventListener('click', () => {
        const now = !this.audio.channelSolo[chIdx];
        this.audio.setSoloChannel(chIdx, now);
        sBtn.classList.toggle('on', now);
      });

      btns.appendChild(mBtn); btns.appendChild(sBtn);
      mch.appendChild(icon); mch.appendChild(name);
      mch.appendChild(fader); mch.appendChild(faderLabel); mch.appendChild(btns);
      host.appendChild(mch);
    });
  }

  // ===== Persistência =====
  snapshot() {
    return {
      grid: this.grid.map(ch => [...ch]),
      velocity: this.velocity.map(ch => [...ch]),
      bassNotes: [...this.bassNotes],
      tempo: this.tempo,
      swing: this.swing,
      stepCount: this.stepCount,
    };
  }

  applySnapshot(snap) {
    this.grid = snap.grid.map(ch => [...ch]);
    this.velocity = (snap.velocity || snap.grid.map(ch => ch.map(() => 1))).map(ch => [...ch]);
    this.bassNotes = [...(snap.bassNotes || Array(64).fill(null))];
    this.tempo = snap.tempo || 120;
    this.swing = snap.swing || 0;
    this.stepCount = snap.stepCount || 16;
    this.ui.tempo.value = this.tempo;
    this.ui.stepCount.value = this.stepCount;
    this.ui.swing.value = this.swing;
    this.render();
  }

  _loadLS() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
  }

  _saveLS(patterns) {
    localStorage.setItem(LS_KEY, JSON.stringify(patterns));
  }

  savePatternModal() {
    const name = prompt('Nome do padrão:', 'DUCK_PATTERN_' + Date.now().toString().slice(-4));
    if (!name) return;
    this.savePattern(name);
  }

  savePattern(name) {
    const data = this.snapshot();
    data.name = name;
    data.id = 'pat_' + Date.now();
    data.created = new Date().toISOString();
    data.updated = new Date().toISOString();
    const patterns = this._loadLS();
    patterns.unshift(data);
    this._saveLS(patterns);
    this.toast('💾 Padrão salvo: ' + name);
    this.loadPatterns();
  }

  loadPatterns() {
    this.patterns = this._loadLS();
    this.renderPatternList();
  }

  renderPatternList() {
    const host = this.ui.patternList;
    host.innerHTML = '';
    if (!this.patterns.length) {
      host.innerHTML = '<div class="empty">Nenhum padrão salvo ainda.<br>Clique em 💾 Salvar padrão.</div>';
      return;
    }
    this.patterns.forEach(p => {
      const item = el('div', 'pattern-item');
      const name = el('div', 'p-name'); name.textContent = p.name;
      const meta = el('div', 'p-meta');
      meta.innerHTML = `<span>${p.tempo || 120} BPM</span><span>${(p.grid || []).length} canais</span>`;
      const actions = el('div', 'p-actions');
      const loadBtn = el('button'); loadBtn.textContent = 'Carregar';
      const delBtn = el('button'); delBtn.textContent = 'Excluir'; delBtn.classList.add('del');
      loadBtn.addEventListener('click', () => this.loadPattern(p.id));
      delBtn.addEventListener('click', () => this.deletePattern(p.id));
      actions.appendChild(loadBtn); actions.appendChild(delBtn);
      item.appendChild(name); item.appendChild(meta); item.appendChild(actions);
      host.appendChild(item);
    });
  }

  loadPattern(id) {
    const p = this._loadLS().find(x => x.id === id);
    if (!p) { this.toast('Padrão não encontrado', true); return; }
    this.applySnapshot(p);
    this.stopPlay();
    this.toast('📂 Carregado: ' + p.name);
  }

  deletePattern(id) {
    if (!confirm('Excluir este padrão?')) return;
    this._saveLS(this._loadLS().filter(x => x.id !== id));
    this.toast('🗑️ Padrão excluído');
    this.loadPatterns();
  }

  exportJSON() {
    const data = this.snapshot();
    data.name = 'DUCK_EXPORT_' + Date.now().toString().slice(-4);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = data.name + '.json';
    a.click();
    URL.revokeObjectURL(url);
    this.toast('⬇ JSON exportado');
  }

  importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        this.applySnapshot(data);
        this.toast('⬆ Padrão importado: ' + (data.name || 'arquivo'));
      } catch (err) {
        this.toast('JSON inválido', true);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // ===== MIDI =====
  async initMidi() {
    try {
      if (!navigator.requestMIDIAccess) {
        if (this.ui.midiStatus) this.ui.midiStatus.textContent = '🎹 MIDI: não suportado';
        return;
      }
      const access = await navigator.requestMIDIAccess();
      const inputs = Array.from(access.inputs.values());
      if (inputs.length > 0) {
        this.midiInput = inputs[0];
        this.midiInput.onmidimessage = (msg) => this.onMidiMessage(msg.data);
        if (this.ui.midiStatus) this.ui.midiStatus.textContent = `🎹 MIDI: ${this.midiInput.name || 'conectado'}`;
      } else {
        if (this.ui.midiStatus) this.ui.midiStatus.textContent = '🎹 MIDI: sem teclado';
      }
      access.onstatechange = () => this.initMidi();
    } catch (e) {
      if (this.ui.midiStatus) this.ui.midiStatus.textContent = '🎹 MIDI: negado';
    }
  }

  onMidiMessage(data) {
    const [status, note, vel] = data;
    if (status === 144 && vel > 0) {
      const chIdx = note % CHANNELS.length;
      const stepIdx = note % this.stepCount;
      this.audio.resume();
      this.audio.triggerChannel(chIdx, this.audio.channelVolume[chIdx]);
      if (!this.audio.channelMuted[chIdx]) {
        this.toggleStep(chIdx, stepIdx);
      }
    } else if (status === 128) {
      // note off — noop
    }
  }

  // ===== SAMPLES =====
  async handleSampleUpload(chIdx, file) {
    try {
      await this.audio.loadSample(chIdx, file);
      this.toast('📀 Sample carregado: ' + file.name);
    } catch (e) {
      this.toast('Erro ao carregar sample: ' + e.message, true);
    }
  }

  clearSample(chIdx) {
    this.audio.clearSample(chIdx);
    this.toast('🗑️ Sample removido do canal ' + (chIdx + 1));
  }

  // ===== OLLAMA =====
  async loadOllamaModels() {
    try {
      const r = await fetch('/api/ollama/models');
      const data = await r.json();
      this.ollamaModels = data.models || [];
      if (this.ui.ollamaModel) {
        this.ui.ollamaModel.innerHTML = '';
        if (this.ollamaModels.length === 0) {
          const opt = document.createElement('option');
          opt.value = 'neural-beat';
          opt.textContent = 'neural-beat (baixar)';
          this.ui.ollamaModel.appendChild(opt);
        } else {
          this.ollamaModels.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.name;
            opt.textContent = m.name;
            this.ui.ollamaModel.appendChild(opt);
          });
        }
      }
    } catch (e) { /* server sem ollama */ }
  }

  async generateWithOllama() {
    const model = this.ui.ollamaModel.value;
    const density = (parseInt(this.ui.ollamaDensity.value) || 50) / 100;
    const variation = (parseInt(this.ui.ollamaVariation.value) || 40) / 100;

    const prompt = `Você é um produtor musical. Gere um padrão de sequenciador de bateria.
Canais (índice 0-7): Bumbo, Caixa, Chimbau, Chimbau Aberto, Clap, Tom Baixo, Tom Alto, Baixo.
Passos: ${this.stepCount}. BPM: ${this.tempo}.
Densidade (fração de steps ativos): ${density.toFixed(2)}. Variação: ${variation.toFixed(2)}.
Retorne SOMENTE JSON válido, sem texto, neste formato:
{"grid": [[bool,...] x8], "velocity": [0-1 x8], "tempo": ${this.tempo}}`;

    this.setStatus('🤖 Gerando com ' + model + '...');
    this.ui.btnOllama.disabled = true;
    try {
      const r = await fetch('/api/ollama/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.hint || data.error || 'erro');
      const p = data.pattern;
      const steps = this.stepCount;
      const grid = Array(8).fill(null).map(() => Array(steps).fill(false));
      (p.grid || []).forEach((ch, ci) => {
        if (!ch) return;
        ch.forEach((on, si) => {
          if (si < steps && on) grid[ci][si] = true;
        });
      });
      if (p.tempo) { this.tempo = p.tempo; this.ui.tempo.value = p.tempo; }
      this.grid = grid;
      const velocity = Array(8).fill(null).map(() => Array(steps).fill(1));
      (p.velocity || []).forEach((v, ci) => {
        if (ci < 8) {
          const val = Math.max(0.3, Math.min(1, Number(v) || 1));
          velocity[ci] = velocity[ci].map(() => val);
        }
      });
      this.velocity = velocity;
      this.render();
      this.toast('🤖 Padrão gerado com IA');
    } catch (e) {
      this.toast('Ollama falhou: ' + e.message, true);
      this.setStatus('Ollama offline?');
    } finally {
      this.ui.btnOllama.disabled = false;
      this.setStatus('');
    }
  }

  // ===== N8N =====
  async exportToN8n() {
    try {
      const r = await fetch('/api/n8n/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grid: this.grid.map(ch => [...ch]),
          tempo: this.tempo,
          velocity: this.velocity.map(ch => ch[0] || 1),
          name: 'DUCK-' + Date.now().toString().slice(-6)
        })
      });
      const workflow = await r.json();
      const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = workflow.name + '.json';
      a.click();
      URL.revokeObjectURL(url);
      this.toast('⚡ Workflow n8n exportado');
    } catch (e) {
      this.toast('Erro ao exportar n8n: ' + e.message, true);
    }
  }

  // ===== Utils =====
  setStatus(msg) { this.ui.status.textContent = msg; }

  toast(msg, isError = false) {
    this.ui.toast.textContent = msg;
    this.ui.toast.classList.toggle('error', isError);
    this.ui.toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.ui.toast.classList.remove('show'), 2500);
  }
}

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
