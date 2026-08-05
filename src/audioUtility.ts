// Web Audio API Sound Synthesizer for Swim Timing Diagnostics
// Synthesizes beeps and alerts offline without requiring MP3 asset files.

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  // Resume context if suspended (browsers block audio until user interaction)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play a sequence of precise beep sounds.
 * @param count Number of beeps
 * @param frequency Frequency of the beep tone (Hz)
 * @param duration Duration of each beep (seconds)
 * @param interval Silence between beeps (seconds)
 */
export function playBeeps(count: number = 3, frequency: number = 900, duration: number = 0.08, interval: number = 0.12) {
  try {
    // Safety check: convert milliseconds to seconds if passed as > 5.0
    if (duration > 5.0) {
      duration = duration / 1000;
    }
    if (interval > 5.0) {
      interval = interval / 1000;
    }

    const ctx = getAudioContext();
    let time = ctx.currentTime;

    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, time);

      // Volume envelope to prevent popping
      gainNode.gain.setValueAtTime(0.001, time);
      gainNode.gain.linearRampToValueAtTime(0.2, time + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.start(time);
      osc.stop(time + duration);

      time += duration + interval;
    }
  } catch (err) {
    console.warn('Audio Context failed to play beeps:', err);
  }
}

/**
 * Play a loud starting horn tone.
 */
export function playStarterHorn() {
  try {
    const ctx = getAudioContext();
    const time = ctx.currentTime;
    const duration = 0.4;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Create a dual-oscillator rich starter horn sound (480Hz + 520Hz)
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(480, time);
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(520, time);

    gainNode.gain.setValueAtTime(0.001, time);
    gainNode.gain.linearRampToValueAtTime(0.25, time + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc1.start(time);
    osc1.stop(time + duration);
    osc2.start(time);
    osc2.stop(time + duration);
  } catch (err) {
    console.warn('Audio Context failed to play starter horn:', err);
  }
}

/**
 * Play a sweep sound to simulate microphone / feedback check.
 */
export function playMicSweep() {
  try {
    const ctx = getAudioContext();
    const time = ctx.currentTime;
    const duration = 0.5;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = 'sine';
    // Frequency sweep from 300Hz to 1100Hz
    osc.frequency.setValueAtTime(300, time);
    osc.frequency.exponentialRampToValueAtTime(1100, time + duration - 0.1);

    gainNode.gain.setValueAtTime(0.001, time);
    gainNode.gain.linearRampToValueAtTime(0.15, time + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.start(time);
    osc.stop(time + duration);
  } catch (err) {
    console.warn('Audio Context failed to play mic sweep:', err);
  }
}

/**
 * Play a high-tech electronic touchpad verification chime (2-tone rising chime: 1050Hz -> 1400Hz).
 */
export function playTouchpadChime() {
  try {
    const ctx = getAudioContext();
    const time = ctx.currentTime;

    // Tone 1: High crisp blip (1050 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1050, time);
    gain1.gain.setValueAtTime(0.001, time);
    gain1.gain.linearRampToValueAtTime(0.25, time + 0.005);
    gain1.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(time);
    osc1.stop(time + 0.08);

    // Tone 2: Rising chime (1400 Hz)
    const time2 = time + 0.07;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1400, time2);
    gain2.gain.setValueAtTime(0.001, time2);
    gain2.gain.linearRampToValueAtTime(0.3, time2 + 0.005);
    gain2.gain.exponentialRampToValueAtTime(0.001, time2 + 0.12);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(time2);
    osc2.stop(time2 + 0.12);
  } catch (err) {
    console.warn('Audio Context failed to play touchpad chime:', err);
  }
}
