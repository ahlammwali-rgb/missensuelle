/**
 * Scanner Audio & Haptic Feedback
 * Uses Web Audio API synthesize pleasant warehouse scanner sounds with zero latency.
 */
export function playScanSound(success = true) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
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
