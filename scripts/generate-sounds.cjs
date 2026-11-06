const fs = require('fs');
const path = require('path');

function writeWav(filename, samples, sampleRate = 44100) {
  const numChannels = 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // 16 bits
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const intSample = s < 0 ? s * 32768 : s * 32767;
    buffer.writeInt16LE(Math.round(intSample), 44 + i * 2);
  }

  fs.writeFileSync(filename, buffer);
  console.log('Saved', filename, 'size:', buffer.length, 'bytes');
}

const sampleRate = 44100;

// 1. Shopify Cha-Ching Sound (100% authentic cash register)
function generateShopifyChaChing() {
  const duration = 1.35;
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let s = 0;

    // A. Latch pop & mechanical drawer slide (0ms to 90ms)
    if (t < 0.09) {
      // Mechanical thump (180Hz -> 50Hz)
      const thumpFreq = 180 * Math.exp(-t * 28);
      const thumpEnv = Math.exp(-t * 35);
      s += 0.28 * Math.sin(2 * Math.PI * thumpFreq * t) * thumpEnv;

      // Friction whoosh (bandpassed noise)
      const noise = (Math.random() * 2 - 1) * Math.sin(2 * Math.PI * 1350 * t);
      const whooshEnv = (t / 0.04) * Math.exp(-(t - 0.04) * 45);
      s += 0.22 * noise * Math.max(0, whooshEnv);
    }

    // B. Crystal Primary Bell (C6: 1046.5Hz) starting at t = 0.065s
    if (t >= 0.065) {
      const tb = t - 0.065;
      const bellEnv = Math.exp(-tb * 3.8); // Natural metallic ring sustain
      const beat = 1 + 0.06 * Math.sin(2 * Math.PI * 3.5 * tb); // Subtle acoustic beating

      // Harmonic 1: 1046.5 Hz (High C)
      s += 0.45 * Math.sin(2 * Math.PI * 1046.5 * tb) * bellEnv * beat;

      // Harmonic 2: 2093.0 Hz (Double octave)
      const overtoneEnv1 = Math.exp(-tb * 5.2);
      s += 0.32 * Math.sin(2 * Math.PI * 2093.0 * tb) * overtoneEnv1;

      // Harmonic 3: 3136.0 Hz (High shimmer G)
      const overtoneEnv2 = Math.exp(-tb * 7.5);
      s += 0.18 * Math.sin(2 * Math.PI * 3136.0 * tb) * overtoneEnv2;

      // High crystalline strike transient (first 25ms)
      if (tb < 0.025) {
        s += 0.25 * Math.sin(2 * Math.PI * 4186.0 * tb) * Math.exp(-tb * 120);
      }
    }

    // C. Realistic coin clinks in the drawer till
    const addCoin = (startT, freq, vol) => {
      if (t >= startT && t < startT + 0.08) {
        const tc = t - startT;
        const cEnv = Math.exp(-tc * 65);
        s += vol * Math.sin(2 * Math.PI * freq * tc) * cEnv;
        s += (vol * 0.4) * Math.sin(2 * Math.PI * (freq * 1.58) * tc) * cEnv;
      }
    };

    addCoin(0.115, 3680, 0.16);
    addCoin(0.165, 4320, 0.18);
    addCoin(0.225, 4780, 0.15);
    addCoin(0.295, 5240, 0.14);

    samples[i] = s * 0.92;
  }
  return samples;
}

// 2. Urgent Red Alert Siren (Problem needing human intervention)
function generateAlertUrgent() {
  const duration = 0.65;
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let s = 0;

    // Dual pulse alarm: pulse 1 (0 to 0.20s), pulse 2 (0.28s to 0.48s)
    const inPulse1 = t >= 0 && t < 0.22;
    const inPulse2 = t >= 0.28 && t < 0.50;

    if (inPulse1 || inPulse2) {
      const pt = inPulse1 ? t : t - 0.28;
      const attack = Math.min(1, pt / 0.015);
      const decay = Math.exp(-(pt - 0.12) * 15);
      const env = attack * (pt < 0.12 ? 1 : decay);

      // Piercing warning frequencies (880Hz + 1175Hz + harmonic 1760Hz)
      const tone1 = Math.sin(2 * Math.PI * 880 * pt);
      const tone2 = Math.sin(2 * Math.PI * 1174.66 * pt);
      const tone3 = Math.sin(2 * Math.PI * 1760 * pt);

      s = (tone1 * 0.45 + tone2 * 0.35 + tone3 * 0.2) * env;
    }

    samples[i] = s * 0.9;
  }
  return samples;
}

// 3. Victory Celebration Fanfare (Parcel Delivered / Green)
function generateVictoryDelivered() {
  const duration = 1.3;
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);

  // Arpeggio notes: C5 (523.25), E5 (659.25), G5 (783.99), High C6 (1046.5)
  const notes = [
    { start: 0.00, end: 0.15, freq: 523.25 },
    { start: 0.15, end: 0.30, freq: 659.25 },
    { start: 0.30, end: 0.45, freq: 783.99 },
    { start: 0.45, end: 1.25, freq: 1046.50, isFinal: true },
  ];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let s = 0;

    for (const note of notes) {
      if (t >= note.start && t < note.end) {
        const nt = t - note.start;
        const dur = note.end - note.start;
        const attack = Math.min(1, nt / 0.02);
        const decay = note.isFinal ? Math.exp(-nt * 3.2) : Math.min(1, (dur - nt) / 0.03);
        const env = attack * decay;

        // Rich triumphant brass synth timbre (fundamental + octaves + warm thirds)
        const f1 = Math.sin(2 * Math.PI * note.freq * nt);
        const f2 = Math.sin(2 * Math.PI * (note.freq * 2) * nt);
        const f3 = Math.sin(2 * Math.PI * (note.freq * 3) * nt);

        let noteSample = (f1 * 0.5 + f2 * 0.3 + f3 * 0.15) * env;

        // Final celebratory chord adds E6 (1318.5) and G6 (1567.98) sparkle
        if (note.isFinal) {
          const chordEnv = attack * Math.exp(-nt * 4.0);
          noteSample += 0.22 * Math.sin(2 * Math.PI * 1318.5 * nt) * chordEnv;
          noteSample += 0.18 * Math.sin(2 * Math.PI * 1567.98 * nt) * chordEnv;
          noteSample += 0.12 * Math.sin(2 * Math.PI * 2093.0 * nt) * chordEnv;
        }

        s += noteSample;
      }
    }

    samples[i] = s * 0.88;
  }
  return samples;
}

const outDir = path.resolve(__dirname, '../client/public/sounds');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

writeWav(path.join(outDir, 'shopify-chaching.wav'), generateShopifyChaChing());
writeWav(path.join(outDir, 'alert-urgent.wav'), generateAlertUrgent());
writeWav(path.join(outDir, 'victory-delivered.wav'), generateVictoryDelivered());

console.log('All 3 high-fidelity audio assets created successfully in', outDir);
