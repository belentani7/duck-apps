# 🎛️ DUCK Studio - Technical Implementation Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    DUCK STUDIO v1.0.0                   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │            UI Layer (HTML + CSS)                 │   │
│  │  - Piano Controller, Drum Pads, Mixer Faders     │   │
│  │  - Sequencer Grid, Control Knobs, Plugins       │   │
│  └──────────────────────────────────────────────────┘   │
│                          ↓                               │
│  ┌──────────────────────────────────────────────────┐   │
│  │      Application Layer (JavaScript Logic)        │   │
│  │  - Event Listeners, State Management             │   │
│  │  - Audio Event Scheduling, Parameter Control    │   │
│  └──────────────────────────────────────────────────┘   │
│                          ↓                               │
│  ┌──────────────────────────────────────────────────┐   │
│  │    Web Audio API Layer (Audio Processing)        │   │
│  │  - Oscillators, Gain Nodes, Filters              │   │
│  │  - Audio Effects, Master Output                  │   │
│  └──────────────────────────────────────────────────┘   │
│                          ↓                               │
│  ┌──────────────────────────────────────────────────┐   │
│  │     Animation Layer (GSAP + Canvas)              │   │
│  │  - Scroll Triggers, Element Animations           │   │
│  │  - Real-time Waveform Visualization              │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## Web Audio API Implementation

### Audio Context Setup

```javascript
// Create Audio Context
let audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Create master gain node (volume control)
let masterGainNode = audioContext.createGain();
masterGainNode.connect(audioContext.destination);
masterGainNode.gain.value = 0.3;

// Create analyser for waveform visualization
const analyser = audioContext.createAnalyser();
analyser.fftSize = 2048;
masterGainNode.connect(analyser);
```

### Oscillator Synthesis

#### Piano Note Synthesis
```javascript
function playNote(frequency, element) {
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  const now = audioContext.currentTime;
  
  // Create oscillator (sine wave for smooth tone)
  const osc = audioContext.createOscillator();
  osc.frequency.value = frequency;
  osc.type = 'triangle';
  
  // Create envelope
  const env = audioContext.createGain();
  env.gain.setValueAtTime(0.2, now);
  env.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
  
  // Connect chain
  osc.connect(env);
  env.connect(masterGainNode);
  
  // Schedule playback
  osc.start(now);
  osc.stop(now + 0.5);
}
```

#### Drum Sound Synthesis
```javascript
function playDrumSound(sound, element) {
  const now = audioContext.currentTime;
  
  // Oscillator with drum frequency
  const osc = audioContext.createOscillator();
  const env = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  
  // Kick drum characteristics
  osc.frequency.value = sound.freq;
  osc.type = 'sine';
  
  // Fast decay envelope (percussive)
  env.gain.setValueAtTime(0.3, now);
  env.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
  
  // Low-pass filter for "kick" sound
  filter.type = 'lowpass';
  filter.frequency.value = 5000;
  
  // Audio graph
  osc.connect(filter);
  filter.connect(env);
  env.connect(masterGainNode);
  
  osc.start(now);
  osc.stop(now + 0.5);
}
```

### Frequency Calculation (MIDI Note)

```javascript
// Calculate frequency from MIDI note number
function midiNoteToFrequency(noteNumber) {
  // A4 = 440Hz = MIDI note 69
  return 440 * Math.pow(2, (noteNumber - 69) / 12);
}

// Calculate note from octave and semitone
const pianoNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

for (let octave = 3; octave <= 6; octave++) {
  pianoNotes.forEach((note, index) => {
    // Calculate MIDI note number
    const midiNote = octave * 12 + index;
    const frequency = midiNoteToFrequency(midiNote);
  });
}
```

---

## GSAP Animation Implementation

### Scroll Trigger Setup

```javascript
// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

// Fade-in animation on scroll
gsap.utils.toArray('.scroll-fade').forEach(element => {
  gsap.to(element, {
    scrollTrigger: {
      trigger: element,
      start: 'top 80%',      // Animation starts when top is 80% visible
      toggleClass: 'active'  // Toggle 'active' class for CSS animations
    }
  });
});
```

### CSS Fade-In Animation

```css
.scroll-fade {
  opacity: 0;
  transform: translateY(30px);
}

.scroll-fade.active {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
```

### Pulse Animation

```javascript
// Continuous pulsing glow effect
@keyframes pulse-glow {
  0%, 100% { text-shadow: 0 0 20px var(--neon-green), 0 0 40px var(--neon-cyan); }
  50% { text-shadow: 0 0 30px var(--neon-green), 0 0 60px var(--neon-cyan), 0 0 80px var(--neon-purple); }
}
```

---

## Real-time Waveform Visualization

### FFT Frequency Analysis

```javascript
function setupVisualizer() {
  const canvas = document.getElementById('waveformCanvas');
  const ctx = canvas.getContext('2d');
  
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048; // 1024 data points
  masterGainNode.connect(analyser);
  
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  
  function draw() {
    // Get frequency data
    analyser.getByteFrequencyData(dataArray);
    
    // Clear canvas
    ctx.fillStyle = 'rgba(10, 14, 39, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw waveform
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const sliceWidth = canvas.width / dataArray.length;
    let x = 0;
    
    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;
      
      if (i === 0) {
        ctx.moveTo(x, canvas.height - y);
      } else {
        ctx.lineTo(x, canvas.height - y);
      }
      
      x += sliceWidth;
    }
    
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    
    // Add glow effect
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
    ctx.lineWidth = 4;
    ctx.stroke();
    
    requestAnimationFrame(draw);
  }
  
  draw();
}
```

---

## Interactive UI Components

### Fader (Slider) Implementation

```javascript
// Fader interaction setup
document.querySelectorAll('.fader').forEach(fader => {
  let isDragging = false;
  
  fader.addEventListener('mousedown', () => { isDragging = true; });
  document.addEventListener('mouseup', () => { isDragging = false; });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const rect = fader.getBoundingClientRect();
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    
    const thumb = fader.querySelector('.fader-thumb');
    thumb.style.top = y + 'px';
    
    // Calculate decibels (-50dB to +12dB)
    const value = Math.round((1 - (y / rect.height)) * 100) - 50;
    fader.nextElementSibling.textContent = value + 'dB';
  });
});
```

### Dynamic Element Creation

```javascript
// Create drum pads dynamically
function createDrumPads() {
  const container = document.getElementById('drumPads');
  
  drumSounds.forEach((sound, index) => {
    const pad = document.createElement('div');
    pad.className = 'pad';
    pad.innerHTML = `
      <i class="fas fa-circle"></i>
      <div class="pad-label">${sound.name}</div>
    `;
    
    pad.addEventListener('click', () => playDrumSound(sound, pad));
    pad.addEventListener('mousedown', () => pad.classList.add('active'));
    pad.addEventListener('mouseup', () => pad.classList.remove('active'));
    
    container.appendChild(pad);
  });
}
```

---

## CSS Glassmorphism Design

### Glass Effect

```css
.glass {
  background: var(--glass-bg);                    /* rgba(15, 23, 50, 0.6) */
  border: 1px solid var(--glass-border);          /* rgba(0, 255, 136, 0.2) */
  backdrop-filter: blur(15px);                    /* Blur effect */
  border-radius: 15px;
  padding: 25px;
  box-shadow: 0 8px 32px rgba(0, 255, 136, 0.1); /* Neon glow */
  transition: all 0.3s ease;
}

.glass:hover {
  background: rgba(15, 23, 50, 0.8);
  box-shadow: 0 8px 32px rgba(0, 255, 136, 0.2);
  border-color: rgba(0, 255, 136, 0.4);
}
```

### Neon Glow Effect

```css
/* Neon text glow */
.logo {
  color: var(--neon-green);
  text-shadow: 
    0 0 20px var(--neon-green),
    0 0 40px var(--neon-cyan),
    0 0 60px var(--neon-purple);
}

/* Neon box glow */
.plugin {
  border: 2px solid var(--neon-cyan);
  box-shadow: 0 0 25px var(--neon-cyan);
}
```

### CSS Grid Background

```css
body::before {
  background-image:
    linear-gradient(0deg, transparent 24%, rgba(0, 255, 136, 0.05) 25%, ...),
    linear-gradient(90deg, transparent 24%, rgba(0, 255, 136, 0.05) 25%, ...);
  background-size: 50px 50px;
  animation: grid-move 8s linear infinite;
}

@keyframes grid-move {
  0% { transform: translateY(0); }
  100% { transform: translateY(50px); }
}
```

---

## Performance Optimization

### Memory Management

```javascript
// Prevent memory leaks with oscillator cleanup
function playNote(frequency, duration) {
  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const env = audioContext.createGain();
  
  osc.connect(env);
  env.connect(masterGainNode);
  
  osc.start(now);
  osc.stop(now + duration);
  
  // Disconnect after sound ends (automatic cleanup)
}
```

### Canvas Rendering Optimization

```javascript
// Use requestAnimationFrame for smooth animation
function draw() {
  // Clear and redraw only visible portion
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw visualization
  // ...
  
  requestAnimationFrame(draw);
}
```

### Event Delegation

```javascript
// Use event delegation instead of individual listeners
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('pad')) {
    playDrumSound(e.target);
  }
});
```

---

## Browser Compatibility

### Audio Context Compatibility

```javascript
// Cross-browser audio context
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContext();
```

### Feature Detection

```javascript
// Check for Web Audio API support
if (!window.AudioContext && !window.webkitAudioContext) {
  console.error('Web Audio API not supported');
}

// Check for pointer events support
if (!window.PointerEvent) {
  console.warn('Using mouse events fallback');
}
```

---

## State Management

### Application State Object

```javascript
const state = {
  isRecording: false,
  isPlaying: false,
  metronomeActive: false,
  tempo: 120,
  currentSequencerStep: 0,
  activePlugins: [],
  mixerLevels: [0, 0, 0, 0, 0, 0, 0, 0],
};

// State update function
function updateState(updates) {
  Object.assign(state, updates);
  console.log('State updated:', state);
}
```

---

## Future Enhancement Possibilities

### 1. MIDI Input Support

```javascript
// Request MIDI access
navigator.requestMIDIAccess()
  .then(onMIDISuccess, onMIDIFailure);

function onMIDISuccess(midiAccess) {
  const inputs = midiAccess.inputs.values();
  
  for (let input of inputs) {
    input.onmidimessage = handleMIDIMessage;
  }
}

function handleMIDIMessage(message) {
  const [command, note, velocity] = message.data;
  // Process MIDI data
}
```

### 2. Audio Recording

```javascript
// Create MediaRecorder for audio capture
const mediaRecorder = new MediaRecorder(
  audioContext.createMediaStreamDestination().stream
);

mediaRecorder.ondataavailable = (e) => {
  const blob = new Blob([e.data], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  // Download or playback
};

mediaRecorder.start();
// ... record audio ...
mediaRecorder.stop();
```

### 3. Preset System

```javascript
// Save preset
function savePreset(name) {
  const preset = {
    name,
    mixerLevels: state.mixerLevels,
    activePlugins: state.activePlugins,
    sequencerPattern: getSequencerPattern(),
  };
  localStorage.setItem(`preset_${name}`, JSON.stringify(preset));
}

// Load preset
function loadPreset(name) {
  const preset = JSON.parse(localStorage.getItem(`preset_${name}`));
  updateState(preset);
}
```

---

## Debugging Tips

### Check Audio Context State

```javascript
console.log('Audio Context State:', audioContext.state);
// "running", "suspended", or "closed"

// Resume if suspended
if (audioContext.state === 'suspended') {
  audioContext.resume().then(() => {
    console.log('Audio Context Resumed');
  });
}
```

### Monitor Performance

```javascript
// Check analyser data
const dataArray = new Uint8Array(analyser.frequencyBinCount);
analyser.getByteFrequencyData(dataArray);
console.log('Frequency data:', dataArray);

// Monitor memory
console.log('Memory usage:', performance.memory);
```

---

## Resources & References

- [MDN Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [GSAP Documentation](https://greensock.com/docs)
- [Canvas API Reference](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [Web MIDI API](https://www.w3.org/TR/webmidi/)

---

**DUCK Studio Technical Guide v1.0.0**  
*Built with ❤️ for PRODUCER DUCK*
