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
  private expectedPreHardDrop: { x: number, y: number, rotation: number } | null = null; // Safety stance before hard drop
  private verboseDebug = false; // Gate very detailed logs
  private controller: BotController; // Abstracted controller to mirror human inputs
  private isPlayingSequence = false; // When true, pause per-tick AI updates
  public sequencePlaybackDelayMs = 100; // Delay between debug sequence moves for visibility
  private currentMoveLogs: string[] = []; // capture logs for current decision
  private lastDecisionMeta: { piece: string; strategy: string; score: number; target: {x:number;y:number;rotation:number}|null; sequence: string } | null = null;
  private strictHumanInputs = true; // simulate exact button presses
  private abortSequenceOnDesync = true; // re-plan if a move doesn't apply as expected

  constructor(gameScene: GameScene) {
    this.gameScene = gameScene;
    this.controller = new LocalGameController(gameScene);
  }

  // UI helper: mirror Rust eval weights for displaying intuition
  public getUiEvalWeights(strategyName: string): { aggregate_height: number, max_height: number, bumpiness: number, holes: number, completed_lines: number } {
    switch (strategyName) {
      case 'Aggressive':
        return { aggregate_height: -0.3, max_height: -0.12, bumpiness: -0.12, holes: -0.28, completed_lines: 0.5 };
      case 'Defensive':
        return { aggregate_height: -0.8, max_height: -0.9, bumpiness: -0.5, holes: -0.6, completed_lines: 1.2 };
      case 'TSpan':
        return { aggregate_height: -0.45, max_height: -0.6, bumpiness: -0.25, holes: -0.5, completed_lines: 0.9 };
      case 'Balanced':
      default:
        return { aggregate_height: -0.51, max_height: -0.18, bumpiness: -0.18, holes: -0.36, completed_lines: 0.76 };
    }
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

  // Preview a rotation without mutating game state; returns kicked anchor if valid
  private tryRotatePreview(direction: 'clockwise' | 'counter-clockwise' | '180', x: number, y: number, rotation: number, typeKey: string): { x: number, y: number, rotation: number } | null {
    const tetrominoData = (TETROMINOES as any)[typeKey];
    if (!tetrominoData) return null;
    const currentRotationState = rotation;
    let rotationAmount = 0;
    switch (direction) {
      case 'clockwise': rotationAmount = 1; break;
      case 'counter-clockwise': rotationAmount = 3; break;
      case '180': rotationAmount = 2; break;
    }
    const nextRotationState = (currentRotationState + rotationAmount) % 4;
    const nextShape = tetrominoData?.shapes?.[nextRotationState];
    if (!nextShape) return null;
    const kickTableKey = `${currentRotationState}->${nextRotationState}` as keyof typeof KICK_DATA_JLSTZ;
    const kicks: number[][] = (typeKey === 'I' ? (KICK_DATA_I as any)[kickTableKey] : (KICK_DATA_JLSTZ as any)[kickTableKey]) || [[0, 0]];
    for (const kick of kicks) {
      const newX = x + kick[0];
      const newY = y - kick[1];
      if (!this.gameScene.gameLogic.physics.checkCollision(newX, newY, nextShape, typeKey as any)) {
        return { x: newX, y: newY, rotation: nextRotationState };
      }
    }
    return null;
  }

  // Simulate the planned sequence on a snapshot to compute the expected stance before hard_drop
  private previewPreHardDropStance(moves: string[]): { x: number, y: number, rotation: number } | null {
    const state = this.gameScene.gameState;
    const piece = state.currentTetromino;
    if (!piece) return null;
    const typeKey = piece.typeKey;
    // If the sequence uses hold before the hard drop, skip alignment to avoid simulating a swap inaccurately
    const lastHardDrop = moves.lastIndexOf('hard_drop');
    const endIdxGuard = lastHardDrop === -1 ? moves.length : lastHardDrop;
    for (let i = 0; i < endIdxGuard; i++) {
      if (moves[i] === 'hold') {
        return null;
      }
    }
    let x = piece.x, y = piece.y, rotation = piece.rotation;
    // Find last hard_drop index
    const endIdx = endIdxGuard;
    for (let i = 0; i < endIdx; i++) {
      const m = moves[i];
      switch (m) {
        case 'move_left':
          if (!this.gameScene.gameLogic.physics.checkCollision(x - 1, y, (TETROMINOES as any)[typeKey].shapes[rotation], typeKey as any)) x -= 1;
          break;
        case 'move_right':
          if (!this.gameScene.gameLogic.physics.checkCollision(x + 1, y, (TETROMINOES as any)[typeKey].shapes[rotation], typeKey as any)) x += 1;
          break;
        case 'move_to_left':
          while (!this.gameScene.gameLogic.physics.checkCollision(x - 1, y, (TETROMINOES as any)[typeKey].shapes[rotation], typeKey as any)) x -= 1;
          break;
        case 'move_to_right':
          while (!this.gameScene.gameLogic.physics.checkCollision(x + 1, y, (TETROMINOES as any)[typeKey].shapes[rotation], typeKey as any)) x += 1;
          break;
        case 'move_down':
          if (!this.gameScene.gameLogic.physics.checkCollision(x, y + 1, (TETROMINOES as any)[typeKey].shapes[rotation], typeKey as any)) y += 1;
          break;
        case 'soft_drop':
          while (!this.gameScene.gameLogic.physics.checkCollision(x, y + 1, (TETROMINOES as any)[typeKey].shapes[rotation], typeKey as any)) y += 1;
          break;
        case 'rotate': {
          const res = this.tryRotatePreview('clockwise', x, y, rotation, typeKey);
          if (res) { x = res.x; y = res.y; rotation = res.rotation; }
          break;
        }
        case 'rotate_ccw': {
          const res = this.tryRotatePreview('counter-clockwise', x, y, rotation, typeKey);
          if (res) { x = res.x; y = res.y; rotation = res.rotation; }
          break;
        }
        case 'rotate_180': {
          const res = this.tryRotatePreview('180', x, y, rotation, typeKey);
          if (res) { x = res.x; y = res.y; rotation = res.rotation; }
          break;
        }
        default:
          break;
      }
    }
    return { x, y, rotation };
  }

  // Simulate a single non-mutating move for finesse planning
  private simulateOne(x: number, y: number, rotation: number, typeKey: string, move: string): { x: number, y: number, rotation: number } | null {
    const tetrominoData = (TETROMINOES as any)[typeKey];
    if (!tetrominoData) return null;
    const shape = tetrominoData.shapes?.[rotation];
    const physics = this.gameScene.gameLogic.physics;
    switch (move) {
      case 'move_left': {
        if (!physics.checkCollision(x - 1, y, shape, typeKey as any)) {
          return { x: x - 1, y, rotation };
        }
        return null;
      }
      case 'move_right': {
        if (!physics.checkCollision(x + 1, y, shape, typeKey as any)) {
          return { x: x + 1, y, rotation };
        }
        return null;
      }
      case 'move_to_left': {
        let nx = x;
        while (!physics.checkCollision(nx - 1, y, shape, typeKey as any)) nx -= 1;
        if (nx !== x) return { x: nx, y, rotation };
        return null;
      }
      case 'move_to_right': {
        let nx = x;
        while (!physics.checkCollision(nx + 1, y, shape, typeKey as any)) nx += 1;
        if (nx !== x) return { x: nx, y, rotation };
        return null;
      }
      case 'rotate': {
        const res = this.tryRotatePreview('clockwise', x, y, rotation, typeKey);
        return res;
      }
      case 'rotate_ccw': {
        const res = this.tryRotatePreview('counter-clockwise', x, y, rotation, typeKey);
        return res;
      }
      case 'rotate_180': {
        const res = this.tryRotatePreview('180', x, y, rotation, typeKey);
        return res;
      }
      default:
        return null;
    }
  }

  // Plan a minimal-input finesse alignment path to reach target x/rotation (ignoring y)
  private planFinesseAlignmentToStance(target: { x: number, rotation: number }): string[] {
    const state = this.gameScene.gameState;
    const piece = state.currentTetromino;
    if (!piece) return [];
    const typeKey = piece.typeKey;
    type Node = { x: number, y: number, rotation: number };
    const start: Node = { x: piece.x, y: piece.y, rotation: piece.rotation };
    const goal = (n: Node) => n.x === target.x && n.rotation === target.rotation;
    const key = (n: Node) => `${n.x},${n.rotation}`; // ignore y for visited to avoid endless kick-y variants
    const queue: Array<{ node: Node, path: string[] }> = [{ node: start, path: [] }];
    const visited = new Set<string>([key(start)]);
    const MAX_EXPANSIONS = 200;
    let expansions = 0;
    while (queue.length && expansions < MAX_EXPANSIONS) {
      const { node, path } = queue.shift()!;
      if (goal(node)) return path;
      expansions++;
      // Move ordering approximates two-step finesse: try rotations, then DAS, then taps
      const movesOrder = ['rotate', 'rotate_ccw', 'rotate_180', 'move_to_left', 'move_to_right', 'move_left', 'move_right'];
      for (const m of movesOrder) {
        const next = this.simulateOne(node.x, node.y, node.rotation, typeKey, m);
        if (!next) continue;
        const k = key(next);
        if (visited.has(k)) continue;
        visited.add(k);
        queue.push({ node: next, path: [...path, m] });
      }
    }
    return [];
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
    this.currentMoveLogs = [];
    this.wasmEngine.configureLogging(true);
    // Hold-aware: compute held index and canHold
    const heldIndex = state.heldTetromino ? WasmLoader.TETROMINO_TYPE_MAP[state.heldTetromino.typeKey] : -1;
    const canHold = state.canHold === true;
    const sequence = this.wasmEngine.getFullMoveSequenceWithPositionAndHold(
      board,
      currentPieceTypeIndex,
      currentX,
      currentY,
      currentRotation,
      nextPieceTypeIndex,
      heldIndex,
      canHold,
      strategy
    );
    this.wasmEngine.configureLogging(false);
    // Best-effort parse of last Rust logs via console interception is not available here;
    // We'll fill intuition later using known weights/sequence.

    // 🎯 CAPTURE RUST PREDICTION - Extract from logs
    // The Rust logs will show "🎯 Target placement details: From current (x, y) rot R → target (X, Y) rot R"
    // For now, we'll capture it during sequence execution

    this.executeFullSequence(sequence);
  }

  private executeFullSequence(sequence: string): void {
    const moves = sequence.split(',');

    const startMsg = `🎬 STARTING SEQUENCE EXECUTION: ${moves.length} moves [${moves.join(', ')}]`;
    console.log(startMsg);
    this.currentMoveLogs.push(startMsg);

    // Capture initial state
    const initialPiece = this.gameScene.gameState.currentTetromino;
    const initialBlocks = this.verboseDebug ? this.calculateBlockPositions(initialPiece) : [];
    const initA = `🏁 INITIAL PIECE STATE:`;
    const initB = `   📍 Anchor: (${initialPiece?.x}, ${initialPiece?.y}) rotation ${initialPiece?.rotation}`;
    console.log(initA);
    console.log(initB);
    this.currentMoveLogs.push(initA, initB);
    if (this.verboseDebug) {
      console.log(`   🧩 All blocks: ${this.formatBlockPositions(initialBlocks)}`);
    }

    // Timed execution for visibility; pause per-tick updates while playing
    const prevActive = this.isActive;
    this.isActive = false;
    this.isPlayingSequence = true;
    let index = 0;
    // Capture a per-piece token to guard against spawn swaps during the sequence
    const startType = this.gameScene.gameState.currentTetromino?.typeKey;
    const lastMoveInSequence = moves[moves.length - 1] || '';
    const step = () => {
      if (index >= moves.length) {
        // After execution, log final state
        const finalState = this.gameScene.gameState.currentTetromino;
        if (finalState && lastMoveInSequence !== 'hard_drop') {
          const finalBlocks = this.verboseDebug ? this.calculateBlockPositions(finalState) : [];
          const doneMsg = `🏁 SEQUENCE COMPLETE: Final position (${finalState.x}, ${finalState.y}) rotation ${finalState.rotation}`;
          console.log(doneMsg);
          this.currentMoveLogs.push(doneMsg);
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
          const doneMsg2 = `🏁 SEQUENCE COMPLETE: Piece locked and new piece spawned`;
          console.log(doneMsg2);
          this.currentMoveLogs.push(doneMsg2);
          this.logActualPlacement();
          this.pushDebugRecord(sequence);
        }
        // Restore state
        this.isPlayingSequence = false;
        this.isActive = prevActive;
        return;
      }
      const currentMove = moves[index++];
      // Despawn guard: stop if piece identity changed unexpectedly before last move
      const liveType = this.gameScene.gameState.currentTetromino?.typeKey;
      if (startType && liveType && liveType !== startType && currentMove !== 'hard_drop') {
        console.warn(`⛔ DESYNC: piece changed from ${startType} to ${liveType} mid-sequence. Aborting and replanning.`);
        this.isPlayingSequence = false;
        this.isActive = prevActive;
        this.replanFromCurrent();
        return;
      }
      // If a hold occurs earlier in the sequence, discard precomputed stance alignment as piece identity changes
      if (currentMove === 'hold') {
        this.expectedPreHardDrop = null;
      }
      // Before executing hard_drop, verify stance matches preview and correct with taps/rot if needed
      if (currentMove === 'hard_drop') {
        // Compute once per sequence
        if (!this.expectedPreHardDrop) {
          this.expectedPreHardDrop = this.previewPreHardDropStance(moves);
        }
        const stance = this.expectedPreHardDrop;
        let s = this.gameScene.gameState.currentTetromino;
        if (stance && s) {
          // Use a finesse planner to reach the stance (minimal inputs, SRS-aware). Execute plan immediately before drop.
          const finesseMoves = this.planFinesseAlignmentToStance({ x: stance.x, rotation: stance.rotation });
          if (finesseMoves.length > 0) {
            console.log(`🎯 Applying finesse alignment before hard_drop: [${finesseMoves.join(', ')}]`);
          }
          for (const m of finesseMoves) {
            switch (m) {
              case 'move_left': this.controller.moveLeft(); break;
              case 'move_right': this.controller.moveRight(); break;
              case 'move_to_left': this.controller.moveToLeft(); break;
              case 'move_to_right': this.controller.moveToRight(); break;
              case 'rotate': this.controller.rotateCW(); break;
              case 'rotate_ccw': this.controller.rotateCCW(); break;
              case 'rotate_180': this.controller.rotate180(); break;
              default: break;
            }
          }
        }
      }
      this.executeMove(currentMove);
      const delay = Math.max(0, this.sequencePlaybackDelayMs);
      setTimeout(step, delay);
    };
    // Pre-compute expected stance before hard drop for safety alignment
    this.expectedPreHardDrop = this.previewPreHardDropStance(moves);
    step();
  }

  private logActualPlacement(): void {
    const hdr = "📍 ACTUAL FINAL BOARD STATE:";
    console.log(hdr);
    this.currentMoveLogs.push(hdr);
    const state = this.gameScene.gameState;
    const board = state.board.slice(-20); // Last 20 rows

    // Create a simple visual representation
    for (let y = 0; y < Math.min(20, board.length); y++) {
      const row = board[y];
      let rowStr = "";
      for (let x = 0; x < 10; x++) {
        rowStr += (row[x] === null) ? "·" : "█";
      }
      const line = `Row ${y.toString().padStart(2)}: ${rowStr}`;
      console.log(line);
      this.currentMoveLogs.push(line);
    }
  }

  private captureBoard20x10(): number[][] {
    const b = this.gameScene.gameState.board.slice(-20);
    return b.map(row => row.map(cell => (cell === null ? 0 : 1)));
  }

  private replanFromCurrent(): void {
    const state = this.gameScene.gameState;
    if (!this.wasmEngine || !state.currentTetromino) return;
    const board = state.board.slice(-20).map(row => row.map(cell => (cell === null ? 0 : 1))).flat();
    const currentPiece = (WasmLoader as any).TETROMINO_TYPE_MAP[state.currentTetromino.typeKey];
    const nextPiece = state.nextTetrominoQueue[0] ? (WasmLoader as any).TETROMINO_TYPE_MAP[state.nextTetrominoQueue[0].typeKey] : -1;
    const currentX = state.currentTetromino.x;
    const currentY = state.currentTetromino.y;
    const currentRotation = state.currentTetromino.rotation;
    const settings: any = this.gameScene.registry.get('gameSettings') || ({} as any);
    const strategy = (WasmLoader as any).STRATEGY_MAP[settings.aiStrategy] ?? 0;
    const heldIndex = state.heldTetromino ? (WasmLoader as any).TETROMINO_TYPE_MAP[state.heldTetromino.typeKey] : -1;
    const canHold = state.canHold === true;
    const seq: string = this.wasmEngine.getFullMoveSequenceWithPositionAndHold(board, currentPiece, currentX, currentY, currentRotation, nextPiece, heldIndex, canHold, strategy);
    if (seq) {
      console.log(`🔄 REPLAN: '${seq}'`);
      this.executeFullSequence(seq);
    }
  }

  private pushDebugRecord(sequence: string): void {
    const gs = this.gameScene.gameState;
    const after = this.captureBoard20x10();
    // Try to reconstruct "before" by removing the last placed piece is complex;
    // instead, capture before at sequence start:
    // For now, we approximate: use current logs' first ACTUAL FINAL BOARD STATE if previously saved, else capture at start.
    // We'll store before at sequence start in expectedPreHardDrop moment.
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

    const heldIndex = state.heldTetromino ? WasmLoader.TETROMINO_TYPE_MAP[state.heldTetromino.typeKey] : -1;
    const canHold = state.canHold === true;
    // Request a full planned sequence to avoid per-tick re-planning mismatches
    const sequence: string = this.wasmEngine.getFullMoveSequenceWithPositionAndHold(
      board,
      currentPiece,
      currentX,
      currentY,
      currentRotation,
      nextPiece,
      heldIndex,
      canHold,
      strategy
    );

    // Store decision metadata for panel
    this.lastDecisionMeta = {
      piece: state.currentTetromino.typeKey,
      strategy: Object.keys(WasmLoader.STRATEGY_MAP).find(k => WasmLoader.STRATEGY_MAP[k] === strategy) || 'Balanced',
      score: 0, // filled from Rust debug later if available
      target: this.expectedFinalPosition, // may be updated later
      sequence,
    };

    if (!sequence) {
      return;
    }

    if (sequence.indexOf(',') >= 0) {
      // Multi-step plan: execute atomically with controlled delay
      this.executeFullSequence(sequence);
    } else {
      // Single move fallback
      this.executeMove(sequence);
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

    // If this is a hard drop, compute expected lock position from the pre-move snapshot
    let precomputedHardDropInfo: { lockX: number, lockY: number, rotation: number, dropDistance: number } | null = null;
    if (move === 'hard_drop' && beforeSnapshot) {
      const typeKey = beforeSnapshot.typeKey as keyof typeof TETROMINOES;
      const shape = (TETROMINOES as any)[typeKey]?.shapes?.[beforeSnapshot.rotation];
      if (shape) {
        let testY = beforeSnapshot.y;
        while (!this.gameScene.gameLogic.physics.checkCollision(beforeSnapshot.x, testY + 1, shape, typeKey as any)) {
          testY += 1;
        }
        precomputedHardDropInfo = {
          lockX: beforeSnapshot.x,
          lockY: testY,
          rotation: beforeSnapshot.rotation,
          dropDistance: testY - beforeSnapshot.y,
        };
      }
    }

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
        if (this.strictHumanInputs) {
          // simulate holding left: emit left taps until blocked
          while (true) {
            const s = this.gameScene.gameState.currentTetromino;
            if (!s) break;
            const can = !this.gameScene.gameLogic.physics.checkCollision(s.x - 1, s.y, s.shape);
            if (!can) break;
            this.controller.moveLeft();
          }
        } else {
          this.controller.moveToLeft();
        }
        break;
      case 'move_to_right':
        if (this.strictHumanInputs) {
          while (true) {
            const s = this.gameScene.gameState.currentTetromino;
            if (!s) break;
            const can = !this.gameScene.gameLogic.physics.checkCollision(s.x + 1, s.y, s.shape);
            if (!can) break;
            this.controller.moveRight();
          }
        } else {
          this.controller.moveToRight();
        }
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
        if (this.strictHumanInputs) {
          // simulate soft-drop hold: step down until landed
          while (true) {
            const s = this.gameScene.gameState.currentTetromino;
            if (!s) break;
            const can = !this.gameScene.gameLogic.physics.checkCollision(s.x, s.y + 1, s.shape);
            if (!can) break;
            this.controller.moveDown();
          }
        } else {
          this.controller.softDrop();
        }
        break;
      case 'move_down':
        this.controller.moveDown();
        break;
      case 'move_to_bottom':
        this.controller.softDrop();
        break;
      case 'hard_drop': {
        const res = this.controller.hardDrop();
        if (res && typeof res.clearedLines === 'number') {
          const clearedMsg = `🧹 LINE CLEAR: ${res.clearedLines} line(s)`;
          console.log(clearedMsg);
          this.currentMoveLogs.push(clearedMsg);
          if (res.displayInfo) {
            const infoMsg = `🏷️ CLEAR TYPE: ${res.displayInfo.clearType} | B2B x${res.displayInfo.b2bCount} | COMBO x${res.displayInfo.comboCount}`;
            console.log(infoMsg);
            this.currentMoveLogs.push(infoMsg);
          }
        }
        break;
      }
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

    // Special-case logging for hard_drop: the current piece gets replaced immediately after the drop.
    if (move === 'hard_drop' && beforeSnapshot) {
      if (precomputedHardDropInfo) {
        console.log(`📍 AFTER MOVE: hard_drop locked at anchor (${precomputedHardDropInfo.lockX}, ${precomputedHardDropInfo.lockY}) rotation ${precomputedHardDropInfo.rotation}`);
        console.log(`📊 ANCHOR DELTA: Δx=0, Δy=${precomputedHardDropInfo.dropDistance}, Δrot=0 (hard_drop)`);
      } else {
        console.log(`📍 AFTER MOVE: hard_drop executed (lock position estimation unavailable)`);
        console.log(`📊 ANCHOR DELTA: (hard_drop) estimation unavailable`);
      }
      // Skip generic after-state logging, since afterState now refers to the newly spawned piece.
      this.gameScene.gameRenderer.drawGame();
      return;
    }

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
      const okBefore = this.validateMoveLogic(move, deltaX, deltaY, deltaRot);
      if (this.abortSequenceOnDesync && !okBefore) {
        console.warn(`⛔ DESYNC: unexpected delta for '${move}'. Aborting and replanning.`);
        this.isPlayingSequence = false;
        this.isActive = true;
        this.replanFromCurrent();
        return;
      }
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

  private validateMoveLogic(move: string, deltaX: number, deltaY: number, deltaRot: number): boolean {
    switch (move) {
      case 'move_left':
        if (deltaX !== -1 || deltaY !== 0 || deltaRot !== 0) {
          console.warn(`❌ UNEXPECTED DELTA for ${move}: expected (-1,0,0), got (${deltaX},${deltaY},${deltaRot})`);
          return false;
        }
        return true;
      case 'move_right':
        if (deltaX !== 1 || deltaY !== 0 || deltaRot !== 0) {
          console.warn(`❌ UNEXPECTED DELTA for ${move}: expected (1,0,0), got (${deltaX},${deltaY},${deltaRot})`);
          return false;
        }
        return true;
      case 'rotate':
        if (deltaRot !== 1 || (deltaX === 0 && deltaY === 0)) {
          console.log(`🔄 ROTATION: ${move} resulted in Δx=${deltaX}, Δy=${deltaY}, Δrot=${deltaRot} (kicks allowed)`);
        }
        return true;
      case 'move_down':
        if (deltaY < 1 || deltaX !== 0 || deltaRot !== 0) {
          console.warn(`❌ UNEXPECTED DELTA for ${move}: expected (0,+N,0), got (${deltaX},${deltaY},${deltaRot})`);
          return false;
        }
        return true;
      case 'soft_drop':
        if (deltaY < 1 || deltaX !== 0 || deltaRot !== 0) {
          console.warn(`❌ UNEXPECTED DELTA for ${move}: expected (0,+N,0), got (${deltaX},${deltaY},${deltaRot})`);
        } else {
          console.log(`✅ SOFT_DROP: moved down ${deltaY} rows as expected`);
        }
        return true;
      default:
        console.log(`ℹ️ MOVE VALIDATION: ${move} - no specific validation logic`);
        return true;
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