import { Platform } from 'react-native';

type OscType = 'sine' | 'square' | 'sawtooth' | 'triangle';

function beep(freq: number, duration: number, type: OscType = 'sine', volume = 0.25): void {
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined') return;
  const Ctx = (window as any).AudioContext ?? (window as any).webkitAudioContext;
  if (!Ctx) return;
  const ctx: AudioContext = new Ctx() as AudioContext;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

export function playCorrect(): void {
  beep(880, 0.18, 'sine');
}

export function playWrong(): void {
  beep(220, 0.25, 'sawtooth', 0.2);
}

export function playLevelUp(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const Ctx = (window as any).AudioContext ?? (window as any).webkitAudioContext;
  if (!Ctx) return;
  const ctx: AudioContext = new Ctx() as AudioContext;
  const notes: [number, number][] = [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36]];
  for (const [freq, delay] of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    gain.gain.setValueAtTime(0.25, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.18);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + 0.18);
  }
}
