import Phaser from "phaser";
import { WORLD_W, WORLD_H, BUILDINGS, ZONES, CITY_MAP } from "../../utils/constants";
import type { Player } from "../../types/game";
import { buildCity } from "../world/RoomRenderer";
import { gridToScreen, screenToGrid, isWalkable, depthOf } from "../world/TileMap";
import { CharacterSprite } from "../entities/CharacterSprite";
import { RainEffect, AmbientParticles, NeonGlow } from "../effects/Effects";

export interface SceneHooks {
  onReady: (scene: DistrictScene) => void;
  onMove: (x: number, y: number) => void;
  onTerminal: () => void;
  onArcade?: () => void;
  onFurnitureClick?: (id: string) => void;
  onNpcClick?: (name: string) => void;
  onCollect?: (type: string, value: number) => void;
  onZoneEnter?: (zone: string) => void;
}

interface Collectible {
  obj: Phaser.GameObjects.Container;
  col: number;
  row: number;
  type: "xp" | "fragment";
  value: number;
  collected: boolean;
}

export class DistrictScene extends Phaser.Scene {
  private hooks: SceneHooks;
  private characters = new Map<string, CharacterSprite>();
  private localChar: CharacterSprite | null = null;
  private rain!: RainEffect;
  private particles!: AmbientParticles;
  private neonGlow!: NeonGlow;
  private collectibles: Collectible[] = [];
  private currentZone = "";
  private zoneBanner!: Phaser.GameObjects.Container;
  private hoverTile!: Phaser.GameObjects.Graphics;
  private tooltip!: Phaser.GameObjects.Container;
  private pulseTime = 0;
  private minimap!: Phaser.GameObjects.Graphics;

  constructor(hooks: SceneHooks) {
    super("DistrictScene");
    this.hooks = hooks;
  }

  create() {
    this.cameras.main.setBackgroundColor("#020408");
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);

    // Build the city
    buildCity(this);

    // Effects
    this.rain = new RainEffect(this, 80);
    this.particles = new AmbientParticles(this, 40);
    this.neonGlow = new NeonGlow(this, []);

    // Hover tile
    this.hoverTile = this.add.graphics().setDepth(900).setAlpha(0).setScrollFactor(1);

    // Tooltip (follows camera)
    this.tooltip = this.add.container(0, 0).setDepth(3000).setVisible(false);
    const ttBg = this.add.rectangle(0, 0, 100, 24, 0x030a14, 0.92).setStrokeStyle(1, 0x4ff5ff, 0.5);
    const ttText = this.add.text(0, 0, "", {
      fontFamily: "'Courier New', monospace", fontSize: "9px", fontStyle: "bold", color: "#4ff5ff",
    }).setOrigin(0.5);
    this.tooltip.add([ttBg, ttText]);

    // Zone banner (fixed to camera)
    this.zoneBanner = this.add.container(0, 0).setDepth(3500).setAlpha(0).setScrollFactor(0);
    const bannerBg = this.add.rectangle(0, 0, 220, 40, 0x030810, 0.92).setStrokeStyle(1.5, 0x4ff5ff, 0.7);
    const bannerText = this.add.text(0, -4, "", {
      fontFamily: "'Courier New', monospace", fontSize: "13px", fontStyle: "bold", color: "#ffffff",
    }).setOrigin(0.5);
    const bannerSub = this.add.text(0, 12, "ZONE DETECTEE", {
      fontFamily: "'Segoe UI', sans-serif", fontSize: "8px", color: "#4ff5ff",
    }).setOrigin(0.5);
    this.zoneBanner.add([bannerBg, bannerText, bannerSub]);

    // Minimap
    this.minimap = this.add.graphics().setDepth(4000).setScrollFactor(0).setAlpha(0.7);
    this.drawMinimap();

    // Spawn collectibles
    this.spawnCollectibles();

    // Input
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.handleClick(p));
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.handleHover(p));

    // Camera zoom
    this.cameras.main.setZoom(1);

    // Center on spawn point
    const spawn = gridToScreen(12, 12);
    this.cameras.main.centerOn(spawn.x, spawn.y);

    this.hooks.onReady(this);
  }

  update(time: number, delta: number) {
    this.rain.update();
    this.particles.update(time);
    this.neonGlow.update(time);
    this.pulseTime += delta * 0.001;

    // Collectible bob
    for (const c of this.collectibles) {
      if (c.collected) continue;
      const base = gridToScreen(c.col, c.row);
      c.obj.y = base.y - 10 + Math.sin(this.pulseTime * 3 + c.col + c.row) * 3;
    }

    // Camera follow
    if (this.localChar) {
      const target = this.localChar.container;
      this.cameras.main.centerOn(
        Phaser.Math.Linear(this.cameras.main.midPoint.x, target.x, 0.08),
        Phaser.Math.Linear(this.cameras.main.midPoint.y, target.y, 0.08),
      );
      this.checkZone(this.localChar.col, this.localChar.row);
      this.checkCollectiblePickup(this.localChar.col, this.localChar.row);
    }

    // Position zone banner at top center of screen
    const cam = this.cameras.main;
    this.zoneBanner.setPosition(cam.width / 2, 50);
  }

  // === PUBLIC API ===

  syncWorld(players: Player[], localPseudo: string) {
    const known = new Set(players.map(p => p.id));
    for (const [id, char] of this.characters) {
      if (!known.has(id)) { char.destroy(); this.characters.delete(id); }
    }
    for (const player of players) {
      const isLocal = player.pseudo === localPseudo;
      let char = this.characters.get(player.id);
      if (!char) {
        char = new CharacterSprite(this, player, isLocal);
        this.characters.set(player.id, char);
        if (isLocal) {
          this.localChar = char;
          this.cameras.main.centerOn(char.container.x, char.container.y);
        }
      } else if (!isLocal) {
        const grid = screenToGrid(player.x, player.y);
        if (isWalkable(grid.col, grid.row) && (grid.col !== char.col || grid.row !== char.row)) {
          char.teleportTo(grid.col, grid.row);
        }
      }
      if (player.emote) char.showEmote(player.emote);
    }
  }

  showSpeech(pseudo: string, text: string) {
    for (const char of this.characters.values()) {
      if (char.pseudo === pseudo) { char.showSpeech(text); return; }
    }
  }

  showEmote(playerId: string, emote: string) {
    this.characters.get(playerId)?.showEmote(emote);
  }

  triggerGlitchEffect() {
    this.cameras.main.shake(200, 0.004);
    this.cameras.main.flash(150, 79, 245, 255, false);
    this.spawnGlitchBonus();
  }

  triggerAchievementEffect(x: number, y: number) {
    const colors = [0x4ff5ff, 0xff55ef, 0x73ff7b, 0xffd700];
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const dist = 25 + Math.random() * 30;
      const p = this.add.circle(x, y, 2 + Math.random() * 2, colors[i % 4], 1).setDepth(2500);
      this.tweens.add({
        targets: p, x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist * 0.5,
        alpha: 0, scale: 0, duration: 400 + Math.random() * 200, ease: "Expo.easeOut",
        onComplete: () => p.destroy(),
      });
    }
  }

  // === COLLECTIBLES ===

  private spawnCollectibles() {
    const spots: { col: number; row: number; type: "xp" | "fragment"; value: number }[] = [];
    // Scatter XP orbs along sidewalks and in special areas
    for (let i = 0; i < 30; i++) {
      const col = 2 + Math.floor(Math.random() * 34);
      const row = 2 + Math.floor(Math.random() * 34);
      if (isWalkable(col, row)) {
        spots.push({ col, row, type: Math.random() > 0.7 ? "fragment" : "xp", value: 10 + Math.floor(Math.random() * 3) * 5 });
      }
    }
    for (const spot of spots) this.createCollectible(spot.col, spot.row, spot.type, spot.value);
  }

  private spawnGlitchBonus() {
    if (!this.localChar) return;
    for (let i = 0; i < 5; i++) {
      const col = this.localChar.col - 5 + Math.floor(Math.random() * 10);
      const row = this.localChar.row - 5 + Math.floor(Math.random() * 10);
      if (isWalkable(col, row)) this.createCollectible(col, row, "fragment", 30 + Math.floor(Math.random() * 20));
    }
  }

  private createCollectible(col: number, row: number, type: "xp" | "fragment", value: number) {
    const { x, y } = gridToScreen(col, row);
    const container = this.add.container(x, y - 10).setDepth(depthOf(col, row) + 2);
    const color = type === "xp" ? 0x4ff5ff : 0xff55ef;
    const glow = this.add.circle(0, 6, 8, color, 0.08);
    this.tweens.add({ targets: glow, scaleX: 1.4, scaleY: 1.2, alpha: 0.03, yoyo: true, repeat: -1, duration: 1200 });
    const orb = this.add.circle(0, 0, 4, color, 0.85);
    const inner = this.add.circle(0, -1, 2, 0xffffff, 0.5);
    const star = this.add.star(0, -2, 4, 1.5, 4, color, 0.6);
    this.tweens.add({ targets: star, angle: 360, duration: 3000, repeat: -1 });
    const txt = this.add.text(0, -12, `+${value}`, {
      fontFamily: "'Courier New', monospace", fontSize: "7px", fontStyle: "bold",
      color: "#" + color.toString(16).padStart(6, "0"),
    }).setOrigin(0.5).setAlpha(0.6);
    container.add([glow, orb, inner, star, txt]);
    this.collectibles.push({ obj: container, col, row, type, value, collected: false });
  }

  private checkCollectiblePickup(pcol: number, prow: number) {
    for (const c of this.collectibles) {
      if (c.collected) continue;
      if (Math.abs(c.col - pcol) <= 1 && Math.abs(c.row - prow) <= 1) {
        c.collected = true;
        const { x, y } = gridToScreen(c.col, c.row);
        this.tweens.add({ targets: c.obj, y: c.obj.y - 30, alpha: 0, scale: 1.3, duration: 350, onComplete: () => c.obj.destroy() });
        const color = c.type === "xp" ? 0x4ff5ff : 0xff55ef;
        const flyText = this.add.text(x, y - 20, `+${c.value} ${c.type.toUpperCase()}`, {
          fontFamily: "'Courier New', monospace", fontSize: "10px", fontStyle: "bold",
          color: "#" + color.toString(16).padStart(6, "0"), stroke: "#030508", strokeThickness: 3,
        }).setOrigin(0.5).setDepth(3000);
        this.tweens.add({ targets: flyText, y: y - 50, alpha: 0, duration: 1000, onComplete: () => flyText.destroy() });
        this.hooks.onCollect?.(c.type, c.value);
        // Respawn later
        this.time.delayedCall(30000 + Math.random() * 30000, () => {
          if (isWalkable(c.col, c.row)) this.createCollectible(c.col, c.row, c.type, c.value);
        });
      }
    }
  }

  // === ZONES ===

  private checkZone(col: number, row: number) {
    let found = "rue";
    for (const [name, zone] of Object.entries(ZONES)) {
      if (Math.abs(col - zone.col) <= zone.radius && Math.abs(row - zone.row) <= zone.radius) {
        found = name; break;
      }
    }
    if (found !== this.currentZone) {
      this.currentZone = found;
      this.showZoneBanner(found);
      this.hooks.onZoneEnter?.(found);
    }
  }

  private showZoneBanner(zone: string) {
    const info = ZONES[zone];
    const label = info?.label ?? zone.toUpperCase();
    (this.zoneBanner.getAt(1) as Phaser.GameObjects.Text).setText(`▸ ${label}`);
    const colors: Record<string, number> = {
      bar: 0x4ff5ff, arcade: 0xb983ff, event: 0xff55ef, spawn: 0x86faff, park: 0x73ff7b,
      hacklab: 0x73ff7b, hq: 0xffd700, staff: 0x4ff5ff, dj: 0xff55ef, clinic: 0x86faff,
      prison: 0xff5165, canal: 0x4ff5ff, megacorp: 0x5d9bff, rue: 0x4ff5ff,
    };
    (this.zoneBanner.getAt(0) as Phaser.GameObjects.Rectangle).setStrokeStyle(1.5, colors[zone] ?? 0x4ff5ff, 0.7);
    this.zoneBanner.setAlpha(0);
    this.tweens.add({ targets: this.zoneBanner, alpha: 1, duration: 300, yoyo: true, hold: 2500 });
  }

  // === MINIMAP ===

  private drawMinimap() {
    const g = this.minimap;
    const size = 3;
    const ox = 10, oy = 10;
    g.fillStyle(0x030810, 0.8);
    g.fillRect(ox - 2, oy - 2, 40 * size + 4, 40 * size + 4);
    for (let r = 0; r < 40; r++) {
      for (let c = 0; c < 40; c++) {
        const t = CITY_MAP[r][c];
        let color = 0x000000;
        if (t === 1) color = 0x0c1418;
        else if (t === 2) color = 0x0a0e14;
        else if (t === 3) color = 0x1a2838;
        else if (t === 4) color = 0x0a1a0c;
        else if (t === 5) color = 0x121828;
        else if (t === 6) color = 0x061828;
        else if (t === 7) color = 0x1a2830;
        else if (t === 8) color = 0x73ff7b;
        if (t !== 0) {
          g.fillStyle(color, t === 8 ? 0.9 : 0.6);
          g.fillRect(ox + c * size, oy + r * size, size, size);
        }
      }
    }
    g.lineStyle(1, 0x4ff5ff, 0.4);
    g.strokeRect(ox - 2, oy - 2, 40 * size + 4, 40 * size + 4);
  }

  // === HOVER / CLICK ===

  private handleHover(pointer: Phaser.Input.Pointer) {
    const grid = screenToGrid(pointer.worldX, pointer.worldY);
    if (this.hoverTile) {
      this.hoverTile.clear();
      if (isWalkable(grid.col, grid.row)) {
        const { x, y } = gridToScreen(grid.col, grid.row);
        this.hoverTile.setAlpha(0.3);
        this.hoverTile.lineStyle(1, 0x4ff5ff, 0.5);
        this.hoverTile.beginPath();
        this.hoverTile.moveTo(x, y - 16); this.hoverTile.lineTo(x + 32, y);
        this.hoverTile.lineTo(x, y + 16); this.hoverTile.lineTo(x - 32, y);
        this.hoverTile.closePath(); this.hoverTile.stroke();
      } else { this.hoverTile.setAlpha(0); }
    }

    // Building tooltip
    const hoveredBuilding = BUILDINGS.find(b =>
      grid.col >= b.col && grid.col < b.col + b.w && grid.row >= b.row && grid.row < b.row + b.h
    );
    let hoveredNpc: CharacterSprite | null = null;
    for (const char of this.characters.values()) {
      if (char === this.localChar) continue;
      if (Math.abs(char.col - grid.col) <= 1 && Math.abs(char.row - grid.row) <= 1) { hoveredNpc = char; break; }
    }

    if (hoveredBuilding) {
      this.tooltip.setPosition(pointer.worldX, pointer.worldY - 30).setVisible(true);
      (this.tooltip.getAt(1) as Phaser.GameObjects.Text).setText(`🏢 ${hoveredBuilding.name}`);
      (this.tooltip.getAt(0) as Phaser.GameObjects.Rectangle).width = Math.max(80, hoveredBuilding.name.length * 6.5 + 20);
    } else if (hoveredNpc) {
      this.tooltip.setPosition(pointer.worldX, pointer.worldY - 30).setVisible(true);
      (this.tooltip.getAt(1) as Phaser.GameObjects.Text).setText(`💬 ${hoveredNpc.pseudo}`);
      (this.tooltip.getAt(0) as Phaser.GameObjects.Rectangle).width = Math.max(80, hoveredNpc.pseudo.length * 7 + 30);
    } else {
      this.tooltip.setVisible(false);
    }
  }

  private handleClick(pointer: Phaser.Input.Pointer) {
    const grid = screenToGrid(pointer.worldX, pointer.worldY);

    // Click NPC
    for (const char of this.characters.values()) {
      if (char === this.localChar) continue;
      if (Math.abs(char.col - grid.col) <= 1 && Math.abs(char.row - grid.row) <= 1) {
        if (this.localChar) {
          const tc = char.col + (char.col > this.localChar.col ? -1 : 1);
          if (isWalkable(tc, char.row)) {
            this.localChar.moveTo(tc, char.row);
            this.hooks.onMove(gridToScreen(tc, char.row).x, gridToScreen(tc, char.row).y);
          }
        }
        this.hooks.onNpcClick?.(char.pseudo);
        return;
      }
    }

    // Click building entrance
    const tile = (grid.row >= 0 && grid.row < 40 && grid.col >= 0 && grid.col < 40) ? CITY_MAP[grid.row][grid.col] : 0;
    if (tile === 8) {
      const building = BUILDINGS.find(b =>
        grid.col >= b.col - 1 && grid.col <= b.col + b.w && grid.row >= b.row - 1 && grid.row <= b.row + b.h
      );
      if (building) {
        this.cameras.main.flash(100, 115, 255, 123);
        if (building.type === "arcade") this.hooks.onArcade?.();
        else if (building.id === "data-center" || building.id === "hack-lab") this.hooks.onTerminal();
        else this.hooks.onFurnitureClick?.(building.id);
      }
    }

    // Move
    if (!isWalkable(grid.col, grid.row)) return;
    const { x, y } = gridToScreen(grid.col, grid.row);
    // Click marker
    const marker = this.add.graphics().setDepth(1900);
    marker.lineStyle(1.5, 0x4ff5ff, 0.6);
    marker.beginPath(); marker.moveTo(x, y - 10); marker.lineTo(x + 20, y); marker.lineTo(x, y + 10); marker.lineTo(x - 20, y);
    marker.closePath(); marker.stroke();
    this.tweens.add({ targets: marker, alpha: 0, scaleX: 1.5, scaleY: 1.5, duration: 400, onComplete: () => marker.destroy() });

    if (this.localChar) this.localChar.moveTo(grid.col, grid.row);
    this.hooks.onMove(x, y);
  }
}
