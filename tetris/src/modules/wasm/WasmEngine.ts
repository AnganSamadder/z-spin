import { GameScene } from '../../scenes/GameScene';
import WasmLoader from './WasmLoader';
import { GameSettings, Strategy, DEFAULT_SETTINGS } from '../../types';
import { TETROMINOES } from '../../constants';

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
    console.log(`[WASM Engine] ${message}`, data || '');
  }

  public async initialize(wasmLoader: WasmLoader): Promise<boolean> {
    if (this.initializing || this.wasmEngine) {
      this.logInfo('Already initializing or initialized.');
      return false;
    }
    this.initializing = true;
    this.logInfo('Starting initialization');

    try {
      if (wasmLoader.isLoaded()) {
        try {
          this.logInfo('Creating WASM engine');
          this.wasmEngine = wasmLoader.createEngine();
          
          if (!this.wasmEngine) {
            throw new Error('Failed to create WASM engine instance');
          }

          // Configure the engine with optimal settings for AI control
          const ARR = 0;
          const DAS = 1;
          const SDF = 4294967295; // u32::MAX
          const DCD = 0;
          this.wasmEngine.configureMovement(ARR, DAS, SDF, DCD);
          
          this.logInfo('WASM engine initialized successfully');
          this.initializing = false;
          return true;
        } catch (error) {
          console.error('[WASM Engine] Error creating WASM engine:', error);
          this.initializing = false;
          return false;
        }
      } else {
        this.logInfo('WASM module not loaded yet');
        this.initializing = false;
        return false;
      }
    } catch (error) {
      console.error('[WASM Engine] General initialization error:', error);
      this.initializing = false;
      return false;
    }
  }

  public activate(): void {
    if (!this.wasmEngine) {
      this.logInfo('Cannot activate: WASM engine not initialized');
      return;
    }
    this.logInfo('WASM engine ACTIVATED');
    this.isActive = true;
    this.wasmEngine.configureLogging(false);
  }

  public deactivate(): void {
    this.logInfo('WASM engine DEACTIVATED');
    this.isActive = false;
  }

  public isActiveEngine(): boolean {
    return this.isActive;
  }

  public getBestMoveDebug(): void {
    if (!this.wasmEngine) {
      this.logInfo('WASM Engine not initialized for debug call');
      return;
    }
    console.log('🔬🔬🔬 DEBUG NEXT MOVE 🔬🔬🔬');
    const state = this.gameScene.gameState;
    if (!state.currentTetromino) {
      console.log('No current piece to debug.');
      return;
    }
    console.log('Current piece:', state.currentTetromino.typeKey);

    const settings: GameSettings = this.gameScene.registry.get('gameSettings') || DEFAULT_SETTINGS;
    const strategy = WasmLoader.STRATEGY_MAP[settings.aiStrategy];
    
    console.log('Current board state:');
    
    const board = state.board
      .slice(-20)
      .map(row => row.map(cell => cell === null ? 0 : 1))
      .flat();
      
    console.log('🔍 Preparing WASM debug call...');
    const currentPieceTypeIndex = WasmLoader.TETROMINO_TYPE_MAP[state.currentTetromino.typeKey];
    const nextPieceTypeIndex = state.nextTetrominoQueue.length > 0 ? WasmLoader.TETROMINO_TYPE_MAP[state.nextTetrominoQueue[0].typeKey] : -1;
    console.log('🎯 Current piece type index:', currentPieceTypeIndex);
    console.log('🎯 Next piece type index:', nextPieceTypeIndex);
    console.log('🎯 Board state array (flat):', board.slice(0, 40), `... (first 40 of ${board.length})`);
    
    // Enable logging, get the move, then disable it
    this.wasmEngine.configureLogging(true);
    const sequence = this.wasmEngine.get_full_move_sequence(board, currentPieceTypeIndex, nextPieceTypeIndex, strategy);
    this.wasmEngine.configureLogging(false);
    
    console.log('🎯 Full move sequence for debug:', sequence);
    console.log('🎯 Full move sequence:', sequence);
    
    this.executeFullSequence(sequence);
    console.log('🔬🔬🔬 DEBUG COMPLETE 🔬🔬🔬');
  }

  private executeFullSequence(sequence: string): void {
    const moves = sequence.split(',');
    console.log('🎮 Executing move sequence:', moves);
    
    let index = 0;
    const executeNext = () => {
      if (index < moves.length) {
        console.log(`🎮 Step ${index + 1}: ${moves[index]}`);
        this.executeMove(moves[index]);
        index++;
        setTimeout(executeNext, 150);
      } else {
        console.log('🎮 Sequence execution complete!');
      }
    };
    
    executeNext();
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
    const board = state.board
      .slice(-20) // 🎯 FIX: Only use the 20 visible rows
      .map(row => row.map(cell => cell === null ? 0 : 1))
      .flat();
    const currentPiece = WasmLoader.TETROMINO_TYPE_MAP[state.currentTetromino.typeKey];
    const nextPiece = WasmLoader.TETROMINO_TYPE_MAP[state.nextTetrominoQueue[0].typeKey];
    
    const settings: GameSettings = this.gameScene.registry.get('gameSettings') || DEFAULT_SETTINGS;
    const strategy = WasmLoader.STRATEGY_MAP[settings.aiStrategy];

    const move = this.wasmEngine.get_best_move(board, currentPiece, nextPiece, strategy);

    if (move) {
      this.executeMove(move);
    }
  }

  private executeMove(move: string): void {
    switch(move) {
      case 'move_left':
        this.gameScene.gameLogic.moveBlockLeft();
        break;
      case 'move_right':
        this.gameScene.gameLogic.moveBlockRight();
        break;
      case 'move_all_the_way_left':
        this.gameScene.gameLogic.moveAllTheWayLeft();
        break;
      case 'move_all_the_way_right':
        this.gameScene.gameLogic.moveAllTheWayRight();
        break;
      case 'rotate':
        this.gameScene.gameLogic.rotate(true); // Assuming CW rotation
        break;
      case 'rotate_ccw':
        this.gameScene.gameLogic.rotate(false);
        break;
      case 'move_down':
        this.gameScene.gameLogic.moveBlockDown(true);
        break;
      case 'move_to_bottom':
        this.gameScene.gameLogic.moveToBottom();
        break;
      case 'hard_drop':
        this.gameScene.gameLogic.performHardDrop();
        break;
      case 'hold':
        this.gameScene.gameLogic.performHold();
        break;
      case 'game_over':
        this.logInfo('WASM detected game over, deactivating engine');
        this.deactivate();
        this.gameScene.isWasmActive = false;
        // Update the toggle button if it exists
        const toggleButton = document.getElementById('wasmToggleBtn') as HTMLButtonElement;
        if (toggleButton) {
          toggleButton.textContent = 'Play WASM Engine';
        }
        break;
      default:
        // No-op
        break;
    }
    this.gameScene.gameRenderer.drawGame();
  }

  private getColorForTetrominoType(typeIndex: number): number {
    const typeKey = Object.keys(WasmLoader.TETROMINO_TYPE_MAP).find(key => WasmLoader.TETROMINO_TYPE_MAP[key as keyof typeof WasmLoader.TETROMINO_TYPE_MAP] === typeIndex);
    if (!typeKey) return 0xFFFFFF; // Default color
  
    // Assuming you have a mapping from typeKey to color in your constants or theme
    const tetrominoData = TETROMINOES[typeKey as keyof typeof TETROMINOES];
    return tetrominoData ? tetrominoData.color : 0xFFFFFF;
  }
} 