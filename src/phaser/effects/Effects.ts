import Phaser from "phaser";
import { WORLD_W, WORLD_H } from "../../utils/constants";

/**
 * Ambient rain effect with puddle splashes
 */
export class RainEffect {
  private drops: { x: number; y: number; len: number; speed: number; line: Phaser.GameObjects.Line }[] = [];
  private splashes: Phaser.GameObjects.Arc[] = [];
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, count = 60) {
    this.scene = scene;
    for (let i = 0; i < count; i++) {
      const x = Math.random() * WORLD_W;
      const y = Math.random() * WORLD_H;
      const len = 8 + Math.random() * 12;
      const speed = 3.5 + Math.random() * 2.5;
      const line = scene.add.line(0, 0, 0, 0, 0, len, 0x4ff5ff, 0.15 + Math.random() * 0.1)
        .setOrigin(0).setDepth(1800).setPosition(x, y);
      this.drops.push({ x, y, len, speed, line });
    }
  }

  update() {
    for (const drop of this.drops) {
      drop.y += drop.speed;
      drop.x -= drop.speed * 0.12;

      if (drop.y > WORLD_H + 10) {
        drop.y = -20;
        drop.x = Math.random() * WORLD_W;
        this.spawnSplash(drop.x, WORLD_H - 30 + Math.random() * 30);
      }

      drop.line.setPosition(drop.x, drop.y);
    }

    // Clean up splashes
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const s = this.splashes[i];
      if (s.alpha <= 0) {
        s.destroy();
        this.splashes.splice(i, 1);
      }
    }
  }

  private spawnSplash(x: number, y: number) {
    if (Math.random() > 0.12) return;
    const splash = this.scene.add.circle(x, y, 2, 0x4ff5ff, 0.3).setDepth(1799);
    this.splashes.push(splash);
    this.scene.tweens.add({
      targets: splash,
      scaleX: 3, scaleY: 1.5, alpha: 0,
      duration: 300,
    });
  }
}

/**
 * Floating ambient particles
 */
export class AmbientParticles {
  private particles: { obj: Phaser.GameObjects.Arc; vx: number; vy: number; phase: number }[] = [];

  constructor(scene: Phaser.Scene, count = 35) {
    const colors = [0x4ff5ff, 0xff55ef, 0x73ff7b, 0xb983ff, 0xffd700];
    for (let i = 0; i < count; i++) {
      const x = 80 + Math.random() * (WORLD_W - 160);
      const y = 80 + Math.random() * (WORLD_H - 160);
      const r = 0.8 + Math.random() * 2;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const obj = scene.add.circle(x, y, r, color, 0.15 + Math.random() * 0.1).setDepth(1700);
      this.particles.push({
        obj, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.25, phase: Math.random() * Math.PI * 2,
      });
    }
  }

  update(time: number) {
    for (const p of this.particles) {
      p.obj.x += p.vx;
      p.obj.y += p.vy + Math.sin(time * 0.001 + p.phase) * 0.2;
      p.obj.alpha = 0.1 + Math.sin(time * 0.0015 + p.phase) * 0.12;
      if (p.obj.x < 40 || p.obj.x > WORLD_W - 40) p.vx *= -1;
      if (p.obj.y < 60 || p.obj.y > WORLD_H - 40) p.vy *= -1;
    }
  }
}

/**
 * Neon glow effect - pulsing lights on furniture/signs
 */
export class NeonGlow {
  private lights: { obj: Phaser.GameObjects.Arc; baseAlpha: number; phase: number }[] = [];

  constructor(scene: Phaser.Scene, positions: { x: number; y: number; color: number; radius: number }[]) {
    for (const pos of positions) {
      const obj = scene.add.circle(pos.x, pos.y, pos.radius, pos.color, 0.15).setDepth(1600);
      this.lights.push({ obj, baseAlpha: 0.15, phase: Math.random() * Math.PI * 2 });
    }
  }

  update(time: number) {
    for (const light of this.lights) {
      light.obj.alpha = light.baseAlpha + Math.sin(time * 0.002 + light.phase) * 0.08;
      // Random flicker
      if (Math.random() < 0.003) {
        light.obj.alpha = 0.03;
      }
    }
  }
}
