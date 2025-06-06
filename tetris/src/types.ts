// Define GameSettings interface and default values
export interface GameSettings {
    ghostPieceEnabled: boolean;
    gravityValue: number;
    arr: number;
    das: number;
    dcd: number;
    sdf: number;
    nextQueueSize: number;
    masterVolume: number;
    sfxVolume: number;
    musicVolume: number;
    keybinds: {
        moveLeft: string[];
        moveRight: string[];
        rotateCW: string[];
        rotateCCW: string[];
        softDrop: string[];
        hardDrop: string[];
        holdPiece: string[];
        rotate180: string[];
        resetGame: string[];
    };
}

export interface TetrominoState {
    shape: number[][];
    x: number;
    y: number;
    color: number;
    rotation: number;
    typeKey: keyof typeof import('../src/constants').TETROMINOES;
}

export interface HeldTetrominoState {
    typeKey: keyof typeof import('../src/constants').TETROMINOES;
}

export const DEFAULT_SETTINGS: GameSettings = {
    ghostPieceEnabled: true,
    gravityValue: 500,
    arr: 16,
    das: 133,
    dcd: 0,
    sdf: Infinity,
    nextQueueSize: 5,
    masterVolume: 0.7,
    sfxVolume: 0.8,
    musicVolume: 0.6,
    keybinds: {
        moveLeft: ['ArrowLeft', 'KeyA'],
        moveRight: ['ArrowRight', 'KeyD'],
        rotateCW: ['KeyX', 'Quote'],
        rotateCCW: ['KeyZ', 'Semicolon'],
        softDrop: ['ArrowDown', 'KeyS'],
        hardDrop: ['ArrowUp', 'KeyW'],
        holdPiece: ['KeyC', 'Space'],
        rotate180: ['ShiftLeft', 'Enter'],
        resetGame: ['KeyR', '-']
    }
}; 