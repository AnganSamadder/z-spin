import { GameScene } from '../../scenes/GameScene';
import { GameState } from '../state/GameState';
import { GameRenderer } from '../rendering/GameRenderer';
import { GameSettings, DEFAULT_SETTINGS } from '../../types';
import { Physics } from './Physics';
import {
    BOARD_WIDTH_BLOCKS,
    LOGICAL_BOARD_HEIGHT_BLOCKS,
    BUFFER_ZONE_HEIGHT,
    KICK_DATA_JLSTZ,
    KICK_DATA_I,
    TETROMINOES,
} from '../../constants';

export class GameLogic {
    private scene: GameScene;
    private gameState: GameState;
    private renderer: GameRenderer;
    public physics: Physics;

    constructor(scene: GameScene, gameState: GameState, renderer: GameRenderer) {
        this.scene = scene;
        this.gameState = gameState;
        this.renderer = renderer;
        this.physics = new Physics(this.gameState);
    }

    public fillNextQueue(): void {
        const settings: GameSettings = this.scene.registry.get('gameSettings') || DEFAULT_SETTINGS;
        const targetQueueSize = settings.nextQueueSize;
        while (this.gameState.nextTetrominoQueue.length < targetQueueSize) {
            this.addRandomPieceToNextQueue();
        }
    }

    private addRandomPieceToNextQueue(): void {
        const typeKey = this.gameState.getNextFromBag();
        this.gameState.nextTetrominoQueue.push({ typeKey: typeKey });
    }

    public spawnNewTetromino(): void {
        this.fillNextQueue();
        const result = this.physics.spawnNewTetromino();

        if (result.gameOver) {
            this.handleGeneralGameOver();
            return;
        }

        // Reset manipulation flag to allow player control of new piece
        this.gameState.canManipulatePiece = true;

        if (result.landed) {
            this.scene.startLockDelayTimer();
        } else {
            this.scene.cancelLockDelayTimer();
        }
        
        this.renderer.drawGame();
    }

    public moveBlockDown(isSoftDrop: boolean = false): void {
        if (!this.gameState.canManipulatePiece || !this.gameState.currentTetromino) return;
        
        const wasLanded = this.gameState.isPieceLanded;
        const result = this.physics.moveBlockDown(isSoftDrop);
        
        // Update score display if soft drop awarded points
        if (isSoftDrop) {
            this.renderer.updateScore(this.gameState.score);
        }
        
        // Only start lock delay timer if piece just landed (transition from falling to landed)
        if (result.landed && !wasLanded) {
            this.scene.startLockDelayTimer();
        } else if (!result.landed && wasLanded) {
            // Piece was landed but moved down, cancel lock delay
            this.scene.cancelLockDelayTimer();
        }
        
        this.renderer.drawGame();
    }

    public moveBlockLeft(): void {
        if (!this.gameState.canManipulatePiece || !this.gameState.currentTetromino) return;
        const result = this.physics.moveBlockLeft();
        if (result.success) {
            if (this.gameState.isPieceLanded) {
                this.scene.startLockDelayTimer();
            } else if (!result.landed) {
                this.scene.cancelLockDelayTimer();
            }
            this.renderer.drawGame();
        }
    }

    public moveBlockRight(): void {
        if (!this.gameState.canManipulatePiece || !this.gameState.currentTetromino) return;
        const result = this.physics.moveBlockRight();
        if (result.success) {
            if (this.gameState.isPieceLanded) {
                this.scene.startLockDelayTimer();
            } else if (!result.landed) {
                this.scene.cancelLockDelayTimer();
            }
            this.renderer.drawGame();
        }
    }

    public rotate(isClockwise: boolean): void {
        if (!this.gameState.canManipulatePiece || !this.gameState.currentTetromino) return;
        const result = this.physics.rotate(isClockwise);
        if (result.success) {
            if (this.gameState.isPieceLanded) {
                this.scene.startLockDelayTimer();
            } else if (!result.landed) {
                this.scene.cancelLockDelayTimer();
            }
            this.renderer.drawGame();
        }
    }

    public rotate180(): void {
        if (!this.gameState.canManipulatePiece || !this.gameState.currentTetromino) return;
        const result1 = this.physics.rotate(true);
        if (result1.success) {
            const result2 = this.physics.rotate(true);
            if (result2.success) {
                if (this.gameState.isPieceLanded) {
                    this.scene.startLockDelayTimer(); // Reset the timer
                }
                this.renderer.drawGame();
            }
        }
    }

    public lockTetromino(): void {
        if (!this.gameState.currentTetromino) return;
        this.gameState.canManipulatePiece = false;
        this.scene.cancelLockDelayTimer();
        
        const result = this.physics.lockTetromino();
        
        if (result.gameOver) {
            this.handleGeneralGameOver();
        } else {
            // Update score display if lines were cleared
            if (result.clearedLines > 0) {
                this.renderer.updateScore(this.gameState.score);
                console.log(`GameLogic: ${result.clearedLines} lines cleared, score updated to ${this.gameState.score}`);
            }
            this.spawnNewTetromino();
        }

        this.renderer.drawGame();
    }

    private handleGeneralGameOver(): void {
        this.scene.endFallTimer();
        this.gameState.gameOver = true;
        this.gameState.canManipulatePiece = false;
        this.renderer.drawGame();
        this.renderer.drawGameOver();
    }
    
    public performHold(): void {
        if (!this.gameState.canManipulatePiece) return;
        const result = this.physics.performHold();
        if (result.success) {
            if (result.gameOver) {
                this.handleGeneralGameOver();
                return;
            }
            
            // Reset manipulation flag to allow player control of new piece
            this.gameState.canManipulatePiece = true;
            
            if (result.landed) {
                this.scene.startLockDelayTimer();
            } else {
                this.scene.cancelLockDelayTimer();
            }
            this.renderer.drawGame();
        }
    }

    public performHardDrop(): void {
        if (!this.gameState.canManipulatePiece || !this.gameState.currentTetromino) return;
        const result = this.physics.performHardDrop();
        
        // Update score display for hard drop points
        this.renderer.updateScore(this.gameState.score);
        
        if (result.gameOver) {
            this.handleGeneralGameOver();
            return;
        }

        // Update score display again if lines were cleared
        if (result.clearedLines > 0) {
            this.renderer.updateScore(this.gameState.score);
            console.log(`GameLogic: Hard drop + ${result.clearedLines} lines cleared, score updated to ${this.gameState.score}`);
        }

        // After a hard drop, a new piece is spawned immediately.
        this.spawnNewTetromino();
        this.renderer.drawGame();
    }

    public checkCollision(x: number, y: number, shape: number[][]): boolean {
        return this.physics.checkCollision(x, y, shape);
    }

    private checkForCompletedLines(): number {
        // Implementation of checkForCompletedLines method
        return 0; // Placeholder return, actual implementation needed
    }

    public moveAllTheWayLeft(): void {
        if (!this.gameState.canManipulatePiece || !this.gameState.currentTetromino) return;
        const result = this.physics.moveAllTheWayLeft();
        if (result.success) {
            if (this.gameState.isPieceLanded) {
                this.scene.startLockDelayTimer();
            } else if (!result.landed) {
                this.scene.cancelLockDelayTimer();
            }
            this.renderer.drawGame();
        }
    }

    public moveAllTheWayRight(): void {
        if (!this.gameState.canManipulatePiece || !this.gameState.currentTetromino) return;
        const result = this.physics.moveAllTheWayRight();
        if (result.success) {
            if (this.gameState.isPieceLanded) {
                this.scene.startLockDelayTimer();
            } else if (!result.landed) {
                this.scene.cancelLockDelayTimer();
            }
            this.renderer.drawGame();
        }
    }

    public moveToBottom(): void {
        if (!this.gameState.canManipulatePiece || !this.gameState.currentTetromino) return;
        const wasLanded = this.gameState.isPieceLanded;
        const result = this.physics.moveToBottom();

        if (result.landed && !wasLanded) {
            this.scene.startLockDelayTimer();
        }
        this.renderer.drawGame();
    }
} 