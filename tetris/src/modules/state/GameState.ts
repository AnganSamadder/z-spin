import { TETROMINOES, TETROMINO_KEYS, BOARD_WIDTH_BLOCKS, LOGICAL_BOARD_HEIGHT_BLOCKS } from '../../constants';
import { TetrominoState, HeldTetrominoState } from '../../types';

export class GameState {
    public board: (number | null)[][] = [];
    public currentTetromino: TetrominoState | null = null;
    public currentTetrominoBlocks: { x: number, y: number }[] = []; // For WASM integration
    public nextTetrominoQueue: HeldTetrominoState[] = [];
    private currentBag: (keyof typeof TETROMINOES)[] = [];
    public heldTetromino: HeldTetrominoState | null = null;
    public canHold: boolean = true;
    public score: number = 0;
    public gameOver: boolean = false;
    public canManipulatePiece: boolean = true; // Default to true to allow immediate manipulation
    public isPieceLanded: boolean = false;
    public lockResetsCount: number = 0;
    public readonly maxLockResets: number = 15;
    public comboCount: number = 0;
    public backToBackActive: boolean = false;
    public backToBackCount: number = 0;
    public lastAction: 'move' | 'rotate' | 'hard_drop' | 'none' = 'none';
    public lastKickOffset: { x: number, y: number } | null = null;
    public isWasmMode: boolean = false; // Track if we're using WASM mode
    public isSoftDropping: boolean = false;
    // Live metrics for UI
    public totalKeyPresses: number = 0; // legacy aggregate; prefer humanKeyPresses + engineKeyPresses
    public humanKeyPresses: number = 0;
    public engineKeyPresses: number = 0;
    public totalPiecesPlaced: number = 0;
    public totalLinesCleared: number = 0;
    public gameStartTimestampMs: number = 0;

    constructor() {
        this.reset();
    }

    public initBoard(): void {
        this.board = [];
        for (let y = 0; y < LOGICAL_BOARD_HEIGHT_BLOCKS; y++) {
            this.board[y] = Array(BOARD_WIDTH_BLOCKS).fill(null);
        }
    }

    // Reset the board without affecting other game state
    public resetBoard(): void {
        for (let y = 0; y < LOGICAL_BOARD_HEIGHT_BLOCKS; y++) {
            for (let x = 0; x < BOARD_WIDTH_BLOCKS; x++) {
                this.board[y][x] = null;
            }
        }
    }

    // Copy board state from another source (useful for WASM transition)
    public copyBoardState(otherBoard: (number | null)[][]): void {
        for (let y = 0; y < Math.min(LOGICAL_BOARD_HEIGHT_BLOCKS, otherBoard.length); y++) {
            for (let x = 0; x < Math.min(BOARD_WIDTH_BLOCKS, otherBoard[y].length); x++) {
                this.board[y][x] = otherBoard[y][x];
            }
        }
    }

    private fillCurrentBag(): void {
        this.currentBag = [...TETROMINO_KEYS];
        this.shuffleArray(this.currentBag);
    }

    private shuffleArray<T>(array: T[]): T[] {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    public getNextFromBag(): keyof typeof TETROMINOES {
        if (this.currentBag.length === 0) {
            this.fillCurrentBag();
        }
        return this.currentBag.pop()!;
    }

    // For debug scenarios: force a specific bag order
    public setCurrentBag(bag: (keyof typeof TETROMINOES)[]): void {
        this.currentBag = [...bag];
    }

    // Get the next tetromino from the queue for WASM engine
    public getNextTetromino(): HeldTetrominoState | null {
        if (this.nextTetrominoQueue.length === 0) {
            return null;
        }

        // Remove the first piece and shift the queue
        const next = this.nextTetrominoQueue.shift();

        // Fill the queue if it's getting low
        if (this.nextTetrominoQueue.length < 5) {
            // Add a new piece to the end of the queue
            const nextType = this.getNextFromBag();
            this.nextTetrominoQueue.push({
                typeKey: nextType
            });
        }

        return next || null;
    }

    public reset(): void {
        this.initBoard();
        this.score = 0;
        this.heldTetromino = null;
        this.canHold = true;
        this.currentTetromino = null;
        this.currentTetrominoBlocks = [];
        this.canManipulatePiece = true; // Allow manipulation by default
        this.gameOver = false;
        this.comboCount = 0;
        this.backToBackActive = false;
        this.backToBackCount = 0;
        this.isPieceLanded = false;
        this.lockResetsCount = 0;
        this.nextTetrominoQueue = [];
        this.isWasmMode = false;
        this.isSoftDropping = false;
        this.totalKeyPresses = 0;
        this.humanKeyPresses = 0;
        this.engineKeyPresses = 0;
        this.totalPiecesPlaced = 0;
        this.totalLinesCleared = 0;
        this.gameStartTimestampMs = Date.now();
        this.fillCurrentBag();
    }

    // Add cheese lines (gray blocks with one random hole per line)
    public addCheeseLines(count: number = 10): void {
        const cheeseColor = 0x808080; // Gray color for cheese blocks
        
        // Shift existing board up by the number of cheese lines
        for (let y = 0; y < this.board.length - count; y++) {
            this.board[y] = [...this.board[y + count]];
        }
        
        // Add cheese lines at the bottom
        for (let i = 0; i < count; i++) {
            const y = this.board.length - count + i;
            this.board[y] = Array(BOARD_WIDTH_BLOCKS).fill(cheeseColor);
            
            // Remove one random block per line to create a hole
            const holeX = Math.floor(Math.random() * BOARD_WIDTH_BLOCKS);
            this.board[y][holeX] = null;
        }
    }
}