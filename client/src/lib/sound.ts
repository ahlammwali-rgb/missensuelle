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
 * 1. 100% Authentic Real Cash Register Sound Effect (Recorded Mechanical Audio, NO Synth)
 * Uses high-fidelity real recordings:
 *  - "shopify": Authentic Shopify mobile Cha-Ching bell
 *  - "vintage": Mechanical heavy register lever, sliding coin drawer & physical bell
 */
export function playChaChingSound(variant?: "shopify" | "vintage") {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate([120, 50, 220, 40, 180]);
  }

  const selected =
    variant ||
    (typeof localStorage !== "undefined" ? localStorage.getItem("ms_cash_sound_type") : null) ||
    "shopify";

  const primaryUrl =
    selected === "vintage"
      ? "/sounds/cash-register-vintage.mp3"
      : "/sounds/shopify-chaching.mp3";

  const fallbackUrl =
    selected === "vintage"
      ? "/sounds/shopify-chaching.mp3"
      : "/sounds/cash-register-vintage.mp3";

  playAudioWithFallback(primaryUrl, () => {
    try {
      const alt = new Audio(fallbackUrl);
      alt.volume = 1.0;
      void alt.play();
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
