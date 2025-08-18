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
  hardDrop(): { clearedLines: number, gameOver: boolean, displayInfo?: { clearType: string, b2bCount: number, comboCount: number } };
  hold(): void;
}

// Default local controller that mirrors human inputs by calling the same GameLogic APIs
export class LocalGameController implements BotController {
  private scene: GameScene;
  private lastBeforeBoard: number[][] | null = null;

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

  hardDrop(): { clearedLines: number, gameOver: boolean, displayInfo?: { clearType: string, b2bCount: number, comboCount: number } } {
    // capture BEFORE 20x10 once per piece
    if (!this.lastBeforeBoard) {
      const b = this.scene.gameState.board.slice(-20);
      this.lastBeforeBoard = b.map(row => row.map(cell => (cell === null ? 0 : 1)));
    }
    const result = this.scene.gameLogic.performHardDrop();
    // Guarantee a return object even if game logic returns undefined (shouldn't happen post-fix)
    const safeResult = result || { clearedLines: 0, gameOver: this.scene.gameState.gameOver };
    // after lock, push record
    try {
      const after = this.scene.gameState.board.slice(-20).map(row => row.map(cell => (cell === null ? 0 : 1)));
      const wasm: any = (this.scene as any).wasmEngine;
      if (wasm && (this.scene as any).debugPanel) {
        const meta = wasm.lastDecisionMeta || { piece: '?', strategy: 'Balanced', score: 0, target: null, sequence: '' };
        // Compute intuition terms using JS-side metrics to mirror Rust evaluate()
        const weights = wasm.getUiEvalWeights(meta.strategy);
        const computeMetrics = (grid: number[][]) => {
          const h = new Array(10).fill(0);
          for (let x = 0; x < 10; x++) {
            for (let y = 0; y < 20; y++) {
              if (grid[y][x]) { h[x] = 20 - y; break; }
            }
          }
          const totalHeight = h.reduce((a:number,b:number)=>a+b,0);
          const maxHeight = Math.max(0, ...h);
          let holes = 0;
          for (let x = 0; x < 10; x++) {
            for (let y = 20 - h[x]; y < 20; y++) { if (y >= 0 && grid[y] && !grid[y][x]) holes++; }
          }
          let bumpiness = 0;
          for (let x = 0; x < 9; x++) bumpiness += Math.abs(h[x] - h[x+1]);
          return { totalHeight, maxHeight, holes, bumpiness };
        };
        const beforeM = computeMetrics(this.lastBeforeBoard || after);
        const afterM = computeMetrics(after);
        // Estimate completed lines by counting filled rows difference
        const countFull = (g:number[][])=>g.reduce((acc, row)=>acc + (row.every(c=>c===1)?1:0), 0);
        const beforeFull = countFull(this.lastBeforeBoard || after);
        const afterFull = countFull(after);
        const completedLines = Math.max(0, afterFull - beforeFull);
        const terms = {
          aggregate_height: afterM.totalHeight * weights.aggregate_height,
          max_height: afterM.maxHeight * weights.max_height,
          bumpiness: afterM.bumpiness * weights.bumpiness,
          holes: afterM.holes * weights.holes,
          completed_lines: completedLines * weights.completed_lines,
        };
        const intuition = `score = ${terms.aggregate_height.toFixed(2)}(aggH) + ${terms.max_height.toFixed(2)}(maxH) + ${terms.bumpiness.toFixed(2)}(bump) + ${terms.holes.toFixed(2)}(holes) + ${terms.completed_lines.toFixed(2)}(lines)`;

        // Build copy-friendly board logs (Before + New piece diff)
        const fmtRow = (filled: boolean) => (filled ? '█' : '·');
        const fmtRowNew = (afterVal: number, beforeVal: number) => (afterVal === 1 && beforeVal !== 1 ? '▓' : afterVal === 1 ? '█' : '·');
        const toAscii = (grid: number[][]) => grid.map((row, y) => {
          const r = row.map(c => fmtRow(!!c)).join('');
          return `Row ${y.toString().padStart(2, ' ')}: ${r}`;
        });
        const toAsciiDiff = (afterG: number[][], beforeG: number[][]) => afterG.map((row, y) => {
          const r = row.map((c, x) => fmtRowNew(c, (beforeG[y] && beforeG[y][x]) || 0)).join('');
          return `Row ${y.toString().padStart(2, ' ')}: ${r}`;
        });
        const beforeAscii = toAscii(this.lastBeforeBoard || after);
        const diffAscii = toAsciiDiff(after, this.lastBeforeBoard || after);

        const logLines: string[] = (wasm.currentMoveLogs || []).slice();
        logLines.push(`🧠 Weights: ah=${weights.aggregate_height.toFixed(2)}, mh=${weights.max_height.toFixed(2)}, bp=${weights.bumpiness.toFixed(2)}, ho=${weights.holes.toFixed(2)}, ln=${weights.completed_lines.toFixed(2)}`);
        logLines.push(`🧮 Intuition terms: aggH=${afterM.totalHeight.toFixed(1)} → ${(afterM.totalHeight*weights.aggregate_height).toFixed(2)}, maxH=${afterM.maxHeight.toFixed(1)} → ${(afterM.maxHeight*weights.max_height).toFixed(2)}, bump=${afterM.bumpiness.toFixed(1)} → ${(afterM.bumpiness*weights.bumpiness).toFixed(2)}, holes=${afterM.holes.toFixed(1)} → ${(afterM.holes*weights.holes).toFixed(2)}, lines=${completedLines} → ${(completedLines*weights.completed_lines).toFixed(2)}`);
        logLines.push(`🧹 Lines cleared this move: ${completedLines}`);
        logLines.push('📋 BEFORE BOARD STATE (for copy)');
        for (const line of beforeAscii) logLines.push(line);
        logLines.push('📋 NEW PIECE DIFF (▓ = new, █ = existing)');
        for (const line of diffAscii) logLines.push(line);
        const rec = {
          id: `${Date.now()}`,
          piece: meta.piece,
          strategy: meta.strategy,
          score: meta.score,
          beforeBoard: this.lastBeforeBoard || after,
          afterBoard: after,
          target: meta.target || null,
          final: null,
          moveSequence: meta.sequence || '',
          intuition,
          rawLogs: logLines.join('\n'),
          timestamp: Date.now(),
        } as any;
        (this.scene as any).debugPanel.pushRecord(rec);
      }
    } catch (_) {}
    this.lastBeforeBoard = null;
    return safeResult;
  }

  hold(): void {
    this.scene.gameLogic.performHold();
  }
}
