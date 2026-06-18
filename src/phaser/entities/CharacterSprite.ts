import Phaser from "phaser";
import { TILE_W, TILE_H, AVATAR_PALETTE, ROLE_COLORS } from "../../utils/constants";
import { gridToScreen, depthOf, findPath, screenToGrid, isWalkable } from "../world/TileMap";
import type { Player, Avatar, Role, GridPos } from "../../types/game";

/**
 * Manages a character sprite on the isometric grid.
 * Handles pathfinding movement, animations, speech bubbles, emotes.
 */
export class CharacterSprite {
  readonly playerId: string;
  readonly pseudo: string;
  readonly container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private bodySprite: Phaser.GameObjects.Graphics;
  private shadowSprite: Phaser.GameObjects.Ellipse;
  private glowRing: Phaser.GameObjects.Ellipse;
  private nameLabel: Phaser.GameObjects.Text;
  private speechBubble: Phaser.GameObjects.Container;
  private speechText: Phaser.GameObjects.Text;
  private emoteText: Phaser.GameObjects.Text | null = null;

  private currentCol: number;
  private currentRow: number;
  private path: GridPos[] = [];
  private isMoving = false;
  private moveTimer: Phaser.Time.TimerEvent | null = null;
  private avatar: Avatar;
  private role: Role;
  private isLocal: boolean;
  private bobTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, player: Player, isLocal: boolean) {
    this.scene = scene;
    this.playerId = player.id;
    this.pseudo = player.pseudo;
    this.avatar = player.avatar;
    this.role = player.role;
    this.isLocal = isLocal;

    // Determine grid position from pixel coords
    const grid = screenToGrid(player.x, player.y);
    this.currentCol = isWalkable(grid.col, grid.row) ? grid.col : 8;
    this.currentRow = isWalkable(grid.col, grid.row) ? grid.row : 5;

    const { x, y } = gridToScreen(this.currentCol, this.currentRow);

    // Container
    this.container = scene.add.container(x, y);
    this.container.setDepth(depthOf(this.currentCol, this.currentRow, 5));

    // Shadow
    this.shadowSprite = scene.add.ellipse(0, 6, 26, 10, 0x000000, 0.35);
    this.container.add(this.shadowSprite);

    // Glow ring
    const roleColor = ROLE_COLORS[player.role];
    this.glowRing = scene.add.ellipse(0, 4, 30, 12, roleColor, isLocal ? 0.3 : 0.15);
    this.container.add(this.glowRing);
    scene.tweens.add({
      targets: this.glowRing,
      scaleX: 1.2, scaleY: 1.2,
      alpha: isLocal ? 0.1 : 0.05,
      yoyo: true, repeat: -1, duration: 1400, ease: "Sine.easeInOut",
    });

    // Body
    this.bodySprite = scene.add.graphics();
    this.drawBody();
    this.container.add(this.bodySprite);

    // Local indicator
    if (isLocal) {
      const arrow = scene.add.triangle(0, 14, 0, -3, -4, 3, 4, 3, roleColor, 0.6);
      scene.tweens.add({ targets: arrow, y: 17, alpha: 0.3, yoyo: true, repeat: -1, duration: 700 });
      this.container.add(arrow);
    }

    // Name label
    const nameW = Math.max(50, player.pseudo.length * 6.5 + 12);
    const nameBg = scene.add.rectangle(0, 18, nameW, 13, 0x030810, 0.85)
      .setStrokeStyle(0.5, roleColor, 0.5);
    this.nameLabel = scene.add.text(0, 18, player.pseudo, {
      fontFamily: "'Courier New', monospace",
      fontSize: "9px",
      fontStyle: "bold",
      color: "#ffffff",
      stroke: "#030508",
      strokeThickness: 2,
    }).setOrigin(0.5).setResolution(2);
    this.container.add([nameBg, this.nameLabel]);

    // Speech bubble (hidden by default)
    this.speechBubble = scene.add.container(0, -50).setVisible(false);
    const bubbleBg = scene.add.rectangle(0, 0, 120, 24, 0xe8fbff, 0.95).setStrokeStyle(1, 0x4ff5ff, 0.5);
    this.speechText = scene.add.text(0, 0, "", {
      fontFamily: "'Segoe UI', sans-serif",
      fontSize: "9px",
      color: "#071018",
      wordWrap: { width: 110 },
    }).setOrigin(0.5).setResolution(2);
    const bubbleTail = scene.add.triangle(0, 13, -4, 0, 4, 0, 0, 6, 0xe8fbff, 0.95);
    this.speechBubble.add([bubbleBg, this.speechText, bubbleTail]);
    this.container.add(this.speechBubble);

    // Idle animation
    this.startIdleAnim();
  }

  get col() { return this.currentCol; }
  get row() { return this.currentRow; }

  /**
   * Move character to target grid position using pathfinding
   */
  moveTo(targetCol: number, targetRow: number) {
    if (!isWalkable(targetCol, targetRow)) return;
    if (targetCol === this.currentCol && targetRow === this.currentRow) return;

    this.path = findPath({ col: this.currentCol, row: this.currentRow }, { col: targetCol, row: targetRow });
    if (this.path.length === 0) return;

    this.startWalking();
  }

  /**
   * Teleport (for syncing remote players)
   */
  teleportTo(col: number, row: number) {
    if (!isWalkable(col, row)) return;
    this.currentCol = col;
    this.currentRow = row;
    const { x, y } = gridToScreen(col, row);
    this.scene.tweens.add({
      targets: this.container,
      x, y,
      duration: 250,
      ease: "Power2",
      onUpdate: () => this.container.setDepth(depthOf(this.currentCol, this.currentRow, 5)),
    });
  }

  /**
   * Show speech bubble with text
   */
  showSpeech(text: string) {
    const display = text.length > 40 ? text.slice(0, 37) + "..." : text;
    this.speechText.setText(display);
    // Resize bg
    const bg = this.speechBubble.getAt(0) as Phaser.GameObjects.Rectangle;
    bg.width = Math.min(140, Math.max(50, display.length * 5.5 + 16));
    
    this.speechBubble.setVisible(true).setAlpha(0);
    this.scene.tweens.add({ targets: this.speechBubble, alpha: 1, duration: 150 });
    this.scene.time.delayedCall(4000, () => {
      this.scene.tweens.add({
        targets: this.speechBubble, alpha: 0, duration: 250,
        onComplete: () => this.speechBubble.setVisible(false),
      });
    });
  }

  /**
   * Show emote animation
   */
  showEmote(emote: string) {
    const icons: Record<string, string> = {
      wave: "👋", dance: "💃", hack: "⚡", chill: "😎", salute: "🫡", glitch: "⚠️"
    };
    const icon = icons[emote] ?? "✨";

    if (!this.emoteText) {
      this.emoteText = this.scene.add.text(0, -55, "", { fontSize: "22px" }).setOrigin(0.5);
      this.container.add(this.emoteText);
    }

    this.emoteText.setText(icon).setVisible(true).setAlpha(1).setScale(0.3).setY(-55);
    this.scene.tweens.add({
      targets: this.emoteText,
      scale: 1.2, y: -70, alpha: 0,
      duration: 2000,
      ease: "Back.easeOut",
      onComplete: () => this.emoteText?.setVisible(false).setY(-55),
    });
  }

  destroy() {
    this.moveTimer?.destroy();
    this.bobTween?.destroy();
    this.container.destroy();
  }

  // === PRIVATE ===

  private startWalking() {
    if (this.isMoving) return;
    this.isMoving = true;
    this.stopIdleAnim();
    this.walkNextStep();
  }

  private walkNextStep() {
    if (this.path.length === 0) {
      this.isMoving = false;
      this.startIdleAnim();
      return;
    }

    const next = this.path.shift()!;
    this.currentCol = next.col;
    this.currentRow = next.row;
    const { x, y } = gridToScreen(next.col, next.row);

    this.scene.tweens.add({
      targets: this.container,
      x, y,
      duration: 180,
      ease: "Linear",
      onUpdate: () => {
        this.container.setDepth(depthOf(this.currentCol, this.currentRow, 5));
      },
      onComplete: () => this.walkNextStep(),
    });
  }

  private startIdleAnim() {
    this.bobTween = this.scene.tweens.add({
      targets: this.bodySprite,
      y: -2,
      yoyo: true,
      repeat: -1,
      duration: 1600 + Math.random() * 400,
      ease: "Sine.easeInOut",
    });
  }

  private stopIdleAnim() {
    this.bobTween?.destroy();
    this.bodySprite.y = 0;
  }

  private drawBody() {
    const g = this.bodySprite;
    const pal = AVATAR_PALETTE[this.avatar];
    g.clear();

    const body = Phaser.Display.Color.HexStringToColor(pal.body).color;
    const trim = Phaser.Display.Color.HexStringToColor(pal.trim).color;
    const visor = Phaser.Display.Color.HexStringToColor(pal.visor).color;
    const glow = Phaser.Display.Color.HexStringToColor(pal.glow).color;

    // Legs
    g.fillStyle(0x0a0e14, 1);
    g.fillRoundedRect(-5, 8, 4, 10, 1);
    g.fillRoundedRect(1, 8, 4, 10, 1);

    // Body
    g.fillStyle(body, 1);
    g.fillRoundedRect(-8, -8, 16, 18, 3);
    g.lineStyle(0.8, trim, 0.8);
    g.strokeRoundedRect(-8, -8, 16, 18, 3);

    // Trim lines
    g.fillStyle(trim, 0.6);
    g.fillRect(-6, -2, 12, 1.5);
    g.fillRect(-6, 4, 12, 1.5);

    // Arms
    g.fillStyle(body, 1);
    g.fillRoundedRect(-11, -5, 3, 12, 1);
    g.fillRoundedRect(8, -5, 3, 12, 1);
    g.lineStyle(0.5, trim, 0.6);
    g.strokeRoundedRect(-11, -5, 3, 12, 1);
    g.strokeRoundedRect(8, -5, 3, 12, 1);

    // Head
    g.fillStyle(0xd4ecf0, 1);
    g.fillCircle(0, -16, 7);
    g.lineStyle(0.6, 0x0a1018, 0.8);
    g.strokeCircle(0, -16, 7);

    // Hair
    g.fillStyle(0x0a1218, 1);
    g.fillEllipse(0, -20, 14, 7);

    // Visor
    g.fillStyle(visor, 1);
    g.fillRect(-5, -17, 10, 2.5);

    // Shoulder pads
    g.fillStyle(trim, 0.8);
    g.fillCircle(-9, -6, 2.5);
    g.fillCircle(9, -6, 2.5);

    // Glow aura
    g.fillStyle(glow, 0.06);
    g.fillCircle(0, -4, 16);
  }
}
