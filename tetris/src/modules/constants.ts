// Re-export constants from the main constants.ts file
// This allows modules to import from '../constants' without path issues
import {
    TETROMINOES,
    TETROMINO_KEYS,
    BOARD_WIDTH_BLOCKS,
    LOGICAL_BOARD_HEIGHT_BLOCKS,
    BUFFER_ZONE_HEIGHT,
    // Include other constants as needed
} from '../constants';

export {
    TETROMINOES,
    TETROMINO_KEYS,
    BOARD_WIDTH_BLOCKS,
    LOGICAL_BOARD_HEIGHT_BLOCKS,
    BUFFER_ZONE_HEIGHT,
    // Include other constants as needed
}; 