// Re-export types from the main types.ts file
// This allows modules to import from '../types' without path issues
import {
    TetrominoState,
    HeldTetrominoState,
    GameSettings,
    DEFAULT_SETTINGS,
    // Include other types as needed
} from '../types';

export {
    TetrominoState,
    HeldTetrominoState,
    GameSettings,
    DEFAULT_SETTINGS,
    // Include other types as needed
}; 