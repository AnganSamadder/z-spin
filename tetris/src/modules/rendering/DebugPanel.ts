import { GameScene } from '../../scenes/GameScene';
import { BLOCK_SIZE, BOARD_WIDTH_BLOCKS, VISIBLE_BOARD_HEIGHT_BLOCKS, BUFFER_ZONE_HEIGHT, TETROMINOES } from '../../constants';

export type PlacementRecord = {
  id: string;
  piece: string;
  strategy: string;
  score: number;
  beforeBoard: number[][]; // 20x10 (0/1)
  afterBoard: number[][];  // 20x10 (0/1)
  target: { x: number; y: number; rotation: number } | null;
  final: { x: number; y: number; rotation: number } | null;
  moveSequence: string;
  intuition: string; // brief rationale string
  rawLogs: string;   // concatenated logs snapshot
  timestamp: number;
};

export class DebugPanel {
  private scene: GameScene;
  private root: HTMLElement | null = null;
  private listEl: HTMLElement | null = null;
  private detailRow: HTMLDivElement | null = null; // inline expander row
  private records: PlacementRecord[] = [];

  constructor(scene: GameScene) {
    this.scene = scene;
  }

  public init(): void {
    this.root = document.getElementById('debugPanelRoot');
    if (!this.root) return;
    this.root.innerHTML = '';

    const title = document.createElement('div');
    title.textContent = 'AI Move History';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '8px';
    this.root.appendChild(title);

    const container = document.createElement('div');
    container.style.display = 'grid';
    container.style.gridTemplateColumns = '1fr';
    container.style.gap = '8px';

    this.listEl = document.createElement('div');
    container.appendChild(this.listEl);
    this.root.appendChild(container);
    this.renderList();
  }

  public pushRecord(rec: PlacementRecord): void {
    // Most recent first
    this.records.unshift(rec);
    if (this.records.length > 50) this.records.pop();
    this.renderList();
  }

  private renderList(): void {
    if (!this.listEl) return;
    this.listEl.innerHTML = '';
    for (const rec of this.records) {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.padding = '6px 8px';
      row.style.border = '1px solid #333';
      row.style.borderRadius = '4px';
      row.style.cursor = 'pointer';

      const left = document.createElement('div');
      const colorNum = (TETROMINOES as any)[rec.piece]?.color as number | undefined;
      const colorSwatch = document.createElement('span');
      colorSwatch.style.display = 'inline-block';
      colorSwatch.style.width = '10px';
      colorSwatch.style.height = '10px';
      colorSwatch.style.marginRight = '6px';
      colorSwatch.style.borderRadius = '2px';
      if (typeof colorNum === 'number') {
        colorSwatch.style.background = `#${colorNum.toString(16).padStart(6, '0')}`;
      } else {
        colorSwatch.style.background = '#6cf';
      }
      const textNode = document.createElement('span');
      textNode.textContent = `${new Date(rec.timestamp).toLocaleTimeString()} — ${rec.piece}  score=${rec.score.toFixed(2)}`;
      left.appendChild(colorSwatch);
      left.appendChild(textNode);
      const right = document.createElement('div');
      right.textContent = rec.strategy;
      right.style.opacity = '0.8';
      row.appendChild(left);
      row.appendChild(right);

      row.addEventListener('click', () => this.renderDetailInline(row, rec));
      this.listEl!.appendChild(row);
    }
  }

  private renderDetailInline(anchorRow: HTMLDivElement, rec: PlacementRecord): void {
    // Remove existing detail row if present
    if (this.detailRow && this.detailRow.parentElement) {
      this.detailRow.parentElement.removeChild(this.detailRow);
      this.detailRow = null;
    }

    // Create a new inline detail row positioned right under the clicked row
    this.detailRow = document.createElement('div');
    this.detailRow.style.border = '1px solid #444';
    this.detailRow.style.borderTop = 'none';
    this.detailRow.style.marginTop = '-1px';
    this.detailRow.style.padding = '8px';
    this.detailRow.style.background = '#151515';

    const header = document.createElement('div');
    header.textContent = `${rec.piece} — score=${rec.score.toFixed(2)} — ${rec.strategy}`;
    header.style.marginBottom = '6px';
    this.detailRow.appendChild(header);

    const info = document.createElement('div');
    info.style.fontSize = '12px';
    info.style.opacity = '0.9';
    info.textContent = `Target: ${this.fmtPose(rec.target)} | Final: ${this.fmtPose(rec.final)} | Moves: ${rec.moveSequence}`;
    this.detailRow.appendChild(info);

    const intuition = document.createElement('div');
    intuition.style.margin = '6px 0';
    intuition.style.fontStyle = 'italic';
    intuition.textContent = `Intuition: ${rec.intuition}`;
    this.detailRow.appendChild(intuition);

    const boards = document.createElement('div');
    boards.style.display = 'grid';
    boards.style.gridTemplateColumns = '1fr 1fr';
    boards.style.gap = '8px';
    this.detailRow.appendChild(boards);

    const beforeCanvas = this.renderMiniBoard(rec.beforeBoard, 'Before', { mode: 'full', fillColor: '#555' });
    const pieceColorNum = (TETROMINOES as any)[rec.piece]?.color as number | undefined;
    const pieceColor = pieceColorNum !== undefined ? `#${pieceColorNum.toString(16).padStart(6, '0')}` : '#6cf';
    const afterCanvas = this.renderMiniBoard(rec.afterBoard, 'New piece', { mode: 'diff', diffAgainst: rec.beforeBoard, fillColor: pieceColor });
    boards.appendChild(beforeCanvas);
    boards.appendChild(afterCanvas);

    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy logs';
    copyBtn.style.marginTop = '8px';
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(rec.rawLogs);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => (copyBtn.textContent = 'Copy logs'), 1200);
      } catch (_) {}
    });
    this.detailRow.appendChild(copyBtn);

    // Insert the detail row right after the clicked row
    if (anchorRow.parentElement) {
      anchorRow.parentElement.insertBefore(this.detailRow, anchorRow.nextSibling);
      // Ensure detail row is visible in scroll area
      this.detailRow.scrollIntoView({ block: 'nearest' });
    }
  }

  private fmtPose(p: {x:number;y:number;rotation:number}|null): string {
    if (!p) return 'n/a';
    return `(${p.x},${p.y}) r${p.rotation}`;
  }

  private renderMiniBoard(board: number[][], title: string, opts?: { mode?: 'full' | 'diff', diffAgainst?: number[][], fillColor?: string }): HTMLElement {
    const wrapper = document.createElement('div');
    const label = document.createElement('div');
    label.textContent = title;
    label.style.marginBottom = '4px';
    wrapper.appendChild(label);

    const cell = 10; // px per cell for mini view
    const canvas = document.createElement('canvas');
    canvas.width = BOARD_WIDTH_BLOCKS * cell;
    canvas.height = VISIBLE_BOARD_HEIGHT_BLOCKS * cell;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const mode = opts?.mode || 'full';
    const bgEmpty = '#222';
    const otherFilled = '#555';
    const bgFilled = opts?.mode === 'full' && opts.fillColor ? opts.fillColor : '#6cf';
    const diffAgainst = opts?.diffAgainst;
    const highlight = opts?.fillColor || '#6cf';
    for (let y = 0; y < VISIBLE_BOARD_HEIGHT_BLOCKS; y++) {
      for (let x = 0; x < BOARD_WIDTH_BLOCKS; x++) {
        if (mode === 'diff') {
          const afterFilled = !!(board[y]?.[x]);
          const beforeFilled = !!(diffAgainst?.[y]?.[x]);
          if (afterFilled && !beforeFilled) {
            // newly placed piece blocks
            ctx.fillStyle = highlight;
            ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
          } else if (afterFilled && beforeFilled) {
            // existing stack
            ctx.fillStyle = otherFilled;
            ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
          } else {
            ctx.fillStyle = bgEmpty;
            ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
          }
        } else {
          if (board[y]?.[x]) {
            ctx.fillStyle = bgFilled;
            ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
          } else {
            ctx.fillStyle = bgEmpty;
            ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
          }
        }
      }
    }
    wrapper.appendChild(canvas);
    return wrapper;
  }
}
