import { GameScene } from '../../scenes/GameScene';

export interface BotController {
  moveLeft(): void;
  moveRight(): void;
  moveToLeft(): void;
  moveToRight(): void;
  rotateCW(): void;
  rotateCCW(): void;
  rotate180(): void;
  softDrop(): void;
  moveDown(): void;
  hardDrop(): void;
  hold(): void;
}

// Default local controller that mirrors human inputs by calling the same GameLogic APIs
export class LocalGameController implements BotController {
  private scene: GameScene;

  constructor(scene: GameScene) {
    this.scene = scene;
  }

  moveLeft(): void {
    this.scene.gameLogic.moveBlockLeft();
  }

  moveRight(): void {
    this.scene.gameLogic.moveBlockRight();
  }

  moveToLeft(): void {
    this.scene.gameLogic.moveAllTheWayLeft();
  }

  moveToRight(): void {
    this.scene.gameLogic.moveAllTheWayRight();
  }

  rotateCW(): void {
    this.scene.gameLogic.rotate('clockwise');
  }

  rotateCCW(): void {
    this.scene.gameLogic.rotate('counter-clockwise');
  }

  rotate180(): void {
    this.scene.gameLogic.rotate('180');
  }

  // Soft drop mirrors a held soft-drop key with SDF set to drop-to-bottom (our default)
  softDrop(): void {
    this.scene.gameLogic.moveToBottom();
  }

  moveDown(): void {
    this.scene.gameLogic.moveBlockDown(true);
  }

  hardDrop(): void {
    this.scene.gameLogic.performHardDrop();
  }

  hold(): void {
    this.scene.gameLogic.performHold();
  }
}


