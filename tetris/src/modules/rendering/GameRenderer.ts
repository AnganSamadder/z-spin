import * as Phaser from 'phaser';
import { GameScene } from '../../scenes/GameScene';
import { GameState } from '../state/GameState';
import { GameSettings, DEFAULT_SETTINGS, HeldTetrominoState } from '../../types';
import {
    BLOCK_SIZE,
    BOARD_WIDTH_BLOCKS,
    VISIBLE_BOARD_HEIGHT_BLOCKS,
    BUFFER_ZONE_HEIGHT,
    LOGICAL_BOARD_HEIGHT_BLOCKS,
    TEXT_LABEL_OFFSET_Y,
    HOLD_AREA_WIDTH,
    HOLD_BOX_OFFSET_X,
    HOLD_BOX_CONTENT_START_Y,
    BOARD_OFFSET_X,
    BOARD_OFFSET_Y,
    NEXT_AREA_WIDTH,
    NEXT_AREA_OFFSET_X,
    NEXT_QUEUE_CONTENT_START_Y,
    PREVIEW_SLOT_HEIGHT,
    TETROMINOES,
} from '../../constants';

export class GameRenderer {
    private scene: GameScene;
    private gameState: GameState;
    private graphics: Phaser.GameObjects.Graphics;

    private scoreText: Phaser.GameObjects.Text;
    private gameOverText: Phaser.GameObjects.Text | null = null;
    private gameOverOverlay: Phaser.GameObjects.Graphics | null = null;
    private comboText: Phaser.GameObjects.Text;
    private backToBackText: Phaser.GameObjects.Text;
    private actualComboText: Phaser.GameObjects.Text;

    constructor(scene: GameScene) {
        this.scene = scene;
        this.gameState = scene.gameState;
        
        this.graphics = this.scene.add.graphics();
        this.scene.cameras.main.roundPixels = true;

        this.scoreText = this.scene.add.text(
            BOARD_OFFSET_X + (BOARD_WIDTH_BLOCKS * BLOCK_SIZE) / 2,
            BOARD_OFFSET_Y + TEXT_LABEL_OFFSET_Y,
            'Score: 0',
            { font: '24px Arial', color: '#ffffff' }
        ).setOrigin(0.5);

        this.comboText = this.scene.add.text(
            HOLD_BOX_OFFSET_X + HOLD_AREA_WIDTH / 2,
            HOLD_BOX_CONTENT_START_Y + PREVIEW_SLOT_HEIGHT + BLOCK_SIZE,
            '',
            { font: `${BLOCK_SIZE}px Arial`, color: '#FFFF00', align: 'center', stroke: '#000000', strokeThickness: 3 }
        ).setOrigin(0.5).setVisible(false);

        this.backToBackText = this.scene.add.text(
            HOLD_BOX_OFFSET_X + HOLD_AREA_WIDTH / 2,
            HOLD_BOX_CONTENT_START_Y + PREVIEW_SLOT_HEIGHT + BLOCK_SIZE * 4,
            '',
            { font: `${BLOCK_SIZE * 0.9}px Arial`, color: '#FF00FF', align: 'center', stroke: '#000000', strokeThickness: 3 }
        ).setOrigin(0.5).setVisible(false);

        this.actualComboText = this.scene.add.text(
            HOLD_BOX_OFFSET_X + HOLD_AREA_WIDTH / 2,
            HOLD_BOX_CONTENT_START_Y + PREVIEW_SLOT_HEIGHT + BLOCK_SIZE * 2.5,
            '',
            { font: `${BLOCK_SIZE * 0.9}px Arial`, color: '#FFFF00', align: 'center', stroke: '#000000', strokeThickness: 3 }
        ).setOrigin(0.5).setVisible(false);
    }

    public updateScore(score: number): void {
        this.scoreText.setText(`Score: ${score}`);
    }

    public showComboText(clearType: string, b2bCount: number, comboCount: number): void {
        if (clearType) {
            this.comboText.setText(clearType).setVisible(true);
        } else {
            this.comboText.setVisible(false);
        }

        if (b2bCount >= 2) {
            this.backToBackText.setText(`B2B x${b2bCount}`).setVisible(true);
        } else {
            this.backToBackText.setVisible(false);
        }

        if (comboCount > 1) {
            this.actualComboText.setText(`COMBO x${comboCount - 1}!`).setVisible(true);
        } else {
            this.actualComboText.setVisible(false);
        }
    }

    public hideComboTexts(): void {
        this.comboText.setVisible(false);
        this.backToBackText.setVisible(false);
        this.actualComboText.setVisible(false);
    }

    public drawGameOver(): void {
        if (this.gameOverText) { this.gameOverText.destroy(); }
        if (this.gameOverOverlay) { this.gameOverOverlay.destroy(); }

        const gameWidth = this.scene.cameras.main.width;
        const gameHeight = this.scene.cameras.main.height;
        this.gameOverOverlay = this.scene.add.graphics();
        this.gameOverOverlay.fillStyle(0x000000, 0.7);
        this.gameOverOverlay.fillRect(0, 0, gameWidth, gameHeight);

        this.gameOverText = this.scene.add.text(this.scene.cameras.main.centerX, this.scene.cameras.main.centerY, 'GAME OVER\nFinal Score: ' + this.gameState.score,
            { font: '48px Arial', color: '#ffffff', align: 'center' }).setOrigin(0.5);
    }

    // Alias for drawGameOver to maintain compatibility with WasmEngine
    public showGameOver(): void {
        this.drawGameOver();
    }

    public clearGameOver(): void {
        if (this.gameOverText) { this.gameOverText.destroy(); this.gameOverText = null; }
        if (this.gameOverOverlay) { this.gameOverOverlay.destroy(); this.gameOverOverlay = null; }
    }
    
    public drawGame(): void {
        this.graphics.clear();

        if (this.gameState.heldTetromino) {
            this.drawPreview(this.gameState.heldTetromino, HOLD_BOX_OFFSET_X, HOLD_BOX_CONTENT_START_Y, HOLD_AREA_WIDTH);
        }

        for (let y = BUFFER_ZONE_HEIGHT; y < LOGICAL_BOARD_HEIGHT_BLOCKS; y++) {
            for (let x = 0; x < BOARD_WIDTH_BLOCKS; x++) {
                if (this.gameState.board[y][x] !== null) {
                    this.graphics.fillStyle(this.gameState.board[y][x] as number, 1);
                    this.graphics.fillRect(
                        Math.floor(BOARD_OFFSET_X + x * BLOCK_SIZE),
                        Math.floor(BOARD_OFFSET_Y + (y - BUFFER_ZONE_HEIGHT) * BLOCK_SIZE),
                        BLOCK_SIZE, BLOCK_SIZE
                    );
                }
            }
        }

        this.graphics.lineStyle(2, 0xFFFFFF, 1);
        this.graphics.strokeRect(
            BOARD_OFFSET_X - 1, BOARD_OFFSET_Y - 1,
            BOARD_WIDTH_BLOCKS * BLOCK_SIZE + 2,
            VISIBLE_BOARD_HEIGHT_BLOCKS * BLOCK_SIZE + 2
        );

        const currentSettings: GameSettings = this.scene.registry.get('gameSettings') || DEFAULT_SETTINGS;

        // Check for WASM-specific blocks (currentTetrominoBlocks)
        if (this.gameState.currentTetrominoBlocks && this.gameState.currentTetrominoBlocks.length > 0) {
            // Render the active tetromino from WASM data
            if (this.gameState.currentTetromino) {
                const { typeKey } = this.gameState.currentTetromino;
                const color = TETROMINOES[typeKey as keyof typeof TETROMINOES]?.color || 0xFFFFFF;
                
                this.graphics.fillStyle(color, 1);
                
                // Draw each block separately based on the coordinates from WASM
                for (const block of this.gameState.currentTetrominoBlocks) {
                    if (block.y >= BUFFER_ZONE_HEIGHT) {
                        this.graphics.fillRect(
                            Math.floor(BOARD_OFFSET_X + block.x * BLOCK_SIZE),
                            Math.floor(BOARD_OFFSET_Y + (block.y - BUFFER_ZONE_HEIGHT) * BLOCK_SIZE),
                            BLOCK_SIZE, BLOCK_SIZE
                        );
                    }
                }
            }
        } 
        // Standard JS rendering
        else if (this.gameState.currentTetromino) {
            // Regular ghost piece
            if (currentSettings.ghostPieceEnabled) {
                const { shape, x, color, typeKey } = this.gameState.currentTetromino;
                const pivot = TETROMINOES[typeKey as keyof typeof TETROMINOES].pivot;
                let ghostY = this.gameState.currentTetromino.y;
                while (!this.scene.gameLogic.physics.checkCollision(x, ghostY + 1, shape, typeKey as keyof typeof TETROMINOES)) {
                    ghostY++;
                }

                this.graphics.fillStyle(color, 0.3);
                for (let r_shape = 0; r_shape < shape.length; r_shape++) {
                    for (let c_shape = 0; c_shape < shape[r_shape].length; c_shape++) {
                        if (shape[r_shape][c_shape]) {
                            const currentBlockLogicalY = ghostY + (r_shape - pivot.r);
                            const boardX = x + (c_shape - pivot.c);
                            if (currentBlockLogicalY >= BUFFER_ZONE_HEIGHT) {
                                this.graphics.fillRect(
                                    Math.floor(BOARD_OFFSET_X + boardX * BLOCK_SIZE),
                                    Math.floor(BOARD_OFFSET_Y + (currentBlockLogicalY - BUFFER_ZONE_HEIGHT) * BLOCK_SIZE),
                                    BLOCK_SIZE, BLOCK_SIZE
                                );
                            }
                        }
                    }
                }
            }

            // Regular active piece
            const { shape, x, y, color, typeKey } = this.gameState.currentTetromino;
            const pivot = TETROMINOES[typeKey as keyof typeof TETROMINOES].pivot;
            this.graphics.fillStyle(color, 1);

            for (let r_shape = 0; r_shape < shape.length; r_shape++) {
                for (let c_shape = 0; c_shape < shape[r_shape].length; c_shape++) {
                    if (shape[r_shape][c_shape]) {
                        const currentBlockLogicalY = y + (r_shape - pivot.r);
                        const boardX = x + (c_shape - pivot.c);
                        if (currentBlockLogicalY >= BUFFER_ZONE_HEIGHT) {
                            this.graphics.fillRect(
                                Math.floor(BOARD_OFFSET_X + boardX * BLOCK_SIZE),
                                Math.floor(BOARD_OFFSET_Y + (currentBlockLogicalY - BUFFER_ZONE_HEIGHT) * BLOCK_SIZE),
                                BLOCK_SIZE, BLOCK_SIZE
                            );
                        }
                    }
                }
            }
        }

        const displayNextCount = Math.min(this.gameState.nextTetrominoQueue.length, currentSettings.nextQueueSize);
        for (let i = 0; i < displayNextCount; i++) {
            const pieceToPreview = this.gameState.nextTetrominoQueue[i];
            if (pieceToPreview) {
                this.drawPreview(pieceToPreview, NEXT_AREA_OFFSET_X, NEXT_QUEUE_CONTENT_START_Y + i * PREVIEW_SLOT_HEIGHT, NEXT_AREA_WIDTH);
            }
        }
    }

    private drawPreview(piece: HeldTetrominoState, x: number, y: number, areaWidth: number): void {
        const tetrominoData = TETROMINOES[piece.typeKey];
        const color = tetrominoData.color;
        const shape = tetrominoData.shapes[0]; // Use the default rotation for preview

        this.graphics.fillStyle(color, 1);
        
        let min_r = shape.length, max_r = -1, min_c = shape[0].length, max_c = -1;
        let hasBlocks = false;
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    hasBlocks = true;
                    min_r = Math.min(min_r, r); max_r = Math.max(max_r, r);
                    min_c = Math.min(min_c, c); max_c = Math.max(max_c, c);
                }
            }
        }

        if(!hasBlocks) return;
        
        const pieceWidth = (max_c - min_c + 1) * BLOCK_SIZE;
        const pieceHeight = (max_r - min_r + 1) * BLOCK_SIZE;
        const offsetX = (areaWidth - pieceWidth) / 2;
        const offsetY = (PREVIEW_SLOT_HEIGHT - pieceHeight) / 2;

        for (let r = min_r; r <= max_r; r++) {
            for (let c = min_c; c <= max_c; c++) {
                if (shape[r][c]) {
                    this.graphics.fillRect(
                        Math.floor(x + offsetX + (c - min_c) * BLOCK_SIZE),
                        Math.floor(y + offsetY + (r - min_r) * BLOCK_SIZE),
                        BLOCK_SIZE, BLOCK_SIZE
                    );
                }
            }
        }
    }
} 