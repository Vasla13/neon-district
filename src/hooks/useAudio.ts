/**
 * Synthesized audio engine using Web Audio API
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private _enabled = true;

  get enabled() { return this._enabled; }

  toggle(): boolean {
    this._enabled = !this._enabled;
    return this._enabled;
  }

  play(type: string) {
    if (!this._enabled) return;
    try {
      if (!this.ctx) this.ctx = new AudioContext();
      const c = this.ctx;
      const o = c.createOscillator();
      const g = c.createGain();
      o.connect(g);
      g.connect(c.destination);
      const t = c.currentTime;

      switch (type) {
        case "click":
          o.type = "sine";
          o.frequency.setValueAtTime(900, t);
          o.frequency.exponentialRampToValueAtTime(350, t + 0.06);
          g.gain.setValueAtTime(0.08, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
          o.start(); o.stop(t + 0.06);
          break;
        case "achievement":
          o.type = "square";
          o.frequency.setValueAtTime(523, t);
          o.frequency.setValueAtTime(659, t + 0.08);
          o.frequency.setValueAtTime(784, t + 0.16);
          o.frequency.setValueAtTime(1047, t + 0.24);
          g.gain.setValueAtTime(0.06, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
          o.start(); o.stop(t + 0.4);
          break;
        case "terminal":
          o.type = "sawtooth";
          o.frequency.setValueAtTime(120, t);
          o.frequency.exponentialRampToValueAtTime(800, t + 0.12);
          g.gain.setValueAtTime(0.05, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
          o.start(); o.stop(t + 0.15);
          break;
        case "event":
          o.type = "square";
          o.frequency.setValueAtTime(180, t);
          o.frequency.exponentialRampToValueAtTime(1400, t + 0.25);
          o.frequency.exponentialRampToValueAtTime(180, t + 0.5);
          g.gain.setValueAtTime(0.06, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
          o.start(); o.stop(t + 0.5);
          break;
        case "chat":
          o.type = "sine";
          o.frequency.setValueAtTime(700, t);
          g.gain.setValueAtTime(0.03, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
          o.start(); o.stop(t + 0.04);
          break;
        case "notification":
          o.type = "triangle";
          o.frequency.setValueAtTime(1000, t);
          o.frequency.setValueAtTime(1200, t + 0.06);
          g.gain.setValueAtTime(0.05, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
          o.start(); o.stop(t + 0.12);
          break;
        case "step":
          o.type = "sine";
          o.frequency.setValueAtTime(200 + Math.random() * 100, t);
          g.gain.setValueAtTime(0.02, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
          o.start(); o.stop(t + 0.04);
          break;
        default:
          o.type = "sine";
          o.frequency.setValueAtTime(440, t);
          g.gain.setValueAtTime(0.04, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
          o.start(); o.stop(t + 0.08);
      }
    } catch { /* Web Audio not supported */ }
  }
}

export const audio = new AudioEngine();
