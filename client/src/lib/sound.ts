/**
 * Scanner Audio & Haptic Feedback
 * Uses Web Audio API synthesize pleasant warehouse scanner sounds with zero latency.
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
      // Pleasant high-pitch double chirp (880Hz -> 1320Hz)
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
      // Low buzz error tone (220Hz)
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
  } catch {
    // AudioContext blocked or not supported
  }
}

/**
 * Authentic Shopify-style Cash Register "Cha-Ching" 💰 Sound Effect
 * Synthesizes the mechanical cash drawer slide + dual crystal bell chime + coin drops.
 */
export function playChaChingSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Drawer slide (filtered white noise)
    const bufferSize = Math.floor(ctx.sampleRate * 0.09);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(1400, now);
    noiseFilter.Q.setValueAtTime(3, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.18, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    whiteNoise.start(now);
    whiteNoise.stop(now + 0.09);

    // 2. Drawer latch / mechanical clank (160Hz -> 60Hz)
    const latchOsc = ctx.createOscillator();
    const latchGain = ctx.createGain();
    latchOsc.type = "triangle";
    latchOsc.frequency.setValueAtTime(180, now);
    latchOsc.frequency.exponentialRampToValueAtTime(50, now + 0.06);
    latchGain.gain.setValueAtTime(0.22, now);
    latchGain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
    latchOsc.connect(latchGain);
    latchGain.connect(ctx.destination);
    latchOsc.start(now);
    latchOsc.stop(now + 0.06);

    // 3. Primary Bell (Crystal C6 - 1046.5 Hz)
    const bell1 = ctx.createOscillator();
    const bell1Gain = ctx.createGain();
    bell1.type = "sine";
    bell1.frequency.setValueAtTime(1046.5, now + 0.05);
    bell1Gain.gain.setValueAtTime(0.001, now);
    bell1Gain.gain.setValueAtTime(0.4, now + 0.06);
    bell1Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    bell1.connect(bell1Gain);
    bell1Gain.connect(ctx.destination);
    bell1.start(now + 0.05);
    bell1.stop(now + 0.85);

    // 4. Harmonic Bell (C7 - 2093 Hz)
    const bell2 = ctx.createOscillator();
    const bell2Gain = ctx.createGain();
    bell2.type = "sine";
    bell2.frequency.setValueAtTime(2093, now + 0.05);
    bell2Gain.gain.setValueAtTime(0.001, now);
    bell2Gain.gain.setValueAtTime(0.28, now + 0.06);
    bell2Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    bell2.connect(bell2Gain);
    bell2Gain.connect(ctx.destination);
    bell2.start(now + 0.05);
    bell2.stop(now + 0.7);

    // 5. High Shimmer Ring (G7 - 3136 Hz)
    const bell3 = ctx.createOscillator();
    const bell3Gain = ctx.createGain();
    bell3.type = "sine";
    bell3.frequency.setValueAtTime(3136, now + 0.06);
    bell3Gain.gain.setValueAtTime(0.001, now);
    bell3Gain.gain.setValueAtTime(0.15, now + 0.07);
    bell3Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    bell3.connect(bell3Gain);
    bell3Gain.connect(ctx.destination);
    bell3.start(now + 0.06);
    bell3.stop(now + 0.5);

    // 6. Staggered Coin Clinks
    const playCoin = (freq: number, startDelay: number) => {
      const coin = ctx.createOscillator();
      const coinGain = ctx.createGain();
      coin.type = "sine";
      coin.frequency.setValueAtTime(freq, now + startDelay);
      coinGain.gain.setValueAtTime(0.001, now);
      coinGain.gain.setValueAtTime(0.12, now + startDelay);
      coinGain.gain.exponentialRampToValueAtTime(0.001, now + startDelay + 0.06);
      coin.connect(coinGain);
      coinGain.connect(ctx.destination);
      coin.start(now + startDelay);
      coin.stop(now + startDelay + 0.06);
    };

    playCoin(3600, 0.12);
    playCoin(4250, 0.18);
    playCoin(4800, 0.25);

    // Haptic phone vibration pattern: distinctive cash register pulse
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([120, 60, 240, 50, 180]);
    }
  } catch {
    // AudioContext blocked or not supported
  }
}

/**
 * Cart Abandonment Alert Sound
 * Gentle high double chime to alert without being as loud as a full order.
 */
export function playAbandonedAlertSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now); // E5
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.2);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.12); // A5
    gain2.gain.setValueAtTime(0.22, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([80, 50, 120]);
    }
  } catch {
    // AudioContext blocked or not supported
  }
}
