import Phaser from "phaser";
import { TILE_W, TILE_H, CITY_MAP, MAP_COLS, MAP_ROWS, BUILDINGS, STREET_PROPS, type BuildingDef, type StreetPropDef } from "../../utils/constants";
import { gridToScreen, depthOf } from "./TileMap";

const TW = TILE_W, TH = TILE_H;

export function buildCity(scene: Phaser.Scene) {
  drawGround(scene);
  drawBuildings(scene);
  drawStreetProps(scene);
}

// === GROUND: roads, sidewalks, park, water ===
function drawGround(scene: Phaser.Scene) {
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      const t = CITY_MAP[row][col];
      if (t === 0) continue;
      const { x, y } = gridToScreen(col, row);
      const d = depthOf(col, row);
      const g = scene.add.graphics().setDepth(d);

      switch (t) {
        case 1: // sidewalk
          tileDiamond(g, x, y, (col + row) % 2 === 0 ? 0x0e1820 : 0x0c1418, 0.9);
          g.lineStyle(0.4, 0x1a3848, 0.2);
          tileStroke(g, x, y);
          break;
        case 2: // road
          tileDiamond(g, x, y, (col + row) % 2 === 0 ? 0x0a0e14 : 0x080c10, 0.95);
          // Road markings
          if (col % 3 === 0 || row % 3 === 0) {
            g.fillStyle(0xffd700, 0.12);
            g.fillRect(x - 2, y - 1, 4, 2);
          }
          break;
        case 4: // park
          tileDiamond(g, x, y, (col + row) % 2 === 0 ? 0x0a1e10 : 0x081a0c, 0.85);
          // Grass detail
          if (Math.random() > 0.6) {
            g.fillStyle(0x73ff7b, 0.1);
            g.fillRect(x - 3 + Math.random() * 6, y - 2, 2, 3);
          }
          break;
        case 5: // plaza
          tileDiamond(g, x, y, (col + row) % 2 === 0 ? 0x121828 : 0x0e1420, 0.9);
          g.lineStyle(0.6, 0x4ff5ff, 0.15);
          tileStroke(g, x, y);
          // Plaza pattern
          tileDiamond(g, x, y, TW * 0.3, 0.06, 0x4ff5ff);
          break;
        case 6: // water
          tileDiamond(g, x, y, 0x061828, 0.9);
          g.fillStyle(0x4ff5ff, 0.06 + Math.random() * 0.04);
          g.fillRect(x - 8 + Math.random() * 4, y - 1, 12, 1);
          // Animated shimmer
          const shimmer = scene.add.rectangle(x, y, 10, 2, 0x4ff5ff, 0.08).setDepth(d + 1);
          scene.tweens.add({ targets: shimmer, alpha: 0.02, x: x + 6, yoyo: true, repeat: -1, duration: 2000 + Math.random() * 1000 });
          break;
        case 7: // bridge
          tileDiamond(g, x, y, 0x1a2830, 0.92);
          g.lineStyle(1, 0x4ff5ff, 0.3);
          tileStroke(g, x, y);
          break;
        case 8: // entrance
          tileDiamond(g, x, y, 0x0c2018, 0.9);
          g.lineStyle(1.5, 0x73ff7b, 0.6);
          tileStroke(g, x, y);
          // Pulsing glow
          const glow = scene.add.circle(x, y, 8, 0x73ff7b, 0.2).setDepth(d + 1);
          scene.tweens.add({ targets: glow, alpha: 0.05, scale: 1.5, yoyo: true, repeat: -1, duration: 1500 });
          break;
      }
    }
  }
}

// === BUILDINGS: 3D isometric blocks ===
function drawBuildings(scene: Phaser.Scene) {
  for (const b of BUILDINGS) {
    drawBuilding(scene, b);
  }
}

function drawBuilding(scene: Phaser.Scene, b: BuildingDef) {
  const base = Phaser.Display.Color.HexStringToColor(b.color).color;
  const accent = Phaser.Display.Color.HexStringToColor(b.accent).color;
  const bh = b.floors * 18; // pixel height based on floors

  // Draw from back to front (each row of the building)
  for (let dr = 0; dr < b.h; dr++) {
    for (let dc = 0; dc < b.w; dc++) {
      const col = b.col + dc, row = b.row + dr;
      const { x, y } = gridToScreen(col, row);
      const d = depthOf(col, row, 4);

      // Only draw visible faces (front row and right column)
      const isRightEdge = dc === b.w - 1;
      const isFrontEdge = dr === b.h - 1;
      const isTop = true;

      const g = scene.add.graphics().setDepth(d);

      // Top face (all tiles)
      if (isTop) {
        g.fillStyle(base, 0.6);
        g.beginPath();
        g.moveTo(x, y - bh - TH / 2);
        g.lineTo(x + TW / 2, y - bh);
        g.lineTo(x, y - bh + TH / 2);
        g.lineTo(x - TW / 2, y - bh);
        g.closePath();
        g.fill();
        g.lineStyle(0.5, accent, 0.2);
        g.strokePath();
      }

      // Right face (front edge only)
      if (isFrontEdge) {
        g.fillStyle(base, 0.45);
        g.beginPath();
        g.moveTo(x - TW / 2, y - bh);
        g.lineTo(x, y - bh + TH / 2);
        g.lineTo(x, y + TH / 2);
        g.lineTo(x - TW / 2, y);
        g.closePath();
        g.fill();

        // Windows on front
        drawWindowColumn(g, x - TW / 4, y, bh, accent, b.floors);
      }

      // Left face (right edge only)
      if (isRightEdge) {
        g.fillStyle(base, 0.3);
        g.beginPath();
        g.moveTo(x + TW / 2, y - bh);
        g.lineTo(x, y - bh + TH / 2);
        g.lineTo(x, y + TH / 2);
        g.lineTo(x + TW / 2, y);
        g.closePath();
        g.fill();

        // Windows on side
        drawWindowColumn(g, x + TW / 4, y, bh, accent, b.floors);
      }

      // Edge glow on top front/right
      if (isFrontEdge || isRightEdge) {
        g.lineStyle(0.8, accent, 0.4);
        if (isFrontEdge) g.lineBetween(x - TW / 2, y - bh, x, y - bh + TH / 2);
        if (isRightEdge) g.lineBetween(x + TW / 2, y - bh, x, y - bh + TH / 2);
      }
    }
  }

  // Building label on top
  const centerCol = b.col + Math.floor(b.w / 2);
  const centerRow = b.row + Math.floor(b.h / 2);
  const { x: lx, y: ly } = gridToScreen(centerCol, centerRow);
  const labelY = ly - bh - 12;
  const accentStr = "#" + accent.toString(16).padStart(6, "0");

  scene.add.rectangle(lx, labelY, b.name.length * 6 + 14, 14, 0x030810, 0.85)
    .setStrokeStyle(0.8, accent, 0.6).setDepth(depthOf(centerCol, centerRow, 6));
  scene.add.text(lx, labelY, b.name, {
    fontFamily: "'Courier New', monospace", fontSize: "9px", fontStyle: "bold",
    color: accentStr, stroke: "#030508", strokeThickness: 2,
  }).setOrigin(0.5).setDepth(depthOf(centerCol, centerRow, 7));

  // Roof detail: antenna or neon strip for tall buildings
  if (b.floors >= 5) {
    const { x: ax, y: ay } = gridToScreen(b.col + b.w - 1, b.row);
    const antG = scene.add.graphics().setDepth(depthOf(b.col + b.w - 1, b.row, 8));
    antG.fillStyle(accent, 0.7);
    antG.fillRect(ax, ay - bh - 20, 1, 20);
    antG.fillCircle(ax, ay - bh - 22, 2);
    // Blinking light
    const blink = scene.add.circle(ax, ay - bh - 22, 2, accent, 0.9).setDepth(depthOf(b.col + b.w - 1, b.row, 9));
    scene.tweens.add({ targets: blink, alpha: 0.1, yoyo: true, repeat: -1, duration: 800 + Math.random() * 600 });
  }
}

function drawWindowColumn(g: Phaser.GameObjects.Graphics, wx: number, baseY: number, buildingH: number, accent: number, floors: number) {
  for (let f = 0; f < floors; f++) {
    const wy = baseY - 8 - f * 18;
    if (wy < baseY - buildingH + 4) break;
    // Window frame
    g.fillStyle(0x030810, 0.9);
    g.fillRect(wx - 4, wy - 6, 8, 10);
    // Window glow (random lit/unlit)
    const lit = Math.random() > 0.25;
    if (lit) {
      const wColor = Math.random() > 0.7 ? 0xff55ef : Math.random() > 0.5 ? accent : 0x1a3848;
      g.fillStyle(wColor, 0.4 + Math.random() * 0.3);
      g.fillRect(wx - 3, wy - 5, 6, 8);
    }
  }
}

// === STREET PROPS ===
function drawStreetProps(scene: Phaser.Scene) {
  for (const prop of STREET_PROPS) {
    const { x, y } = gridToScreen(prop.col, prop.row);
    const d = depthOf(prop.col, prop.row, 5);
    const accent = Phaser.Display.Color.HexStringToColor(prop.accent).color;
    const accentStr = prop.accent;
    const g = scene.add.graphics().setDepth(d);

    switch (prop.type) {
      case "streetlight":
        g.fillStyle(0x0c1820, 1);
        g.fillRect(x - 1, y - 40, 2, 40);
        g.fillStyle(accent, 0.8);
        g.fillCircle(x, y - 42, 3);
        g.fillStyle(accent, 0.08);
        g.fillCircle(x, y - 42, 16);
        g.fillStyle(accent, 0.025);
        g.beginPath(); g.moveTo(x, y - 38); g.lineTo(x - 16, y + 4); g.lineTo(x + 16, y + 4); g.closePath(); g.fill();
        break;
      case "tree":
        g.fillStyle(0x2a1a0c, 0.8);
        g.fillRect(x - 1, y - 20, 2, 20);
        // Canopy
        g.fillStyle(accent, 0.5);
        g.fillCircle(x, y - 24, 8);
        g.fillCircle(x - 4, y - 20, 5);
        g.fillCircle(x + 5, y - 22, 6);
        g.fillStyle(accent, 0.06);
        g.fillCircle(x, y - 22, 18);
        break;
      case "bench":
        g.fillStyle(0x0c1a24, 0.9);
        g.fillRect(x - 8, y - 5, 16, 4);
        g.fillRect(x - 7, y - 1, 2, 4);
        g.fillRect(x + 5, y - 1, 2, 4);
        g.lineStyle(0.5, accent, 0.4);
        g.strokeRect(x - 8, y - 5, 16, 4);
        break;
      case "hydrant":
        g.fillStyle(accent, 0.7);
        g.fillRect(x - 3, y - 10, 6, 10);
        g.fillRect(x - 5, y - 7, 10, 3);
        g.fillCircle(x, y - 11, 3);
        break;
      case "sign":
        g.fillStyle(0x0c1820, 1);
        g.fillRect(x - 0.5, y - 28, 1, 22);
        g.fillStyle(0x050a10, 0.95);
        g.fillRect(x - 18, y - 30, 36, 12);
        g.lineStyle(0.8, accent, 0.6);
        g.strokeRect(x - 18, y - 30, 36, 12);
        if (prop.label) {
          scene.add.text(x, y - 24, prop.label, {
            fontFamily: "'Courier New', monospace", fontSize: "7px", fontStyle: "bold", color: accentStr,
          }).setOrigin(0.5).setDepth(d + 1);
        }
        break;
      case "billboard":
        g.fillStyle(0x050a10, 0.95);
        g.fillRect(x - 22, y - 50, 44, 22);
        g.lineStyle(1.2, accent, 0.7);
        g.strokeRect(x - 22, y - 50, 44, 22);
        g.fillStyle(0x0c1820, 1);
        g.fillRect(x - 1, y - 28, 2, 22);
        g.fillRect(x - 8, y - 6, 16, 3);
        if (prop.label) {
          scene.add.text(x, y - 39, prop.label, {
            fontFamily: "'Courier New', monospace", fontSize: "11px", fontStyle: "bold", color: accentStr,
            stroke: "#030508", strokeThickness: 2,
          }).setOrigin(0.5).setDepth(d + 1);
        }
        // Glow
        g.fillStyle(accent, 0.05);
        g.fillCircle(x, y - 39, 28);
        break;
      case "car":
        // Car body
        g.fillStyle(accent, 0.6);
        g.beginPath();
        g.moveTo(x, y - 6);
        g.lineTo(x + 14, y);
        g.lineTo(x, y + 6);
        g.lineTo(x - 14, y);
        g.closePath();
        g.fill();
        // Windshield
        g.fillStyle(0x4ff5ff, 0.3);
        g.beginPath();
        g.moveTo(x, y - 4);
        g.lineTo(x + 8, y);
        g.lineTo(x, y + 2);
        g.lineTo(x - 4, y);
        g.closePath();
        g.fill();
        // Headlights
        g.fillStyle(0xffffff, 0.5);
        g.fillCircle(x + 12, y, 1.5);
        g.fillCircle(x - 12, y, 1.5);
        break;
      case "trash":
        g.fillStyle(0x0c1620, 0.9);
        g.fillRect(x - 4, y - 10, 8, 10);
        g.lineStyle(0.5, accent, 0.3);
        g.strokeRect(x - 4, y - 10, 8, 10);
        g.fillStyle(accent, 0.2);
        g.fillRect(x - 5, y - 11, 10, 2);
        break;
      case "mailbox":
        g.fillStyle(0x0c1a28, 0.9);
        g.fillRect(x - 4, y - 14, 8, 14);
        g.fillStyle(accent, 0.5);
        g.fillRect(x - 3, y - 8, 6, 2);
        g.lineStyle(0.5, accent, 0.4);
        g.strokeRect(x - 4, y - 14, 8, 14);
        break;
      case "fountain":
        g.fillStyle(0x0a1828, 0.8);
        g.fillCircle(x, y, 14);
        g.lineStyle(1, 0x86faff, 0.5);
        g.strokeCircle(x, y, 14);
        g.fillStyle(0x86faff, 0.15);
        g.fillCircle(x, y, 10);
        // Water spray
        const spray = scene.add.circle(x, y - 8, 2, 0x86faff, 0.4).setDepth(d + 1);
        scene.tweens.add({ targets: spray, y: y - 16, alpha: 0, yoyo: true, repeat: -1, duration: 1200 });
        const spray2 = scene.add.circle(x - 3, y - 5, 1.5, 0x86faff, 0.3).setDepth(d + 1);
        scene.tweens.add({ targets: spray2, y: y - 12, alpha: 0, yoyo: true, repeat: -1, duration: 1000, delay: 300 });
        break;
    }
  }
}

// === HELPERS ===
function tileDiamond(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, alpha: number, _unused?: number) {
  g.fillStyle(color, alpha);
  g.beginPath(); g.moveTo(x, y - TH / 2); g.lineTo(x + TW / 2, y); g.lineTo(x, y + TH / 2); g.lineTo(x - TW / 2, y); g.closePath(); g.fill();
}

function tileStroke(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  g.beginPath(); g.moveTo(x, y - TH / 2); g.lineTo(x + TW / 2, y); g.lineTo(x, y + TH / 2); g.lineTo(x - TW / 2, y); g.closePath(); g.stroke();
}
