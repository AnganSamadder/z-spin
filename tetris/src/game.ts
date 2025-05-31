import * as Phaser from 'phaser';
import { SettingsScene } from './settingsScene';
import { GameSettings, DEFAULT_SETTINGS } from './types';

const BLOCK_SIZE = 30;
const BOARD_WIDTH_BLOCKS = 10;
const VISIBLE_BOARD_HEIGHT_BLOCKS = 20;
const BUFFER_ZONE_HEIGHT = 20; // As per Tetris Guideline
const LOGICAL_BOARD_HEIGHT_BLOCKS = VISIBLE_BOARD_HEIGHT_BLOCKS + BUFFER_ZONE_HEIGHT; // Total 40 rows

// --- Layout: Hold (Left) - Board (Center) - Next (Right) ---
const UI_SIDE_MARGIN = BLOCK_SIZE * 1.5;         // Margin on the far left and far right
const GAP_BETWEEN_AREAS = BLOCK_SIZE * 1.5;    // Horizontal gap between Hold/Board and Board/Next

const UI_ELEMENTS_TOP_Y = BLOCK_SIZE * 2;  // Y-coordinate for the top of UI content boxes (Hold, Next, Board)
const TEXT_LABEL_OFFSET_Y = -BLOCK_SIZE * 0.8; // Offset for text labels (Hold/Next/Score) above their content/reference point

// Hold Area (Left of Board)
const HOLD_AREA_WIDTH = BLOCK_SIZE * 4;
const HOLD_BOX_OFFSET_X = UI_SIDE_MARGIN;
const HOLD_TEXT_LABEL_Y = UI_ELEMENTS_TOP_Y + TEXT_LABEL_OFFSET_Y;
const HOLD_BOX_CONTENT_START_Y = UI_ELEMENTS_TOP_Y;

// Board Area (Center)
const BOARD_OFFSET_X = HOLD_BOX_OFFSET_X + HOLD_AREA_WIDTH + GAP_BETWEEN_AREAS;
const BOARD_OFFSET_Y = UI_ELEMENTS_TOP_Y; 

// Next Area (Right of Board)
const NEXT_AREA_WIDTH = BLOCK_SIZE * 4;
const NEXT_AREA_OFFSET_X = BOARD_OFFSET_X + (BOARD_WIDTH_BLOCKS * BLOCK_SIZE) + GAP_BETWEEN_AREAS;
const NEXT_TEXT_LABEL_Y = UI_ELEMENTS_TOP_Y + TEXT_LABEL_OFFSET_Y; // Vertically aligned with Hold text
const NEXT_QUEUE_CONTENT_START_Y = UI_ELEMENTS_TOP_Y; // Content starts at same Y as Hold content & Board

const PREVIEW_SLOT_HEIGHT = BLOCK_SIZE * 3; 
// --- End Layout Constants ---

// Calculated logical dimensions for the game content (for stacked left layout)
// The previous LOGICAL_GAME_WIDTH calculation was unusual for this layout.
// Standard width for this layout: Board starts after UI column, extends, then a margin.
const LOGICAL_GAME_WIDTH = BOARD_OFFSET_X + (BOARD_WIDTH_BLOCKS * BLOCK_SIZE) + UI_SIDE_MARGIN; // Adjusted for clarity
const LOGICAL_GAME_HEIGHT = BOARD_OFFSET_Y + (VISIBLE_BOARD_HEIGHT_BLOCKS * BLOCK_SIZE) + (BLOCK_SIZE * 3); // More bottom margin


// SRS Wall Kick Data
// (x, y) offsets: +x is right, +y is UP (will need to adjust for board's y-down)
// Rotation states: 0: spawn, 1: R (CW), 2: 180, 3: L (CCW)

const KICK_DATA_JLSTZ = {
    "0->1": [[0, 0], [-1, 0], [-1, +1], [0, -2], [-1, -2]],
    "1->0": [[0, 0], [+1, 0], [+1, -1], [0, +2], [+1, +2]],
    "1->2": [[0, 0], [+1, 0], [+1, -1], [0, +2], [+1, +2]],
    "2->1": [[0, 0], [-1, 0], [-1, +1], [0, -2], [-1, -2]],
    "2->3": [[0, 0], [+1, 0], [+1, +1], [0, -2], [+1, -2]],
    "3->2": [[0, 0], [-1, 0], [-1, -1], [0, +2], [-1, +2]],
    "3->0": [[0, 0], [-1, 0], [-1, -1], [0, +2], [-1, +2]],
    "0->3": [[0, 0], [+1, 0], [+1, +1], [0, -2], [+1, -2]],
};

const KICK_DATA_I = {
    "0->1": [[0, 0], [-2, 0], [+1, 0], [-2, -1], [+1, +2]],
    "1->0": [[0, 0], [+2, 0], [-1, 0], [+2, +1], [-1, -2]],
    "1->2": [[0, 0], [-1, 0], [+2, 0], [-1, +2], [+2, -1]],
    "2->1": [[0, 0], [+1, 0], [-2, 0], [+1, -2], [-2, +1]],
    "2->3": [[0, 0], [+2, 0], [-1, 0], [+2, +1], [-1, -2]],
    "3->2": [[0, 0], [-2, 0], [+1, 0], [-2, -1], [+1, +2]],
    "3->0": [[0, 0], [+1, 0], [-2, 0], [+1, -2], [-2, +1]],
    "0->3": [[0, 0], [-1, 0], [+2, 0], [-1, +2], [+2, -1]],
};

// O Tetromino does not kick.

// Tetromino shapes and their colors
// Each shape is an array of 2D arrays representing its rotations
// Shapes are defined in grids (3x3 for J,L,S,T,Z; 5x5 for I; 2x2 for O)
// Pivot is {r, c} index within the shape grid.
export const TETROMINOES = {
    'I': {
        pivot: { r: 1, c: 1 }, // Pivot point for SRS
        shapes: [
            // State 0 (Spawn) - Horizontal
            [[0,0,0,0],
             [1,1,1,1],
             [0,0,0,0],
             [0,0,0,0]],
            // State R (Clockwise from spawn)
            [[0,0,1,0],
             [0,0,1,0],
             [0,0,1,0],
             [0,0,1,0]],
            // State 2 (180)
            [[0,0,0,0],
             [0,0,0,0],
             [1,1,1,1],
             [0,0,0,0]],
            // State L (Counter-clockwise from spawn)
            [[0,1,0,0],
             [0,1,0,0],
             [0,1,0,0],
             [0,1,0,0]]
        ],
        color: 0x00ffff // Cyan
    },
    'O': {
        pivot: { r: 0, c: 0 }, // Pivot for 2x2 grid (top-left block), though O doesn't "rotate" in SRS kicks
        shapes: [
            [[1, 1], [1, 1]] // O-piece has only one state
        ],
        color: 0xffff00 // Yellow
    },
    'T': {
        pivot: { r: 1, c: 1 }, // Pivot for 3x3 grid (center of the 3-block line)
        shapes: [
            // T0 (Spawn)
            [[0,1,0], [1,1,1], [0,0,0]],
            // T1 (R)
            [[0,1,0], [0,1,1], [0,1,0]],
            // T2 (180)
            [[0,0,0], [1,1,1], [0,1,0]],
            // T3 (L)
            [[0,1,0], [1,1,0], [0,1,0]]
        ],
        color: 0x800080 // Purple
    },
    'S': {
        pivot: { r: 1, c: 1 }, // Pivot for 3x3 grid (center of the 2x2 bounding box for the 4 blocks)
        shapes: [
            // S0 (Spawn)
            [[0,1,1], [1,1,0], [0,0,0]],
            // S1 (R)
            [[0,1,0], [0,1,1], [0,0,1]],
            // S2 (180) - S0 rotated 180 degrees
            [[0,0,0], [0,1,1], [1,1,0]], // This is S0 rotated 180 degrees around its own center
            // S3 (L) - S1 rotated 180 degrees
            [[1,0,0], [1,1,0], [0,1,0]]
        ],
        color: 0x00ff00 // Green
    },
    'Z': {
        pivot: { r: 1, c: 1 }, // Pivot for 3x3 grid (center of the 2x2 bounding box)
        shapes: [
            // Z0 (Spawn)
            [[1,1,0], [0,1,1], [0,0,0]],
            // Z1 (R)
            [[0,0,1], [0,1,1], [0,1,0]],
            // Z2 (180) - Z0 rotated 180 degrees
            [[0,0,0], [1,1,0], [0,1,1]],
            // Z3 (L) - Z1 rotated 180 degrees
            [[0,1,0], [1,1,0], [1,0,0]]
        ],
        color: 0xff0000 // Red
    },
    'J': {
        pivot: { r: 1, c: 1 }, // Pivot for 3x3 grid (center of the 3-block line)
        shapes: [
            // J0 (Spawn)
            [[1,0,0], [1,1,1], [0,0,0]],
            // J1 (R)
            [[0,1,1], [0,1,0], [0,1,0]],
            // J2 (180)
            [[0,0,0], [1,1,1], [0,0,1]],
            // J3 (L)
            [[0,1,0], [0,1,0], [1,1,0]]
        ],
        color: 0x0000ff // Blue
    },
    'L': {
        pivot: { r: 1, c: 1 }, // Pivot for 3x3 grid (center of the 3-block line)
        shapes: [
            // L0 (Spawn)
            [[0,0,1], [1,1,1], [0,0,0]],
            // L1 (R)
            [[0,1,0], [0,1,0], [0,1,1]],
            // L2 (180)
            [[0,0,0], [1,1,1], [1,0,0]],
            // L3 (L)
            [[1,1,0], [0,1,0], [0,1,0]]
        ],
        color: 0xffa500 // Orange
    }
};
const TETROMINO_KEYS = Object.keys(TETROMINOES) as (keyof typeof TETROMINOES)[];

class GameScene extends Phaser.Scene {
    private board: (number | null)[][] = [];
    private currentTetromino: { shape: number[][], x: number, y: number, color: number, rotation: number, typeKey: keyof typeof TETROMINOES } | null = null;
    private nextTetrominoQueue: { shape: number[][], color: number, typeKey: keyof typeof TETROMINOES }[] = [];
    private currentBag: (keyof typeof TETROMINOES)[] = [];
    private heldTetromino: { shape: number[][], color: number, typeKey: keyof typeof TETROMINOES } | null = null;
    private canHold: boolean = true;
    private fallTimer: Phaser.Time.TimerEvent | null = null;
    private graphics: Phaser.GameObjects.Graphics | null = null;
    
    private score: number = 0;
    private scoreText: Phaser.GameObjects.Text | null = null;
    private nextText: Phaser.GameObjects.Text | null = null;
    private holdText: Phaser.GameObjects.Text | null = null;
    private gameOverText: Phaser.GameObjects.Text | null = null;
    private gameOverOverlay: Phaser.GameObjects.Graphics | null = null;
    private canManipulatePiece: boolean = false;

    private lockDelayTimer: Phaser.Time.TimerEvent | null = null;
    private lockDelayDuration: number = 500;
    private isPieceLanded: boolean = false;
    private lockResetsCount: number = 0;
    private readonly maxLockResets: number = 15;
    private arr!: number;
    private das!: number;
    private dcd!: number;
    private sdf!: number;

    private dasTimerLeft: number = 0;
    private dasTimerRight: number = 0;
    private isDasActiveLeft: boolean = false;
    private isDasActiveRight: boolean = false;
    private arrTimer: number = 0;
    private lastHorizontalMoveTime: number = 0;
    private lastSoftDropTime: number = 0;

    private phaserKeys: { [keyCode: string]: Phaser.Input.Keyboard.Key } = {};
    private actionKeyObjects: { [action: string]: Phaser.Input.Keyboard.Key[] } = {};
    private singlePressActions: Set<string> = new Set([
        'rotateCW', 'rotateCCW', 'rotate180', 'hardDrop', 'holdPiece', 'resetGame'
    ]);

    private moveDelay: number = 70; // Used by SDF=Infinity & DAS=0/ARR=0 initial move logic (was this.lastMoveTime + this.moveDelay before)

    private comboText: Phaser.GameObjects.Text | null = null;
    private lastAction: 'move' | 'rotate' | 'hard_drop' | 'none' = 'none';
    private lastKickOffset: { x: number, y: number } | null = null; // ADDED: To track the offset of the last successful kick
    private comboCount: number = 0;
    private backToBackActive: boolean = false;
    private backToBackCount: number = 0;
    private backToBackText: Phaser.GameObjects.Text | null = null;
    private actualComboText: Phaser.GameObjects.Text | null = null;

    constructor() {
        super({ key: 'GameScene' });
    }

    preload(): void {}

    create(): void {
        if (!this.registry.has('gameSettings')) {
            this.registry.set('gameSettings', { ...DEFAULT_SETTINGS });
        }
        const currentSettings: GameSettings = this.registry.get('gameSettings');
        this.arr = currentSettings.arr;
        this.das = currentSettings.das;
        this.dcd = currentSettings.dcd;
        this.sdf = currentSettings.sdf;
        this.updateFallTimerDelay(currentSettings.gravityValue);
        this.updateKeybindings();

        console.log("Creating Tetris game objects...");
        this.graphics = this.add.graphics();
        this.cameras.main.roundPixels = true;

        const settingsButton = this.add.text(this.cameras.main.width - (BLOCK_SIZE * 0.5), this.cameras.main.height - (BLOCK_SIZE * 0.5), '⚙️', 
            { font: `${BLOCK_SIZE * 1.2}px Arial`, color: '#ffffff' })
            .setOrigin(1, 1).setInteractive({ useHandCursor: true });

        settingsButton.on('pointerdown', () => {
            this.scene.launch('SettingsScene', { gameScene: this });
            this.scene.pause();
            if (this.fallTimer) this.fallTimer.paused = true;
        });
        
        this.events.on('resume', () => {
            console.log('GameScene resumed');
            const updatedSettings: GameSettings = this.registry.get('gameSettings');
            this.arr = updatedSettings.arr;
            this.das = updatedSettings.das;
            this.dcd = updatedSettings.dcd;
            this.sdf = updatedSettings.sdf;
            this.updateFallTimerDelay(updatedSettings.gravityValue);
            this.updateKeybindings();
            if (this.fallTimer) this.fallTimer.paused = false;
        });

        this.score = 0;
        this.scoreText = this.add.text(
            BOARD_OFFSET_X + (BOARD_WIDTH_BLOCKS * BLOCK_SIZE) / 2, // Centered above board
            BOARD_OFFSET_Y + TEXT_LABEL_OFFSET_Y, // Positioned above the board (TEXT_LABEL_OFFSET_Y is negative)
            'Score: 0', 
            { font: '24px Arial', color: '#ffffff' }
        ).setOrigin(0.5); // Origin 0.5 for horizontal and vertical centering of the text block
        
        this.comboText = this.add.text(
            HOLD_BOX_OFFSET_X + HOLD_AREA_WIDTH / 2, // Centered in Hold Area X
            HOLD_BOX_CONTENT_START_Y + PREVIEW_SLOT_HEIGHT + BLOCK_SIZE, // Below Hold Piece display
            '', 
            { font: `${BLOCK_SIZE}px Arial`, color: '#FFFF00', align: 'center', stroke: '#000000', strokeThickness: 3 }
        ).setOrigin(0.5).setVisible(false);

        this.backToBackText = this.add.text(
            HOLD_BOX_OFFSET_X + HOLD_AREA_WIDTH / 2, // Centered in Hold Area X
            HOLD_BOX_CONTENT_START_Y + PREVIEW_SLOT_HEIGHT + BLOCK_SIZE * 4, // Adjusted Y: Below actualComboText
            '', 
            { font: `${BLOCK_SIZE * 0.9}px Arial`, color: '#FF00FF', align: 'center', stroke: '#000000', strokeThickness: 3 } // Slightly smaller font
        ).setOrigin(0.5).setVisible(false);

        this.actualComboText = this.add.text(
            HOLD_BOX_OFFSET_X + HOLD_AREA_WIDTH / 2, // Centered in Hold Area X
            HOLD_BOX_CONTENT_START_Y + PREVIEW_SLOT_HEIGHT + BLOCK_SIZE * 2.5, // Below primary clear message
            '',
            { font: `${BLOCK_SIZE * 0.9}px Arial`, color: '#FFFF00', align: 'center', stroke: '#000000', strokeThickness: 3 } // Slightly smaller font
        ).setOrigin(0.5).setVisible(false);

        this.heldTetromino = null;
        this.canHold = true;
        this.canManipulatePiece = false; 

        if (!this.input.keyboard) {
            console.warn("Keyboard input not available.");
        }

        this.initBoard();
        this.fillCurrentBag();    
        this.fillNextQueue();     
        this.spawnNewTetromino(); 
        this.drawGame();
    }

    private updateKeybindings(): void {
        const settings: GameSettings = this.registry.get('gameSettings') || DEFAULT_SETTINGS;
        const keybinds = settings.keybinds;

        for (const eventCode in this.phaserKeys) {
            if (this.input.keyboard && this.phaserKeys[eventCode]) {
                this.input.keyboard.removeKey(this.phaserKeys[eventCode], true);
            }
        }
        this.phaserKeys = {};
        this.actionKeyObjects = {};

        const uniqueEventCodes = new Set<string>();
        for (const action in keybinds) {
            const boundEventCodes = keybinds[action as keyof GameSettings['keybinds']];
            if (Array.isArray(boundEventCodes)) {
                boundEventCodes.forEach(code => {
                    if (code && code !== '-') uniqueEventCodes.add(code);
                });
            }
        }

        uniqueEventCodes.forEach(eventCode => {
            if (this.input.keyboard && eventCode && eventCode !== '-') {
                 let keyStringToRegister = eventCode;
                 try {
                    if (eventCode.startsWith('Key') && eventCode.length > 3) { // e.g. KeyW -> W
                        keyStringToRegister = eventCode.substring(3);
                    } else if (eventCode.startsWith('Arrow')) { // e.g. ArrowUp -> UP
                        keyStringToRegister = eventCode.substring(5).toUpperCase();
                    } else if (eventCode === 'Quote') {
                        keyStringToRegister = 'QUOTES';
                    } else if (eventCode === 'Semicolon') {
                        keyStringToRegister = 'SEMICOLON';
                    } else if (eventCode === 'Space') {
                        keyStringToRegister = 'SPACE';
                    } // Other event.code values like 'Enter', 'ShiftLeft' are often handled directly by Phaser
                    
                    const newKeyObj = this.input.keyboard.addKey(keyStringToRegister, false);
                    this.phaserKeys[eventCode] = newKeyObj;
                 } catch (e) {
                    console.warn(`[KB_SETUP_ERROR] Failed to add key for eventCode: ${eventCode} (tried ${keyStringToRegister}). Error: ${e}`);
                 }
            }
        });

        for (const action in keybinds) {
            const boundEventCodes = keybinds[action as keyof GameSettings['keybinds']];
            this.actionKeyObjects[action] = [];
            if (Array.isArray(boundEventCodes)) {
                boundEventCodes.forEach(eventCode => {
                    if (eventCode && eventCode !== '-' && this.phaserKeys[eventCode]) {
                        this.actionKeyObjects[action].push(this.phaserKeys[eventCode]);
                    } else if (eventCode && eventCode !== '-') {
                        // Warning already handled if phaserKeys[eventCode] failed
                    }
                });
            }
        }
        console.log('[KB_SETUP_COMPLETE] Action Key Objects:', 
            Object.fromEntries(Object.entries(this.actionKeyObjects).map(([act, keys]) => [act, keys.map(k => k.keyCode)]))
        );
    }

    update(time: number, delta: number): void {
        // Check for reset game action regardless of game state
        if (this.actionKeyObjects.resetGame) {
            for (const keyObj of this.actionKeyObjects.resetGame) {
                if (keyObj && Phaser.Input.Keyboard.JustDown(keyObj)) {
                    this.resetGame();
                    return;
                }
            }
        }

        if (!this.canManipulatePiece || !this.currentTetromino || !this.input?.keyboard) return;
        // console.log('[UPDATE_LOOP_ACTIVE] CanManipulate:', this.canManipulatePiece, 'HasTetromino:', !!this.currentTetromino); 

        // Check for single press actions first
        for (const action of this.singlePressActions) {
            let actionTriggered = false;
            if (this.actionKeyObjects[action]) {
                for (const keyObj of this.actionKeyObjects[action]) {
                    if (keyObj) {
                        const isJustDown = Phaser.Input.Keyboard.JustDown(keyObj);
                        if (isJustDown) {
                            actionTriggered = true;
                            break;
                        }
                    }
                }
            }
            if (actionTriggered) {
                switch (action) {
                    case 'rotateCW': this.rotate(true); break;
                    case 'rotateCCW': this.rotate(false); break;
                    case 'rotate180': this.rotate180(); break;
                    case 'hardDrop': this.performHardDrop(); break;
                    case 'holdPiece': this.performHold(); break;
                    case 'resetGame': this.resetGame(); break;
                }
            }
        }

        let isLeftPressed = false;
        if (this.actionKeyObjects.moveLeft) {
            for (const keyObj of this.actionKeyObjects.moveLeft) {
                if (keyObj && keyObj.isDown) { isLeftPressed = true; break; }
            }
        }

        let isRightPressed = false;
        if (this.actionKeyObjects.moveRight) {
            for (const keyObj of this.actionKeyObjects.moveRight) {
                if (keyObj && keyObj.isDown) { isRightPressed = true; break; }
            }
        }

        let isDownPressed = false;
        if (this.actionKeyObjects.softDrop) {
            for (const keyObj of this.actionKeyObjects.softDrop) {
                if (keyObj && keyObj.isDown) { isDownPressed = true; break; }
            }
        }
        
        // Horizontal Movement (DAS/ARR) - uses isLeftPressed, isRightPressed
        if (isRightPressed) {
            if (!this.isDasActiveRight && this.dasTimerRight === 0) { 
                this.moveBlockRight(); 
                this.lastHorizontalMoveTime = time; // USE this.lastHorizontalMoveTime
                this.dasTimerRight += delta;
                if (this.isDasActiveLeft) { 
                    this.isDasActiveLeft = false;
                    this.dasTimerLeft = 0; 
                }
            } else {
                this.dasTimerRight += delta;
            }
            if (!this.isDasActiveRight && this.dasTimerRight >= this.das) {
                this.isDasActiveRight = true;
                this.arrTimer = 0; 
                if (this.das > 0 && this.arr === 0 && time > this.lastHorizontalMoveTime) { /* ARR=0 handled by block below */ } 
                else if (this.das > 0) { this.moveBlockRight(); this.lastHorizontalMoveTime = time; }
            }
            if (this.isDasActiveRight) {
                if (this.arr === 0) { 
                    if (this.currentTetromino && time > this.lastHorizontalMoveTime ) { // Ensure distinct from first press
                        let moved = false;
                        while (this.currentTetromino && !this.checkCollision(this.currentTetromino.x + 1, this.currentTetromino.y, this.currentTetromino.shape)) {
                            this.currentTetromino.x++; moved = true; this.lastAction = 'move'; 
                        }
                        if (moved) { this.lastHorizontalMoveTime = time; this.handlePostSuccessfulMoveRotation(); this.drawGame(); } 
                        else { this.lastHorizontalMoveTime = time; }
                    }
                } else if (this.arr > 0) { 
                    this.arrTimer += delta;
                    if (this.arrTimer >= this.arr) { this.moveBlockRight(); this.lastHorizontalMoveTime = time; this.arrTimer = 0; }
                }
            }
            if (this.dasTimerLeft > 0 || this.isDasActiveLeft) { this.dasTimerLeft = 0; this.isDasActiveLeft = false; }
        } else { 
            this.dasTimerRight = 0; this.isDasActiveRight = false;
        }

        if (isLeftPressed) {
            if (!this.isDasActiveLeft && this.dasTimerLeft === 0) { 
                this.moveBlockLeft(); 
                this.lastHorizontalMoveTime = time; // USE this.lastHorizontalMoveTime
                this.dasTimerLeft += delta;
                if (this.isDasActiveRight) { this.isDasActiveRight = false; this.dasTimerRight = 0; }
            } else {
                this.dasTimerLeft += delta;
            }
            if (!this.isDasActiveLeft && this.dasTimerLeft >= this.das) {
                this.isDasActiveLeft = true;
                this.arrTimer = 0; 
                if (this.das > 0 && this.arr === 0 && time > this.lastHorizontalMoveTime) { /* ARR=0 handled by block below */ } 
                else if (this.das > 0) { this.moveBlockLeft(); this.lastHorizontalMoveTime = time; }
            }
            if (this.isDasActiveLeft) {
                if (this.arr === 0) { 
                    if (this.currentTetromino && time > this.lastHorizontalMoveTime) { // Ensure distinct from first press
                        let moved = false;
                        while (this.currentTetromino && !this.checkCollision(this.currentTetromino.x - 1, this.currentTetromino.y, this.currentTetromino.shape)) {
                            this.currentTetromino.x--; moved = true; this.lastAction = 'move';
                        }
                        if (moved) { this.lastHorizontalMoveTime = time; this.handlePostSuccessfulMoveRotation(); this.drawGame(); } 
                        else { this.lastHorizontalMoveTime = time; }
                    }
                } else if (this.arr > 0) { 
                    this.arrTimer += delta;
                    if (this.arrTimer >= this.arr) { this.moveBlockLeft(); this.lastHorizontalMoveTime = time; this.arrTimer = 0; }
                }
            }
            if (this.dasTimerRight > 0 || this.isDasActiveRight) { this.dasTimerRight = 0; this.isDasActiveRight = false; }
        } else { 
            this.dasTimerLeft = 0; this.isDasActiveLeft = false;
        }
        if (!isLeftPressed && !isRightPressed) this.arrTimer = 0;

        if (isDownPressed) {
            if (this.sdf === Infinity) {
                // Use this.moveDelay for SDF Infinity checks, consistent with previous logic
                if (this.currentTetromino && time > this.lastSoftDropTime + this.moveDelay) { 
                    let originalY = this.currentTetromino.y; let newY = originalY;
                    while (!this.checkCollision(this.currentTetromino.x, newY + 1, this.currentTetromino.shape)) newY++;
                    if (newY > originalY) { this.currentTetromino.y = newY; this.lastAction = 'move'; this.handlePostSuccessfulMoveRotation(); this.drawGame(); }
                    else { this.handlePostSuccessfulMoveRotation(); } // Re-evaluate landing if already at bottom
                    this.lastSoftDropTime = time;
                }
            } else if (this.sdf > 1) { 
                const baseGravity = this.registry.get('gameSettings')?.gravityValue || DEFAULT_SETTINGS.gravityValue;
                const softDropInterval = Math.max(16, baseGravity / this.sdf);
                if (time > this.lastSoftDropTime + softDropInterval) { this.moveBlockDown(true); this.lastSoftDropTime = time; }
            }
        }
    }

    private initBoard(): void {
        this.board = []; // Clear existing board data
        for (let y = 0; y < LOGICAL_BOARD_HEIGHT_BLOCKS; y++) {
            this.board[y] = [];
            for (let x = 0; x < BOARD_WIDTH_BLOCKS; x++) {
                this.board[y][x] = null; 
            }
        }
    }

    private fillNextQueue(): void {
        this.nextTetrominoQueue = []; 
        const settings: GameSettings = this.registry.get('gameSettings') || DEFAULT_SETTINGS;
        const targetQueueSize = settings.nextQueueSize;
        for (let i = 0; i < targetQueueSize; i++) {
            this.addRandomPieceToNextQueue();
        }
    }

    private addRandomPieceToNextQueue(): void {
        const settings: GameSettings = this.registry.get('gameSettings') || DEFAULT_SETTINGS;
        const targetQueueSize = settings.nextQueueSize;
        if (this.nextTetrominoQueue.length >= targetQueueSize) return;
        if (this.currentBag.length === 0) this.fillCurrentBag();
        const typeKey = this.currentBag.pop()!;
        const tetrominoData = TETROMINOES[typeKey];
        const shape = tetrominoData.shapes[0];
        this.nextTetrominoQueue.push({ shape: shape, color: tetrominoData.color, typeKey: typeKey });
    }

    private spawnNewTetromino(): void {
        this.canManipulatePiece = false; 
        if (this.nextTetrominoQueue.length === 0) {
            this.fillNextQueue(); 
            if(this.nextTetrominoQueue.length === 0) { 
                 if(this.fallTimer) this.fallTimer.destroy();
                 this.handleSpawnCollision(); 
                 return;
            }
        }
        const nextPiece = this.nextTetrominoQueue.shift()!;
        this.addRandomPieceToNextQueue(); 
        const tetrominoDataForCurrent = TETROMINOES[nextPiece.typeKey];
        const initialRotation = 0;
        const shapeForCurrent = tetrominoDataForCurrent.shapes[initialRotation]; 
        const pivot = tetrominoDataForCurrent.pivot;
        
        // --- START: Modified Spawn Position Calculation ---
        // X-coordinate: Centering logic (same as before)
        let spawn_pivot_x: number;
        let min_r_shape = shapeForCurrent.length, max_r_shape = -1, min_c_shape = shapeForCurrent[0] ? shapeForCurrent[0].length : 0, max_c_shape = -1;
        let hasBlocks = false;
        for (let r = 0; r < shapeForCurrent.length; r++) {
            for (let c = 0; c < shapeForCurrent[r].length; c++) {
                if (shapeForCurrent[r][c]) {
                    hasBlocks = true;
                    min_r_shape = Math.min(min_r_shape, r);
                    max_r_shape = Math.max(max_r_shape, r);
                    min_c_shape = Math.min(min_c_shape, c);
                    max_c_shape = Math.max(max_c_shape, c);
                }
            }
        }

        if (!hasBlocks) { // Should not happen with valid Tetrominoes
            spawn_pivot_x = Math.floor(BOARD_WIDTH_BLOCKS / 2) - pivot.c;
        } else {
            const pieceWidthInBlocks = max_c_shape - min_c_shape + 1;
            const targetBoardXForMinCShape = Math.floor((BOARD_WIDTH_BLOCKS - pieceWidthInBlocks) / 2);
            spawn_pivot_x = targetBoardXForMinCShape - (min_c_shape - pivot.c);
        }

        // Y-coordinate: Spawn piece so its bottom-most block is on the first visible row (BUFFER_ZONE_HEIGHT).
        let spawn_pivot_y: number;
        if (!hasBlocks) { // Fallback for an unexpectedly empty shape
             // Place its theoretical pivot at the top of the visible area as a sensible default.
             spawn_pivot_y = BUFFER_ZONE_HEIGHT; 
        } else {
            // Standard case:
            // The pivot's y-coordinate (spawn_pivot_y) on the logical board should be such that
            // the bottom-most block of the piece lands on logical row BUFFER_ZONE_HEIGHT.
            // A block at shape-row 'r_shape' has a logical_y of: spawn_pivot_y + (r_shape - pivot.r)
            // The bottom-most block is at shape-row 'max_r_shape'.
            // So, we want: spawn_pivot_y + (max_r_shape - pivot.r) = BUFFER_ZONE_HEIGHT
            spawn_pivot_y = BUFFER_ZONE_HEIGHT - (max_r_shape - pivot.r);
        }
        // --- END: Modified Spawn Position Calculation ---

        const collisionDetected = this.checkCollision(spawn_pivot_x, spawn_pivot_y, shapeForCurrent, nextPiece.typeKey);
        if (collisionDetected) {
            this.handleSpawnCollision(); // Game over if cannot spawn at the very top of the buffer
        } else {
            this.currentTetromino = { shape: shapeForCurrent, x: spawn_pivot_x, y: spawn_pivot_y, color: nextPiece.color, rotation: initialRotation, typeKey: nextPiece.typeKey };
            this.canManipulatePiece = true; 
            this.canHold = true; 
            // Check if landed immediately after spawn (e.g., on top of other blocks in buffer or visible area)
            if (this.checkCollision(this.currentTetromino.x, this.currentTetromino.y + 1, this.currentTetromino.shape )) {
                this.isPieceLanded = true;
                this.resetLockResetsCount();
                this.startLockDelayTimer();
            } else {
                this.isPieceLanded = false;
                this.cancelLockDelayTimer();
            }
        }
        this.drawGame();
    }

    private moveBlockDownRegularFall(): void { this.moveBlockDown(false); }

    private moveBlockDown(isSoftDrop: boolean = false): void {
        if (!this.canManipulatePiece || !this.currentTetromino) return;
        if (!this.checkCollision(this.currentTetromino.x, this.currentTetromino.y + 1, this.currentTetromino.shape)) {
            this.currentTetromino.y++;
            if (isSoftDrop) { /* soft drop score */ }
            this.isPieceLanded = false; 
            this.cancelLockDelayTimer();
            this.resetLockResetsCount(); 
            this.lastAction = 'move'; 
        } else {
            if (!this.isPieceLanded) { 
                this.isPieceLanded = true;
                this.startLockDelayTimer(); 
            }
        }
        this.drawGame();
    }

    private moveBlockLeft(): void {
        if (!this.canManipulatePiece || !this.currentTetromino) return;
        if (!this.checkCollision(this.currentTetromino.x - 1, this.currentTetromino.y, this.currentTetromino.shape)) {
            this.currentTetromino.x--;
            this.lastAction = 'move';
            this.handlePostSuccessfulMoveRotation();
            this.drawGame();
        }
    }

    private moveBlockRight(): void {
        if (!this.canManipulatePiece || !this.currentTetromino) return;
        if (!this.checkCollision(this.currentTetromino.x + 1, this.currentTetromino.y, this.currentTetromino.shape)) {
            this.currentTetromino.x++;
            this.lastAction = 'move';
            this.handlePostSuccessfulMoveRotation();
            this.drawGame();
        }
    }

    private rotate(isClockwise: boolean): void {
        if (!this.canManipulatePiece || !this.currentTetromino) return;
        const typeKey = this.currentTetromino.typeKey;
        const tetrominoData = TETROMINOES[typeKey];
        const currentRotationState = this.currentTetromino.rotation; 
        if (typeKey === 'O') return;
        let nextRotationState: number = (isClockwise ? (currentRotationState + 1) : (currentRotationState - 1 + tetrominoData.shapes.length)) % tetrominoData.shapes.length;
        const nextShape = tetrominoData.shapes[nextRotationState];
        const kickTableKey = `${currentRotationState}->${nextRotationState}` as keyof typeof KICK_DATA_JLSTZ; 
        let kicks: number[][] = (typeKey === 'I' ? KICK_DATA_I[kickTableKey as keyof typeof KICK_DATA_I] : KICK_DATA_JLSTZ[kickTableKey]) || [[0,0]];
        
        this.lastKickOffset = null; // Reset before trying kicks

        for (const kick of kicks) {
            const newX = this.currentTetromino.x + kick[0];
            const newY = this.currentTetromino.y - kick[1]; 
            if (!this.checkCollision(newX, newY, nextShape)) {
                this.currentTetromino.x = newX; this.currentTetromino.y = newY;
                this.currentTetromino.shape = nextShape; this.currentTetromino.rotation = nextRotationState;
                this.lastAction = 'rotate'; 
                this.lastKickOffset = { x: kick[0], y: kick[1] }; // Store the successful kick
                this.handlePostSuccessfulMoveRotation(); this.drawGame();
                return; 
            }
        }
    }

    private rotate180(): void { 
        if (!this.canManipulatePiece || !this.currentTetromino) return; 
        // For 180, we ideally should check specific 0->2, 1->3 etc. kick data if available
        // For now, just performing two CW rotations. Kick offset will be from the *second* rotation.
        this.rotate(true); 
        if (!this.canManipulatePiece || !this.currentTetromino) return; // Check if first rotation failed or locked
        this.rotate(true); 
    }
    
    private lockTetromino(): void {
        if (!this.currentTetromino) return;
        const lockedPieceDetails = { 
            typeKey: this.currentTetromino.typeKey, 
            x: this.currentTetromino.x, 
            y: this.currentTetromino.y, 
            rotation: this.currentTetromino.rotation, 
            shape: this.currentTetromino.shape,
            lastKickOffset: this.lastAction === 'rotate' ? this.lastKickOffset : null // Pass kick offset only if last action was rotate
        };
        this.canManipulatePiece = false; this.isPieceLanded = false; 
        this.cancelLockDelayTimer(); this.resetLockResetsCount();
        const { shape, x: pivotBoardX, y: pivotBoardY, color, typeKey } = this.currentTetromino;
        const pivot = TETROMINOES[typeKey].pivot;
        
        let pieceHasAnyBlockInVisibleArea = false;
        for (let r_shape = 0; r_shape < shape.length; r_shape++) {
            for (let c_shape = 0; c_shape < shape[r_shape].length; c_shape++) {
                if (shape[r_shape][c_shape]) {
                    const boardX = pivotBoardX + (c_shape - pivot.c);
                    const boardY = pivotBoardY + (r_shape - pivot.r);
                    
                    // Place block on the logical board
                    if (boardY >= 0 && boardY < LOGICAL_BOARD_HEIGHT_BLOCKS && boardX >= 0 && boardX < BOARD_WIDTH_BLOCKS) {
                        this.board[boardY][boardX] = color;
                        if (boardY >= BUFFER_ZONE_HEIGHT) { // Check if this block is in the visible area
                            pieceHasAnyBlockInVisibleArea = true;
                        }
                    } else if (boardY < 0 && boardX >= 0 && boardX < BOARD_WIDTH_BLOCKS) {
                        // Piece locked entirely above the logical board (e.g. due to extreme kick)
                        // This is a game over scenario by Guideline (lock completely above visible part).
                        // If it's above logical row 0, it's definitely game over.
                        console.log("GAME OVER - Piece locked entirely above logical board rendering space.");
                        this.handleGeneralGameOver();
                        return;
                    }
                }
            }
        }

        // Game Over Check: if piece locked and NO part of it is in the visible area, it means it locked entirely in the buffer.
        if (!pieceHasAnyBlockInVisibleArea) {
            // Check if any part of the piece is on the logical board at all.
            // If it was placed (i.e. boardY >= 0 for some block), but none visible, then it's a buffer lock game over.
            let placedOnLogicalBoardAtAll = false;
            for (let r_shape = 0; r_shape < shape.length; r_shape++) {
                for (let c_shape = 0; c_shape < shape[r_shape].length; c_shape++) {
                    if (shape[r_shape][c_shape]) {
                        const boardY = pivotBoardY + (r_shape - pivot.r);
                        if (boardY >=0 && boardY < LOGICAL_BOARD_HEIGHT_BLOCKS) {
                             placedOnLogicalBoardAtAll = true; break;
                        }
                    }
                }
                if(placedOnLogicalBoardAtAll) break;
            }
            if(placedOnLogicalBoardAtAll){ // Placed somewhere on logical board, but not visible area
                console.log("GAME OVER - Piece locked entirely in buffer zone (above visible playfield).");
                this.handleGeneralGameOver(); 
                return;
            }
            // If not placed on logical board at all (e.g. kicked way off top), previous check (boardY < 0) should have caught it.
        }

        this.currentTetromino = null; 
        this.checkForCompletedLines(this.lastAction, lockedPieceDetails);
        this.spawnNewTetromino();      
        this.drawGame(); 
    }

    private handleGeneralGameOver(): void {
        if (this.fallTimer) this.fallTimer.remove();
        this.currentTetromino = null; 
        this.canManipulatePiece = false; 
        this.isPieceLanded = false; 
        this.cancelLockDelayTimer();
        this.resetLockResetsCount();
        this.drawGame(); 
        if (this.gameOverText) { this.gameOverText.destroy(); }
        if (this.gameOverOverlay) { this.gameOverOverlay.destroy(); }

        // Add translucent background
        const gameWidth = this.cameras.main.width;
        const gameHeight = this.cameras.main.height;
        this.gameOverOverlay = this.add.graphics();
        this.gameOverOverlay.fillStyle(0x000000, 0.7);
        this.gameOverOverlay.fillRect(0, 0, gameWidth, gameHeight);

        this.gameOverText = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 'GAME OVER\nFinal Score: ' + this.score, 
            { font: '48px Arial', color: '#ffffff', align: 'center' }).setOrigin(0.5);
    }

    private isTSpin(lockedPieceDetails: { typeKey: keyof typeof TETROMINOES, x: number, y: number, rotation: number, shape: number[][], lastKickOffset: {x: number, y: number} | null }): { type: 'none' | 'mini' | 'proper', kickUsedForMiniUpgrade: boolean } {
        const result = { type: 'none', kickUsedForMiniUpgrade: false } as { type: 'none' | 'mini' | 'proper', kickUsedForMiniUpgrade: boolean }; // Default result
        if (lockedPieceDetails.typeKey !== 'T') return result;
        
        const boardY = lockedPieceDetails.y;
        const boardX = lockedPieceDetails.x;

        const corners = [
            { x: boardX - 1, y: boardY - 1 }, // Top-left (A)
            { x: boardX + 1, y: boardY - 1 }, // Top-right (B)
            { x: boardX - 1, y: boardY + 1 }, // Bottom-left (C)
            { x: boardX + 1, y: boardY + 1 }  // Bottom-right (D)
        ];

        const isOccupied = (x: number, y: number): boolean => {
            return x < 0 || x >= BOARD_WIDTH_BLOCKS || 
                   y < 0 || y >= LOGICAL_BOARD_HEIGHT_BLOCKS || 
                   (this.board[y] && this.board[y][x] !== null);
        };

        const occupiedStatus = {
            A: isOccupied(corners[0].x, corners[0].y),
            B: isOccupied(corners[1].x, corners[1].y),
            C: isOccupied(corners[2].x, corners[2].y),
            D: isOccupied(corners[3].x, corners[3].y)
        };

        const totalOccupiedCorners = (occupiedStatus.A ? 1:0) + (occupiedStatus.B ? 1:0) + (occupiedStatus.C ? 1:0) + (occupiedStatus.D ? 1:0);

        if (totalOccupiedCorners < 3) return result; // Must have at least 3 corners for any T-Spin

        // Determine front and back based on rotation
        // Front corners are those the "nose" of the T points towards.
        // Back corners are the other two.
        let frontOccupiedCount = 0;
        let backOccupiedCount = 0;

        switch (lockedPieceDetails.rotation) {
            case 0: // T facing up (nose towards A and B)
                frontOccupiedCount = (occupiedStatus.A ? 1:0) + (occupiedStatus.B ? 1:0);
                backOccupiedCount = (occupiedStatus.C ? 1:0) + (occupiedStatus.D ? 1:0);
                break;
            case 1: // T facing right (nose towards B and D)
                frontOccupiedCount = (occupiedStatus.B ? 1:0) + (occupiedStatus.D ? 1:0);
                backOccupiedCount = (occupiedStatus.A ? 1:0) + (occupiedStatus.C ? 1:0);
                break;
            case 2: // T facing down (nose towards C and D)
                frontOccupiedCount = (occupiedStatus.C ? 1:0) + (occupiedStatus.D ? 1:0);
                backOccupiedCount = (occupiedStatus.A ? 1:0) + (occupiedStatus.B ? 1:0);
                break;
            case 3: // T facing left (nose towards A and C)
                frontOccupiedCount = (occupiedStatus.A ? 1:0) + (occupiedStatus.C ? 1:0);
                backOccupiedCount = (occupiedStatus.B ? 1:0) + (occupiedStatus.D ? 1:0);
                break;
        }
        
        // Guideline T-Spin check (3-corner rule)
        // Proper: 2 front occupied, and at least 1 back (so >=1 back, total >=3 implies this)
        // Mini: 1 front occupied, and 2 back occupied.

        let isProper = false;
        let isMini = false;

        if (frontOccupiedCount >= 2 && totalOccupiedCorners >=3) { // At least 2 front, at least 3 total implies at least 1 back.
            isProper = true;
        } else if (frontOccupiedCount === 1 && backOccupiedCount >= 2 && totalOccupiedCorners >=3) { // At least 1 front, at least 2 back, at least 3 total.
            isMini = true;
        }

        // Kick upgrade rule: if a specific kick (SRS test 5, a 1x2 or 2x1 offset) was used, a Mini can be upgraded to Proper.
        // SRS Kicks: (x, y) offsets: +x is right, +y is UP (board y is down, so kick y is negated for boardY comparison)
        // The relevant kicks are those with an absolute y-offset of 2 (meaning piece moved 2 units vertically relative to board grid)
        // or an absolute x-offset of 2 for I-piece (not relevant here).
        // For T-piece, it's kicks like [-1, -2] or [+1, +2] from KICK_DATA_JLSTZ (kicks[3] and kicks[4] for many rotation pairs).
        // Check if kick offset y is +/- 2 (or x for I, but this is T).
        let kickUpgrade = false;
        if (isMini && lockedPieceDetails.lastKickOffset) {
            // The SRS standard describes this as the 5th kick test resulting in a (column_offset= +/-1, row_offset= +/-2) or (column_offset= +/-2, row_offset= +/-1) displacement.
            // For T-pieces, this often corresponds to a kick where the |y_offset_from_kick_table| is 2.
            // The kick table stores y as +up, our board uses +down for y.
            // So a kick of [c, r] means piece moves c cells right, and r cells *up* from the kick table perspective.
            // The lastKickOffset stores {x: kick_c, y: kick_r_from_table}.
            // We care if |kick_r_from_table| == 2 (or |kick_c| == 2 for I-piece).
            if (Math.abs(lockedPieceDetails.lastKickOffset.y) === 2) { // Check for y-offset of 2 from kick table
                 kickUpgrade = true;
                 result.kickUsedForMiniUpgrade = true;
            }
        }

        if (isProper || kickUpgrade) {
            result.type = 'proper';
        } else if (isMini) {
            result.type = 'mini';
        }

        // console.log(`[isTSpinInternal] Piece: ${lockedPieceDetails.typeKey} at (${boardX}, ${boardY}) rot: ${lockedPieceDetails.rotation}. TotalOcc: ${totalOccupiedCorners}, FrontOcc: ${frontOccupiedCount}, BackOcc: ${backOccupiedCount}. Kick: ${JSON.stringify(lockedPieceDetails.lastKickOffset)}. IsProper: ${isProper}, IsMini: ${isMini}, KickUpgrade: ${kickUpgrade}. ResultType: ${result.type}`);
        return result;
    }

    private checkForCompletedLines(actionPriorToLock: 'move' | 'rotate' | 'hard_drop' | 'none', lockedPieceDetails: { typeKey: keyof typeof TETROMINOES, x: number, y: number, rotation: number, shape: number[][], lastKickOffset: {x: number, y: number} | null } | null): void {
        
        let tSpinResult = { type: 'none', kickUsedForMiniUpgrade: false } as { type: 'none' | 'mini' | 'proper', kickUsedForMiniUpgrade: boolean };
        if (lockedPieceDetails && lockedPieceDetails.typeKey === 'T' && actionPriorToLock === 'rotate') {
            tSpinResult = this.isTSpin(lockedPieceDetails);
        }

        let linesClearedThisTurn = 0;
        // Iterate only through the visible part of the board for line clearing
        for (let y = LOGICAL_BOARD_HEIGHT_BLOCKS - 1; y >= BUFFER_ZONE_HEIGHT; y--) {
            if (this.board[y].every(cell => cell !== null)) {
                linesClearedThisTurn++;
                // Shift lines down from the cleared line up to the top of the visible board
                for (let r = y; r > BUFFER_ZONE_HEIGHT; r--) { // Stop before overwriting buffer zone top
                    this.board[r] = [...this.board[r - 1]];
                }
                // Clear the top visible line
                this.board[BUFFER_ZONE_HEIGHT] = Array(BOARD_WIDTH_BLOCKS).fill(null);
                y++; // Re-check the current row index as lines have shifted down
            }
        }
        let pointsEarned = 0; let clearTypeMessage = ""; 
        let isDifficultClearThisTurn = false; 
        const b2bActivePriorToThisClear = this.backToBackActive;

        if (tSpinResult.type !== 'none') {
            this.comboCount++; 
            isDifficultClearThisTurn = linesClearedThisTurn > 0; // Any line-clearing T-Spin (Mini or Proper) is difficult for B2B

            switch (tSpinResult.type) {
                case 'proper':
                    switch (linesClearedThisTurn) {
                        case 0: pointsEarned = 400; clearTypeMessage = "T-Spin"; break;
                        case 1: pointsEarned = 800; clearTypeMessage = "T-Spin\nSingle!"; break; 
                        case 2: pointsEarned = 1200; clearTypeMessage = "T-Spin\nDouble!"; break; 
                        case 3: pointsEarned = 1600; clearTypeMessage = "T-Spin\nTriple!"; break; 
                        default: pointsEarned = 1600; clearTypeMessage = "T-Spin\nMax!"; break; 
                    }
                    break;
                case 'mini':
                    switch (linesClearedThisTurn) {
                        case 0: pointsEarned = 100; clearTypeMessage = "T-Spin Mini"; break;
                        case 1: pointsEarned = 200; clearTypeMessage = "T-Spin Mini\nSingle!"; break; 
                        case 2: pointsEarned = 400; clearTypeMessage = "T-Spin Mini\nDouble!"; break; 
                        // Mini T-Spin Triple is impossible
                        default: pointsEarned = 400; clearTypeMessage = "T-Spin Mini\nMax!"; break; 
                    }
                    break;
            }
        } else if (linesClearedThisTurn > 0) { // Regular line clear (not a T-Spin)
            this.comboCount++;
            isDifficultClearThisTurn = linesClearedThisTurn === 4; // Only Tetris is difficult for non-T-Spin clears
            switch (linesClearedThisTurn) {
                case 1: pointsEarned = 100; clearTypeMessage = "Single"; break; 
                case 2: pointsEarned = 300; clearTypeMessage = "Double"; break; 
                case 3: pointsEarned = 500; clearTypeMessage = "Triple"; break; 
                case 4: pointsEarned = 800; clearTypeMessage = "Tetris!"; break; 
                default: pointsEarned = 800; clearTypeMessage = `Clear ${linesClearedThisTurn}×`; break; 
            }
        } else {
            // No lines cleared, and not any kind of T-Spin (0-line T-Spins handled above)
            this.comboCount = 0; 
            if (this.comboText) this.comboText.setVisible(false).setText('');
            if (this.actualComboText) this.actualComboText.setVisible(false).setText('');
        }

        // Apply Combo and B2B logic
        if (pointsEarned > 0 || tSpinResult.type !== 'none') {
            if (this.comboText) {
                const shouldShowClearMessage =
                    tSpinResult.type !== 'none' ||                         // Any T-Spin (Mini or Proper, 0-3 lines)
                    (linesClearedThisTurn === 4 && tSpinResult.type === 'none'); // Tetris (that isn't also a T-Spin)

                if (shouldShowClearMessage) {
                    this.comboText.setText(clearTypeMessage).setVisible(true);
                } else if (linesClearedThisTurn > 0 && tSpinResult.type === 'none') { 
                    this.comboText.setVisible(false).setText('');
                }
            }

            if (this.comboCount > 1 && linesClearedThisTurn > 0) {
                const comboBonus = (this.comboCount - 1) * 50; 
                pointsEarned += comboBonus; 
                if (this.actualComboText) { 
                    this.actualComboText.setText(`COMBO ×${this.comboCount -1}!`); // UPDATED FORMAT
                    this.actualComboText.setVisible(true); 
                }
            } else if (linesClearedThisTurn === 0 && tSpinResult.type === 'none') {
                 if (this.actualComboText) this.actualComboText.setVisible(false).setText('');
            } else if (this.comboCount <=1 && linesClearedThisTurn > 0) {
                 if (this.actualComboText) this.actualComboText.setVisible(false).setText('');
            }

            // B2B Logic
            if (isDifficultClearThisTurn) {
                if (b2bActivePriorToThisClear) {
                    this.backToBackCount++;
                    pointsEarned = Math.floor(pointsEarned * 1.5); 
                } else {
                    this.backToBackCount = 1; 
                }
                this.backToBackActive = true; 
                if (this.backToBackText) {
                    if (this.backToBackCount >= 2) { // UPDATED VISIBILITY AND FORMAT
                        this.backToBackText.setText(`B2B ×${this.backToBackCount}`);
                        this.backToBackText.setVisible(true);
                    } else {
                        this.backToBackText.setVisible(false).setText('');
                    }
                }
            } else if (linesClearedThisTurn > 0) { 
                this.backToBackActive = false;
                this.backToBackCount = 0;
                if (this.backToBackText) this.backToBackText.setVisible(false).setText('');
            } else if (tSpinResult.type !== 'none' && linesClearedThisTurn === 0) {
                // 0-line T-Spin (Mini or Proper): Does NOT break B2B, does NOT increment B2B count.
                if (this.backToBackText) { // UPDATED VISIBILITY AND FORMAT for maintaining B2B text
                    if (this.backToBackCount >= 2) {
                        this.backToBackText.setText(`B2B ×${this.backToBackCount}`);
                        this.backToBackText.setVisible(true); 
                    } else {
                        this.backToBackText.setVisible(false).setText('');
                    }
                }
            }
        }
        
        // Perfect Clear Check
        let isBoardEmpty = true; 
        if (linesClearedThisTurn > 0) {
            for (let r = BUFFER_ZONE_HEIGHT; r < LOGICAL_BOARD_HEIGHT_BLOCKS; r++) { 
                if (this.board[r].some(cell => cell !== null)) {
                    isBoardEmpty = false;
                    break;
                }
            }
            if (isBoardEmpty) { 
                const perfectClearBasePoints = 3000; 
                let perfectClearTotalPoints = perfectClearBasePoints;
                
                clearTypeMessage = "Perfect Clear!"; // UPDATED: Always "Perfect Clear!"

                isDifficultClearThisTurn = true; 

                if (b2bActivePriorToThisClear) {
                    this.backToBackCount++; 
                    perfectClearTotalPoints = Math.floor(perfectClearTotalPoints * 1.5); 
                } else {
                     this.backToBackCount = 1; 
                }
                pointsEarned += perfectClearTotalPoints; 

                this.backToBackActive = true; 
                
                if (this.comboText) this.comboText.setText(clearTypeMessage).setVisible(true);
                if (this.backToBackText) { // UPDATED VISIBILITY AND FORMAT for PC B2B
                    if (this.backToBackCount >= 2) {
                        this.backToBackText.setText(`B2B ×${this.backToBackCount}`);
                        this.backToBackText.setVisible(true);
                    } else {
                        this.backToBackText.setVisible(false).setText('');
                    }
                }
                if (this.actualComboText) this.actualComboText.setVisible(false).setText('');
            }
        }

        if (pointsEarned > 0) { 
            this.score += pointsEarned; 
            if (this.scoreText) { 
                this.scoreText.setText(`Score: ${this.score}`); 
            }
        }
        this.lastAction = 'none'; 
        this.drawGame();
    }

    private drawGame(): void {
        if (!this.graphics) return;
        this.graphics.clear();

        // Draw Hold Box Title and Piece
        if (this.holdText && !this.holdText.active) this.holdText.setActive(true);
        if (this.heldTetromino) {
            this.graphics.fillStyle(this.heldTetromino.color, 1);
            const shape = this.heldTetromino.shape; 
            const previewAreaWidth = HOLD_AREA_WIDTH; 
            let min_r_shape_hold = shape.length, max_r_shape_hold = -1, min_c_shape_hold = shape[0] ? shape[0].length : 0, max_c_shape_hold = -1;
            let hasBlocks_hold = false;
            for (let r = 0; r < shape.length; r++) {
                for (let c = 0; c < shape[r].length; c++) {
                    if (shape[r][c]) {
                        hasBlocks_hold = true;
                        min_r_shape_hold = Math.min(min_r_shape_hold, r);
                        max_r_shape_hold = Math.max(max_r_shape_hold, r);
                        min_c_shape_hold = Math.min(min_c_shape_hold, c);
                        max_c_shape_hold = Math.max(max_c_shape_hold, c);
                    }
                }
            }
            if (hasBlocks_hold) {
                const pieceActualWidthPx_hold = (max_c_shape_hold - min_c_shape_hold + 1) * BLOCK_SIZE;
                const pieceActualHeightPx_hold = (max_r_shape_hold - min_r_shape_hold + 1) * BLOCK_SIZE;
                let offsetX = Math.floor((previewAreaWidth - pieceActualWidthPx_hold) / 2);
                let offsetY = Math.floor((PREVIEW_SLOT_HEIGHT - pieceActualHeightPx_hold) / 2); 
                 if (offsetY < 0) offsetY = 0;

                for (let r_shape_idx = min_r_shape_hold; r_shape_idx <= max_r_shape_hold; r_shape_idx++) {
                    for (let c_shape_idx = min_c_shape_hold; c_shape_idx <= max_c_shape_hold; c_shape_idx++) {
                        if (shape[r_shape_idx][c_shape_idx]) {
                            this.graphics.fillRect(
                                Math.floor(HOLD_BOX_OFFSET_X + offsetX + (c_shape_idx - min_c_shape_hold) * BLOCK_SIZE),
                                Math.floor(HOLD_BOX_CONTENT_START_Y + offsetY + (r_shape_idx - min_r_shape_hold) * BLOCK_SIZE),
                                BLOCK_SIZE,
                                BLOCK_SIZE
                            );
                        }
                    }
                }
            }
        }

        // Draw the landed blocks on the board (Only visible part)
        for (let y = BUFFER_ZONE_HEIGHT; y < LOGICAL_BOARD_HEIGHT_BLOCKS; y++) {
            for (let x = 0; x < BOARD_WIDTH_BLOCKS; x++) {
                if (this.board[y][x] !== null) {
                    this.graphics.fillStyle(this.board[y][x] as number, 1);
                    this.graphics.fillRect(
                        Math.floor(BOARD_OFFSET_X + x * BLOCK_SIZE),
                        Math.floor(BOARD_OFFSET_Y + (y - BUFFER_ZONE_HEIGHT) * BLOCK_SIZE), // Adjust Y for buffer
                        BLOCK_SIZE,
                        BLOCK_SIZE
                    );
                }
            }
        }

        // Draw the border around the VISIBLE game board
        this.graphics.lineStyle(2, 0xFFFFFF, 1);
        this.graphics.strokeRect(
            BOARD_OFFSET_X -1,
            BOARD_OFFSET_Y -1,
            BOARD_WIDTH_BLOCKS * BLOCK_SIZE + 2, 
            VISIBLE_BOARD_HEIGHT_BLOCKS * BLOCK_SIZE + 2 // Border for visible height
        );

        // Draw Ghost Piece
        const currentSettings_draw: GameSettings = this.registry.get('gameSettings') || DEFAULT_SETTINGS;
        if (this.currentTetromino && currentSettings_draw.ghostPieceEnabled) {
            const { shape, x: pivotBoardX, color, typeKey } = this.currentTetromino;
            const pivot = TETROMINOES[typeKey].pivot;
            let ghostY = this.currentTetromino.y;
            // Ghost piece logic itself doesn't need to know about buffer for projection, checkCollision handles boundaries.
            while (!this.checkCollision(pivotBoardX, ghostY + 1, shape, typeKey)) {
                ghostY++;
            }

            this.graphics.fillStyle(color, 0.3);
            for (let r_shape = 0; r_shape < shape.length; r_shape++) {
                for (let c_shape = 0; c_shape < shape[r_shape].length; c_shape++) {
                    if (shape[r_shape][c_shape]) {
                        const currentBlockLogicalY = ghostY + (r_shape - pivot.r);
                        const boardX = pivotBoardX + (c_shape - pivot.c);
                        
                        // Only draw ghost blocks that fall within the visible area
                        if (currentBlockLogicalY >= BUFFER_ZONE_HEIGHT && currentBlockLogicalY < LOGICAL_BOARD_HEIGHT_BLOCKS && boardX >= 0 && boardX < BOARD_WIDTH_BLOCKS) {
                            this.graphics.fillRect(
                                Math.floor(BOARD_OFFSET_X + boardX * BLOCK_SIZE),
                                Math.floor(BOARD_OFFSET_Y + (currentBlockLogicalY - BUFFER_ZONE_HEIGHT) * BLOCK_SIZE), // Adjust Y
                                BLOCK_SIZE,
                                BLOCK_SIZE
                            );
                        }
                    }
                }
            }
        }

        // Draw the current falling tetromino
        if (this.currentTetromino) {
            const { shape, x: pivotBoardX, y: pivotBoardY, color, typeKey } = this.currentTetromino;
            const pivot = TETROMINOES[typeKey].pivot;
            this.graphics.fillStyle(color, 1);

            for (let r_shape = 0; r_shape < shape.length; r_shape++) {
                for (let c_shape = 0; c_shape < shape[r_shape].length; c_shape++) {
                    if (shape[r_shape][c_shape]) {
                        const currentBlockLogicalY = pivotBoardY + (r_shape - pivot.r);
                        const boardX = pivotBoardX + (c_shape - pivot.c);
                        
                        // Only draw blocks of the current piece that are within the visible area
                        if (currentBlockLogicalY >= BUFFER_ZONE_HEIGHT && currentBlockLogicalY < LOGICAL_BOARD_HEIGHT_BLOCKS && boardX >= 0 && boardX < BOARD_WIDTH_BLOCKS) {
                            this.graphics.fillRect(
                                Math.floor(BOARD_OFFSET_X + boardX * BLOCK_SIZE),
                                Math.floor(BOARD_OFFSET_Y + (currentBlockLogicalY - BUFFER_ZONE_HEIGHT) * BLOCK_SIZE), // Adjust Y
                                BLOCK_SIZE,
                                BLOCK_SIZE
                            );
                        }
                    }
                }
            }
        }

        // Draw the "Next" block queue
        if (this.nextText && !this.nextText.active) this.nextText.setActive(true);
        
        const previewAreaWidthNext = NEXT_AREA_WIDTH; 
        const settingsForDraw_Next: GameSettings = this.registry.get('gameSettings') || DEFAULT_SETTINGS;
        const displayNextCount = Math.min(this.nextTetrominoQueue.length, settingsForDraw_Next.nextQueueSize);

        for (let i = 0; i < displayNextCount; i++) {
            const pieceToPreview = this.nextTetrominoQueue[i];
            if (!pieceToPreview) continue;

            this.graphics.fillStyle(pieceToPreview.color, 1);
            const shape = pieceToPreview.shape; 
            
            let min_r_shape = shape.length, max_r_shape = -1, min_c_shape = shape[0] ? shape[0].length : 0, max_c_shape = -1;
            let hasBlocks = false;
            for (let r = 0; r < shape.length; r++) {
                for (let c = 0; c < shape[r].length; c++) {
                    if (shape[r][c]) {
                        hasBlocks = true;
                        min_r_shape = Math.min(min_r_shape, r);
                        max_r_shape = Math.max(max_r_shape, r);
                        min_c_shape = Math.min(min_c_shape, c);
                        max_c_shape = Math.max(max_c_shape, c);
                    }
                }
            }

            if (!hasBlocks) continue; 

            const pieceActualWidthInBlocks = max_c_shape - min_c_shape + 1;
            const pieceActualHeightInBlocks = max_r_shape - min_r_shape + 1;
            const pieceActualWidthPx = pieceActualWidthInBlocks * BLOCK_SIZE;
            const pieceActualHeightPx = pieceActualHeightInBlocks * BLOCK_SIZE;
            const slotCenterX = previewAreaWidthNext / 2;
            const slotCenterY = PREVIEW_SLOT_HEIGHT / 2;
            const pieceBoundingBoxCenterX = pieceActualWidthPx / 2;
            const pieceBoundingBoxCenterY = pieceActualHeightPx / 2;
            let drawOffsetX = Math.floor(slotCenterX - pieceBoundingBoxCenterX);
            let drawOffsetY = Math.floor(slotCenterY - pieceBoundingBoxCenterY);
            const currentPreviewYBase = NEXT_QUEUE_CONTENT_START_Y + i * PREVIEW_SLOT_HEIGHT;

            for (let r_shape_idx = min_r_shape; r_shape_idx <= max_r_shape; r_shape_idx++) {
                for (let c_shape_idx = min_c_shape; c_shape_idx <= max_c_shape; c_shape_idx++) {
                    if (shape[r_shape_idx][c_shape_idx]) {
                        this.graphics.fillRect(
                            Math.floor(NEXT_AREA_OFFSET_X + drawOffsetX + (c_shape_idx - min_c_shape) * BLOCK_SIZE),
                            Math.floor(currentPreviewYBase + drawOffsetY + (r_shape_idx - min_r_shape) * BLOCK_SIZE),
                            BLOCK_SIZE,
                            BLOCK_SIZE
                        );
                    }
                }
            }
        }
    }

    private performHold(): void {
        if (!this.canManipulatePiece || !this.canHold || !this.currentTetromino) return;

        const pieceToStoreInHold = {
            // Store the base shape for consistent display in hold box
            shape: TETROMINOES[this.currentTetromino.typeKey].shapes[0],
            color: this.currentTetromino.color,
            typeKey: this.currentTetromino.typeKey
        };

        if (!this.heldTetromino) { // No piece currently held
            this.heldTetromino = pieceToStoreInHold;
            this.spawnNewTetromino(); // Spawn next piece from queue
        } else { // Swap with existing held piece
            const previouslyHeld = this.heldTetromino;
            this.heldTetromino = pieceToStoreInHold;

            // The previously held piece becomes the current falling piece
            const newCurrentTypeKey = previouslyHeld.typeKey;
            const tetrominoDataForNewCurrent = TETROMINOES[newCurrentTypeKey];
            const initialRotation = 0;
            const shapeForNewCurrent = tetrominoDataForNewCurrent.shapes[initialRotation];
            const pivotForNewCurrent = tetrominoDataForNewCurrent.pivot;
            let spawn_pivot_x_hold: number;
            let spawn_pivot_y_hold: number;
            const shape_hold = shapeForNewCurrent;
            let min_r_hold = shape_hold.length, max_r_hold = -1, min_c_hold = shape_hold[0] ? shape_hold[0].length : 0, max_c_hold = -1;
            let hasBlocks_hold = false;
            for (let r = 0; r < shape_hold.length; r++) {
                for (let c = 0; c < shape_hold[r].length; c++) {
                    if (shape_hold[r][c]) {
                        hasBlocks_hold = true;
                        min_r_hold = Math.min(min_r_hold, r);
                        max_r_hold = Math.max(max_r_hold, r);
                        min_c_hold = Math.min(min_c_hold, c);
                        max_c_hold = Math.max(max_c_hold, c);
                    }
                }
            }
            if (!hasBlocks_hold) { 
                spawn_pivot_x_hold = Math.floor(BOARD_WIDTH_BLOCKS / 2) - pivotForNewCurrent.c;
                spawn_pivot_y_hold = pivotForNewCurrent.r; 
            } else {
                const pieceWidthInBlocks_hold = max_c_hold - min_c_hold + 1;
                const targetBoardXForMinCShape_hold = Math.floor((BOARD_WIDTH_BLOCKS - pieceWidthInBlocks_hold) / 2);
                spawn_pivot_x_hold = targetBoardXForMinCShape_hold - (min_c_hold - pivotForNewCurrent.c);
                spawn_pivot_y_hold = pivotForNewCurrent.r - min_r_hold;
            }

            // Check collision for the piece coming from hold *before* making it current
            const collisionOnHoldSwap = this.checkCollision(spawn_pivot_x_hold, spawn_pivot_y_hold, shapeForNewCurrent, newCurrentTypeKey);

            if (collisionOnHoldSwap) {
                // Game over: Piece from hold cannot be placed.
                // Revert held piece (optional, or consider game lost)
                // For now, treat as direct game over like a block out. this.heldTetromino was already updated.
                // The currentTetromino (being replaced) is what was active.
                // We need to make sure handleSpawnCollision correctly uses the *board* state.
                // To make handleSpawnCollision work as intended (showing board that blocked the *new* piece),
                // currentTetromino should be null or the piece that *was* playing before hold was pressed.
                // It currently is. So handleSpawnCollision should be fine.
                this.handleSpawnCollision(); // This will nullify currentTetromino, draw board, show text.
            } else {
                this.currentTetromino = {
                    shape: shapeForNewCurrent,
                    x: spawn_pivot_x_hold,
                    y: spawn_pivot_y_hold,
                    color: previouslyHeld.color,
                    rotation: initialRotation,
                    typeKey: newCurrentTypeKey
                };
                this.canManipulatePiece = true; 
                // Initial landed check for piece from hold
                if (this.checkCollision(this.currentTetromino.x, this.currentTetromino.y + 1, this.currentTetromino.shape)) {
                    this.isPieceLanded = true;
                    this.resetLockResetsCount(); 
                    this.startLockDelayTimer();
                } else {
                    this.isPieceLanded = false;
                    this.cancelLockDelayTimer();
                }
            }
        }
        this.canHold = false; // Regardless of success/failure of swap, canHold is used up for this turn.
        this.drawGame(); // Draw the final state after hold operation
    }

    private performHardDrop(): void {
        if (!this.canManipulatePiece || !this.currentTetromino) return;
        const wasRotation = this.lastAction === 'rotate'; // Store rotation status
        let newY = this.currentTetromino.y;
        while (!this.checkCollision(this.currentTetromino.x, newY + 1, this.currentTetromino.shape)) {
            newY++;
        }
        this.currentTetromino.y = newY;
        this.lastAction = wasRotation ? 'rotate' : 'hard_drop'; // Preserve rotation status if it was a rotation
        this.lockTetromino(); 
    }

    private updateFallTimerDelay(newDelay: number): void {
        if (this.fallTimer) this.fallTimer.remove(false);
        this.fallTimer = this.time.addEvent({
            delay: newDelay > 0 ? newDelay : 500,
            callback: this.moveBlockDownRegularFall,
            callbackScope: this,
            loop: true
        });
        if (this.scene.isPaused()) {
             if (this.fallTimer) this.fallTimer.paused = true;
        }
    }

    private shuffleArray<T>(array: T[]): T[] {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    private fillCurrentBag(): void {
        this.currentBag = [...TETROMINO_KEYS];
        this.shuffleArray(this.currentBag);
    }

    private checkCollision(pivotBoardX: number, pivotBoardY: number, shape: number[][], pieceTypeKey?: keyof typeof TETROMINOES): boolean {
        if (!shape) return true; 

        const typeKeyToCheck = pieceTypeKey || this.currentTetromino?.typeKey;
        const pivot = typeKeyToCheck ? TETROMINOES[typeKeyToCheck].pivot : {r:0, c:0}; 

        for (let r_shape = 0; r_shape < shape.length; r_shape++) {
            for (let c_shape = 0; c_shape < shape[r_shape].length; c_shape++) {
                if (shape[r_shape][c_shape]) {
                    const boardX = pivotBoardX + (c_shape - pivot.c);
                    const boardY = pivotBoardY + (r_shape - pivot.r);

                    if (boardX < 0 || boardX >= BOARD_WIDTH_BLOCKS) {
                        return true; 
                    }

                    // Check bottom bound against LOGICAL board height
                    if (boardY >= LOGICAL_BOARD_HEIGHT_BLOCKS) {
                        return true; 
                    }

                    // Check collision with existing blocks ON THE LOGICAL BOARD (including buffer)
                    // Blocks can exist above visible area (boardY < BUFFER_ZONE_HEIGHT)
                    if (boardY >= 0) { // Only check if the block is on or below logical row 0
                        if (this.board[boardY] && this.board[boardY][boardX] !== null) {
                            return true; 
                        }
                    }
                    // If boardY < 0, the block is above the logical board. This is allowed (no collision).
                }
            }
        }
        return false; 
    }

    private resetGame(): void {
        console.log("Resetting game...");
        this.initBoard();
        this.score = 0;
        if (this.scoreText) {
            this.scoreText.setText('Score: 0');
        }
        this.heldTetromino = null;
        this.canHold = true;
        this.currentTetromino = null;
        this.canManipulatePiece = false;
        this.comboCount = 0;
        this.backToBackActive = false;
        this.backToBackCount = 0;
        if (this.comboText) this.comboText.setVisible(false);
        if (this.backToBackText) this.backToBackText.setVisible(false);
        if (this.actualComboText) this.actualComboText.setVisible(false);

        if (this.gameOverText) { 
            this.gameOverText.destroy(); 
            this.gameOverText = null;
        }
        if (this.gameOverOverlay) {
            this.gameOverOverlay.destroy();
            this.gameOverOverlay = null;
        }

        this.isPieceLanded = false;
        this.cancelLockDelayTimer();
        this.resetLockResetsCount();

        if (this.graphics) {
            this.graphics.clear();
        }

        this.fillCurrentBag();    
        this.fillNextQueue();     
        this.spawnNewTetromino(); 

        if (this.fallTimer) {
            this.fallTimer.remove();
        }
        this.fallTimer = this.time.addEvent({
            delay: 500, 
            callback: this.moveBlockDownRegularFall,
            callbackScope: this,
            loop: true
        });

        this.drawGame(); 
    }

    private startLockDelayTimer(): void {
        this.cancelLockDelayTimer(); 
        if (this.currentTetromino) { 
            this.lockDelayTimer = this.time.delayedCall(this.lockDelayDuration, this.onLockDelayEnd, [], this);
        }
    }

    private cancelLockDelayTimer(): void {
        if (this.lockDelayTimer) {
            this.lockDelayTimer.remove(false); 
            this.lockDelayTimer = null;
        }
    }

    private onLockDelayEnd(): void {
        this.lockDelayTimer = null; 
        if (this.currentTetromino && this.isPieceLanded) {
            if (this.checkCollision(this.currentTetromino.x, this.currentTetromino.y + 1, this.currentTetromino.shape)) {
                this.lockTetromino();
            } else {
                this.isPieceLanded = false;
                this.resetLockResetsCount();
            }
        } else {
            // Conditions not met for lock.
        }
    }

    private resetLockResetsCount(): void {
        this.lockResetsCount = 0;
    }

    // New helper for logic after a successful horizontal move or rotation
    private handlePostSuccessfulMoveRotation(): void {
        if (!this.canManipulatePiece || !this.currentTetromino) return;

        if (this.checkCollision(this.currentTetromino.x, this.currentTetromino.y + 1, this.currentTetromino.shape)) {
            // Piece is still (or now) landed on a surface
            this.isPieceLanded = true;
            this.lockResetsCount++; // Count this successful move/rotation as a reset used

            if (this.lockResetsCount > this.maxLockResets) { // Use > now since we increment before check
                this.lockTetromino(); // Force lock if resets exhausted by this move/rotation
            } else {
                this.startLockDelayTimer(); // Reset lock delay timer
            }
        } else {
            // Piece is now airborne (e.g., slid off an edge)
            this.isPieceLanded = false;
            this.cancelLockDelayTimer();
            this.resetLockResetsCount(); // It's a new situation, reset count
        }
    }

    // This is the game over condition within spawnNewTetromino
    private handleSpawnCollision(): void {
        console.log("GAME OVER - Block Out (cannot spawn new block due to collision on board)");
        if (this.fallTimer) this.fallTimer.remove();
        
        this.currentTetromino = null;
        this.canManipulatePiece = false; 
        this.isPieceLanded = false; 
        this.cancelLockDelayTimer();
        this.resetLockResetsCount();
        
        this.drawGame();

        if (this.gameOverText) { this.gameOverText.destroy(); }
        if (this.gameOverOverlay) { this.gameOverOverlay.destroy(); }

        // Add translucent background
        const gameWidth = this.cameras.main.width;
        const gameHeight = this.cameras.main.height;
        this.gameOverOverlay = this.add.graphics();
        this.gameOverOverlay.fillStyle(0x000000, 0.7);
        this.gameOverOverlay.fillRect(0, 0, gameWidth, gameHeight);

        this.gameOverText = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 'GAME OVER\nFinal Score: ' + this.score, 
            { font: '48px Arial', color: '#ffffff', align: 'center' }).setOrigin(0.5);
    }
}

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: NEXT_AREA_OFFSET_X + NEXT_AREA_WIDTH + UI_SIDE_MARGIN, 
    height: UI_ELEMENTS_TOP_Y + (VISIBLE_BOARD_HEIGHT_BLOCKS * BLOCK_SIZE) + BLOCK_SIZE, // Canvas height based on visible board
    parent: 'game-container',
    scene: [GameScene, SettingsScene], 
    render: {
        pixelArt: true, 
        antialias: false, 
    },
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    }
};

window.onload = () => {
    const game = new Phaser.Game(config);
}; 