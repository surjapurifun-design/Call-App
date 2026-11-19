// 100% Offline Web Audio API & Vibration Engine for Sn Call
// Supports custom audio/MP3 file playback, built-in harmonic Android-style ringtone fallback,
// authentic ITU-T DTMF dialpad tones, SMS chime, and call-end tone.

const DTMF_FREQS: Record<string, [number, number]> = {
  '1': [697, 1209],
  '2': [697, 1336],
  '3': [697, 1477],
  '4': [770, 1209],
  '5': [770, 1336],
  '6': [770, 1477],
  '7': [852, 1209],
  '8': [852, 1336],
  '9': [852, 1477],
  '*': [941, 1209],
  '0': [941, 1336],
  '#': [941, 1477],
};

class OfflineAudioEngine {
  private ctx: AudioContext | null = null;
  private customAudio: HTMLAudioElement | null = null;
  private customUrl: string | null = null;
  private ringInterval: number | null = null;
  private vibrateInterval: number | null = null;
  private activeOscillators: OscillatorNode[] = [];
  private isRinging = false;

  private ensureContext(): AudioContext | null {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  public unlock(): void {
    this.ensureContext();
  }

  public setCustomRingtone(file: File | null): string | null {
    this.stopRingtone();
    if (this.customUrl) {
      URL.revokeObjectURL(this.customUrl);
      this.customUrl = null;
    }
    this.customAudio = null;

    if (!file) return null;
    const url = URL.createObjectURL(file);
    this.customUrl = url;
    const audio = new Audio(url);
    audio.loop = true;
    audio.preload = 'auto';
    this.customAudio = audio;
    return file.name;
  }

  public hasCustomRingtone(): boolean {
    return this.customAudio !== null;
  }

  private playPixelPhrase(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    // Pleasant Google Pixel-inspired harmonic chime pattern (C5-E5-G5-B5-G5-E5)
    const now = ctx.currentTime;
    const notes: Array<{ freq: number; start: number; dur: number; gain: number }> = [
      { freq: 523.25, start: 0.0, dur: 0.22, gain: 0.22 },
      { freq: 659.25, start: 0.14, dur: 0.22, gain: 0.22 },
      { freq: 783.99, start: 0.28, dur: 0.26, gain: 0.24 },
      { freq: 1046.5, start: 0.44, dur: 0.36, gain: 0.22 },
      { freq: 783.99, start: 0.72, dur: 0.22, gain: 0.2 },
      { freq: 659.25, start: 0.88, dur: 0.34, gain: 0.22 },
      { freq: 783.99, start: 1.16, dur: 0.22, gain: 0.2 },
      { freq: 987.77, start: 1.32, dur: 0.42, gain: 0.22 },
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, now + note.start);

      overtone.type = 'triangle';
      overtone.frequency.setValueAtTime(note.freq * 2, now + note.start);

      const overtoneGain = ctx.createGain();
      overtoneGain.gain.setValueAtTime(0.18, now + note.start);

      gain.gain.setValueAtTime(0.0001, now + note.start);
      gain.gain.exponentialRampToValueAtTime(note.gain, now + note.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.dur);

      osc.connect(gain);
      overtone.connect(overtoneGain);
      overtoneGain.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + note.start);
      overtone.start(now + note.start);
      osc.stop(now + note.start + note.dur + 0.04);
      overtone.stop(now + note.start + note.dur + 0.04);

      this.activeOscillators.push(osc, overtone);
      osc.onended = () => {
        this.activeOscillators = this.activeOscillators.filter((o) => o !== osc && o !== overtone);
      };
    }
  }

  public startRingtone(withVibration = true): void {
    this.stopRingtone();
    this.isRinging = true;

    if (this.customAudio) {
      this.customAudio.currentTime = 0;
      this.customAudio.loop = true;
      const playPromise = this.customAudio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Fallback to Web Audio API if custom audio playback fails
          if (this.isRinging) {
            this.playPixelPhrase();
            this.ringInterval = window.setInterval(() => {
              if (this.isRinging) this.playPixelPhrase();
            }, 2600);
          }
        });
      }
    } else {
      this.playPixelPhrase();
      this.ringInterval = window.setInterval(() => {
        if (this.isRinging) this.playPixelPhrase();
      }, 2600);
    }

    if (withVibration) {
      this.startVibrationPattern();
    }
  }

  public stopRingtone(): void {
    this.isRinging = false;

    if (this.ringInterval !== null) {
      window.clearInterval(this.ringInterval);
      this.ringInterval = null;
    }

    for (const osc of this.activeOscillators) {
      try {
        osc.stop();
      } catch {
        // Ignore already stopped oscillators
      }
    }
    this.activeOscillators = [];

    if (this.customAudio) {
      try {
        this.customAudio.pause();
        this.customAudio.currentTime = 0;
      } catch {
        // Ignore pause errors
      }
    }

    this.stopVibration();
  }

  public startVibrationPattern(): void {
    this.stopVibration();
    const pulse = () => {
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate([500, 300, 500, 1000]);
        }
      } catch {
        // Ignore unsupported vibration
      }
    };
    pulse();
    this.vibrateInterval = window.setInterval(pulse, 2400);
  }

  public stopVibration(): void {
    if (this.vibrateInterval !== null) {
      window.clearInterval(this.vibrateInterval);
      this.vibrateInterval = null;
    }
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(0);
      }
    } catch {
      // Ignore unsupported vibration
    }
  }

  public vibrateOnce(pattern: number | number[] = 40): void {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch {
      // Ignore unsupported vibration
    }
  }

  public playDtmf(key: string): void {
    const pair = DTMF_FREQS[key];
    if (!pair) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(pair[0], now);
    osc2.frequency.setValueAtTime(pair[1], now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.14);
    osc2.stop(now + 0.14);
  }

  public playSmsChime(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const chimeNotes = [
      { freq: 880, start: 0, dur: 0.14 },
      { freq: 1174.66, start: 0.11, dur: 0.24 },
    ];

    for (const n of chimeNotes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, now + n.start);
      gain.gain.setValueAtTime(0.0001, now + n.start);
      gain.gain.exponentialRampToValueAtTime(0.18, now + n.start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.start);
      osc.stop(now + n.start + n.dur + 0.03);
    }

    this.vibrateOnce([110, 70, 140]);
  }

  public playCallEndTone(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const tones = [
      { freq: 480, start: 0, dur: 0.12 },
      { freq: 380, start: 0.14, dur: 0.16 },
    ];

    for (const t of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(t.freq, now + t.start);
      gain.gain.setValueAtTime(0.0001, now + t.start);
      gain.gain.exponentialRampToValueAtTime(0.12, now + t.start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t.start + t.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + t.start);
      osc.stop(now + t.start + t.dur + 0.02);
    }
  }
}

export const audioEngine = new OfflineAudioEngine();
