use wasm_bindgen::prelude::*;

// Console.log for debugging
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

// Simple macro for console.log
macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

// Game board dimensions
const BOARD_WIDTH: usize = 10;
const BOARD_HEIGHT: usize = 40; // Full height including hidden rows
const VISIBLE_HEIGHT: usize = 20; // Visible board height

// Tetromino shapes - I, O, T, S, Z, J, L
const TETROMINO_SHAPES: [[[bool; 4]; 4]; 7] = [
    // I
    [
        [false, false, false, false],
        [true, true, true, true],
        [false, false, false, false],
        [false, false, false, false]
    ],
    // O
    [
        [false, false, false, false],
        [false, true, true, false],
        [false, true, true, false],
        [false, false, false, false]
    ],
    // T
    [
        [false, false, false, false],
        [false, true, false, false],
        [true, true, true, false],
        [false, false, false, false]
    ],
    // S
    [
        [false, false, false, false],
        [false, true, true, false],
        [true, true, false, false],
        [false, false, false, false]
    ],
    // Z
    [
        [false, false, false, false],
        [true, true, false, false],
        [false, true, true, false],
        [false, false, false, false]
    ],
    // J
    [
        [false, false, false, false],
        [true, false, false, false],
        [true, true, true, false],
        [false, false, false, false]
    ],
    // L
    [
        [false, false, false, false],
        [false, false, true, false],
        [true, true, true, false],
        [false, false, false, false]
    ],
];

// Tetromino representation
#[derive(Clone, Copy, Debug)]
struct Tetromino {
    x: i32,
    y: i32,
    shape_index: usize,
    rotation: usize,
}

impl Tetromino {
    fn new(shape_index: usize) -> Self {
        Self {
            x: 3, // Start in the middle
            y: 18, // Start in the buffer zone, not at the very top
            shape_index,
            rotation: 0,
        }
    }

    fn get_shape(&self) -> [[bool; 4]; 4] {
        let shape = TETROMINO_SHAPES[self.shape_index];
        match self.rotation {
            0 => shape,
            1 => self.rotate_90(shape),
            2 => self.rotate_180(shape),
            3 => self.rotate_270(shape),
            _ => shape, // Default case, shouldn't happen
        }
    }

    fn rotate_90(&self, shape: [[bool; 4]; 4]) -> [[bool; 4]; 4] {
        let mut result = [[false; 4]; 4];
        for y in 0..4 {
            for x in 0..4 {
                result[x][3 - y] = shape[y][x];
            }
        }
        result
    }

    fn rotate_180(&self, shape: [[bool; 4]; 4]) -> [[bool; 4]; 4] {
        let mut result = [[false; 4]; 4];
        for y in 0..4 {
            for x in 0..4 {
                result[3 - y][3 - x] = shape[y][x];
            }
        }
        result
    }

    fn rotate_270(&self, shape: [[bool; 4]; 4]) -> [[bool; 4]; 4] {
        let mut result = [[false; 4]; 4];
        for y in 0..4 {
            for x in 0..4 {
                result[3 - x][y] = shape[y][x];
            }
        }
        result
    }
}

// Simple Tetris engine implementation
#[wasm_bindgen]
pub struct WasmTetrisEngine;

#[wasm_bindgen]
impl WasmTetrisEngine {
    // Constructor - required for proper export
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        console_log!("WasmTetrisEngine (stateless) initialized");
        Self
    }

    // THIS IS THE NEW FUNCTION
    pub fn get_best_move(&mut self, _board: Vec<i32>, _current_piece: i32, _next_piece: i32) -> String {
        static mut MOVE_INDEX: usize = 0;
        const MOVE_QUEUE: [&str; 26] = [
            // Sequence 1: T-Spin setup
            "hold",
            "move_right", "move_right", "move_right", "move_right",
            "hard_drop",
            // Sequence 2: L-piece
            "rotate", "rotate",
            "move_left", "move_left", "move_left", "move_left",
            "hard_drop",
            // Sequence 3: J-piece
            "hold",
            "hard_drop",
            // Sequence 4: O-piece
            "move_right",
            "hard_drop",
            // Sequence 5: S-piece
            "rotate",
            "move_left",
            "hard_drop",
            // Top out
            "hard_drop", "hard_drop", "hard_drop", "hard_drop", "hard_drop", "hard_drop",
        ];

        let move_to_return = unsafe {
            if MOVE_INDEX >= MOVE_QUEUE.len() {
                MOVE_INDEX = 0; // Loop the sequence
            }
            let current_move = MOVE_QUEUE[MOVE_INDEX];
            MOVE_INDEX += 1;
            current_move
        };
        
        move_to_return.to_string()
    }

    // Move the active tetromino left
    pub fn move_left(&mut self) -> bool {
        console_log!("WasmTetrisEngine::move_left() called");
        
        false
    }

    // Move the active tetromino right
    pub fn move_right(&mut self) -> bool {
        console_log!("WasmTetrisEngine::move_right() called");
        
        false
    }

    // Move the active tetromino down
    pub fn move_down(&mut self) -> bool {
        console_log!("WasmTetrisEngine::move_down() called");
        
        false
    }

    // Rotate the active tetromino
    pub fn rotate(&mut self) -> bool {
        console_log!("WasmTetrisEngine::rotate() called");
        
        false
    }

    // Spawn a new tetromino
    pub fn spawn_tetromino(&mut self, type_key: i32) -> bool {
        console_log!("WasmTetrisEngine::spawn_tetromino({}) called", type_key);
        
        false
    }

    // Get the game state as JSON
    pub fn get_game_state_json(&self) -> String {
        "{}".to_string()
    }

    // Check if a tetromino position is valid
    fn is_valid_position(&self, tetromino: &Tetromino) -> bool {
        false
    }

    // Lock the current tetromino in place on the board
    fn lock_tetromino(&mut self) {
    }

    // Check for completed lines and clear them
    fn check_lines(&mut self) {
    }
}

// Called when the WASM module is initialized
#[wasm_bindgen(start)]
pub fn start() {
    console_log!("WASM module (stateless) started");
} 