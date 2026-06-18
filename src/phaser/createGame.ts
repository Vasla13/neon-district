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
};

type GameHooks = {
  onReady: (scene: DistrictScene) => void;
  onMove: (x: number, y: number) => void;
  onTerminal: () => void;
};

const baseRoom = { width: 1280, height: 720, centerX: 640, centerY: 360 };
const iso = { originX: 640, originY: 120, tileW: 64, tileH: 32 };
const textureScale = 2;

const roleColors: Record<Role, string> = {
  "New User": "#76f8ff",
  Runner: "#36dfff",
  Hacker: "#78ff7e",
  Architect: "#ffffff",
  DJ: "#ff55ef",
  Sentinel: "#5d9bff",
  Ghost: "#bc83ff",
  Admin: "#ff5165",
  Founder: "#ffffff"
};

const avatarColors: Record<Avatar, { coat: string; trim: string; hair: string }> = {
  runner: { coat: "#15cbed", trim: "#ffffff", hair: "#0a1018" },
  hacker: { coat: "#4bea69", trim: "#d8ffe1", hair: "#08230d" },
  ghost: { coat: "#a574ff", trim: "#ffffff", hair: "#1b1229" },
  dj: { coat: "#ff49e7", trim: "#ffffff", hair: "#17121b" }
};

export class DistrictScene extends Phaser.Scene {
  private hooks: GameHooks;
  private sprites = new Map<string, Phaser.GameObjects.Container>();
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private speech = new Map<string, Phaser.GameObjects.Text>();
  private terminalZone!: Phaser.GameObjects.Zone;
  private marker!: Phaser.GameObjects.Image;

  constructor(hooks: GameHooks) {
    super("DistrictScene");
    this.hooks = hooks;
  }

  create() {
    this.cameras.main.setBackgroundColor("#06080c");
    this.createTextures();
    this.drawRoom();
    this.centerCamera();
    this.scale.on("resize", () => this.centerCamera());
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.handlePointer(pointer));
    this.hooks.onReady(this);
  }

  syncWorld(players: Player[], localPseudo: string) {
    const known = new Set(players.map((player) => player.id));

    for (const [id, sprite] of this.sprites) {
      if (!known.has(id)) {
        sprite.destroy();
        this.sprites.delete(id);
        this.labels.delete(id);
        this.speech.delete(id);
      }
    }

    for (const player of players) {
      let sprite = this.sprites.get(player.id);
      if (!sprite) {
        sprite = this.createAvatar(player, player.pseudo === localPseudo);
        this.sprites.set(player.id, sprite);
      }

      const target = this.clampToRoom(player.x, player.y);
      this.tweens.killTweensOf(sprite);
      this.tweens.add({
        targets: sprite,
        x: target.x,
        y: target.y,
        duration: player.pseudo === localPseudo ? 150 : 280,
        ease: "Stepped",
        onUpdate: () => sprite?.setDepth(Math.floor(sprite.y) + 500)
      });
    }
  }

  showSpeech(pseudo: string, text: string) {
    const entry = [...this.labels.entries()].find(([, label]) => label.text === pseudo);
    if (!entry) return;
    const bubble = this.speech.get(entry[0]);
    if (!bubble) return;
    bubble.setText(text.length > 38 ? `${text.slice(0, 35)}...` : text);
    bubble.setVisible(true);
    this.time.delayedCall(3600, () => bubble.setVisible(false));
  }

  private handlePointer(pointer: Phaser.Input.Pointer) {
    if (this.terminalZone.getBounds().contains(pointer.worldX, pointer.worldY)) {
      this.cameras.main.flash(120, 120, 255, 126);
      this.hooks.onTerminal();
      return;
    }

    const point = this.clampToRoom(pointer.worldX, pointer.worldY);
    this.marker.setPosition(point.x, point.y + 10).setVisible(true).setAlpha(1);
    this.tweens.add({ targets: this.marker, alpha: 0, duration: 420, onComplete: () => this.marker.setVisible(false) });
    this.hooks.onMove(point.x, point.y);
  }

  private drawRoom() {
    this.art(640, 360, "district-backdrop", 0);
    this.art(640, 112, "logo-2042", 8);
    this.art(326, 226, "district-station", 12);
    this.art(540, 225, "apartment-lounge", 12);
    this.art(784, 224, "mission-lab", 12);
    this.art(1010, 232, "rank-board", 12);

    this.art(640, 456, "plaza-ring", 448);
    this.art(640, 342, "floor-glow", 342);
    this.art(548, 356, "floor-arrow", 352);
    this.art(742, 414, "floor-arrow", 412).setFlipX(true);
    this.art(640, 260, "spawn-pad", 263);

    this.art(330, 482, "noodle-bar", 500);
    this.art(318, 548, "sofa-cyan", 560);
    this.art(444, 552, "sofa-blue", 570);
    this.art(382, 526, "holo-table", 572);
    this.art(236, 528, "vending", 545);
    this.art(250, 462, "plant-pod", 486);
    this.art(498, 586, "plant-pod", 604).setFlipX(true);

    this.art(820, 390, "protocol-board", 406);
    this.art(918, 452, "terminal-404", 472);
    this.terminalZone = this.add.zone(918, 434, 72, 86);

    this.art(646, 554, "event-stage", 566);
    this.art(590, 516, "dj-booth", 536);
    this.art(742, 552, "arcade-run", 576);
    this.art(810, 590, "arcade-mem", 612);
    this.art(940, 548, "arcade-hall", 570);

    this.art(1036, 488, "staff-desk", 510);
    this.art(1086, 558, "security-gate", 582);
    this.art(1134, 462, "staff-door", 488);
    this.marker = this.art(640, 360, "walk-marker", 999).setVisible(false);

    this.add.text(504, 690, "Clique sur le sol pour bouger  /  Terminal 404 : Protocole 01", {
      fontFamily: "Segoe UI, Arial, sans-serif",
      fontSize: "12px",
      fontStyle: "700",
      color: "#b9fbff",
      stroke: "#061018",
      strokeThickness: 3
    }).setDepth(1500).setResolution(3);
  }

  private centerCamera() {
    const view = this.scale.gameSize;
    const zoom = Phaser.Math.Clamp(Math.min(view.width / baseRoom.width, view.height / baseRoom.height) * 0.86, 1, 1.9);
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(baseRoom.centerX, baseRoom.centerY);
  }

  private createAvatar(player: Player, isLocal: boolean) {
    const roleColor = roleColors[player.role];
    const container = this.add.container(player.x, player.y).setDepth(player.y + 500);
    const shadow = this.localArt(0, 14, "avatar-shadow");
    const aura = this.localArt(0, 12, "avatar-aura").setTint(Phaser.Display.Color.HexStringToColor(roleColor).color).setAlpha(isLocal ? 0.7 : 0.36);
    const sprite = this.localArt(0, -22, `avatar-${player.avatar}`);
    const badge = this.add.rectangle(18, -34, 6, 6, Phaser.Display.Color.HexStringToColor(roleColor).color, 1);
    const labelBg = this.add.rectangle(0, 22, Math.max(54, player.pseudo.length * 7), 16, 0x05080c, 0.88).setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(roleColor).color, 0.9);
    const label = this.add.text(0, 15, player.pseudo, {
      fontFamily: "Segoe UI, Arial, sans-serif",
      fontSize: "12px",
      fontStyle: "700",
      color: "#ffffff",
      stroke: "#05080c",
      strokeThickness: 3
    }).setOrigin(0.5, 0).setResolution(3);
    const bubble = this.add.text(0, -76, "", {
      fontFamily: "Segoe UI, Arial, sans-serif",
      fontSize: "12px",
      color: "#071018",
      backgroundColor: "#f3feff",
      padding: { x: 6, y: 4 }
    }).setOrigin(0.5).setVisible(false).setResolution(3);

    container.add([shadow, aura, sprite, badge, labelBg, label, bubble]);
    this.labels.set(player.id, label);
    this.speech.set(player.id, bubble);
    this.tweens.add({ targets: aura, alpha: 0.12, yoyo: true, repeat: -1, duration: 900 });
    return container;
  }

  private createTextures() {
    this.pixelTexture("wall-grid", 96, 96, (ctx) => {
      ctx.fillStyle = "#0d1118";
      ctx.fillRect(0, 0, 96, 96);
      ctx.fillStyle = "#123847";
      ctx.fillRect(0, 0, 1, 96);
      ctx.fillRect(0, 0, 96, 1);
      ctx.fillStyle = "#0a232d";
      ctx.fillRect(48, 0, 1, 96);
      ctx.fillRect(0, 48, 96, 1);
    });

    this.pixelTexture("district-backdrop", 1280, 720, (ctx) => {
      const bg = ctx.createLinearGradient(0, 0, 0, 720);
      bg.addColorStop(0, "#090d14");
      bg.addColorStop(0.45, "#0c121c");
      bg.addColorStop(1, "#05070b");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 1280, 720);

      const windowGrad = ctx.createLinearGradient(0, 70, 0, 300);
      windowGrad.addColorStop(0, "rgba(18,34,48,0.92)");
      windowGrad.addColorStop(1, "rgba(9,16,25,0.78)");
      this.round(ctx, 90, 62, 1100, 246, 8, windowGrad, "rgba(79,245,255,0.18)");

      ctx.strokeStyle = "rgba(79,245,255,0.14)";
      ctx.lineWidth = 1;
      for (let x = 130; x <= 1160; x += 82) {
        ctx.beginPath();
        ctx.moveTo(x, 62);
        ctx.lineTo(x, 308);
        ctx.stroke();
      }
      for (let y = 112; y <= 286; y += 58) {
        ctx.beginPath();
        ctx.moveTo(90, y);
        ctx.lineTo(1190, y);
        ctx.stroke();
      }

      for (let x = 150; x < 1130; x += 44) {
        const h = 38 + ((x * 11) % 130);
        const y = 290 - h;
        const alpha = 0.18 + ((x % 5) * 0.04);
        this.round(ctx, x, y, 24, h, 4, `rgba(26,86,106,${alpha})`);
        if (x % 4 === 0) this.rect(ctx, x + 8, y + 16, 5, 5, "#4ff5ff");
        if (x % 7 === 0) this.rect(ctx, x + 12, y + 34, 5, 5, "#ff55ef");
      }

      this.round(ctx, 235, 168, 236, 120, 14, "rgba(8,22,32,0.88)", "rgba(79,245,255,0.42)");
      this.round(ctx, 506, 164, 238, 126, 14, "rgba(11,21,42,0.86)", "rgba(93,155,255,0.42)");
      this.round(ctx, 778, 164, 238, 126, 14, "rgba(9,31,25,0.86)", "rgba(115,255,123,0.42)");
      this.round(ctx, 1038, 176, 126, 102, 14, "rgba(15,20,31,0.84)", "rgba(255,85,239,0.32)");

      const plaza = ctx.createLinearGradient(640, 250, 640, 650);
      plaza.addColorStop(0, "#122537");
      plaza.addColorStop(0.52, "#0f2030");
      plaza.addColorStop(1, "#0b1520");
      this.diamond(ctx, 640, 420, 940, 380, plaza, "#2b6d8b");
      this.diamond(ctx, 640, 420, 610, 236, "rgba(14,35,54,0.72)", "#45dff0");
      this.diamond(ctx, 640, 520, 380, 154, "rgba(45,15,62,0.58)", "#ff55ef");

      ctx.strokeStyle = "rgba(134,250,255,0.16)";
      ctx.lineWidth = 1;
      for (let i = -10; i <= 10; i += 1) {
        ctx.beginPath();
        ctx.moveTo(640 + i * 45, 238);
        ctx.lineTo(640 + i * 45 + 360, 420);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(640 + i * 45, 238);
        ctx.lineTo(640 + i * 45 - 360, 420);
        ctx.stroke();
      }

      const leftZone = ctx.createLinearGradient(210, 430, 430, 600);
      leftZone.addColorStop(0, "rgba(22,112,134,0.62)");
      leftZone.addColorStop(1, "rgba(13,49,78,0.28)");
      this.diamond(ctx, 360, 534, 330, 132, leftZone, "#4ff5ff");

      const staffZone = ctx.createLinearGradient(825, 465, 1110, 610);
      staffZone.addColorStop(0, "rgba(70,18,30,0.62)");
      staffZone.addColorStop(1, "rgba(38,12,20,0.26)");
      this.diamond(ctx, 945, 544, 330, 132, staffZone, "#ff5165");

      ctx.fillStyle = "rgba(79,245,255,0.18)";
      ctx.beginPath();
      ctx.ellipse(640, 430, 150, 44, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(79,245,255,0.45)";
      ctx.stroke();

      ctx.fillStyle = "rgba(255,85,239,0.2)";
      ctx.fillRect(760, 105, 96, 4);
      ctx.fillRect(802, 128, 70, 4);
      ctx.fillStyle = "rgba(115,255,123,0.18)";
      ctx.fillRect(966, 110, 82, 4);
    });

    this.pixelTexture("mega-city-window", 1040, 236, (ctx) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, 178);
      gradient.addColorStop(0, "#101925");
      gradient.addColorStop(0.55, "#0b121b");
      gradient.addColorStop(1, "#080b10");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1040, 236);
      this.outline(ctx, 0, 0, 1040, 236, "#123847");
      ctx.fillStyle = "#0e2b38";
      for (let x = 22; x < 1010; x += 46) {
        const h = 34 + ((x * 7) % 118);
        ctx.fillRect(x, 204 - h, 25, h);
        ctx.fillStyle = x % 3 === 0 ? "#4ff5ff" : "#2d6576";
        ctx.fillRect(x + 5, 212 - h, 4, 4);
        ctx.fillRect(x + 15, 224 - h, 4, 4);
        ctx.fillStyle = "#0e2b38";
      }
      ctx.fillStyle = "rgba(79,245,255,0.12)";
      ctx.fillRect(0, 92, 1040, 2);
      ctx.fillRect(0, 166, 1040, 2);
      for (let x = 0; x <= 1040; x += 86) {
        ctx.fillRect(x, 0, 2, 236);
      }
      ctx.fillStyle = "rgba(255,80,246,0.18)";
      ctx.fillRect(665, 58, 120, 3);
      ctx.fillRect(710, 75, 80, 3);
    });

    this.pixelTexture("left-tower", 80, 208, (ctx) => {
      const grad = ctx.createLinearGradient(0, 0, 0, 208);
      grad.addColorStop(0, "rgba(26,74,89,0.45)");
      grad.addColorStop(1, "rgba(6,15,22,0.2)");
      ctx.fillStyle = grad;
      ctx.fillRect(20, 0, 40, 208);
      ctx.fillStyle = "#4ff5ff";
      ctx.fillRect(32, 18, 16, 164);
      ctx.fillRect(24, 8, 32, 12);
      ctx.fillRect(24, 180, 32, 12);
    });

    this.pixelTexture("right-tower", 80, 208, (ctx) => {
      const grad = ctx.createLinearGradient(0, 0, 0, 208);
      grad.addColorStop(0, "rgba(26,74,89,0.45)");
      grad.addColorStop(1, "rgba(6,15,22,0.2)");
      ctx.fillStyle = grad;
      ctx.fillRect(20, 0, 40, 208);
      ctx.fillStyle = "#4ff5ff";
      ctx.fillRect(32, 18, 16, 164);
      ctx.fillRect(24, 8, 32, 12);
      ctx.fillRect(24, 180, 32, 12);
    });

    this.pixelTexture("district-station", 168, 74, (ctx) => {
      this.round(ctx, 0, 0, 168, 74, 8, "rgba(8,20,30,0.92)", "#4ff5ff");
      this.rect(ctx, 18, 16, 54, 6, "#4ff5ff");
      this.rect(ctx, 18, 30, 96, 5, "#2b6d7d");
      this.rect(ctx, 18, 43, 78, 5, "#214f5e");
      ctx.font = "bold 12px Segoe UI, Arial";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("DISTRICT GATE", 18, 62);
      this.round(ctx, 128, 38, 26, 16, 3, "#ff55ef");
    });

    this.pixelTexture("apartment-lounge", 188, 92, (ctx) => {
      this.round(ctx, 0, 0, 188, 92, 10, "rgba(7,18,27,0.92)", "#2f6dff");
      this.rect(ctx, 16, 18, 64, 7, "#4ff5ff");
      this.round(ctx, 18, 42, 74, 22, 8, "#146d87", "#86faff");
      this.round(ctx, 106, 36, 48, 30, 8, "#1b2e59", "#5d9bff");
      this.rect(ctx, 128, 18, 36, 6, "#ff55ef");
      ctx.font = "bold 11px Segoe UI, Arial";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("LOUNGE", 20, 80);
    });

    this.pixelTexture("mission-lab", 188, 92, (ctx) => {
      this.round(ctx, 0, 0, 188, 92, 10, "rgba(7,21,18,0.93)", "#73ff7b");
      this.rect(ctx, 16, 16, 70, 7, "#73ff7b");
      this.round(ctx, 18, 36, 52, 32, 5, "#071018", "#73ff7b");
      this.round(ctx, 84, 34, 72, 36, 5, "#0d2430", "#4ff5ff");
      this.rect(ctx, 96, 48, 46, 5, "#86faff");
      ctx.font = "bold 11px Segoe UI, Arial";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("MISSION LAB", 18, 80);
    });

    this.pixelTexture("side-line", 18, 150, (ctx) => {
      ctx.fillStyle = "#4ff5ff";
      ctx.fillRect(7, 9, 4, 132);
      ctx.fillRect(2, 5, 14, 8);
      ctx.fillRect(2, 137, 14, 8);
    });

    this.pixelTexture("logo-2042", 236, 78, (ctx) => {
      ctx.font = "italic 58px Arial Black";
      ctx.fillStyle = "#4ff5ff";
      ctx.fillText("2042", 14, 62);
      ctx.fillStyle = "#ffffff";
      ctx.fillText("2042", 8, 56);
      ctx.fillStyle = "#e5feff";
      ctx.fillRect(14, 64, 52, 4);
      ctx.fillRect(88, 64, 44, 4);
      ctx.fillRect(164, 64, 54, 4);
    });

    this.pixelTexture("neon-sign", 118, 32, (ctx) => {
      this.rect(ctx, 0, 0, 118, 32, "#071018");
      this.outline(ctx, 0, 0, 118, 32, "#ff55ef");
      ctx.font = "bold 10px Segoe UI, Arial";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("GLITCH ALERT", 20, 20);
    });

    this.pixelTexture("wall-poster", 112, 58, (ctx) => {
      this.rect(ctx, 0, 0, 112, 58, "#081018");
      this.outline(ctx, 0, 0, 112, 58, "#4ff5ff");
      this.rect(ctx, 10, 10, 34, 4, "#4ff5ff");
      this.rect(ctx, 10, 20, 72, 3, "#1d5a68");
      this.rect(ctx, 10, 28, 56, 3, "#1d5a68");
      this.rect(ctx, 78, 33, 22, 12, "#ff55ef");
      ctx.font = "bold 9px Segoe UI, Arial";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("DISTRICT", 10, 45);
    });

    this.pixelTexture("rank-board", 126, 74, (ctx) => {
      this.rect(ctx, 0, 0, 126, 74, "#081018");
      this.outline(ctx, 0, 0, 126, 74, "#73ff7b");
      this.rect(ctx, 12, 10, 64, 5, "#73ff7b");
      ctx.font = "bold 9px Segoe UI, Arial";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("TOP SIGNALS", 12, 28);
      ctx.fillStyle = "#86faff";
      ctx.fillText("01 VOLT", 14, 43);
      ctx.fillText("02 NYX", 14, 56);
      ctx.fillStyle = "#73ff7b";
      ctx.fillRect(94, 14, 18, 44);
    });

    this.isoTile("tile-a", "#101923", "#172b38", "#275365");
    this.isoTile("tile-b", "#0c141d", "#132433", "#1f4657");
    this.isoTile("tile-lounge", "#111827", "#1b2740", "#3b5d83");
    this.isoTile("tile-staff", "#1a1118", "#2b1820", "#ff5165");

    this.pixelTexture("floor-glow", 360, 92, (ctx) => {
      for (let i = 0; i < 11; i += 1) {
        ctx.globalAlpha = 0.04 + i * 0.01;
        ctx.fillStyle = i % 2 === 0 ? "#4ff5ff" : "#ff55ef";
        ctx.fillRect(20 + i * 28, 36 - i, 42, 2);
      }
      ctx.globalAlpha = 1;
    });

    this.pixelTexture("center-carpet", 270, 118, (ctx) => {
      this.diamond(ctx, 135, 58, 252, 96, "#15152d", "#ff55ef");
      this.diamond(ctx, 135, 58, 168, 62, "#102943", "#4ff5ff");
      ctx.fillStyle = "rgba(255,85,239,0.28)";
      ctx.fillRect(72, 48, 126, 4);
      ctx.fillRect(100, 64, 70, 4);
    });

    this.pixelTexture("plaza-ring", 360, 160, (ctx) => {
      this.diamond(ctx, 180, 80, 326, 126, "rgba(17,32,52,0.72)", "#4ff5ff");
      this.diamond(ctx, 180, 80, 236, 86, "rgba(16,14,42,0.72)", "#ff55ef");
      ctx.strokeStyle = "rgba(134,250,255,0.32)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(180, 80, 76, 22, 0, 0, Math.PI * 2);
      ctx.stroke();
    });

    this.pixelTexture("floor-arrow", 82, 36, (ctx) => {
      this.diamond(ctx, 41, 18, 78, 30, "#0b2029", "#4ff5ff");
      this.rect(ctx, 24, 16, 28, 4, "#4ff5ff");
      this.rect(ctx, 48, 12, 6, 12, "#4ff5ff");
      this.rect(ctx, 54, 16, 6, 4, "#4ff5ff");
    });

    this.pixelTexture("walk-marker", 34, 18, (ctx) => {
      this.diamond(ctx, 17, 9, 32, 16, "#4ff5ff", "#ffffff");
      ctx.clearRect(7, 6, 20, 6);
    });

    this.pixelTexture("spawn-pad", 156, 70, (ctx) => {
      this.diamond(ctx, 78, 35, 150, 64, "#092832", "#4ff5ff");
      this.diamond(ctx, 78, 35, 94, 38, "#123f4d", "#86faff");
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px Segoe UI, Arial";
      ctx.fillText("SPAWN", 62, 38);
    });

    this.furnitureTextures();
    this.avatarTextures();
  }

  private furnitureTextures() {
    this.pixelTexture("sofa-cyan", 102, 64, (ctx) => {
      this.rect(ctx, 9, 28, 80, 18, "#0d7f9b");
      this.rect(ctx, 17, 14, 74, 18, "#109abd");
      this.rect(ctx, 4, 24, 14, 28, "#075e74");
      this.rect(ctx, 83, 24, 14, 28, "#075e74");
      this.outline(ctx, 4, 14, 93, 38, "#86faff");
      this.rect(ctx, 26, 33, 20, 4, "#86faff");
      this.rect(ctx, 54, 33, 20, 4, "#86faff");
    });

    this.pixelTexture("noodle-bar", 180, 96, (ctx) => {
      this.diamond(ctx, 90, 64, 170, 56, "rgba(13,42,54,0.92)", "#4ff5ff");
      this.round(ctx, 28, 26, 124, 34, 8, "#0f7894", "#86faff");
      this.rect(ctx, 42, 42, 34, 6, "#d9fbff");
      this.rect(ctx, 88, 42, 34, 6, "#d9fbff");
      this.round(ctx, 20, 14, 36, 22, 6, "#102538", "#4ff5ff");
      this.round(ctx, 124, 12, 28, 20, 6, "#ff55ef", "#ffb7fb");
      ctx.font = "bold 12px Segoe UI, Arial";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("NEON BAR", 58, 24);
    });

    this.pixelTexture("sofa-blue", 102, 64, (ctx) => {
      this.rect(ctx, 9, 28, 80, 18, "#163e74");
      this.rect(ctx, 17, 14, 74, 18, "#215ca2");
      this.rect(ctx, 4, 24, 14, 28, "#102b52");
      this.rect(ctx, 83, 24, 14, 28, "#102b52");
      this.outline(ctx, 4, 14, 93, 38, "#5d9bff");
    });

    this.pixelTexture("holo-table", 88, 42, (ctx) => {
      this.diamond(ctx, 44, 19, 80, 30, "#123845", "#86faff");
      this.rect(ctx, 37, 20, 14, 18, "#0b1b24");
      this.rect(ctx, 23, 12, 42, 3, "#ffffff");
    });

    this.pixelTexture("vending", 58, 88, (ctx) => {
      this.rect(ctx, 12, 10, 34, 66, "#102538");
      this.outline(ctx, 12, 10, 34, 66, "#4ff5ff");
      this.rect(ctx, 18, 18, 22, 18, "#071018");
      this.rect(ctx, 20, 20, 18, 4, "#73ff7b");
      this.rect(ctx, 20, 28, 12, 4, "#ff55ef");
      this.rect(ctx, 20, 48, 18, 4, "#86faff");
      this.rect(ctx, 20, 60, 18, 4, "#86faff");
      this.rect(ctx, 18, 76, 22, 4, "#071018");
    });

    this.pixelTexture("plant-pod", 58, 62, (ctx) => {
      this.rect(ctx, 16, 34, 26, 18, "#14212c");
      this.outline(ctx, 16, 34, 26, 18, "#86faff");
      this.rect(ctx, 21, 42, 16, 4, "#4ff5ff");
      ctx.fillStyle = "#73ff7b";
      ctx.fillRect(22, 20, 5, 16);
      ctx.fillRect(31, 14, 5, 22);
      ctx.fillRect(15, 25, 8, 6);
      ctx.fillRect(35, 24, 9, 6);
      ctx.fillStyle = "#1de2ff";
      ctx.fillRect(27, 24, 5, 10);
    });

    this.pixelTexture("protocol-board", 150, 112, (ctx) => {
      this.rect(ctx, 16, 8, 118, 84, "#071018");
      this.outline(ctx, 16, 8, 118, 84, "#73ff7b");
      this.rect(ctx, 24, 18, 56, 5, "#73ff7b");
      ctx.font = "bold 9px Segoe UI, Arial";
      ctx.fillStyle = "#eaffef";
      ctx.fillText("PROTOCOLES", 28, 36);
      ctx.fillText("01 SIGNAL", 28, 52);
      ctx.fillText("02 FRAG 404", 28, 66);
      ctx.fillText("04 GHOST", 28, 80);
      this.rect(ctx, 58, 92, 16, 16, "#0a151e");
      this.rect(ctx, 64, 88, 4, 8, "#73ff7b");
    });

    this.pixelTexture("terminal-404", 76, 86, (ctx) => {
      this.rect(ctx, 20, 44, 36, 30, "#101923");
      this.rect(ctx, 12, 8, 52, 42, "#071018");
      this.outline(ctx, 12, 8, 52, 42, "#73ff7b");
      this.rect(ctx, 20, 16, 34, 4, "#73ff7b");
      ctx.font = "bold 14px Segoe UI, Arial";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("404", 24, 36);
      this.rect(ctx, 31, 74, 14, 6, "#73ff7b");
    });

    this.pixelTexture("event-stage", 180, 88, (ctx) => {
      this.diamond(ctx, 90, 52, 168, 60, "#32113d", "#ff55ef");
      this.rect(ctx, 42, 18, 96, 22, "#12071a");
      this.outline(ctx, 42, 18, 96, 22, "#ff55ef");
      this.rect(ctx, 56, 12, 4, 38, "#ff55ef");
      this.rect(ctx, 120, 12, 4, 38, "#ff55ef");
      ctx.font = "bold 10px Segoe UI, Arial";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("EVENT", 74, 34);
    });

    this.pixelTexture("dj-booth", 88, 54, (ctx) => {
      this.rect(ctx, 10, 22, 68, 22, "#101625");
      this.outline(ctx, 10, 22, 68, 22, "#ff55ef");
      this.rect(ctx, 18, 28, 18, 8, "#071018");
      this.rect(ctx, 52, 28, 18, 8, "#071018");
      this.rect(ctx, 25, 17, 8, 8, "#4ff5ff");
      this.rect(ctx, 55, 17, 8, 8, "#4ff5ff");
      ctx.font = "bold 8px Segoe UI, Arial";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("DJ", 39, 37);
    });

    this.pixelTexture("arcade-hall", 150, 102, (ctx) => {
      this.round(ctx, 10, 16, 124, 66, 8, "#101625", "#ff55ef");
      this.rect(ctx, 22, 28, 80, 8, "#ff55ef");
      this.rect(ctx, 22, 48, 54, 6, "#4ff5ff");
      this.rect(ctx, 22, 62, 74, 6, "#73ff7b");
      this.round(ctx, 106, 42, 18, 28, 5, "#071018", "#4ff5ff");
      ctx.font = "bold 12px Segoe UI, Arial";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("ARCADE", 34, 78);
    });

    this.arcadeTexture("arcade-run", "#ff55ef", "RUN");
    this.arcadeTexture("arcade-mem", "#4ff5ff", "MEM");

    this.pixelTexture("staff-desk", 126, 78, (ctx) => {
      this.rect(ctx, 16, 36, 94, 28, "#2b1018");
      this.rect(ctx, 28, 12, 72, 30, "#071018");
      this.outline(ctx, 28, 12, 72, 30, "#ff5165");
      ctx.font = "bold 10px Segoe UI, Arial";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("STAFF", 48, 30);
      this.rect(ctx, 36, 48, 52, 4, "#ff5165");
    });

    this.pixelTexture("security-gate", 82, 70, (ctx) => {
      this.rect(ctx, 8, 18, 12, 46, "#111827");
      this.rect(ctx, 62, 18, 12, 46, "#111827");
      this.outline(ctx, 8, 18, 12, 46, "#ff5165");
      this.outline(ctx, 62, 18, 12, 46, "#ff5165");
      this.rect(ctx, 22, 30, 38, 4, "#ff5165");
      this.rect(ctx, 22, 46, 38, 4, "#4ff5ff");
      this.rect(ctx, 34, 10, 14, 8, "#ffffff");
    });

    this.pixelTexture("staff-door", 104, 84, (ctx) => {
      this.round(ctx, 18, 8, 68, 62, 8, "#190b12", "#ff5165");
      this.rect(ctx, 28, 22, 48, 7, "#ffffff");
      this.rect(ctx, 28, 48, 48, 6, "#ff5165");
      ctx.font = "bold 11px Segoe UI, Arial";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("STAFF", 38, 40);
      this.rect(ctx, 44, 70, 18, 5, "#ff5165");
    });

    this.pixelTexture("neon-column", 48, 156, (ctx) => {
      this.rect(ctx, 18, 18, 12, 120, "#0d1722");
      this.rect(ctx, 21, 20, 6, 116, "#4ff5ff");
      this.rect(ctx, 14, 10, 20, 10, "#4ff5ff");
      this.rect(ctx, 14, 136, 20, 10, "#4ff5ff");
      ctx.fillStyle = "rgba(79,245,255,0.2)";
      ctx.fillRect(10, 18, 28, 120);
    });
  }

  private avatarTextures() {
    this.pixelTexture("avatar-shadow", 40, 18, (ctx) => {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(8, 6, 24, 4);
      ctx.fillRect(4, 8, 32, 4);
      ctx.fillRect(12, 12, 16, 2);
    });

    this.pixelTexture("avatar-aura", 48, 20, (ctx) => {
      this.diamond(ctx, 24, 10, 42, 16, "#ffffff", "#ffffff");
      ctx.clearRect(13, 7, 22, 6);
    });

    for (const [name, colors] of Object.entries(avatarColors) as Array<[Avatar, { coat: string; trim: string; hair: string }]>) {
      this.pixelTexture(`avatar-${name}`, 34, 58, (ctx) => {
        ctx.lineWidth = 1.5;
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.beginPath();
        ctx.ellipse(18, 50, 12, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        this.round(ctx, 12, 36, 6, 14, 3, "#0a0d12", "#172637");
        this.round(ctx, 20, 36, 6, 14, 3, "#0a0d12", "#172637");
        this.round(ctx, 8, 23, 22, 24, 7, colors.coat, "#061018");
        this.round(ctx, 5, 26, 6, 17, 3, colors.coat, "#061018");
        this.round(ctx, 28, 26, 6, 17, 3, colors.coat, "#061018");
        this.round(ctx, 12, 22, 14, 5, 3, colors.trim, "#ffffff");

        ctx.fillStyle = "#e9fbff";
        ctx.beginPath();
        ctx.ellipse(19, 16, 10, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#061018";
        ctx.stroke();

        this.round(ctx, 13, 14, 16, 5, 3, "#071018", colors.trim);
        ctx.fillStyle = colors.hair;
        ctx.beginPath();
        ctx.ellipse(18, 8, 11, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        this.round(ctx, 8, 11, 5, 11, 3, colors.hair, colors.hair);
        this.round(ctx, 26, 11, 4, 9, 2, colors.hair, colors.hair);
        this.round(ctx, 1, 24, 7, 8, 3, colors.trim, "#061018");
        this.round(ctx, 31, 24, 4, 8, 2, colors.trim, "#061018");
      });
    }
  }

  private arcadeTexture(key: string, neon: string, label: string) {
    this.pixelTexture(key, 48, 76, (ctx) => {
      this.rect(ctx, 10, 12, 28, 52, "#171326");
      this.rect(ctx, 14, 18, 20, 18, "#071018");
      this.outline(ctx, 14, 18, 20, 18, neon);
      ctx.font = "bold 8px Segoe UI, Arial";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, 15, 30);
      this.rect(ctx, 17, 44, 4, 4, "#ff5165");
      this.rect(ctx, 27, 44, 4, 4, "#73ff7b");
      this.rect(ctx, 8, 64, 32, 6, "#0b0d14");
      this.outline(ctx, 10, 12, 28, 58, neon);
    });
  }

  private isoTile(key: string, top: string, side: string, edge: string) {
    this.pixelTexture(key, 64, 34, (ctx) => {
      const gradient = ctx.createLinearGradient(32, 1, 32, 31);
      gradient.addColorStop(0, top);
      gradient.addColorStop(1, side);
      this.diamond(ctx, 32, 16, 62, 30, gradient, edge);
      ctx.strokeStyle = "rgba(134,250,255,0.2)";
      ctx.beginPath();
      ctx.moveTo(32, 2);
      ctx.lineTo(32, 30);
      ctx.moveTo(18, 16);
      ctx.lineTo(46, 16);
      ctx.stroke();
      ctx.fillStyle = "rgba(79,245,255,0.08)";
      ctx.beginPath();
      ctx.ellipse(32, 16, 20, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  private pixelTexture(key: string, width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
    if (this.textures.exists(key)) {
      this.textures.remove(key);
    }
    const texture = this.textures.createCanvas(key, width * textureScale, height * textureScale);
    if (!texture) {
      throw new Error(`Unable to create pixel texture: ${key}`);
    }
    const canvas = texture.getSourceImage() as HTMLCanvasElement;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, width * textureScale, height * textureScale);
    ctx.scale(textureScale, textureScale);
    draw(ctx);
    texture.refresh();
  }

  private art(x: number, y: number, key: string, depth: number) {
    return this.add.image(x, y, key).setScale(1 / textureScale).setDepth(depth);
  }

  private localArt(x: number, y: number, key: string) {
    return this.add.image(x, y, key).setScale(1 / textureScale);
  }

  private isoToScreen(col: number, row: number) {
    return {
      x: iso.originX + (col - row) * (iso.tileW / 2),
      y: iso.originY + (col + row) * (iso.tileH / 2)
    };
  }

  private clampToRoom(x: number, y: number) {
    return {
      x: Phaser.Math.Clamp(x, 150, 1130),
      y: Phaser.Math.Clamp(y, 210, 650)
    };
  }

  private rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  private outline(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + w - 1, y, 1, h);
  }

  private diamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, fill: string | CanvasGradient, stroke: string) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - h / 2);
    ctx.lineTo(cx + w / 2, cy);
    ctx.lineTo(cx, cy + h / 2);
    ctx.lineTo(cx - w / 2, cy);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, stroke?: string) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }
}

export function createGame(parent: string, hooks: GameHooks) {
  const width = typeof window === "undefined" ? baseRoom.width : window.innerWidth;
  const height = typeof window === "undefined" ? baseRoom.height : window.innerHeight;

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width,
    height,
    backgroundColor: "#06080c",
    pixelArt: false,
    antialias: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [new DistrictScene(hooks)],
    input: {
      activePointers: 2
    },
    callbacks: {}
  });
}
