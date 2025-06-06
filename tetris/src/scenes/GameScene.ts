import * as Phaser from 'phaser';
import { SettingsScene } from './SettingsScene';
import { GameSettings, DEFAULT_SETTINGS } from '../types';
import { GameState } from '../modules/state/GameState';
import { InputHandler } from '../modules/input/InputHandler';
import { GameRenderer } from '../modules/rendering/GameRenderer';
import { GameLogic } from '../modules/logic/GameLogic';
import { WasmEngine } from '../modules/wasm/WasmEngine';
import {
    BLOCK_SIZE,
} from '../constants';


export class GameScene extends Phaser.Scene {
    public gameState: GameState;
    private fallTimer: Phaser.Time.TimerEvent | null = null;
    private inputHandler!: InputHandler;
    public gameRenderer!: GameRenderer;
    public gameLogic!: GameLogic;
    private wasmEngine!: WasmEngine;
    public isWasmActive: boolean = false;
    private wasmToggleButton: HTMLButtonElement | null = null;

    private lockDelayTimer: Phaser.Time.TimerEvent | null = null;
    private lockDelayDuration: number = 500;

    constructor() {
        super({ key: 'GameScene' });
        this.gameState = new GameState();
    }

    preload(): void {}

    create(): void {
        if (!this.registry.has('gameSettings')) {
            this.registry.set('gameSettings', { ...DEFAULT_SETTINGS });
        }
        const currentSettings: GameSettings = this.registry.get('gameSettings');
        
        this.inputHandler = new InputHandler(this);
        this.gameRenderer = new GameRenderer(this);
        this.gameLogic = new GameLogic(this, this.gameState, this.gameRenderer);
        
        // Initialize the WASM engine
        this.wasmEngine = new WasmEngine(this);
        this.wasmEngine.initialize().then(success => {
            if (success) {
                this.setupWasmToggleButton();
                console.log('WASM engine initialized successfully!');
            } else {
                console.warn('WASM engine initialization failed. WASM features will be disabled.');
            }
        }).catch(error => {
            console.error('Error initializing WASM engine:', error);
        });

        this.updateFallTimerDelay(currentSettings.gravityValue);

        console.log("Creating Tetris game objects...");

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
            this.updateFallTimerDelay(updatedSettings.gravityValue);
            this.inputHandler.updateSettings();
            this.inputHandler.updateKeybindings();
            if (this.fallTimer) this.fallTimer.paused = false;
        });

        if (!this.input.keyboard) {
            console.warn("Keyboard input not available.");
        }

        this.resetGame();
    }

    update(time: number, delta: number): void {
        if (this.isWasmActive) {
            this.wasmEngine.update(time, delta);
        } else {
            this.inputHandler.update(time, delta);
        }
    }

    private moveBlockDownRegularFall(): void { 
        if (this.gameState.isSoftDropping) return;
        this.gameLogic.moveBlockDown(false);
    }

    public resetGame(): void {
        this.gameState.reset();
        this.gameRenderer.updateScore(0);
        this.gameRenderer.hideComboTexts();
        this.gameRenderer.clearGameOver();

        this.cancelLockDelayTimer();

        // Use the JavaScript engine to initialize the game
        this.gameLogic.fillNextQueue();
        this.gameLogic.spawnNewTetromino();

        if (this.fallTimer) {
            this.fallTimer.remove();
        }
        const currentSettings: GameSettings = this.registry.get('gameSettings');
        this.updateFallTimerDelay(currentSettings.gravityValue);
        this.gameRenderer.drawGame();
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

    public startLockDelayTimer(): void {
        this.cancelLockDelayTimer();
        if (this.gameState.currentTetromino) {
            this.lockDelayTimer = this.time.delayedCall(this.lockDelayDuration, this.onLockDelayEnd, [], this);
        }
    }

    public cancelLockDelayTimer(): void {
        if (this.lockDelayTimer) {
            this.lockDelayTimer.remove(false);
            this.lockDelayTimer = null;
        }
    }

    private onLockDelayEnd(): void {
        this.lockDelayTimer = null;
        if (this.gameState.currentTetromino && this.gameState.isPieceLanded) {
            if (this.gameLogic.physics.checkCollision(this.gameState.currentTetromino.x, this.gameState.currentTetromino.y + 1, this.gameState.currentTetromino.shape)) {
                this.gameLogic.lockTetromino();
            } else {
                this.gameState.isPieceLanded = false;
                this.gameState.lockResetsCount = 0;
            }
        }
    }
    
    public endFallTimer(): void {
        if (this.fallTimer) this.fallTimer.remove();
    }

    private setupWasmToggleButton(): void {
        // Find the existing HTML button
        this.wasmToggleButton = document.getElementById('wasmToggleBtn') as HTMLButtonElement;
        
        if (!this.wasmToggleButton) {
            console.error('Could not find WASM toggle button in HTML');
            return;
        }
        
        // Add event listener to the button
        this.wasmToggleButton.addEventListener('click', () => {
            this.toggleWasmEngine();
        });
    }

    private toggleWasmEngine(): void {
        if (!this.wasmEngine) {
            console.error('WASM engine not initialized');
            return;
        }
        
        this.isWasmActive = !this.isWasmActive;
        console.log(`WASM engine is now ${this.isWasmActive ? 'active' : 'inactive'}`);
        if (this.wasmToggleButton) {
            this.wasmToggleButton.textContent = this.isWasmActive ? 'Play JS Engine' : 'Play WASM Engine';
        }

        if (this.isWasmActive) {
            this.wasmEngine.activate();
        } else {
            this.wasmEngine.deactivate();
        }
    }
}