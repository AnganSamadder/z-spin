import { GameScene } from '../../scenes/GameScene';
import { TETROMINOES } from '../../constants';
import WasmLoader from './WasmLoader';

export class WasmEngine {
  private gameScene: GameScene;
  private wasmEngine: any = null; // Will be set to the actual WASM engine instance
  private isActive = false;
  private initializing = false;
  private lastMoveTime = 0;
  private readonly moveInterval = 100; // ms between moves

  constructor(gameScene: GameScene) {
    this.gameScene = gameScene;
  }

  private logInfo(message: string, data?: any): void {
    console.log(`[WASM Engine] ${message}`, data ? data : '');
  }

  public async initialize(): Promise<boolean> {
    if (this.initializing) {
      this.logInfo('Already initializing, waiting...');
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(this.wasmEngine !== null);
        }, 1000);
      });
    }

    this.initializing = true;
    try {
      this.logInfo('Starting initialization');
      const wasmLoader = WasmLoader.getInstance();
      
      try {
        this.logInfo('Loading WASM module');
        await wasmLoader.loadWasmModule();
      } catch (loadError) {
        this.logInfo('Error loading WASM module', loadError);
        this.initializing = false;
        return false;
      }
      
      this.logInfo('Checking if WASM is loaded');
      if (wasmLoader.isLoaded()) {
        try {
          this.logInfo('Creating WASM engine');
          this.wasmEngine = wasmLoader.createEngine();
          
          if (!this.wasmEngine) {
            throw new Error('Failed to create WASM engine instance');
          }
          
          this.logInfo('WASM engine initialized successfully');
          this.initializing = false;
          return true;
        } catch (createError) {
          this.logInfo('Error creating WASM engine', createError);
          this.initializing = false;
          return false;
        }
      } else {
        this.logInfo('WASM module not loaded: ' + 
          'wasmLoader.isLoaded() returned false');
        this.initializing = false;
        return false;
      }
    } catch (error) {
      this.logInfo('Error initializing WASM engine', error);
      this.initializing = false;
      return false;
    }
  }

  public activate(): void {
    if (!this.wasmEngine) {
      this.logInfo('Cannot activate WASM engine: not initialized');
      return;
    }
    
    this.isActive = true;
    this.logInfo('WASM engine activated');
  }

  public deactivate(): void {
    this.isActive = false;
    this.logInfo('WASM engine deactivated');
  }

  public isActiveEngine(): boolean {
    return this.isActive;
  }

  public update(time: number, delta: number): void {
    if (!this.isActive || !this.wasmEngine || !this.gameScene.gameState.currentTetromino) {
      return;
    }

    if (time - this.lastMoveTime < this.moveInterval) {
      return;
    }

    this.lastMoveTime = time;

    const state = this.gameScene.gameState;
    if (!state.currentTetromino) {
      return;
    }
    const board = state.board.map(row => row.map(cell => cell === null ? 0 : 1)).flat();
    const currentPiece = WasmLoader.TETROMINO_TYPE_MAP[state.currentTetromino.typeKey];
    const nextPiece = WasmLoader.TETROMINO_TYPE_MAP[state.nextTetrominoQueue[0].typeKey];

    const move = this.wasmEngine.get_best_move(board, currentPiece, nextPiece);

    this.executeMove(move);
  }

  private executeMove(move: string): void {
    switch(move) {
      case 'move_left':
        this.gameScene.gameLogic.moveBlockLeft();
        break;
      case 'move_right':
        this.gameScene.gameLogic.moveBlockRight();
        break;
      case 'rotate':
        this.gameScene.gameLogic.rotate(true); // Assuming CW rotation
        break;
      case 'move_down':
        this.gameScene.gameLogic.moveBlockDown(true);
        break;
      case 'hard_drop':
        this.gameScene.gameLogic.performHardDrop();
        break;
      case 'hold':
        this.gameScene.gameLogic.performHold();
        break;
      default:
        // No-op
        break;
    }
    this.gameScene.gameRenderer.drawGame();
  }

  // Map WASM tetromino type indices to colors used in the JS engine
  private getColorForTetrominoType(typeIndex: number): number {
    // These are the standard Tetris colors
    const colorMap: {[key: number]: number} = {
      0: 0x00FFFF, // I - cyan
      1: 0xFFFF00, // O - yellow
      2: 0x800080, // T - purple
      3: 0x00FF00, // S - green
      4: 0xFF0000, // Z - red
      5: 0x0000FF, // J - blue
      6: 0xFF7F00  // L - orange
    };
    
    return colorMap[typeIndex] || 0xFFFFFF; // Default to white if unknown
  }
} 