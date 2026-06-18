import Phaser from "phaser";

type Avatar = "runner" | "hacker" | "ghost" | "dj";
type Role = "New User" | "Runner" | "Hacker" | "Architect" | "DJ" | "Sentinel" | "Ghost" | "Admin" | "Founder";

type Player = {
  id: string;
  pseudo: string;
  avatar: Avatar;
  role: Role;
  x: number;
  y: number;
  emote?: string;
  zone?: string;
};

type GameHooks = {
  onReady: (scene: DistrictScene) => void;
  onMove: (x: number, y: number) => void;
  onTerminal: () => void;
  onZoneEnter?: (zone: string) => void;
  onArcade?: () => void;
};

const W = 1280;
const H = 720;
const baseRoom = { width: W, height: H, centerX: W / 2, centerY: H / 2 };
const textureScale = 2;

const roleColors: Record<Role, number> = {
  "New User": 0x76f8ff,
  Runner: 0x36dfff,
  Hacker: 0x78ff7e,
  Architect: 0xffffff,
  DJ: 0xff55ef,
  Sentinel: 0x5d9bff,
  Ghost: 0xbc83ff,
  Admin: 0xff5165,
  Founder: 0xffd700,
};

const roleColorStr: Record<Role, string> = {
  "New User": "#76f8ff",
  Runner: "#36dfff",
  Hacker: "#78ff7e",
  Architect: "#ffffff",
  DJ: "#ff55ef",
  Sentinel: "#5d9bff",
  Ghost: "#bc83ff",
  Admin: "#ff5165",
  Founder: "#ffd700",
};

const avatarPalette: Record<Avatar, { body: string; trim: string; glow: string; eye: string }> = {
  runner: { body: "#0d2d3f", trim: "#15cbed", glow: "#4ff5ff", eye: "#15cbed" },
  hacker: { body: "#0d2f14", trim: "#4bea69", glow: "#73ff7b", eye: "#4bea69" },
  ghost: { body: "#1f0d3a", trim: "#a574ff", glow: "#d3a8ff", eye: "#a574ff" },
  dj: { body: "#2f0d29", trim: "#ff49e7", glow: "#ff88f5", eye: "#ff49e7" },
};

export class DistrictScene extends Phaser.Scene {
  private hooks: GameHooks;
  private sprites = new Map<string, Phaser.GameObjects.Container>();
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private speech = new Map<string, Phaser.GameObjects.Text>();
  private emoteSprites = new Map<string, Phaser.GameObjects.Text>();
  private terminalZone!: Phaser.GameObjects.Zone;
  private arcadeZone!: Phaser.GameObjects.Zone;
  private marker!: Phaser.GameObjects.Image;
  private rain: Phaser.GameObjects.Line[] = [];
  private neonSigns: Phaser.GameObjects.Image[] = [];
  private floatingParticles: { obj: Phaser.GameObjects.Arc; vx: number; vy: number }[] = [];
  private hologramObjects: Phaser.GameObjects.Container[] = [];
  private pulse = 0;
  private localSprite: Phaser.GameObjects.Container | null = null;

  constructor(hooks: GameHooks) {
    super("DistrictScene");
    this.hooks = hooks;
  }

  create() {
    this.cameras.main.setBackgroundColor("#030508");
    this.buildTextures();
    this.drawWorld();
    this.createRain();
    this.createFloatingParticles();
    this.createHolograms();
    this.centerCamera();
    this.scale.on("resize", () => this.centerCamera());
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.handleClick(p));
    this.hooks.onReady(this);
  }

  update(time: number, delta: number) {
    this.pulse += delta * 0.001;

    // Rain animation
    for (const drop of this.rain) {
      drop.y += 4 + Math.random() * 2;
      if (drop.y > H + 20) {
        drop.y = -20;
        drop.x = Math.random() * W;
      }
      drop.alpha = 0.15 + Math.sin(this.pulse * 3 + drop.x * 0.01) * 0.08;
    }

    // Floating particles
    for (const p of this.floatingParticles) {
      p.obj.x += p.vx;
      p.obj.y += p.vy + Math.sin(this.pulse * 2 + p.obj.x * 0.02) * 0.3;
      p.obj.alpha = 0.2 + Math.sin(this.pulse * 1.5 + p.obj.y * 0.03) * 0.15;
      if (p.obj.y < 60 || p.obj.y > H - 20) p.vy *= -1;
      if (p.obj.x < 40 || p.obj.x > W - 40) p.vx *= -1;
    }

    // Hologram pulse
    for (const holo of this.hologramObjects) {
      holo.alpha = 0.6 + Math.sin(this.pulse * 3 + holo.x * 0.01) * 0.2;
      holo.y += Math.sin(this.pulse * 2) * 0.15;
    }

    // Neon sign flicker
    for (let i = 0; i < this.neonSigns.length; i++) {
      const sign = this.neonSigns[i];
      if (Math.random() < 0.005) {
        sign.alpha = 0.3;
        this.time.delayedCall(50 + Math.random() * 100, () => { sign.alpha = 1; });
      }
    }
  }

  syncWorld(players: Player[], localPseudo: string) {
    const known = new Set(players.map((p) => p.id));

    for (const [id, sprite] of this.sprites) {
      if (!known.has(id)) {
        sprite.destroy();
        this.sprites.delete(id);
        this.labels.delete(id);
        this.speech.delete(id);
        this.emoteSprites.delete(id);
      }
    }

    for (const player of players) {
      let container = this.sprites.get(player.id);
      const isLocal = player.pseudo === localPseudo;

      if (!container) {
        container = this.buildCharacter(player, isLocal);
        this.sprites.set(player.id, container);
        if (isLocal) this.localSprite = container;
      }

      const target = this.clamp(player.x, player.y);
      this.tweens.killTweensOf(container);
      this.tweens.add({
        targets: container,
        x: target.x,
        y: target.y,
        duration: isLocal ? 180 : 320,
        ease: "Power2",
        onUpdate: () => {
          container!.setDepth(Math.floor(container!.y) + 500);
        },
      });

      if (player.emote) this.showEmote(player.id, player.emote);
    }
  }

  showSpeech(pseudo: string, text: string) {
    const entry = [...this.labels.entries()].find(([, l]) => l.text === pseudo);
    if (!entry) return;
    const bubble = this.speech.get(entry[0]);
    if (!bubble) return;
    const displayText = text.length > 42 ? text.slice(0, 39) + "..." : text;
    bubble.setText(displayText).setVisible(true).setAlpha(0);
    this.tweens.add({
      targets: bubble,
      alpha: 1,
      duration: 200,
    });
    this.time.delayedCall(4000, () => {
      this.tweens.add({ targets: bubble, alpha: 0, duration: 300, onComplete: () => bubble.setVisible(false) });
    });
  }

  showEmote(playerId: string, emote: string) {
    const container = this.sprites.get(playerId);
    if (!container) return;
    let emoteObj = this.emoteSprites.get(playerId);
    const icons: Record<string, string> = {
      wave: "👋", dance: "💃", hack: "⚡", chill: "😎", salute: "🫡", glitch: "⚠️"
    };
    const icon = icons[emote] ?? "✨";
    if (!emoteObj) {
      emoteObj = this.add.text(0, -80, icon, { fontSize: "28px" }).setOrigin(0.5).setDepth(2000);
      container.add(emoteObj);
      this.emoteSprites.set(playerId, emoteObj);
    }
    emoteObj.setText(icon).setVisible(true).setAlpha(1).setScale(0);
    this.tweens.add({
      targets: emoteObj,
      scale: 1.4,
      y: -100,
      duration: 600,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: emoteObj,
          alpha: 0,
          scale: 0.5,
          y: -120,
          duration: 800,
          delay: 1200,
          onComplete: () => emoteObj?.setVisible(false).setY(-80),
        });
      },
    });
  }

  triggerGlitchEffect() {
    this.cameras.main.shake(300, 0.008);
    this.cameras.main.flash(200, 79, 245, 255, false);
    // Chromatic aberration feel
    const rect = this.add.rectangle(W / 2, H / 2, W, H, 0xff55ef, 0.08).setDepth(3000);
    this.tweens.add({
      targets: rect,
      alpha: 0,
      duration: 500,
      onComplete: () => rect.destroy(),
    });
  }

  triggerAchievementEffect(x: number, y: number) {
    const colors = [0x4ff5ff, 0xff55ef, 0x73ff7b, 0xffd700];
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const dist = 40 + Math.random() * 40;
      const size = 2 + Math.random() * 4;
      const color = colors[i % colors.length];
      const particle = this.add.circle(x, y, size, color, 1).setDepth(2500);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist * 0.6,
        alpha: 0,
        scale: 0,
        duration: 500 + Math.random() * 300,
        ease: "Expo.easeOut",
        onComplete: () => particle.destroy(),
      });
    }
    // Ring burst
    const ring = this.add.circle(x, y, 5, 0xffffff, 0).setStrokeStyle(2, 0x4ff5ff, 1).setDepth(2499);
    this.tweens.add({
      targets: ring,
      radius: 60,
      alpha: 0,
      duration: 600,
      ease: "Expo.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  // ===================== WORLD BUILDING =====================

  private drawWorld() {
    // Sky / backdrop
    this.img(W / 2, H / 2, "world-bg", 0);

    // Distant city skyline (parallax feel)
    this.img(W / 2, 135, "skyline", 2);

    // Main buildings row
    this.img(200, 195, "building-tall", 5);
    this.img(420, 205, "building-wide", 5);
    this.img(660, 190, "building-center", 5);
    this.img(900, 200, "building-tech", 5);
    this.img(1100, 210, "building-small", 5);

    // Neon signs (animated)
    this.neonSigns.push(this.img(200, 148, "sign-district", 6));
    this.neonSigns.push(this.img(660, 145, "sign-2042", 6));
    this.neonSigns.push(this.img(900, 155, "sign-arcade", 6));

    // Floor / plaza
    this.img(W / 2, 480, "plaza-floor", 10);

    // Zone landmarks
    this.img(320, 440, "zone-bar", 400);
    this.img(320, 520, "zone-bar-front", 530);
    this.img(540, 380, "zone-lounge", 380);
    this.img(640, 300, "zone-spawn-pad", 300);
    this.img(800, 380, "zone-missions", 380);
    this.img(920, 440, "zone-terminal", 440);
    this.terminalZone = this.add.zone(920, 430, 80, 80);
    this.img(640, 530, "zone-event-stage", 530);
    this.img(780, 560, "zone-arcade", 560);
    this.arcadeZone = this.add.zone(780, 560, 120, 80);
    this.img(1040, 480, "zone-staff", 480);

    // Decorative elements
    this.img(160, 530, "deco-vending", 540);
    this.img(460, 580, "deco-bench", 590);
    this.img(1120, 560, "deco-crate", 570);
    this.img(250, 440, "deco-plant", 450);
    this.img(500, 450, "deco-lamp", 300);
    this.img(780, 450, "deco-lamp", 300);
    this.img(1060, 420, "deco-lamp", 300);

    // Click marker
    this.marker = this.img(0, 0, "click-marker", 999).setVisible(false);

    // Instruction text
    this.add.text(W / 2, H - 18, "CLIQUE POUR BOUGER • TERMINAL 404 • ARCADE • /talk NPC", {
      fontFamily: "'Courier New', monospace",
      fontSize: "11px",
      color: "#4ff5ff",
      stroke: "#030508",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(1500).setAlpha(0.7);
  }

  // ===================== RAIN =====================

  private createRain() {
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const length = 8 + Math.random() * 14;
      const line = this.add.line(0, 0, x, y, x - 1, y + length, 0x4ff5ff, 0.18)
        .setOrigin(0).setDepth(1700);
      (line as any).x = x;
      (line as any).y = y;
      this.rain.push(line);
    }
  }

  // ===================== FLOATING PARTICLES =====================

  private createFloatingParticles() {
    const colors = [0x4ff5ff, 0xff55ef, 0x73ff7b, 0xb983ff, 0xffd700];
    for (let i = 0; i < 40; i++) {
      const x = 100 + Math.random() * (W - 200);
      const y = 100 + Math.random() * (H - 200);
      const r = 1 + Math.random() * 2.5;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const obj = this.add.circle(x, y, r, color, 0.2).setDepth(1650);
      this.floatingParticles.push({
        obj,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.3,
      });
    }
  }

  // ===================== HOLOGRAMS =====================

  private createHolograms() {
    // Holographic display above event stage
    const holo1 = this.add.container(640, 490).setDepth(520).setAlpha(0.7);
    const holoBase = this.add.rectangle(0, 0, 80, 50, 0x4ff5ff, 0.08).setStrokeStyle(1, 0x4ff5ff, 0.5);
    const holoText = this.add.text(0, 0, "EVENT\nACTIF", {
      fontFamily: "'Courier New', monospace", fontSize: "10px", color: "#4ff5ff", align: "center"
    }).setOrigin(0.5);
    holo1.add([holoBase, holoText]);
    this.hologramObjects.push(holo1);

    // Hologram near terminal
    const holo2 = this.add.container(920, 390).setDepth(420).setAlpha(0.6);
    const h2bg = this.add.rectangle(0, 0, 60, 35, 0x73ff7b, 0.06).setStrokeStyle(1, 0x73ff7b, 0.4);
    const h2txt = this.add.text(0, 0, "404", {
      fontFamily: "'Courier New', monospace", fontSize: "14px", fontStyle: "bold", color: "#73ff7b"
    }).setOrigin(0.5);
    holo2.add([h2bg, h2txt]);
    this.hologramObjects.push(holo2);
  }

  // ===================== CHARACTERS =====================

  private buildCharacter(player: Player, isLocal: boolean): Phaser.GameObjects.Container {
    const palette = avatarPalette[player.avatar];
    const roleColor = roleColors[player.role];
    const container = this.add.container(player.x, player.y).setDepth(player.y + 500);

    // Shadow
    const shadow = this.add.ellipse(0, 18, 28, 10, 0x000000, 0.4);

    // Glow ring under character
    const glow = this.add.ellipse(0, 16, 34, 12, roleColor, isLocal ? 0.4 : 0.2);
    this.tweens.add({
      targets: glow,
      scaleX: 1.15,
      scaleY: 1.15,
      alpha: isLocal ? 0.15 : 0.08,
      yoyo: true,
      repeat: -1,
      duration: 1200,
      ease: "Sine.easeInOut",
    });

    // Body sprite
    const body = this.img(0, -8, `char-${player.avatar}`, 0);
    body.setScale(1 / textureScale);

    // Direction indicator for local player
    if (isLocal) {
      const indicator = this.add.triangle(0, 28, 0, -4, -5, 4, 5, 4, roleColor, 0.7);
      this.tweens.add({
        targets: indicator,
        y: 32,
        alpha: 0.3,
        yoyo: true,
        repeat: -1,
        duration: 800,
      });
      container.add(indicator);
    }

    // Name label with background
    const nameWidth = Math.max(60, player.pseudo.length * 7.5 + 16);
    const labelBg = this.add.rectangle(0, 30, nameWidth, 16, 0x030810, 0.85)
      .setStrokeStyle(1, roleColor, 0.7);
    const label = this.add.text(0, 30, player.pseudo, {
      fontFamily: "'Courier New', monospace",
      fontSize: "11px",
      fontStyle: "bold",
      color: "#ffffff",
      stroke: "#030508",
      strokeThickness: 2,
    }).setOrigin(0.5).setResolution(2);

    // Speech bubble
    const bubble = this.add.text(0, -70, "", {
      fontFamily: "'Segoe UI', Arial, sans-serif",
      fontSize: "11px",
      color: "#0a1218",
      backgroundColor: "#e8fbff",
      padding: { x: 8, y: 5 },
      wordWrap: { width: 160 },
    }).setOrigin(0.5).setVisible(false).setDepth(2000).setResolution(2);

    container.add([shadow, glow, body, labelBg, label, bubble]);
    this.labels.set(player.id, label);
    this.speech.set(player.id, bubble);

    // Idle bobbing animation
    this.tweens.add({
      targets: body,
      y: -10,
      yoyo: true,
      repeat: -1,
      duration: 1800 + Math.random() * 400,
      ease: "Sine.easeInOut",
    });

    return container;
  }

  // ===================== INTERACTION =====================

  private handleClick(pointer: Phaser.Input.Pointer) {
    if (this.terminalZone.getBounds().contains(pointer.worldX, pointer.worldY)) {
      this.cameras.main.flash(150, 115, 255, 123);
      this.triggerTerminalEffect();
      this.hooks.onTerminal();
      return;
    }

    if (this.arcadeZone.getBounds().contains(pointer.worldX, pointer.worldY)) {
      this.cameras.main.flash(100, 255, 85, 239);
      this.hooks.onArcade?.();
      return;
    }

    const point = this.clamp(pointer.worldX, pointer.worldY);

    // Click effect: expanding ring
    this.marker.setPosition(point.x, point.y).setVisible(true).setAlpha(0.9).setScale(0.5);
    this.tweens.add({
      targets: this.marker,
      alpha: 0,
      scale: 1.5,
      duration: 500,
      ease: "Expo.easeOut",
      onComplete: () => this.marker.setVisible(false),
    });

    // Trail particles towards destination
    for (let i = 0; i < 3; i++) {
      const trail = this.add.circle(
        point.x + (Math.random() - 0.5) * 20,
        point.y + (Math.random() - 0.5) * 10,
        2, 0x4ff5ff, 0.6
      ).setDepth(300);
      this.tweens.add({
        targets: trail,
        alpha: 0,
        scale: 0,
        duration: 400 + i * 100,
        onComplete: () => trail.destroy(),
      });
    }

    this.hooks.onMove(point.x, point.y);
  }

  private triggerTerminalEffect() {
    const lines = 8;
    for (let i = 0; i < lines; i++) {
      const y = 390 + i * 8;
      const line = this.add.rectangle(920, y, 50 + Math.random() * 30, 2, 0x73ff7b, 0.8)
        .setDepth(2000);
      this.tweens.add({
        targets: line,
        alpha: 0,
        scaleX: 2,
        duration: 300 + i * 50,
        onComplete: () => line.destroy(),
      });
    }
  }

  // ===================== CAMERA =====================

  private centerCamera() {
    const view = this.scale.gameSize;
    const zoom = Phaser.Math.Clamp(
      Math.min(view.width / W, view.height / H) * 0.92,
      0.7, 2.0
    );
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(W / 2, H / 2);
  }

  // ===================== TEXTURE GENERATION =====================

  private buildTextures() {
    // World background
    this.tex("world-bg", W, H, (ctx) => {
      // Deep sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#020308");
      sky.addColorStop(0.15, "#060b14");
      sky.addColorStop(0.4, "#0a1220");
      sky.addColorStop(0.7, "#0d1a2e");
      sky.addColorStop(1, "#081018");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // Stars
      for (let i = 0; i < 60; i++) {
        const sx = Math.random() * W;
        const sy = Math.random() * 120;
        const sr = Math.random() * 1.2;
        ctx.fillStyle = `rgba(200,240,255,${0.2 + Math.random() * 0.5})`;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Grid floor perspective
      ctx.save();
      ctx.strokeStyle = "rgba(79,245,255,0.07)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 30; i++) {
        const y = 310 + i * 16;
        const spread = (y - 310) * 1.8;
        ctx.beginPath();
        ctx.moveTo(W / 2 - spread, y);
        ctx.lineTo(W / 2 + spread, y);
        ctx.stroke();
      }
      for (let i = -15; i <= 15; i++) {
        ctx.beginPath();
        ctx.moveTo(W / 2 + i * 8, 310);
        ctx.lineTo(W / 2 + i * 70, H);
        ctx.stroke();
      }
      ctx.restore();

      // Fog at bottom
      const fog = ctx.createLinearGradient(0, H - 100, 0, H);
      fog.addColorStop(0, "rgba(8,16,24,0)");
      fog.addColorStop(1, "rgba(8,16,24,0.6)");
      ctx.fillStyle = fog;
      ctx.fillRect(0, H - 100, W, 100);
    });

    // Skyline
    this.tex("skyline", W, 180, (ctx) => {
      const colors = ["#0c1a28", "#0a1520", "#081018", "#0d1f2e", "#091318"];
      for (let i = 0; i < 40; i++) {
        const x = i * 34 - 10;
        const h = 40 + ((i * 17) % 120);
        const w = 18 + ((i * 7) % 20);
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(x, 180 - h, w, h);
        // Windows
        const windowColor = i % 5 === 0 ? "#ff55ef" : i % 3 === 0 ? "#4ff5ff" : "#1a3848";
        for (let wy = 180 - h + 8; wy < 175; wy += 12) {
          for (let wx = x + 4; wx < x + w - 4; wx += 7) {
            if (Math.random() > 0.4) {
              ctx.fillStyle = windowColor;
              ctx.globalAlpha = 0.3 + Math.random() * 0.5;
              ctx.fillRect(wx, wy, 3, 4);
            }
          }
        }
        ctx.globalAlpha = 1;
        // Roof detail
        if (i % 3 === 0) {
          ctx.fillStyle = "#4ff5ff";
          ctx.fillRect(x + w / 2 - 2, 180 - h - 6, 4, 6);
        }
      }
    });

    // Buildings
    this.texBuilding("building-tall", 120, 160, "#0c1824", "#4ff5ff", true);
    this.texBuilding("building-wide", 180, 120, "#0a1420", "#5d9bff", false);
    this.texBuilding("building-center", 200, 170, "#0d1a28", "#ff55ef", true);
    this.texBuilding("building-tech", 160, 140, "#081420", "#73ff7b", true);
    this.texBuilding("building-small", 100, 110, "#0b1620", "#b983ff", false);

    // Signs
    this.tex("sign-district", 100, 28, (ctx) => {
      this.roundRect(ctx, 0, 0, 100, 28, 4, "#050a10");
      ctx.strokeStyle = "#4ff5ff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = "bold 12px 'Courier New', monospace";
      ctx.fillStyle = "#4ff5ff";
      ctx.textAlign = "center";
      ctx.fillText("DISTRICT", 50, 18);
      ctx.shadowColor = "#4ff5ff";
      ctx.shadowBlur = 8;
      ctx.fillText("DISTRICT", 50, 18);
      ctx.shadowBlur = 0;
    });

    this.tex("sign-2042", 80, 32, (ctx) => {
      this.roundRect(ctx, 0, 0, 80, 32, 4, "#0a0510");
      ctx.strokeStyle = "#ff55ef";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = "bold italic 16px Arial";
      ctx.fillStyle = "#ff55ef";
      ctx.textAlign = "center";
      ctx.shadowColor = "#ff55ef";
      ctx.shadowBlur = 10;
      ctx.fillText("2042", 40, 22);
      ctx.shadowBlur = 0;
    });

    this.tex("sign-arcade", 90, 26, (ctx) => {
      this.roundRect(ctx, 0, 0, 90, 26, 4, "#100520");
      ctx.strokeStyle = "#b983ff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = "bold 11px 'Courier New', monospace";
      ctx.fillStyle = "#b983ff";
      ctx.textAlign = "center";
      ctx.shadowColor = "#b983ff";
      ctx.shadowBlur = 6;
      ctx.fillText("ARCADE", 45, 17);
      ctx.shadowBlur = 0;
    });

    // Plaza floor
    this.tex("plaza-floor", W, 360, (ctx) => {
      // Main plaza diamond
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(W / 2, 20);
      ctx.lineTo(W - 60, 180);
      ctx.lineTo(W / 2, 340);
      ctx.lineTo(60, 180);
      ctx.closePath();
      const floorGrad = ctx.createLinearGradient(0, 0, 0, 360);
      floorGrad.addColorStop(0, "#0c1a2a");
      floorGrad.addColorStop(0.5, "#0a1522");
      floorGrad.addColorStop(1, "#081018");
      ctx.fillStyle = floorGrad;
      ctx.fill();
      ctx.strokeStyle = "rgba(79,245,255,0.25)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // Inner diamond
      ctx.beginPath();
      ctx.moveTo(W / 2, 80);
      ctx.lineTo(W - 200, 180);
      ctx.lineTo(W / 2, 280);
      ctx.lineTo(200, 180);
      ctx.closePath();
      ctx.strokeStyle = "rgba(255,85,239,0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Grid lines on floor
      ctx.strokeStyle = "rgba(79,245,255,0.06)";
      for (let i = -8; i <= 8; i++) {
        ctx.beginPath();
        ctx.moveTo(W / 2 + i * 60, 20);
        ctx.lineTo(W / 2 + i * 60, 340);
        ctx.stroke();
      }
      for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(60, 20 + i * 35);
        ctx.lineTo(W - 60, 20 + i * 35);
        ctx.stroke();
      }

      // Center circle glow
      const centerGlow = ctx.createRadialGradient(W / 2, 180, 0, W / 2, 180, 80);
      centerGlow.addColorStop(0, "rgba(79,245,255,0.12)");
      centerGlow.addColorStop(1, "rgba(79,245,255,0)");
      ctx.fillStyle = centerGlow;
      ctx.beginPath();
      ctx.ellipse(W / 2, 180, 80, 40, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // Zone textures
    this.texZone("zone-bar", 160, 100, "#0c2830", "#4ff5ff", "NEON BAR", [
      { x: 20, y: 30, w: 120, h: 40, fill: "#0a2028" },
      { x: 30, y: 45, w: 25, h: 8, fill: "#4ff5ff" },
      { x: 65, y: 45, w: 25, h: 8, fill: "#4ff5ff" },
      { x: 100, y: 45, w: 25, h: 8, fill: "#86faff" },
    ]);
    this.texZone("zone-bar-front", 140, 50, "#082020", "#4ff5ff", "", [
      { x: 15, y: 10, w: 110, h: 30, fill: "#0a2830" },
    ]);
    this.texZone("zone-lounge", 160, 80, "#0c1830", "#5d9bff", "LOUNGE", [
      { x: 20, y: 30, w: 50, h: 30, fill: "#0a1828" },
      { x: 80, y: 30, w: 50, h: 30, fill: "#0a1828" },
    ]);
    this.texZone("zone-spawn-pad", 120, 60, "#0a2030", "#4ff5ff", "SPAWN", []);
    this.texZone("zone-missions", 150, 90, "#0a200c", "#73ff7b", "PROTOCOLES", [
      { x: 15, y: 35, w: 120, h: 40, fill: "#081a0a" },
    ]);
    this.texZone("zone-terminal", 90, 90, "#0a1a0c", "#73ff7b", "404", [
      { x: 15, y: 25, w: 60, h: 45, fill: "#061208" },
    ]);
    this.texZone("zone-event-stage", 200, 80, "#200a20", "#ff55ef", "EVENT STAGE", [
      { x: 30, y: 30, w: 140, h: 35, fill: "#180818" },
    ]);
    this.texZone("zone-arcade", 160, 90, "#1a0a28", "#b983ff", "ARCADE", [
      { x: 15, y: 30, w: 40, h: 45, fill: "#120820" },
      { x: 60, y: 30, w: 40, h: 45, fill: "#120820" },
      { x: 105, y: 30, w: 40, h: 45, fill: "#120820" },
    ]);
    this.texZone("zone-staff", 130, 90, "#200a0a", "#ff5165", "STAFF", [
      { x: 20, y: 30, w: 90, h: 40, fill: "#180808" },
    ]);

    // Decorations
    this.tex("deco-vending", 40, 70, (ctx) => {
      this.roundRect(ctx, 5, 5, 30, 60, 4, "#0a1820");
      ctx.strokeStyle = "#4ff5ff";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#071018";
      ctx.fillRect(10, 12, 20, 20);
      ctx.fillStyle = "#73ff7b";
      ctx.fillRect(12, 15, 6, 3);
      ctx.fillStyle = "#ff55ef";
      ctx.fillRect(12, 21, 6, 3);
      ctx.fillStyle = "#4ff5ff";
      ctx.fillRect(22, 15, 6, 3);
      ctx.fillRect(12, 40, 16, 4);
    });

    this.tex("deco-bench", 80, 30, (ctx) => {
      ctx.fillStyle = "#0c2028";
      ctx.fillRect(5, 10, 70, 12);
      ctx.fillStyle = "#0a1820";
      ctx.fillRect(10, 22, 8, 8);
      ctx.fillRect(62, 22, 8, 8);
      ctx.strokeStyle = "#4ff5ff";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(5, 10, 70, 12);
    });

    this.tex("deco-crate", 36, 40, (ctx) => {
      ctx.fillStyle = "#1a0c0c";
      ctx.fillRect(4, 10, 28, 26);
      ctx.strokeStyle = "#ff5165";
      ctx.lineWidth = 1;
      ctx.strokeRect(4, 10, 28, 26);
      ctx.fillStyle = "#ff5165";
      ctx.fillRect(14, 14, 8, 3);
    });

    this.tex("deco-plant", 40, 55, (ctx) => {
      ctx.fillStyle = "#0a1820";
      ctx.fillRect(12, 35, 16, 18);
      ctx.strokeStyle = "#4ff5ff";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(12, 35, 16, 18);
      ctx.fillStyle = "#2d8a3e";
      ctx.beginPath(); ctx.ellipse(20, 30, 10, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#4bea69";
      ctx.beginPath(); ctx.ellipse(18, 25, 6, 8, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#73ff7b";
      ctx.fillRect(19, 20, 2, 15);
    });

    this.tex("deco-lamp", 20, 120, (ctx) => {
      ctx.fillStyle = "#0c1820";
      ctx.fillRect(8, 20, 4, 100);
      // Lamp head
      const glow = ctx.createRadialGradient(10, 15, 0, 10, 15, 12);
      glow.addColorStop(0, "rgba(79,245,255,0.6)");
      glow.addColorStop(1, "rgba(79,245,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(10, 15, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#4ff5ff";
      ctx.beginPath(); ctx.arc(10, 15, 3, 0, Math.PI * 2); ctx.fill();
      // Light cone
      ctx.fillStyle = "rgba(79,245,255,0.03)";
      ctx.beginPath();
      ctx.moveTo(10, 20);
      ctx.lineTo(-5, 120);
      ctx.lineTo(25, 120);
      ctx.closePath();
      ctx.fill();
    });

    // Click marker
    this.tex("click-marker", 30, 16, (ctx) => {
      ctx.strokeStyle = "#4ff5ff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(15, 0); ctx.lineTo(30, 8); ctx.lineTo(15, 16); ctx.lineTo(0, 8);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = "rgba(79,245,255,0.15)";
      ctx.fill();
    });

    // Character sprites
    for (const [avatar, pal] of Object.entries(avatarPalette) as [Avatar, typeof avatarPalette.runner][]) {
      this.tex(`char-${avatar}`, 40, 64, (ctx) => {
        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath(); ctx.ellipse(20, 58, 12, 4, 0, 0, Math.PI * 2); ctx.fill();

        // Legs
        ctx.fillStyle = "#0a0e14";
        ctx.fillRect(14, 42, 5, 14);
        ctx.fillRect(21, 42, 5, 14);

        // Body
        ctx.fillStyle = pal.body;
        this.roundRect(ctx, 10, 22, 20, 22, 4, pal.body);
        ctx.fill();
        ctx.strokeStyle = pal.trim;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Trim detail
        ctx.fillStyle = pal.trim;
        ctx.fillRect(12, 28, 16, 2);
        ctx.fillRect(12, 38, 16, 2);

        // Arms
        ctx.fillStyle = pal.body;
        ctx.fillRect(7, 26, 4, 14);
        ctx.fillRect(29, 26, 4, 14);
        ctx.strokeStyle = pal.trim;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(7, 26, 4, 14);
        ctx.strokeRect(29, 26, 4, 14);

        // Head
        ctx.fillStyle = "#d4ecf0";
        ctx.beginPath(); ctx.ellipse(20, 15, 9, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#0a1018";
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Hair
        ctx.fillStyle = "#0a1218";
        ctx.beginPath(); ctx.ellipse(20, 9, 9, 6, 0, 0, Math.PI * 2); ctx.fill();

        // Visor / eye
        ctx.fillStyle = pal.eye;
        ctx.fillRect(13, 13, 14, 3);
        ctx.shadowColor = pal.glow;
        ctx.shadowBlur = 4;
        ctx.fillRect(13, 13, 14, 3);
        ctx.shadowBlur = 0;

        // Shoulder pads
        ctx.fillStyle = pal.trim;
        ctx.beginPath(); ctx.ellipse(9, 25, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(31, 25, 4, 3, 0, 0, Math.PI * 2); ctx.fill();

        // Glow effect
        ctx.fillStyle = pal.glow;
        ctx.globalAlpha = 0.15;
        ctx.beginPath(); ctx.ellipse(20, 30, 18, 25, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      });
    }
  }

  // ===================== TEXTURE HELPERS =====================

  private texBuilding(key: string, w: number, h: number, baseColor: string, accentColor: string, hasAntenna: boolean) {
    this.tex(key, w, h, (ctx) => {
      // Main building shape
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, baseColor);
      grad.addColorStop(1, "#050a10");
      this.roundRect(ctx, 4, hasAntenna ? 20 : 4, w - 8, h - (hasAntenna ? 24 : 8), 3, baseColor);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Windows
      const winCols = Math.floor((w - 20) / 14);
      const winRows = Math.floor((h - 40) / 16);
      for (let row = 0; row < winRows; row++) {
        for (let col = 0; col < winCols; col++) {
          const wx = 12 + col * 14;
          const wy = (hasAntenna ? 30 : 14) + row * 16;
          const lit = Math.random() > 0.35;
          ctx.fillStyle = lit ? (Math.random() > 0.7 ? accentColor : "#1a3848") : "#060c14";
          ctx.globalAlpha = lit ? 0.4 + Math.random() * 0.4 : 0.3;
          ctx.fillRect(wx, wy, 8, 10);
        }
      }
      ctx.globalAlpha = 1;

      // Top accent line
      ctx.fillStyle = accentColor;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(4, hasAntenna ? 20 : 4, w - 8, 2);
      ctx.globalAlpha = 1;

      // Antenna
      if (hasAntenna) {
        ctx.fillStyle = "#1a2830";
        ctx.fillRect(w / 2 - 1, 0, 2, 20);
        ctx.fillStyle = accentColor;
        ctx.beginPath(); ctx.arc(w / 2, 4, 3, 0, Math.PI * 2); ctx.fill();
      }
    });
  }

  private texZone(key: string, w: number, h: number, bg: string, accent: string, label: string, details: { x: number; y: number; w: number; h: number; fill: string }[]) {
    this.tex(key, w, h, (ctx) => {
      // Base
      this.roundRect(ctx, 0, 0, w, h, 6, bg);
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Details
      for (const d of details) {
        ctx.fillStyle = d.fill;
        ctx.fillRect(d.x, d.y, d.w, d.h);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.4;
        ctx.strokeRect(d.x, d.y, d.w, d.h);
        ctx.globalAlpha = 1;
      }

      // Accent line top
      ctx.fillStyle = accent;
      ctx.fillRect(10, 10, Math.min(60, w - 20), 3);

      // Label
      if (label) {
        ctx.font = "bold 11px 'Courier New', monospace";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "left";
        ctx.fillText(label, 12, h - 10);
      }

      // Corner dots
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.arc(8, 8, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(w - 8, 8, 2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  private tex(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
    if (this.textures.exists(key)) this.textures.remove(key);
    const texture = this.textures.createCanvas(key, w * textureScale, h * textureScale);
    if (!texture) return;
    const canvas = texture.getSourceImage() as HTMLCanvasElement;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, w * textureScale, h * textureScale);
    ctx.scale(textureScale, textureScale);
    draw(ctx);
    texture.refresh();
  }

  private img(x: number, y: number, key: string, depth: number) {
    return this.add.image(x, y, key).setScale(1 / textureScale).setDepth(depth);
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill?: string) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
  }

  private clamp(x: number, y: number) {
    return {
      x: Phaser.Math.Clamp(x, 130, W - 130),
      y: Phaser.Math.Clamp(y, 280, H - 50),
    };
  }
}

export function createGame(parent: string, hooks: GameHooks) {
  const width = typeof window === "undefined" ? W : window.innerWidth;
  const height = typeof window === "undefined" ? H : window.innerHeight;

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width,
    height,
    backgroundColor: "#030508",
    pixelArt: false,
    antialias: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [new DistrictScene(hooks)],
    input: { activePointers: 2 },
  });
}
