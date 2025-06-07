import * as Phaser from 'phaser';
import { GameScene } from '../../scenes/GameScene';
import { GameSettings, DEFAULT_SETTINGS } from '../../types';

export class InputHandler {
    private scene: GameScene;
    private input: Phaser.Input.InputPlugin;

    private arr!: number;
    private das!: number;
    private dcd!: number;
    private sdf!: number;
    private gravityValue!: number;

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

    private moveDelay: number = 70;

    constructor(scene: GameScene) {
        this.scene = scene;
        this.input = scene.input;
        this.updateSettings();
        this.updateKeybindings();
    }

    public updateSettings(): void {
        const currentSettings: GameSettings = this.scene.registry.get('gameSettings');
        this.arr = currentSettings.arr;
        this.das = currentSettings.das;
        this.dcd = currentSettings.dcd;
        this.sdf = currentSettings.sdf;
        this.gravityValue = currentSettings.gravityValue;
    }

    public updateKeybindings(): void {
        const settings: GameSettings = this.scene.registry.get('gameSettings') || DEFAULT_SETTINGS;
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
                    if (eventCode.startsWith('Key') && eventCode.length > 3) {
                        keyStringToRegister = eventCode.substring(3);
                    } else if (eventCode.startsWith('Arrow')) {
                        keyStringToRegister = eventCode.substring(5).toUpperCase();
                    } else if (eventCode === 'Quote') {
                        keyStringToRegister = 'QUOTES';
                    } else if (eventCode === 'Semicolon') {
                        keyStringToRegister = 'SEMICOLON';
                    } else if (eventCode === 'Space') {
                        keyStringToRegister = 'SPACE';
                    }

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
                    }
                });
            }
        }
    }

    public update(time: number, delta: number): void {
        if (this.actionKeyObjects.resetGame) {
            for (const keyObj of this.actionKeyObjects.resetGame) {
                if (keyObj && Phaser.Input.Keyboard.JustDown(keyObj)) {
                    this.scene.resetGame();
                    return;
                }
            }
        }

        const isDownPressed = this.actionKeyObjects.softDrop?.some(k => k.isDown) ?? false;
        this.scene.gameState.isSoftDropping = isDownPressed;

        if (this.scene.gameState.gameOver || !this.scene.gameState.canManipulatePiece || !this.scene.gameState.currentTetromino || !this.input?.keyboard) return;

        // Handle single-press actions, including SDF=Infinity
        if (this.actionKeyObjects.softDrop?.some(k => Phaser.Input.Keyboard.JustDown(k))) {
            if (this.sdf === Infinity) {
                this.scene.gameLogic.moveToBottom();
            }
        }

        for (const action of this.singlePressActions) {
            let actionTriggered = false;
            if (this.actionKeyObjects[action]) {
                for (const keyObj of this.actionKeyObjects[action]) {
                    if (keyObj && Phaser.Input.Keyboard.JustDown(keyObj)) {
                        actionTriggered = true;
                        break;
                    }
                }
            }
            if (actionTriggered) {
                switch (action) {
                    case 'rotateCW': this.scene.gameLogic.rotate(true); break;
                    case 'rotateCCW': this.scene.gameLogic.rotate(false); break;
                    case 'rotate180': this.scene.gameLogic.rotate180(); break;
                    case 'hardDrop': this.scene.gameLogic.performHardDrop(); break;
                    case 'holdPiece': this.scene.gameLogic.performHold(); break;
                }
            }
        }

        let isLeftPressed = this.actionKeyObjects.moveLeft?.some(k => k.isDown) ?? false;
        let isRightPressed = this.actionKeyObjects.moveRight?.some(k => k.isDown) ?? false;
        
        if (isDownPressed) {
            if (this.sdf > 0 && this.sdf !== Infinity) {
                const softDropDelay = this.gravityValue / this.sdf;
                if (time - this.lastSoftDropTime > softDropDelay) {
                    this.scene.gameLogic.moveBlockDown(true);
                    this.lastSoftDropTime = time;
                }
            }
        }

        // Standard JavaScript engine handling for continuous movement
        if (isRightPressed) {
            if (!this.isDasActiveRight && this.dasTimerRight === 0) {
                this.scene.gameLogic.moveBlockRight();
                this.lastHorizontalMoveTime = time;
                this.dasTimerRight += delta;
            } else {
                this.dasTimerRight += delta;
                if (!this.isDasActiveRight && this.dasTimerRight >= this.das) {
                    this.isDasActiveRight = true;
                    this.arrTimer = 0;
                    if (this.arr === 0) {
                        this.scene.gameLogic.moveAllTheWayRight();
                    }
                }

                if (this.isDasActiveRight) {
                    this.arrTimer += delta;
                    if (this.arr > 0 && this.arrTimer >= this.arr) {
                        this.scene.gameLogic.moveBlockRight();
                        this.arrTimer = 0;
                    }
                }
            }
            if (this.isDasActiveLeft) {
                this.isDasActiveLeft = false;
                this.dasTimerLeft = 0;
            }
        } else {
            this.isDasActiveRight = false;
            this.dasTimerRight = 0;
        }

        if (isLeftPressed) {
            if (!this.isDasActiveLeft && this.dasTimerLeft === 0) {
                this.scene.gameLogic.moveBlockLeft();
                this.lastHorizontalMoveTime = time;
                this.dasTimerLeft += delta;
            } else {
                this.dasTimerLeft += delta;
                if (!this.isDasActiveLeft && this.dasTimerLeft >= this.das) {
                    this.isDasActiveLeft = true;
                    this.arrTimer = 0;
                    if (this.arr === 0) {
                        this.scene.gameLogic.moveAllTheWayLeft();
                    }
                }

                if (this.isDasActiveLeft) {
                    this.arrTimer += delta;
                    if (this.arr > 0 && this.arrTimer >= this.arr) {
                        this.scene.gameLogic.moveBlockLeft();
                        this.arrTimer = 0;
                    }
                }
            }
            if (this.isDasActiveRight) {
                this.isDasActiveRight = false;
                this.dasTimerRight = 0;
            }
        } else {
            this.isDasActiveLeft = false;
            this.dasTimerLeft = 0;
        }
    }
} 