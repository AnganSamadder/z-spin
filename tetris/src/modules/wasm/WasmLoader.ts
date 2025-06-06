/**
 * WASM module loader for the Tetris game
 * Handles loading and initializing the Rust WASM module
 */

// Define the interface for the WASM Tetris Engine
export interface WasmTetrisEngine {
  reset(): void;
  move_left(): boolean;
  move_right(): boolean;
  move_down(): boolean;
  rotate(): boolean;
  spawn_tetromino(typeKey: number): boolean;
  get_game_state_json(): string;
  get_best_move(board: number[], current_piece: number, next_piece: number): string;
}

// Fallback implementation when WASM isn't available
class WasmTetrisEngineWrapper implements WasmTetrisEngine {
  private score = 0;
  private gameOver = false;
  private moveIndex = 0;
  private readonly moveQueue: string[] = [
    // Sequence for 1st piece
    'rotate',
    'move_right',
    'move_right',
    'move_down',
    'move_down',
    'hard_drop',
    // Sequence for 2nd piece
    'rotate',
    'move_left',
    'move_left',
    'hard_drop',
    // Sequence for 3rd piece
    'rotate',
    'rotate',
    'hard_drop',
    // Spam hard_drop to top out
    'hard_drop',
    'hard_drop',
    'hard_drop',
    'hard_drop',
    'hard_drop',
  ];
  
  constructor() {
    console.log('WasmTetrisEngineWrapper constructor called');
  }
  
  reset(): void {
    console.log('WasmTetrisEngineWrapper.reset() called');
    this.score = 0;
    this.gameOver = false;
  }
  
  move_left(): boolean {
    console.log('WasmTetrisEngineWrapper.move_left() called');
    return true;
  }
  
  move_right(): boolean {
    console.log('WasmTetrisEngineWrapper.move_right() called');
    return true;
  }
  
  move_down(): boolean {
    console.log('WasmTetrisEngineWrapper.move_down() called');
    this.score += 1;
    return true;
  }
  
  rotate(): boolean {
    console.log('WasmTetrisEngineWrapper.rotate() called');
    return true;
  }
  
  spawn_tetromino(typeKey: number): boolean {
    console.log('WasmTetrisEngineWrapper.spawn_tetromino() called with', typeKey);
    return true;
  }
  
  get_game_state_json(): string {
    const state = { 
      score: this.score, 
      gameOver: this.gameOver 
    };
    console.log('WasmTetrisEngineWrapper.get_game_state_json() called', state);
    return JSON.stringify(state);
  }

  get_best_move(board: number[], current_piece: number, next_piece: number): string {
    if (this.moveIndex < this.moveQueue.length) {
      const move = this.moveQueue[this.moveIndex];
      this.moveIndex++;
      console.log(`[WASM WRAPPER] Executing move ${this.moveIndex}: ${move}`);
      return move;
    }
    console.log('[WASM WRAPPER] Move queue empty.');
    return ''; // Return empty string for no-op
  }
}

class WasmLoader {
  private static instance: WasmLoader;
  private wasmInitPromise: Promise<any> | null = null;
  private wasmModule: any = null;
  private isLoading = false;
  private engineClass: any = null;

  // Map TypeScript tetromino type keys to numeric values for WASM
  public static readonly TETROMINO_TYPE_MAP: { [key: string]: number } = {
    'I': 0,
    'O': 1,
    'T': 2, 
    'S': 3,
    'Z': 4,
    'J': 5,
    'L': 6
  };

  private constructor() {}

  public static getInstance(): WasmLoader {
    if (!WasmLoader.instance) {
      WasmLoader.instance = new WasmLoader();
    }
    return WasmLoader.instance;
  }

  private log(message: string, data?: any): void {
    console.log(`[WASM] ${message}`, data !== undefined ? data : '');
  }

  public async loadWasmModule(): Promise<void> {
    this.log('Starting loadWasmModule');

    if (this.wasmModule && this.engineClass) {
      this.log('Already loaded');
      return Promise.resolve();
    }

    if (this.isLoading) {
      this.log('Currently loading, waiting for existing promise');
      return this.wasmInitPromise as Promise<void>;
    }

    try {
      this.isLoading = true;
      
      // Dynamically load the WASM module from the server
      this.log('Loading WASM module');
      
      // First check if the WASM binary is accessible
      const wasmBinaryResponse = await fetch('/static/z_spin_engine_bg.wasm');
      if (!wasmBinaryResponse.ok) {
        throw new Error(`Failed to fetch WASM binary: ${wasmBinaryResponse.status} ${wasmBinaryResponse.statusText}`);
      }
      
      // Now load the JS module
      const jsModuleResponse = await fetch('/static/z_spin_engine.js');
      if (!jsModuleResponse.ok) {
        throw new Error(`Failed to fetch JS module: ${jsModuleResponse.status} ${jsModuleResponse.statusText}`);
      }
      
      const jsModuleText = await jsModuleResponse.text();
      
      // Create a blob URL for the JS module
      const blob = new Blob([jsModuleText], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      
      // Import the module
      const wasmModule = await import(/* @vite-ignore */ blobUrl);
      
      // Clean up the blob URL
      URL.revokeObjectURL(blobUrl);
      
      this.log('Module imported', { 
        keys: Object.keys(wasmModule),
        hasDefault: !!wasmModule.default
      });
      
      // Initialize the WASM module
      this.log('Initializing WASM module');
      this.wasmInitPromise = wasmModule.default('/static/z_spin_engine_bg.wasm');
      const initialized = await this.wasmInitPromise;
      
      this.log('WASM module initialized', {
        memory: !!initialized?.memory,
        exports: !!initialized?.__wbindgen_start
      });
      
      // Store the module for future use
      this.wasmModule = wasmModule;
      
      // Check if WasmTetrisEngine is available in the module
      try {
        if (this.wasmModule.WasmTetrisEngine) {
          this.log('Found WasmTetrisEngine class in module');
          this.engineClass = this.wasmModule.WasmTetrisEngine;
        } else {
          this.log('WasmTetrisEngine not found, using wrapper');
          this.engineClass = WasmTetrisEngineWrapper;
        }
      } catch (error) {
        this.log('Error accessing WasmTetrisEngine, using wrapper', error);
        this.engineClass = WasmTetrisEngineWrapper;
      }
      
      this.log('WASM module loaded successfully', {
        engineClass: this.engineClass ? this.engineClass.name || 'Anonymous' : 'None'
      });
      
      this.isLoading = false;
      return;
    } catch (error) {
      this.log('Failed to load WASM module', error);
      this.isLoading = false;
      throw error;
    }
  }

  public createEngine(): WasmTetrisEngine | null {
    this.log('Creating engine');
    
    if (!this.engineClass) {
      console.error('Engine class not available. Call loadWasmModule() first.');
      return null;
    }
    
    try {
      const engine = new this.engineClass();
      this.log('Engine created successfully');
      return engine;
    } catch (error) {
      this.log('Error creating engine', error);
      return null;
    }
  }

  public isLoaded(): boolean {
    return this.wasmModule !== null && this.engineClass !== null;
  }
}

export default WasmLoader; 