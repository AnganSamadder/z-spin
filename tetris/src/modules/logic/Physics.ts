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
    private scene?: any; // Optional scene reference for accessing renderer

    constructor(gameState: GameState, scene?: any) {
        this.gameState = gameState;
        this.scene = scene;
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

    public rotate(direction: 'clockwise' | 'counter-clockwise' | '180'): { success: boolean; landed: boolean } {
        if (!this.gameState.currentTetromino) return { success: false, landed: false };
        const typeKey = this.gameState.currentTetromino.typeKey as keyof typeof TETROMINOES;
        if (typeKey === 'O') return { success: false, landed: this.gameState.isPieceLanded };

        const tetrominoData = TETROMINOES[typeKey];
        const currentRotationState = this.gameState.currentTetromino.rotation;
        
        let rotationAmount: number;
        switch (direction) {
            case 'clockwise':
                rotationAmount = 1;
                break;
            case 'counter-clockwise':
                rotationAmount = 3;
                break;
            case '180':
                rotationAmount = 2;
                break;
        }

        const nextRotationState = (currentRotationState + rotationAmount) % 4;
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
        const landedAfterMove = this.checkCollision(this.gameState.currentTetromino!.x, this.gameState.currentTetromino!.y + 1, this.gameState.currentTetromino!.shape);
        
        // Reset lock resets only if the piece moves away from the ground
        if (!landedAfterMove && this.gameState.isPieceLanded) {
            this.gameState.lockResetsCount = 0;
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

    public moveAllTheWayLeft(): { success: boolean, landed: boolean } {
        if (!this.gameState.currentTetromino) return { success: false, landed: false };
        let moved = false;
        while (!this.checkCollision(this.gameState.currentTetromino.x - 1, this.gameState.currentTetromino.y, this.gameState.currentTetromino.shape)) {
            this.gameState.currentTetromino.x--;
            moved = true;
        }
        if (moved) {
            this.gameState.lastAction = 'move';
            const landed = this.handlePostSuccessfulMoveRotation();
            return { success: true, landed };
        }
        return { success: false, landed: this.gameState.isPieceLanded };
    }

    public moveAllTheWayRight(): { success: boolean, landed: boolean } {
        if (!this.gameState.currentTetromino) return { success: false, landed: false };
        let moved = false;
        while (!this.checkCollision(this.gameState.currentTetromino.x + 1, this.gameState.currentTetromino.y, this.gameState.currentTetromino.shape)) {
            this.gameState.currentTetromino.x++;
            moved = true;
        }
        if (moved) {
            this.gameState.lastAction = 'move';
            const landed = this.handlePostSuccessfulMoveRotation();
            return { success: true, landed };
        }
        return { success: false, landed: this.gameState.isPieceLanded };
    }

    public moveToBottom(): { landed: boolean } {
        if (!this.gameState.currentTetromino) return { landed: false };
        let moved = false;
        let distance = 0;
        while (!this.checkCollision(this.gameState.currentTetromino.x, this.gameState.currentTetromino.y + 1, this.gameState.currentTetromino.shape)) {
            this.gameState.currentTetromino.y++;
            distance++;
            moved = true;
        }
        this.gameState.score += distance; // Award 1 point per cell dropped
        if (moved) {
            this.gameState.lastAction = 'move';
            this.gameState.lockResetsCount = 0;
            this.gameState.isPieceLanded = true;
            return { landed: true };
        }
        return { landed: this.gameState.isPieceLanded };
    }

    public performHardDrop(): { clearedLines: number, gameOver: boolean, displayInfo?: { clearType: string, b2bCount: number, comboCount: number } } {
        if (!this.gameState.currentTetromino) return { clearedLines: 0, gameOver: this.gameState.gameOver };
        let distance = 0;
        while (!this.checkCollision(this.gameState.currentTetromino.x, this.gameState.currentTetromino.y + 1, this.gameState.currentTetromino.shape)) {
            this.gameState.currentTetromino.y++;
            distance++;
        }
        this.gameState.score += distance * 2; // Example score for hard drop
        this.gameState.lastAction = 'hard_drop';
        this.gameState.lockResetsCount = 0;
        
        const lockResult = this.lockTetromino();
        if (lockResult.gameOver) {
            return { clearedLines: 0, gameOver: true };
        }

        return { clearedLines: lockResult.clearedLines, gameOver: false, displayInfo: lockResult.displayInfo };
    }

    public lockTetromino(): { clearedLines: number, gameOver: boolean, displayInfo?: { clearType: string, b2bCount: number, comboCount: number } } {
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

        const { clearedLines, displayInfo } = this.checkForCompletedLinesWithDisplay();
        this.gameState.currentTetromino = null;
        this.gameState.canHold = true;
        
        return { clearedLines, gameOver: this.gameState.gameOver, displayInfo };
    }

    private checkForCompletedLines(): number {
        const { clearedLines } = this.checkForCompletedLinesWithDisplay();
        return clearedLines;
    }

    private checkForCompletedLinesWithDisplay(): { clearedLines: number, displayInfo?: { clearType: string, b2bCount: number, comboCount: number } } {
        // Check for spin BEFORE clearing lines (crucial for T-spin detection)
        const spinInfo = this.detectSpin();
        // Only consider spin if the last action was a rotation and piece did not move down after that rotation
        const shouldCheckForSpin = spinInfo.isSpin && this.gameState.lastAction === 'rotate';
        
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
            return this.updateScoringAndGetDisplayInfo(linesCleared, spinInfo, shouldCheckForSpin);
        } else {
            // No clear; do not count spins without a line clear
            this.gameState.comboCount = 0;
            return { clearedLines: 0 };
        }
    }

    private updateScoringAndGetDisplayInfo(linesCleared: number, spinInfo?: { isSpin: boolean, pieceType: string }, shouldCheckForSpin?: boolean): { clearedLines: number, displayInfo: { clearType: string, b2bCount: number, comboCount: number } } {
        // Check if it's a perfect clear (board is completely empty after line clear)
        const isPerfectClear = this.isEmptyBoard();
        
        // Determine line clear type and if it's "difficult" (maintains B2B)
        const { clearType, isDifficultClear, baseScore } = this.getClearTypeAndScore(linesCleared, isPerfectClear, spinInfo, shouldCheckForSpin);
        
        // Update combo count
        this.gameState.comboCount++;
        
        // Update B2B state
        if (isDifficultClear) {
            if (this.gameState.backToBackActive) {
                this.gameState.backToBackCount++;
            } else {
                this.gameState.backToBackActive = true;
                this.gameState.backToBackCount = 2; // Start at 2 for display purposes
            }
        } else {
            // Non-difficult clear breaks B2B
            this.gameState.backToBackActive = false;
            this.gameState.backToBackCount = 0;
        }
        
        // Calculate final score with bonuses
        let finalScore = baseScore;
        
        // Apply B2B bonus (1.5x multiplier)
        if (this.gameState.backToBackActive && isDifficultClear && this.gameState.backToBackCount >= 2) {
            finalScore = Math.floor(finalScore * 1.5);
        }
        
        // Apply combo bonus (50 points per combo level)
        if (this.gameState.comboCount > 1) {
            finalScore += (this.gameState.comboCount - 1) * 50;
        }
        
        // Apply perfect clear bonus (massive bonus)
        if (isPerfectClear) {
            finalScore += 3500; // Flat bonus for perfect clear
        }
        
        // Add to total score
        this.gameState.score += finalScore;
        
        // Return display info instead of directly showing it
        const displayClearType = isPerfectClear ? 'PERFECT CLEAR!' : clearType;
        return {
            clearedLines: linesCleared,
            displayInfo: {
                clearType: displayClearType,
                b2bCount: this.gameState.backToBackCount,
                comboCount: this.gameState.comboCount
            }
        };
    }

    private isEmptyBoard(): boolean {
        for (let y = 0; y < LOGICAL_BOARD_HEIGHT_BLOCKS; y++) {
            for (let x = 0; x < BOARD_WIDTH_BLOCKS; x++) {
                if (this.gameState.board[y][x] !== null) {
                    return false;
                }
            }
        }
        return true;
    }

    private getClearTypeAndScore(linesCleared: number, isPerfectClear: boolean, spinInfo?: { isSpin: boolean, pieceType: string }, shouldCheckForSpin?: boolean): { clearType: string, isDifficultClear: boolean, baseScore: number } {
        let clearType = '';
        let isDifficultClear = false;
        let baseScore = 0;
        
        if (spinInfo && spinInfo.isSpin) {
            // All spins are difficult and maintain B2B
            isDifficultClear = true;
            
            const spinPrefix = `${spinInfo.pieceType}-SPIN`;
            
            if (linesCleared === 0) {
                clearType = spinPrefix;
                baseScore = 100; // Spin without clear
            } else {
                switch (linesCleared) {
                    case 1:
                        clearType = `${spinPrefix} SINGLE`;
                        baseScore = spinInfo.pieceType === 'T' ? 200 : 100; // T-spins worth more
                        break;
                    case 2:
                        clearType = `${spinPrefix} DOUBLE`;
                        baseScore = spinInfo.pieceType === 'T' ? 600 : 300;
                        break;
                    case 3:
                        clearType = `${spinPrefix} TRIPLE`;
                        baseScore = spinInfo.pieceType === 'T' ? 1200 : 500;
                        break;
                    case 4:
                        clearType = `${spinPrefix} TETRIS`;
                        baseScore = spinInfo.pieceType === 'T' ? 1600 : 800;
                        break;
                    default:
                        clearType = `${spinPrefix} ${linesCleared} LINES`;
                        baseScore = linesCleared * (spinInfo.pieceType === 'T' ? 400 : 200);
                        break;
                }
            }
        } else {
            // Regular line clears
            switch (linesCleared) {
                case 1:
                    clearType = 'SINGLE';
                    isDifficultClear = false;
                    baseScore = 100;
                    break;
                case 2:
                    clearType = 'DOUBLE';
                    isDifficultClear = false;
                    baseScore = 300;
                    break;
                case 3:
                    clearType = 'TRIPLE';
                    isDifficultClear = false;
                    baseScore = 500;
                    break;
                case 4:
                    clearType = 'TETRIS';
                    isDifficultClear = true; // Tetris maintains B2B
                    baseScore = 800;
                    break;
                default:
                    clearType = `${linesCleared} LINES`;
                    isDifficultClear = false;
                    baseScore = linesCleared * 100;
                    break;
            }
        }
        
        return { clearType, isDifficultClear, baseScore };
    }

    // Comprehensive spin detection for all piece types
    private detectSpin(): { isSpin: boolean, pieceType: string } {
        if (!this.gameState.currentTetromino) {
            return { isSpin: false, pieceType: '' };
        }
        
        // Only check for spin if the last action was a rotation
        if (this.gameState.lastAction !== 'rotate') {
            return { isSpin: false, pieceType: '' };
        }
        
        const pieceType = this.gameState.currentTetromino.typeKey;
        
        // Only check for spins on pieces that can spin (not O-piece)
        if (pieceType === 'O') {
            return { isSpin: false, pieceType: '' };
        }
        
        const isSpin = this.checkSpinCondition(this.gameState.currentTetromino);
        return { isSpin, pieceType };
    }

    // Unified spin detection using 3-corner rule (works for all pieces)
    private checkSpinCondition(piece: { x: number, y: number, typeKey: string, rotation: number }): boolean {
        if (piece.typeKey !== 'T') return false;

        const corners = [
            { x: piece.x - 1, y: piece.y - 1 }, // Top-left
            { x: piece.x + 1, y: piece.y - 1 }, // Top-right
            { x: piece.x - 1, y: piece.y + 1 }, // Bottom-left
            { x: piece.x + 1, y: piece.y + 1 }  // Bottom-right
        ];

        let filledCorners = 0;
        for (const corner of corners) {
            const isOutOfBounds = corner.x < 0 || corner.x >= 10 || corner.y < 0 || corner.y >= LOGICAL_BOARD_HEIGHT_BLOCKS;
            const hasBlock = !isOutOfBounds && corner.y < this.gameState.board.length && this.gameState.board[corner.y][corner.x] !== null;
            
            if (isOutOfBounds || hasBlock) {
                filledCorners++;
            }
        }

        return filledCorners >= 3;
    }

    // Keep the old isTSpin method for backward compatibility, but use the new system
    private isTSpin(): boolean {
        const spinInfo = this.detectSpin();
        return spinInfo.isSpin && spinInfo.pieceType === 'T';
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