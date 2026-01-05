import * as Phaser from 'phaser';
// SettingsScene imported in game.ts; not directly referenced here
import { GameSettings, DEFAULT_SETTINGS, Strategy } from '../types';
import { GameState } from '../modules/state/GameState';
import { InputHandler } from '../modules/input/InputHandler';
import { GameRenderer } from '../modules/rendering/GameRenderer';
import { DebugPanel } from '../modules/rendering/DebugPanel';
import { GameLogic } from '../modules/logic/GameLogic';
import { WasmEngine } from '../modules/wasm/WasmEngine';
import WasmLoader from '../modules/wasm/WasmLoader';
import Logger from '../modules/utils/Logger';
import { DEFAULT_LOG_LEVEL, ALLOW_CONSOLE_LOGS_IN_DEBUG } from '../config';
import {
    BLOCK_SIZE,
} from '../constants';


export class GameScene extends Phaser.Scene {
    public gameState: GameState;
    private fallTimer: Phaser.Time.TimerEvent | null = null;
    private inputHandler!: InputHandler;
    public gameRenderer!: GameRenderer;
    public debugPanel!: DebugPanel;
    public gameLogic!: GameLogic;
    private wasmEngine!: WasmEngine;
    public isWasmActive: boolean = false;
    private wasmToggleButton: HTMLButtonElement | null = null;
    private wasmDebugButton: HTMLButtonElement | null = null;
    private debugModeButton: HTMLButtonElement | null = null;
    private isDebugModeOn: boolean = false;
    private suspendLockDelay: boolean = false;

    private lockDelayTimer: Phaser.Time.TimerEvent | null = null;
    private lockDelayDuration: number = 500;

    constructor() {
        super({ key: 'GameScene' });
        this.gameState = new GameState();
    }

    preload(): void {}

    create(): void {
        // Apply code-level default log level on startup
        Logger.applyConsoleLevel(DEFAULT_LOG_LEVEL);
        if (!this.registry.has('gameSettings')) {
            this.registry.set('gameSettings', { ...DEFAULT_SETTINGS });
        }
        const currentSettings: GameSettings = this.registry.get('gameSettings');

        this.inputHandler = new InputHandler(this);
        this.gameRenderer = new GameRenderer(this);
        this.debugPanel = new DebugPanel(this);
        this.debugPanel.init();
        this.gameLogic = new GameLogic(this, this.gameState, this.gameRenderer);

        // Initialize the WASM engine
        this.wasmEngine = new WasmEngine(this);
        const wasmLoader = WasmLoader.getInstance();
        wasmLoader.loadWasmModule().then(() => {
            this.wasmEngine.initialize(wasmLoader).then(success => {
                if (success) {
                    this.setupWasmToggleButton();
                    console.log('WASM engine initialized successfully!');
                } else {
                    console.warn('WASM engine initialization failed. WASM features will be disabled.');
                }
            }).catch(error => {
                console.error('Error initializing WASM engine:', error);
            });
        }).catch(error => {
            console.error('Error loading WASM module:', error);
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
        if (this.suspendLockDelay) {
            return;
        }
        // Check if we've exceeded the maximum lock resets - if so, lock immediately
        if (this.gameState.lockResetsCount >= this.gameState.maxLockResets) {
            console.log(`Max lock resets (${this.gameState.maxLockResets}) reached, locking immediately`);
            this.gameLogic.lockTetromino();
            return;
        }

        this.cancelLockDelayTimer();
        if (this.gameState.currentTetromino && this.gameState.isPieceLanded) {
            this.gameState.lockResetsCount++;
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
        if (this.suspendLockDelay) {
            // Ignore lock while suspended
            this.lockDelayTimer = null;
            return;
        }
        this.lockDelayTimer = null;
        if (this.gameState.currentTetromino && this.gameState.isPieceLanded) {
            // Double-check the piece is still colliding downward (landed)
            if (this.gameLogic.physics.checkCollision(this.gameState.currentTetromino.x, this.gameState.currentTetromino.y + 1, this.gameState.currentTetromino.shape)) {
                this.gameLogic.lockTetromino();
            } else {
                // Piece is no longer landed, reset the land state
                this.gameState.isPieceLanded = false;
                this.gameState.lockResetsCount = 0;
            }
        }
    }

    public endFallTimer(): void {
        if (this.fallTimer) this.fallTimer.remove();
    }

    public isGravityPaused(): boolean {
        return !!(this.fallTimer && this.fallTimer.paused);
    }

    public pauseGravity(): void {
        if (this.fallTimer) this.fallTimer.paused = true;
    }

    public resumeGravity(): void {
        if (this.fallTimer) this.fallTimer.paused = false;
    }

    public setLockDelaySuspended(suspend: boolean): void {
        this.suspendLockDelay = suspend;
        if (suspend) {
            this.cancelLockDelayTimer();
        }
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

        // Setup debug button
        this.wasmDebugButton = document.getElementById('wasmDebugBtn') as HTMLButtonElement;

        if (!this.wasmDebugButton) {
            console.error('Could not find WASM debug button in HTML');
            return;
        }

        // Add event listener to the debug button
        this.wasmDebugButton.addEventListener('click', () => {
            this.debugNextMove();
        });

        // Setup debug mode toggle button
        this.debugModeButton = document.getElementById('debugModeBtn') as HTMLButtonElement;

        if (!this.debugModeButton) {
            console.error('Could not find debug mode button in HTML');
            return;
        }

        // Add event listener to the debug mode button
        this.debugModeButton.addEventListener('click', () => {
            this.toggleDebugMode();
        });

        this.updateDebugModeUI();
    }

    private toggleWasmEngine(): void {
        if (!this.wasmEngine) {
            console.error('WASM engine not initialized');
            return;
        }

        this.isWasmActive = !this.isWasmActive;
        this.gameState.isWasmMode = this.isWasmActive;

        console.log(`WASM engine is now ${this.isWasmActive ? 'active' : 'inactive'}`);
        if (this.wasmToggleButton) {
            this.wasmToggleButton.textContent = this.isWasmActive ? 'Play JS Engine' : 'Play WASM Engine';
        }

        if (this.isWasmActive) {
            this.wasmEngine.activate();
        } else {
            this.wasmEngine.deactivate();
        }

        console.log(`B2B state preserved: active=${this.gameState.backToBackActive}, count=${this.gameState.backToBackCount}`);
        console.log(`Combo state preserved: ${this.gameState.comboCount}`);
    }

    private debugNextMove(): void {
        if (!this.wasmEngine) {
            console.error('WASM engine not initialized');
            return;
        }

        if (!this.gameState.currentTetromino) {
            console.warn('No current tetromino to debug');
            return;
        }

        // Call the WASM engine to get the best move with detailed logging
        this.wasmEngine.getBestMoveDebug();
    }

    private toggleDebugMode(): void {
        this.isDebugModeOn = !this.isDebugModeOn;
        // Toggle console verbosity with debug mode
        if (this.isDebugModeOn && ALLOW_CONSOLE_LOGS_IN_DEBUG) {
            Logger.applyConsoleLevel('debug');
        } else {
            Logger.applyConsoleLevel(DEFAULT_LOG_LEVEL);
        }
        this.updateDebugModeUI();
    }

    private updateDebugModeUI(): void {
        const debugPanelRoot = document.getElementById('debugPanelRoot');

        if (!debugPanelRoot || !this.debugModeButton) return;

        if (this.isDebugModeOn) {
            // Show full debug panel
            this.debugModeButton.textContent = 'Debug: On';
            debugPanelRoot.style.display = 'block';
            this.debugPanel.init(); // Re-initialize with full UI
        } else {
            // Show simplified debug panel
            this.debugModeButton.textContent = 'Debug: Off';
            this.createSimpleDebugUI(debugPanelRoot);
        }
    }

    private createSimpleDebugUI(container: HTMLElement): void {
        container.innerHTML = '';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'stretch';
        container.style.gap = '12px';
        container.style.width = '100%';
        container.style.maxWidth = '100%';
        container.style.boxSizing = 'border-box';

        // Remove duplicate controls here; they already exist at the top bar.

        // Strategy selector (simple presets; live-switchable)
        const strategyWrapper = document.createElement('div');
        strategyWrapper.style.display = 'flex';
        strategyWrapper.style.flexDirection = 'column';
        strategyWrapper.style.alignItems = 'center';
        strategyWrapper.style.gap = '8px';

        const strategyTitle = document.createElement('div');
        strategyTitle.textContent = 'Strategy';
        strategyTitle.style.fontWeight = 'bold';
        strategyTitle.style.fontSize = '16px';
        strategyWrapper.appendChild(strategyTitle);

        const buttonsRow = document.createElement('div');
        buttonsRow.style.display = 'flex';
        buttonsRow.style.flexWrap = 'wrap';
        buttonsRow.style.gap = '8px';
        buttonsRow.style.justifyContent = 'center';
        buttonsRow.style.maxWidth = '100%';

        const strategies: Strategy[] = [
            Strategy.Balanced,
            Strategy.Aggressive,
            Strategy.Defensive,
            Strategy.NineZero,
            Strategy.Cheese,
        ];

        const currentSettings: GameSettings = this.registry.get('gameSettings') || { ...DEFAULT_SETTINGS };
        const current = currentSettings.aiStrategy;

        for (const s of strategies) {
            const btn = document.createElement('button');
            btn.textContent = (s === Strategy.NineZero ? '9-0' : s);
            btn.style.padding = '8px 14px';
            btn.style.fontSize = '14px';
            btn.style.cursor = 'pointer';
            btn.style.borderRadius = '16px';
            btn.style.border = '1px solid #555';
            btn.style.whiteSpace = 'nowrap';
            btn.style.flex = '0 1 auto';
            // Highlight selected strategy
            const isSelected = s === current;
            btn.style.backgroundColor = isSelected ? '#0a84ff' : '#333';
            btn.style.color = isSelected ? '#fff' : '#ddd';

            btn.addEventListener('click', () => {
                const settings: GameSettings = this.registry.get('gameSettings') || { ...DEFAULT_SETTINGS };
                settings.aiStrategy = s;
                this.registry.set('gameSettings', settings);
                // Re-render simple UI to reflect new selection immediately
                this.createSimpleDebugUI(container);
            });
            buttonsRow.appendChild(btn);
        }

        strategyWrapper.appendChild(buttonsRow);
        container.appendChild(strategyWrapper);

        // Add Cheese button
        const cheeseWrapper = document.createElement('div');
        cheeseWrapper.style.display = 'flex';
        cheeseWrapper.style.flexDirection = 'column';
        cheeseWrapper.style.alignItems = 'center';
        cheeseWrapper.style.gap = '8px';

        const cheeseButton = document.createElement('button');
        cheeseButton.textContent = 'Add Cheese (10 lines)';
        cheeseButton.style.padding = '8px 14px';
        cheeseButton.style.fontSize = '14px';
        cheeseButton.style.cursor = 'pointer';
        cheeseButton.style.borderRadius = '16px';
        cheeseButton.style.border = '1px solid #555';
        cheeseButton.style.backgroundColor = '#8B4513'; // Brown color for cheese
        cheeseButton.style.color = '#fff';
        cheeseButton.style.fontWeight = 'bold';

        cheeseButton.addEventListener('click', () => {
            this.gameState.addCheeseLines(10);
            this.gameRenderer.drawGame();
            console.log('🧀 Added 10 lines of cheese to the board!');
            
            // Visual feedback - briefly change button text
            const originalText = cheeseButton.textContent;
            cheeseButton.textContent = '🧀 Cheese Added!';
            cheeseButton.style.backgroundColor = '#32CD32'; // Green for success
            setTimeout(() => {
                cheeseButton.textContent = originalText;
                cheeseButton.style.backgroundColor = '#8B4513'; // Back to brown
            }, 1000);
        });

        cheeseWrapper.appendChild(cheeseButton);
        container.appendChild(cheeseWrapper);


        // Add Debug TST Scenario button
        const tstDebugWrapper = document.createElement('div');
        tstDebugWrapper.style.display = 'flex';
        tstDebugWrapper.style.flexDirection = 'column';
        tstDebugWrapper.style.alignItems = 'center';
        tstDebugWrapper.style.gap = '8px';

        const tstDebugButton = document.createElement('button');
        tstDebugButton.textContent = 'Debug TST Scenario';
        tstDebugButton.style.padding = '10px 20px';
        tstDebugButton.style.backgroundColor = '#4a148c';
        tstDebugButton.style.color = 'white';
        tstDebugButton.style.border = 'none';
        tstDebugButton.style.borderRadius = '5px';
        tstDebugButton.style.cursor = 'pointer';
        tstDebugButton.style.fontWeight = 'bold';

        tstDebugButton.addEventListener('click', () => {
            this.setupTstDebugScenario();
            console.log('🧪 TST debug scenario loaded! Press "Debug Next Move" to test.');
            
            // Visual feedback
            const originalText = tstDebugButton.textContent;
            tstDebugButton.textContent = '🧪 Scenario Loaded!';
            tstDebugButton.style.backgroundColor = '#32CD32';
            setTimeout(() => {
                tstDebugButton.textContent = originalText;
                tstDebugButton.style.backgroundColor = '#4A148C';
            }, 1000);
        });

        tstDebugWrapper.appendChild(tstDebugButton);
        container.appendChild(tstDebugWrapper);
    }

    /**
     * Sets up a deterministic board state for testing T-Spin Triple (TST) pathfinding.
     */
    private setupTstDebugScenario(): void {
        const state = this.gameState;
        const blockColor = 0x808080; // Gray blocks

        // Clear the board first
        state.resetBoard();

        // Create a T-Spin Triple (TST) structure based on user's setup
        // Target:
        // r10-r14: ██████····
        // r15:     ███████···
        // r16:     ██████····
        // r17:     ██████·███
        // r18:     ██████··██  <-- The "missing hole" at col 7
        // r19:     ██████·███
        
        const visibleStart = state.board.length - 20;

        // Rows 10-14 (Col 0-5 blocked)
        for (let y = 10; y <= 14; y++) {
            for (let x = 0; x <= 5; x++) {
                state.board[visibleStart + y][x] = blockColor;
            }
        }

        // Row 15: ███████··· (Col 0-6 blocked)
        for (let x = 0; x <= 6; x++) {
            state.board[visibleStart + 15][x] = blockColor;
        }

        // Row 16: ██████···· (Col 0-5 blocked)
        for (let x = 0; x <= 5; x++) {
            state.board[visibleStart + 16][x] = blockColor;
        }

        // Rows 17, 18, 19
        for (let y = 17; y <= 19; y++) {
            // Col 0-5 blocked
            for (let x = 0; x <= 5; x++) {
                state.board[visibleStart + y][x] = blockColor;
            }
            // Col 7-9 blocked (mostly)
            for (let x = 7; x <= 9; x++) {
                if (y === 18 && x === 7) continue; // The TST "hole"
                state.board[visibleStart + y][x] = blockColor;
            }
        }

        // Force spawn a T-piece as the current piece
        state.setCurrentBag(['T', 'I', 'O', 'S', 'Z', 'L', 'J']);
        state.nextTetrominoQueue = [{ typeKey: 'T' }];
        
        // Spawn the T-piece
        this.gameLogic.spawnNewTetromino();
        
        // Re-render the game
        this.gameRenderer.drawGame();

        console.log("🛠️ TST Debug Scenario Setup Refined");
        console.log('📋 EXPECTED: The T-piece should perform a T-Spin Triple in the gap at column 6.');
        console.log('📋 This requires specific SRS kicks to rotate under the overhang.');
        console.log('📋 Click "Debug Next Move" to see what the engine does!');
    }
}