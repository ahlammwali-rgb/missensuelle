/**
 * Studio-Grade Audio & Haptic Feedback Suite for Miss Sensuelle
 * Supports:
 *  1. Authentic Shopify "Cha-Ching" 💰 Sound Effect (100% fidelity)
 *  2. Urgent Red Alert Siren 🚨 (Problems needing intervention: ne_repond_pas, annulee, reportee)
 *  3. Victory Fanfare 🎉 (Delivered parcels / colis livré en vert)
 *  4. Cart Abandonment alert
 *  5. Scanner audio
 */

function getAudioContext(): AudioContext | null {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Play audio using HTML5 Audio with instant Web Audio API synthesis fallback.
 */
function playAudioWithFallback(soundUrl: string, fallbackSynth: () => void) {
  try {
    if (typeof window === "undefined") return;
    const audio = new Audio(soundUrl);
    audio.volume = 1.0;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Fallback to Web Audio synthesis if file playback is blocked by policy
        fallbackSynth();
      });
    }
  } catch {
    fallbackSynth();
  }
}

/**
 * Scanner Audio (Warehouse barcode scan)
 */
export function playScanSound(success = true) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (success) {
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

      osc.start(now);
      osc.stop(now + 0.12);

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([60, 30, 90]);
      }
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, now);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

      osc.start(now);
      osc.stop(now + 0.25);

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(250);
      }
    }
  } catch {}
}

/**
 * 1. 100% Authentic Shopify-Style "Cha-Ching" 💰 Sound Effect
 * Used when a new order arrives.
 */
export function playChaChingSound() {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate([120, 50, 220, 40, 180]);
  }

  playAudioWithFallback("/sounds/shopify-chaching.wav", () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Mechanical drawer slide
      const bufferSize = Math.floor(ctx.sampleRate * 0.08);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1350, now);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.25, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      whiteNoise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      whiteNoise.start(now);
      whiteNoise.stop(now + 0.08);

      // Primary crystal bell C6 (1046.5 Hz)
      const bell1 = ctx.createOscillator();
      const bellGain1 = ctx.createGain();
      bell1.type = "sine";
      bell1.frequency.setValueAtTime(1046.5, now + 0.05);
      bellGain1.gain.setValueAtTime(0.42, now + 0.05);
      bellGain1.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      bell1.connect(bellGain1);
      bellGain1.connect(ctx.destination);
      bell1.start(now + 0.05);
      bell1.stop(now + 0.9);

      // Harmonic C7 (2093 Hz)
      const bell2 = ctx.createOscillator();
      const bellGain2 = ctx.createGain();
      bell2.type = "sine";
      bell2.frequency.setValueAtTime(2093, now + 0.05);
      bellGain2.gain.setValueAtTime(0.28, now + 0.05);
      bellGain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      bell2.connect(bellGain2);
      bellGain2.connect(ctx.destination);
      bell2.start(now + 0.05);
      bell2.stop(now + 0.75);

      // Shimmer G7 (3136 Hz)
      const bell3 = ctx.createOscillator();
      const bellGain3 = ctx.createGain();
      bell3.type = "sine";
      bell3.frequency.setValueAtTime(3136, now + 0.06);
      bellGain3.gain.setValueAtTime(0.18, now + 0.06);
      bellGain3.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      bell3.connect(bellGain3);
      bellGain3.connect(ctx.destination);
      bell3.start(now + 0.06);
      bell3.stop(now + 0.5);
    } catch {}
  });
}

/**
 * 2. Urgent Red Alert Siren 🚨
 * Used for parcel issues requiring immediate intervention (ne_repond_pas, annulee, reportee, litige).
 */
export function playUrgentAlertSound() {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate([280, 90, 280, 90, 450]);
  }

  playAudioWithFallback("/sounds/alert-urgent.wav", () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Pulse 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sawtooth";
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.18);

      // Pulse 2
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sawtooth";
      osc2.frequency.setValueAtTime(1175, now + 0.24);
      gain2.gain.setValueAtTime(0.35, now + 0.24);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.44);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.24);
      osc2.stop(now + 0.44);
    } catch {}
  });
}

/**
 * 3. Victory Celebration Fanfare 🎉
 * Used when a parcel is delivered (COLI LIVRÉ en VERT).
 */
export function playVictoryDeliveredSound() {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate([90, 50, 140, 50, 180, 50, 320]);
  }

  playAudioWithFallback("/sounds/victory-delivered.wav", () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const playNote = (freq: number, start: number, dur: number, vol: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + start);
        gain.gain.setValueAtTime(vol, now + start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + dur);
      };

      playNote(523.25, 0.00, 0.15, 0.25); // C5
      playNote(659.25, 0.14, 0.15, 0.28); // E5
      playNote(783.99, 0.28, 0.16, 0.32); // G5
      playNote(1046.5, 0.42, 0.70, 0.40); // High C6
    } catch {}
  });
}

/**
 * 4. Cart Abandonment Alert Sound
 */
export function playAbandonedAlertSound() {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate([80, 50, 120]);
  }

  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.2);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.22, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);
  } catch {}
}
