export const BLOCK_SIZE = 30;
export const BOARD_WIDTH_BLOCKS = 10;
export const VISIBLE_BOARD_HEIGHT_BLOCKS = 20;
export const BUFFER_ZONE_HEIGHT = 20; // As per Tetris Guideline
export const LOGICAL_BOARD_HEIGHT_BLOCKS = VISIBLE_BOARD_HEIGHT_BLOCKS + BUFFER_ZONE_HEIGHT; // Total 40 rows

// --- Layout: Hold (Left) - Board (Center) - Next (Right) ---
export const UI_SIDE_MARGIN = BLOCK_SIZE * 1.5;         // Margin on the far left and far right
export const GAP_BETWEEN_AREAS = BLOCK_SIZE * 1.5;    // Horizontal gap between Hold/Board and Board/Next

export const UI_ELEMENTS_TOP_Y = BLOCK_SIZE * 2;  // Y-coordinate for the top of UI content boxes (Hold, Next, Board)
export const TEXT_LABEL_OFFSET_Y = -BLOCK_SIZE * 0.8; // Offset for text labels (Hold/Next/Score) above their content/reference point

// Hold Area (Left of Board)
export const HOLD_AREA_WIDTH = BLOCK_SIZE * 4;
export const HOLD_BOX_OFFSET_X = UI_SIDE_MARGIN;
export const HOLD_TEXT_LABEL_Y = UI_ELEMENTS_TOP_Y + TEXT_LABEL_OFFSET_Y;
export const HOLD_BOX_CONTENT_START_Y = UI_ELEMENTS_TOP_Y;

// Board Area (Center)
export const BOARD_OFFSET_X = HOLD_BOX_OFFSET_X + HOLD_AREA_WIDTH + GAP_BETWEEN_AREAS;
export const BOARD_OFFSET_Y = UI_ELEMENTS_TOP_Y; 

// Next Area (Right of Board)
export const NEXT_AREA_WIDTH = BLOCK_SIZE * 4;
export const NEXT_AREA_OFFSET_X = BOARD_OFFSET_X + (BOARD_WIDTH_BLOCKS * BLOCK_SIZE) + GAP_BETWEEN_AREAS;
export const NEXT_TEXT_LABEL_Y = UI_ELEMENTS_TOP_Y + TEXT_LABEL_OFFSET_Y; // Vertically aligned with Hold text
export const NEXT_QUEUE_CONTENT_START_Y = UI_ELEMENTS_TOP_Y; // Content starts at same Y as Hold content & Board

export const PREVIEW_SLOT_HEIGHT = BLOCK_SIZE * 3; 
// --- End Layout Constants ---

// Calculated logical dimensions for the game content (for stacked left layout)
// The previous LOGICAL_GAME_WIDTH calculation was unusual for this layout.
// Standard width for this layout: Board starts after UI column, extends, then a margin.
export const LOGICAL_GAME_WIDTH = BOARD_OFFSET_X + (BOARD_WIDTH_BLOCKS * BLOCK_SIZE) + UI_SIDE_MARGIN; // Adjusted for clarity
export const LOGICAL_GAME_HEIGHT = BOARD_OFFSET_Y + (VISIBLE_BOARD_HEIGHT_BLOCKS * BLOCK_SIZE) + (BLOCK_SIZE * 3); // More bottom margin


// SRS Wall Kick Data
// (x, y) offsets: +x is right, +y is UP (will need to adjust for board's y-down)
// Rotation states: 0: spawn, 1: R (CW), 2: 180, 3: L (CCW)

export const KICK_DATA_JLSTZ = {
    "0->1": [[0, 0], [-1, 0], [-1, +1], [0, -2], [-1, -2]],
    "1->0": [[0, 0], [+1, 0], [+1, -1], [0, +2], [+1, +2]],
    "1->2": [[0, 0], [+1, 0], [+1, -1], [0, +2], [+1, +2]],
    "2->1": [[0, 0], [-1, 0], [-1, +1], [0, -2], [-1, -2]],
    "2->3": [[0, 0], [+1, 0], [+1, +1], [0, -2], [+1, -2]],
    "3->2": [[0, 0], [-1, 0], [-1, -1], [0, +2], [-1, +2]],
    "3->0": [[0, 0], [-1, 0], [-1, -1], [0, +2], [-1, +2]],
    "0->3": [[0, 0], [+1, 0], [+1, +1], [0, -2], [+1, -2]],
};

export const KICK_DATA_I = {
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
        pivot: { r: 1, c: 1 }, // Using a 3x3 box for consistent spawn centering
        shapes: [
            [ // O-piece has only one state, padded to 3x3
                [0,0,0],
                [0,1,1],
                [0,1,1]
            ]
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
export const TETROMINO_KEYS = Object.keys(TETROMINOES) as (keyof typeof TETROMINOES)[]; 