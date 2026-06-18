import Phaser from "phaser";
import { DistrictScene, type SceneHooks } from "./scenes/DistrictScene";
import { WORLD_W, WORLD_H } from "../utils/constants";

export type { SceneHooks };
export { DistrictScene };

export function createGame(parent: string, hooks: SceneHooks): Phaser.Game {
  const width = typeof window === "undefined" ? WORLD_W : window.innerWidth;
  const height = typeof window === "undefined" ? WORLD_H : window.innerHeight;

  // Create scene instance with hooks injected
  const districtScene = new DistrictScene(hooks);

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
    scene: [districtScene],
    input: { activePointers: 2 },
  });
}
