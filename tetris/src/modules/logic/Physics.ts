import { GameState } from '../state/GameState';
import {
    BOARD_WIDTH_BLOCKS,
    LOGICAL_BOARD_HEIGHT_BLOCKS,
    TETROMINOES,
    KICK_DATA_JLSTZ,
    KICK_DATA_I,
    BUFFER_ZONE_HEIGHT
} from '../../constants';
import { TetrominoState, HeldTetrominoState } from '../../types';

export class Physics {
    private gameState: GameState;

    constructor(gameState: GameState) {
        this.gameState = gameState;
    }

    public checkCollision(pivotBoardX: number, pivotBoardY: number, shape: number[][], pieceTypeKey?: keyof typeof TETROMINOES): boolean {
        const pivot = TETROMINOES[pieceTypeKey as keyof typeof TETROMINOES || this.gameState.currentTetromino!.typeKey as keyof typeof TETROMINOES].pivot;

        for (let r_shape = 0; r_shape < shape.length; r_shape++) {
            for (let c_shape = 0; c_shape < shape[r_shape].length; c_shape++) {
                if (shape[r_shape][c_shape]) {
                    const boardX = pivotBoardX + (c_shape - pivot.c);
                    const boardY = pivotBoardY + (r_shape - pivot.r);

                    if (boardX < 0 || boardX >= BOARD_WIDTH_BLOCKS || boardY >= LOGICAL_BOARD_HEIGHT_BLOCKS) {
                        return true; // Collision with walls or floor
                    }
                    if (boardY >= 0 && this.gameState.board[boardY] && this.gameState.board[boardY][boardX] !== null) {
                        return true; // Collision with another block
                    }
                }
            }
        }
        return false;
    }

    public rotate(isClockwise: boolean): { success: boolean; landed: boolean } {
        if (!this.gameState.currentTetromino) return { success: false, landed: false };
        const typeKey = this.gameState.currentTetromino.typeKey as keyof typeof TETROMINOES;
        if (typeKey === 'O') return { success: false, landed: this.gameState.isPieceLanded };

        const tetrominoData = TETROMINOES[typeKey];
        const currentRotationState = this.gameState.currentTetromino.rotation;
        const nextRotationState = (isClockwise ? (currentRotationState + 1) : (currentRotationState + 3)) % 4;
        const nextShape = tetrominoData.shapes[nextRotationState];

        const kickTableKey = `${currentRotationState}->${nextRotationState}`;
        const kicks: number[][] = (typeKey === 'I' ? KICK_DATA_I[kickTableKey as keyof typeof KICK_DATA_I] : KICK_DATA_JLSTZ[kickTableKey as keyof typeof KICK_DATA_JLSTZ]) || [[0, 0]];

        for (const kick of kicks) {
            const newX = this.gameState.currentTetromino.x + kick[0];
            const newY = this.gameState.currentTetromino.y - kick[1]; // SRS Y-kicks are inverse of board coordinates
            if (!this.checkCollision(newX, newY, nextShape)) {
                this.gameState.currentTetromino.x = newX;
                this.gameState.currentTetromino.y = newY;
                this.gameState.currentTetromino.shape = nextShape;
                this.gameState.currentTetromino.rotation = nextRotationState;
                this.gameState.lastAction = 'rotate';
                this.gameState.lastKickOffset = { x: kick[0], y: kick[1] };
                return { success: true, landed: this.handlePostSuccessfulMoveRotation() };
            }
        }
        return { success: false, landed: this.gameState.isPieceLanded };
    }

    private handlePostSuccessfulMoveRotation(): boolean {
        if (!this.gameState.currentTetromino) return false;

        const landedAfterMove = this.checkCollision(this.gameState.currentTetromino.x, this.gameState.currentTetromino.y + 1, this.gameState.currentTetromino.shape);

        if (this.gameState.isPieceLanded && this.gameState.lockResetsCount < this.gameState.maxLockResets) {
             this.gameState.lockResetsCount++;
        }
        
        this.gameState.isPieceLanded = landedAfterMove;
        return landedAfterMove;
    }
    
    public moveBlockDown(isSoftDrop: boolean): { landed: boolean, gameOver: boolean } {
        if (!this.gameState.currentTetromino) return { landed: false, gameOver: false };

        if (!this.checkCollision(this.gameState.currentTetromino.x, this.gameState.currentTetromino.y + 1, this.gameState.currentTetromino.shape)) {
            this.gameState.currentTetromino.y++;
            if (isSoftDrop) {
                this.gameState.score += 1; // Example score for soft drop
            }
            this.gameState.isPieceLanded = false;
            this.gameState.lockResetsCount = 0;
            this.gameState.lastAction = 'move';
            return { landed: false, gameOver: false };
        } else {
            this.gameState.isPieceLanded = true;
            // The decision to lock is made externally based on timers.
            return { landed: true, gameOver: false };
        }
    }

    public moveBlockLeft(): { success: boolean, landed: boolean } {
        if (!this.gameState.currentTetromino) return { success: false, landed: false };
        if (!this.checkCollision(this.gameState.currentTetromino.x - 1, this.gameState.currentTetromino.y, this.gameState.currentTetromino.shape)) {
            this.gameState.currentTetromino.x--;
            this.gameState.lastAction = 'move';
            const landed = this.handlePostSuccessfulMoveRotation();
            return { success: true, landed };
        }
        return { success: false, landed: this.gameState.isPieceLanded };
    }

    public moveBlockRight(): { success: boolean, landed: boolean } {
        if (!this.gameState.currentTetromino) return { success: false, landed: false };
        if (!this.checkCollision(this.gameState.currentTetromino.x + 1, this.gameState.currentTetromino.y, this.gameState.currentTetromino.shape)) {
            this.gameState.currentTetromino.x++;
            this.gameState.lastAction = 'move';
            const landed = this.handlePostSuccessfulMoveRotation();
            return { success: true, landed };
        }
        return { success: false, landed: this.gameState.isPieceLanded };
    }

    public performHardDrop(): { clearedLines: number, gameOver: boolean } {
        if (!this.gameState.currentTetromino) return { clearedLines: 0, gameOver: this.gameState.gameOver };
        let distance = 0;
        while (!this.checkCollision(this.gameState.currentTetromino.x, this.gameState.currentTetromino.y + 1, this.gameState.currentTetromino.shape)) {
            this.gameState.currentTetromino.y++;
            distance++;
        }
        this.gameState.score += distance * 2; // Example score for hard drop
        
        const lockResult = this.lockTetromino();
        if (lockResult.gameOver) {
            return { clearedLines: 0, gameOver: true };
        }

        return { clearedLines: lockResult.clearedLines, gameOver: false };
    }

    public lockTetromino(): { clearedLines: number, gameOver: boolean } {
        if (!this.gameState.currentTetromino) return { clearedLines: 0, gameOver: this.gameState.gameOver };

        const { shape, x: pivotBoardX, y: pivotBoardY, color, typeKey } = this.gameState.currentTetromino;
        const pivot = TETROMINOES[typeKey as keyof typeof TETROMINOES].pivot;
        
        let isGameOver = false;

        for (let r_shape = 0; r_shape < shape.length; r_shape++) {
            for (let c_shape = 0; c_shape < shape[r_shape].length; c_shape++) {
                if (shape[r_shape][c_shape]) {
                    const boardX = pivotBoardX + (c_shape - pivot.c);
                    const boardY = pivotBoardY + (r_shape - pivot.r);

                    if (boardY < BUFFER_ZONE_HEIGHT && boardY >= 0) {
                        isGameOver = true;
                    }

                    if (boardY >= 0 && boardY < LOGICAL_BOARD_HEIGHT_BLOCKS && boardX >= 0 && boardX < BOARD_WIDTH_BLOCKS) {
                        this.gameState.board[boardY][boardX] = color;
                    }
                }
            }
        }
        
        if (isGameOver) {
            this.gameState.gameOver = true;
            return { clearedLines: 0, gameOver: true };
        }

        const clearedLines = this.checkForCompletedLines();
        this.gameState.currentTetromino = null;
        this.gameState.canHold = true;
        
        return { clearedLines, gameOver: this.gameState.gameOver };
    }

    private checkForCompletedLines(): number {
        let linesCleared = 0;
        let y = LOGICAL_BOARD_HEIGHT_BLOCKS - 1;
        while (y >= 0) {
            if (this.gameState.board[y].every(cell => cell !== null)) {
                linesCleared++;
                this.gameState.board.splice(y, 1);
                this.gameState.board.unshift(Array(BOARD_WIDTH_BLOCKS).fill(null));
            } else {
                y--;
            }
        }

        if (linesCleared > 0) {
            // Scoring logic would go here
        }
        return linesCleared;
    }

    public spawnNewTetromino(): { success: boolean; landed: boolean, gameOver: boolean } {
        const nextPiece = this.gameState.getNextTetromino();
        if (!nextPiece) {
             return { success: false, landed: false, gameOver: false };
        }

        const tetrominoData = TETROMINOES[nextPiece.typeKey];
        const initialRotation = 0;
        const shape = tetrominoData.shapes[initialRotation];
        const pivot = tetrominoData.pivot;

        // Find the lowest block in the shape to calculate the correct spawn height
        let lowestBlockRow = 0;
        for (let r = shape.length - 1; r >= 0; r--) {
            if (shape[r].some(cell => cell === 1)) {
                lowestBlockRow = r;
                break;
            }
        }

        const spawnX = Math.floor(BOARD_WIDTH_BLOCKS / 2) - pivot.c;
        // Spawn the piece so its lowest block is just entering the top of the visible area
        const spawnY = BUFFER_ZONE_HEIGHT - (lowestBlockRow - pivot.r);

        if (this.checkCollision(spawnX, spawnY, shape, nextPiece.typeKey)) {
            // If there's a collision on spawn, it's an instant lock-out.
            this.gameState.gameOver = true;
            return { success: false, landed: true, gameOver: true };
        }

        this.gameState.currentTetromino = {
            shape: shape,
            x: spawnX,
            y: spawnY,
            color: tetrominoData.color,
            rotation: initialRotation,
            typeKey: nextPiece.typeKey,
        };

        this.gameState.isPieceLanded = false;
        this.gameState.lockResetsCount = 0;
        
        const landed = this.checkCollision(this.gameState.currentTetromino.x, this.gameState.currentTetromino.y + 1, this.gameState.currentTetromino.shape)
        this.gameState.isPieceLanded = landed;

        return { success: true, landed: landed, gameOver: false }; // Success
    }

    public performHold(): { success: boolean, gameOver: boolean, landed: boolean } {
        if (!this.gameState.canHold) {
            return { success: false, gameOver: this.gameState.gameOver, landed: this.gameState.isPieceLanded };
        }

        const currentTypeKey = this.gameState.currentTetromino?.typeKey;
        
        const heldState = this.gameState.heldTetromino;

        this.gameState.heldTetromino = currentTypeKey ? { typeKey: currentTypeKey } : null;
        this.gameState.canHold = false;
        this.gameState.currentTetromino = null;
        
        if (heldState) {
            // Spawn from hold
            return this.spawnHeld(heldState.typeKey);
        } else {
            // If no piece was held, spawn a new one from the queue
            const spawnResult = this.spawnNewTetromino();
            return { success: true, gameOver: spawnResult.gameOver, landed: spawnResult.landed };
        }
    }

    private spawnHeld(typeKey: keyof typeof TETROMINOES): { success: boolean, gameOver: boolean, landed: boolean } {
        const tetrominoData = TETROMINOES[typeKey];
        const initialRotation = 0;
        const shape = tetrominoData.shapes[initialRotation];
        const pivot = tetrominoData.pivot;
        const spawnX = Math.floor(BOARD_WIDTH_BLOCKS / 2) - pivot.c;
        const spawnY = BUFFER_ZONE_HEIGHT - pivot.r;

        if (this.checkCollision(spawnX, spawnY, shape, typeKey)) {
            this.gameState.gameOver = true;
            return { success: true, gameOver: true, landed: false };
        }

        this.gameState.currentTetromino = {
            shape: shape, x: spawnX, y: spawnY,
            color: tetrominoData.color, rotation: initialRotation, typeKey: typeKey,
        };
        const landed = this.checkCollision(spawnX, spawnY + 1, shape);
        this.gameState.isPieceLanded = landed;
        return { success: true, gameOver: false, landed: landed };
    }
} 