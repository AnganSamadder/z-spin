import { GameScene } from '../../scenes/GameScene';
import WasmLoader from './WasmLoader';
import { GameSettings, Strategy, DEFAULT_SETTINGS } from '../../types';
import { TETROMINOES, KICK_DATA_JLSTZ, KICK_DATA_I } from '../../constants';
import { BotController, LocalGameController } from './BotController';

export class WasmEngine {
  private gameScene: GameScene;
  private wasmEngine: any = null; // Will be set to the actual WASM engine instance
  private isActive = false;
  private initializing = false;
  private lastMoveTime = 0;
  private readonly moveInterval = 100; // ms between moves
  private expectedFinalPosition: { x: number, y: number, rotation: number } | null = null; // Track Rust prediction
  private verboseDebug = false; // Gate very detailed logs
  private controller: BotController; // Abstracted controller to mirror human inputs
  private isPlayingSequence = false; // When true, pause per-tick AI updates
  public sequencePlaybackDelayMs = 100; // Delay between debug sequence moves for visibility

  constructor(gameScene: GameScene) {
    this.gameScene = gameScene;
    this.controller = new LocalGameController(gameScene);
  }

  private logInfo(message: string, data?: any): void {
    console.log(`[WASM Engine] ${message}`, data || '');
  }

  // Calculate all 4 block positions for a tetromino
  private calculateBlockPositions(piece: any): Array<{x: number, y: number}> {
    if (!piece) return [];
    
    const tetrominoData = TETROMINOES[piece.typeKey as keyof typeof TETROMINOES];
    if (!tetrominoData) return [];
    
    const shape = tetrominoData.shapes[piece.rotation] || tetrominoData.shapes[0];
    const blocks: Array<{x: number, y: number}> = [];
    
    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (shape[row][col] === 1) {
          blocks.push({
            x: piece.x + col,
            y: piece.y + row
          });
        }
      }
    }
    
    return blocks.sort((a, b) => a.y === b.y ? a.x - b.x : a.y - b.y); // Sort for consistent comparison
  }

  private formatBlockPositions(blocks: Array<{x: number, y: number}>): string {
    return blocks.map(b => `(${b.x},${b.y})`).join(', ');
  }

  private compareBlockPositions(blocks1: Array<{x: number, y: number}>, blocks2: Array<{x: number, y: number}>): boolean {
    if (blocks1.length !== blocks2.length) return false;
    
    for (let i = 0; i < blocks1.length; i++) {
      if (blocks1[i].x !== blocks2[i].x || blocks1[i].y !== blocks2[i].y) {
        return false;
      }
    }
    return true;
  }

  // Check if a rotation is possible from the current piece state without mutating it
  private canRotate(direction: 'clockwise' | 'counter-clockwise' | '180'): boolean {
    const state = this.gameScene.gameState;
    const piece = state.currentTetromino;
    if (!piece) return false;
    const typeKey = piece.typeKey as keyof typeof TETROMINOES;
    if (typeKey === 'O') return false;

    const tetrominoData = TETROMINOES[typeKey];
    const currentRotationState = piece.rotation;
    let rotationAmount = 0;
    switch (direction) {
      case 'clockwise': rotationAmount = 1; break;
      case 'counter-clockwise': rotationAmount = 3; break;
      case '180': rotationAmount = 2; break;
    }
    const nextRotationState = (currentRotationState + rotationAmount) % 4;
    const nextShape = tetrominoData.shapes[nextRotationState];

    const kickTableKey = `${currentRotationState}->${nextRotationState}` as keyof typeof KICK_DATA_JLSTZ;
    const kicks: number[][] = (typeKey === 'I' ? (KICK_DATA_I as any)[kickTableKey] : (KICK_DATA_JLSTZ as any)[kickTableKey]) || [[0, 0]];

    for (const kick of kicks) {
      const newX = piece.x + kick[0];
      const newY = piece.y - kick[1]; // SRS Y-kicks are inverse of board coordinates
      if (!this.gameScene.gameLogic.physics.checkCollision(newX, newY, nextShape, piece.typeKey as any)) {
        return true;
      }
    }
    return false;
  }

  private canMoveDown(): boolean {
    const piece = this.gameScene.gameState.currentTetromino;
    if (!piece) return false;
    return !this.gameScene.gameLogic.physics.checkCollision(piece.x, piece.y + 1, piece.shape);
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
    
    const state = this.gameScene.gameState;
    if (!state.currentTetromino) {
      return;
    }

    const settings: GameSettings = this.gameScene.registry.get('gameSettings') || DEFAULT_SETTINGS;
    const strategy = WasmLoader.STRATEGY_MAP[settings.aiStrategy];
    
    const board = state.board
      .slice(-20)
      .map(row => row.map(cell => cell === null ? 0 : 1))
      .flat();
      
    const currentPieceTypeIndex = WasmLoader.TETROMINO_TYPE_MAP[state.currentTetromino.typeKey];
    const nextPieceTypeIndex = state.nextTetrominoQueue.length > 0 ? WasmLoader.TETROMINO_TYPE_MAP[state.nextTetrominoQueue[0].typeKey] : -1;
    
    // Get current piece position for accurate pathfinding
    const currentX = state.currentTetromino.x;
    const currentY = state.currentTetromino.y;
    const currentRotation = state.currentTetromino.rotation;
    
    // Enable logging, get the move, then disable it
    this.wasmEngine.configureLogging(true);
    const sequence = this.wasmEngine.getFullMoveSequenceWithPosition(board, currentPieceTypeIndex, currentX, currentY, currentRotation, nextPieceTypeIndex, strategy);
    this.wasmEngine.configureLogging(false);
    
    // 🎯 CAPTURE RUST PREDICTION - Extract from logs
    // The Rust logs will show "🎯 Target placement details: From current (x, y) rot R → target (X, Y) rot R"
    // For now, we'll capture it during sequence execution
    
    this.executeFullSequence(sequence);
  }

  private executeFullSequence(sequence: string): void {
    const moves = sequence.split(',');
    
    console.log(`🎬 STARTING SEQUENCE EXECUTION: ${moves.length} moves [${moves.join(', ')}]`);
    
    // Capture initial state
    const initialPiece = this.gameScene.gameState.currentTetromino;
    const initialBlocks = this.verboseDebug ? this.calculateBlockPositions(initialPiece) : [];
    console.log(`🏁 INITIAL PIECE STATE:`);
    console.log(`   📍 Anchor: (${initialPiece?.x}, ${initialPiece?.y}) rotation ${initialPiece?.rotation}`);
    if (this.verboseDebug) {
      console.log(`   🧩 All blocks: ${this.formatBlockPositions(initialBlocks)}`);
    }
    
    // Timed execution for visibility; pause per-tick updates while playing
    const prevActive = this.isActive;
    this.isActive = false;
    this.isPlayingSequence = true;
    let index = 0;
    const step = () => {
      if (index >= moves.length) {
        // After execution, log final state
        const finalState = this.gameScene.gameState.currentTetromino;
        if (finalState) {
          const finalBlocks = this.verboseDebug ? this.calculateBlockPositions(finalState) : [];
          console.log(`🏁 SEQUENCE COMPLETE: Final position (${finalState.x}, ${finalState.y}) rotation ${finalState.rotation}`);
          if (this.verboseDebug) {
            console.log(`🧩 Final blocks: ${this.formatBlockPositions(finalBlocks)}`);
          }
          if (this.expectedFinalPosition) {
            const matches = finalState.x === this.expectedFinalPosition.x &&
                            finalState.y === this.expectedFinalPosition.y &&
                            finalState.rotation === this.expectedFinalPosition.rotation;
            console.log(`🎯 RUST vs JAVASCRIPT COMPARISON:`);
            console.log(`   🤖 Rust predicted: (${this.expectedFinalPosition.x}, ${this.expectedFinalPosition.y}) rot ${this.expectedFinalPosition.rotation}`);
            console.log(`   🎮 JavaScript actual: (${finalState.x}, ${finalState.y}) rot ${finalState.rotation}`);
            console.log(`   ${matches ? '✅ PERFECT MATCH' : '❌ MISMATCH DETECTED'}`);
            this.expectedFinalPosition = null;
          }
        } else {
          console.log(`🏁 SEQUENCE COMPLETE: Piece locked and new piece spawned`);
          this.logActualPlacement();
        }
        // Restore state
        this.isPlayingSequence = false;
        this.isActive = prevActive;
        return;
      }
      const currentMove = moves[index++];
      this.executeMove(currentMove);
      const delay = Math.max(0, this.sequencePlaybackDelayMs);
      setTimeout(step, delay);
    };
    step();
  }

  private logActualPlacement(): void {
    console.log("📍 ACTUAL FINAL BOARD STATE:");
    const state = this.gameScene.gameState;
    const board = state.board.slice(-20); // Last 20 rows
    
    // Create a simple visual representation
    for (let y = 0; y < Math.min(20, board.length); y++) {
      const row = board[y];
      let rowStr = "";
      for (let x = 0; x < 10; x++) {
        rowStr += (row[x] === null) ? "·" : "█";
      }
      console.log(`Row ${y.toString().padStart(2)}: ${rowStr}`);
    }
  }

  public update(time: number, delta: number): void {
    if (this.isPlayingSequence) {
      return; // pause tick-driven moves while playing a full sequence for visibility
    }
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
    
    // Get current piece position for accurate pathfinding
    const currentX = state.currentTetromino.x;
    const currentY = state.currentTetromino.y;
    const currentRotation = state.currentTetromino.rotation;
    
    const settings: GameSettings = this.gameScene.registry.get('gameSettings') || DEFAULT_SETTINGS;
    const strategy = WasmLoader.STRATEGY_MAP[settings.aiStrategy];

    const move = this.wasmEngine.getBestMoveWithPosition(board, currentPiece, currentX, currentY, currentRotation, nextPiece, strategy);

    if (move) {
      this.executeMove(move);
    }
  }

  private executeMove(move: string): void {
    const beforeState = this.gameScene.gameState.currentTetromino;
    const canManipulate = this.gameScene.gameState.canManipulatePiece;
    const gameOver = this.gameScene.gameState.gameOver;
    
    // Capture snapshot of before state instead of reference
    const beforeSnapshot = beforeState ? {
      x: beforeState.x,
      y: beforeState.y,
      rotation: beforeState.rotation,
      typeKey: beforeState.typeKey
    } : null;
    
    // Calculate all block positions before the move
    const beforeBlocks = beforeSnapshot ? this.calculateBlockPositions(beforeSnapshot) : [];
    
    console.log(`🎮 EXECUTING MOVE: '${move}' at anchor (${beforeState?.x}, ${beforeState?.y}) rotation ${beforeState?.rotation}`);
    console.log(`🧩 Before blocks: ${this.formatBlockPositions(beforeBlocks)}`);
    console.log(`🚩 GAME STATE: canManipulatePiece=${canManipulate}, gameOver=${gameOver}, currentTetromino=${beforeState ? 'exists' : 'null'}`);
    
    // Early return check to match game logic guards
    if (!canManipulate || !beforeState) {
      console.warn(`⚠️ MOVE BLOCKED: ${move} cannot execute - canManipulate=${canManipulate}, hasPiece=${beforeState ? 'yes' : 'no'}`);
      return;
    }
    
    switch(move) {
      case 'move_left':
        this.controller.moveLeft();
        break;
      case 'move_right':
        this.controller.moveRight();
        break;
      case 'move_to_left':
        this.controller.moveToLeft();
        break;
      case 'move_to_right':
        this.controller.moveToRight();
        break;
      case 'rotate':
        this.controller.rotateCW();
        break;
      case 'rotate_ccw':
        this.controller.rotateCCW();
        break;
      case 'rotate_180':
        this.controller.rotate180();
        break;
      case 'soft_drop':
        this.controller.softDrop();
        break;
      case 'move_down':
        this.controller.moveDown();
        break;
      case 'move_to_bottom':
        this.controller.softDrop();
        break;
      case 'hard_drop':
        this.controller.hardDrop();
        break;
      case 'hold':
        this.controller.hold();
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
    
    const afterState = this.gameScene.gameState.currentTetromino;
    
    if (afterState && beforeSnapshot) {
      // Calculate all block positions after the move
      const afterBlocks = this.verboseDebug ? this.calculateBlockPositions(afterState) : [];
      
      console.log(`📍 AFTER MOVE: anchor (${afterState.x}, ${afterState.y}) rotation ${afterState.rotation}`);
      if (this.verboseDebug) {
        console.log(`🧩 After blocks: ${this.formatBlockPositions(afterBlocks)}`);
      }
      
      // Calculate deltas for anchor position
      const deltaX = afterState.x - beforeSnapshot.x;
      const deltaY = afterState.y - beforeSnapshot.y;
      const deltaRot = (afterState.rotation - beforeSnapshot.rotation + 4) % 4;
      
      console.log(`📊 ANCHOR DELTA: Δx=${deltaX}, Δy=${deltaY}, Δrot=${deltaRot} (${move})`);
      
      // Detailed block-by-block analysis (optional)
      if (this.verboseDebug && beforeBlocks.length === 4 && afterBlocks.length === 4) {
        console.log(`🔍 BLOCK-BY-BLOCK ANALYSIS:`);
        let allMatched = true;
        for (let i = 0; i < 4; i++) {
          const before = beforeBlocks[i];
          const after = afterBlocks[i];
          const blockDeltaX = after.x - before.x;
          const blockDeltaY = after.y - before.y;
          if (blockDeltaX !== 0 || blockDeltaY !== 0) {
            console.log(`   Block ${i+1}: (${before.x},${before.y}) → (${after.x},${after.y}) [Δx=${blockDeltaX}, Δy=${blockDeltaY}]`);
          } else {
            console.log(`   Block ${i+1}: (${before.x},${before.y}) → unchanged`);
          }
          if (i > 0 && (blockDeltaX !== deltaX || blockDeltaY !== deltaY)) {
            allMatched = false;
          }
        }
        if (allMatched && (deltaX !== 0 || deltaY !== 0)) {
          console.log(`   ✅ All blocks moved consistently: Δx=${deltaX}, Δy=${deltaY}`);
        } else if (deltaX === 0 && deltaY === 0 && deltaRot === 0) {
          console.log(`   ⚠️ No movement detected - possible collision or already at destination`);
        }
      }
      
      // Validate move logic
      this.validateMoveLogic(move, deltaX, deltaY, deltaRot);
    } else if (afterState) {
      const afterBlocks = this.verboseDebug ? this.calculateBlockPositions(afterState) : [];
      console.log(`📍 AFTER MOVE: anchor (${afterState.x}, ${afterState.y}) rotation ${afterState.rotation}`);
      if (this.verboseDebug) {
        console.log(`🧩 After blocks: ${this.formatBlockPositions(afterBlocks)}`);
      }
      console.log(`📊 ANCHOR DELTA: Unable to calculate (no before snapshot)`);
    } else {
      console.log(`📍 AFTER MOVE: piece is null (likely locked)`);
      if (beforeBlocks.length > 0) {
        console.log(`🔒 Piece was locked with blocks at: ${this.formatBlockPositions(beforeBlocks)}`);
      }
    }
    
    this.gameScene.gameRenderer.drawGame();
  }

  private validateMoveLogic(move: string, deltaX: number, deltaY: number, deltaRot: number): void {
    switch (move) {
      case 'move_left':
        if (deltaX !== -1 || deltaY !== 0 || deltaRot !== 0) {
          console.warn(`❌ UNEXPECTED DELTA for ${move}: expected (-1,0,0), got (${deltaX},${deltaY},${deltaRot})`);
        }
        break;
      case 'move_right':
        if (deltaX !== 1 || deltaY !== 0 || deltaRot !== 0) {
          console.warn(`❌ UNEXPECTED DELTA for ${move}: expected (1,0,0), got (${deltaX},${deltaY},${deltaRot})`);
        }
        break;
      case 'rotate':
        if (deltaRot !== 1 || (deltaX === 0 && deltaY === 0)) {
          console.log(`🔄 ROTATION: ${move} resulted in Δx=${deltaX}, Δy=${deltaY}, Δrot=${deltaRot} (kicks allowed)`);
        }
        break;
      case 'move_down':
        if (deltaY < 1 || deltaX !== 0 || deltaRot !== 0) {
          console.warn(`❌ UNEXPECTED DELTA for ${move}: expected (0,+N,0), got (${deltaX},${deltaY},${deltaRot})`);
        }
        break;
      case 'soft_drop':
        if (deltaY < 1 || deltaX !== 0 || deltaRot !== 0) {
          console.warn(`❌ UNEXPECTED DELTA for ${move}: expected (0,+N,0), got (${deltaX},${deltaY},${deltaRot})`);
        } else {
          console.log(`✅ SOFT_DROP: moved down ${deltaY} rows as expected`);
        }
        break;
      default:
        console.log(`ℹ️ MOVE VALIDATION: ${move} - no specific validation logic`);
        break;
    }
  }

  private getColorForTetrominoType(typeIndex: number): number {
    const typeKey = Object.keys(WasmLoader.TETROMINO_TYPE_MAP).find(key => WasmLoader.TETROMINO_TYPE_MAP[key as keyof typeof WasmLoader.TETROMINO_TYPE_MAP] === typeIndex);
    if (!typeKey) return 0xFFFFFF; // Default color
  
    // Assuming you have a mapping from typeKey to color in your constants or theme
    const tetrominoData = TETROMINOES[typeKey as keyof typeof TETROMINOES];
    return tetrominoData ? tetrominoData.color : 0xFFFFFF;
  }

  public debugNextMove(): void {
    if (!this.gameScene.gameState?.currentTetromino || !this.wasmEngine) {
      return;
    }

    // Use the same board preparation logic as in getBestMoveDebug
    const state = this.gameScene.gameState;
    if (!state.currentTetromino) {
      return;
    }
    
    const board = state.board
      .slice(-20)
      .map(row => row.map(cell => cell === null ? 0 : 1))
      .flat();
      
    const currentPieceTypeIndex = WasmLoader.TETROMINO_TYPE_MAP[state.currentTetromino.typeKey];
    const nextPieceTypeIndex = state.nextTetrominoQueue.length > 0 ? WasmLoader.TETROMINO_TYPE_MAP[state.nextTetrominoQueue[0].typeKey] : -1;
    
    // Get current piece position for accurate pathfinding
    const currentX = state.currentTetromino.x;
    const currentY = state.currentTetromino.y;
    const currentRotation = state.currentTetromino.rotation;
    
    const settings: GameSettings = this.gameScene.registry.get('gameSettings') || DEFAULT_SETTINGS;
    const strategy = WasmLoader.STRATEGY_MAP[settings.aiStrategy];
    
    // Enable logging, get the move, then disable it
    this.wasmEngine.configureLogging(true);
    const sequence = this.wasmEngine.getFullMoveSequenceWithPosition(board, currentPieceTypeIndex, currentX, currentY, currentRotation, nextPieceTypeIndex, strategy);
    this.wasmEngine.configureLogging(false);
    
    this.executeFullSequence(sequence);
  }
} 