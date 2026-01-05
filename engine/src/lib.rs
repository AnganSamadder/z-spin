extern crate console_error_panic_hook;
use wasm_bindgen::prelude::*;

pub mod board;
pub mod pieces;
pub mod search;
pub mod evaluation;
mod engine;

use engine::TetrisEngine;
use crate::evaluation::Strategy;
// Prune unused imports

// Console.log for debugging - WASM target
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

// Make log function available to modules - WASM target
#[cfg(target_arch = "wasm32")]
pub(crate) fn console_log_fn(msg: &str) {
    log(msg);
}

// Make log function print to stdout for non-WASM targets (CLI tools)
#[cfg(not(target_arch = "wasm32"))]
pub(crate) fn console_log_fn(msg: &str) {
    println!("{}", msg);
}

// Simple macro for console.log that uses our wrapper function
#[macro_export]
macro_rules! console_log {
    ($($t:tt)*) => (crate::console_log_fn(&format_args!($($t)*).to_string()))
}

// === WASM INTERFACE ===

#[wasm_bindgen]
pub struct WasmTetrisEngine {
    engine: TetrisEngine,
}

#[wasm_bindgen]
impl WasmTetrisEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        console_log!("Advanced Tetris AI Engine initialized");
        Self {
            engine: TetrisEngine::new(),
        }
    }

    #[wasm_bindgen(js_name = configureMovement)]
    pub fn configure_movement(&mut self, arr: u32, das: u32, sdf: u32, dcd: u32) {
        self.engine.configure_movement(arr, das, sdf, dcd);
    }

    #[wasm_bindgen(js_name = configureLogging)]
    pub fn configure_logging(&mut self, debug: bool) {
        self.engine.configure_logging(debug);
    }

    pub fn get_best_move(&mut self, board: Vec<i32>, current_piece: i32, next_piece: i32, strategy: Strategy) -> String {
        self.engine.get_best_move(&board, current_piece, next_piece, strategy)
    }

    pub fn get_full_move_sequence(&mut self, board: Vec<i32>, current_piece: i32, next_piece: i32, strategy: Strategy) -> String {
        self.engine.get_full_move_sequence(&board, current_piece, next_piece, strategy)
    }

    // New methods that accept current piece position for accurate pathfinding
    #[wasm_bindgen(js_name = getBestMoveWithPosition)]
    pub fn get_best_move_with_position(&mut self, board: Vec<i32>, current_piece: i32, current_x: i32, current_y: i32, current_rotation: i32, next_piece: i32, strategy: Strategy) -> String {
        console_log!("🎮 ENGINE: getBestMoveWithPosition called - piece: {}, position: ({}, {}) rotation: {}, next: {}", 
                     current_piece, current_x, current_y, current_rotation, next_piece);
        
        // Use direct mapping; JS passes visible-space coordinates
        let (rust_x, rust_y) = (current_x, current_y);
        
        // Create the board and validate coordinates
        let rust_board = crate::board::Board::from_flat_array(&board);
        let piece_type = crate::pieces::PieceType::from_i32(current_piece).unwrap_or(crate::pieces::PieceType::T);
        let test_piece = crate::pieces::Piece::new(piece_type, rust_x, rust_y).with_rotation(current_rotation as usize);
        
        let final_coordinates = if !rust_board.can_place_piece(&test_piece) {
            console_log!("🔄 Coordinates invalid, using spawn position fallback...");
            let spawn_piece = crate::pieces::Piece::spawn(piece_type);
            (spawn_piece.x, spawn_piece.y)
        } else {
            (rust_x, rust_y)
        };
        
        // Convert next piece
        // next_piece_type intentionally unused here
        
        // Run the search using the engine's method with corrected coordinates
        self.engine.get_best_move_with_position(&board, current_piece, final_coordinates.0, final_coordinates.1, current_rotation as usize, next_piece, strategy)
    }

    #[wasm_bindgen(js_name = getFullMoveSequenceWithPosition)]
    pub fn get_full_move_sequence_with_position(&mut self, board: Vec<i32>, current_piece: i32, current_x: i32, current_y: i32, current_rotation: i32, next_piece: i32, strategy: Strategy) -> String {
        console_log!("🎮 ENGINE: getFullMoveSequenceWithPosition called - piece: {}, position: ({}, {}) rotation: {}, next: {}", 
                     current_piece, current_x, current_y, current_rotation, next_piece);
        
        // Condensed coordinate diagnostics
        let board_rows = board.len() / 10;
        console_log!("📐 Rows={} JSpos=({}, {})", board_rows, current_x, current_y);
        
        // Use direct mapping; JS passes visible-space coordinates
        let (rust_x, rust_y) = (current_x, current_y);
        
        // Create the board from flat array (this maps JS data to Rust rows 20-39)
        let rust_board = crate::board::Board::from_flat_array(&board);
        
        // Validate the coordinates
        let piece_type = crate::pieces::PieceType::from_i32(current_piece).unwrap_or(crate::pieces::PieceType::T);
        let test_piece = crate::pieces::Piece::new(piece_type, rust_x, rust_y).with_rotation(current_rotation as usize);
        
        // Concise piece creation debug
        console_log!("🔍 Piece {:?} at ({}, {}) rot {}", piece_type, rust_x, rust_y, current_rotation);
        let mask_result = test_piece.get_mask();
        
        match mask_result {
            Some(_mask) => {
                console_log!("✅ Mask OK for {:?} rot {} @({}, {})", piece_type, current_rotation, rust_x, rust_y);
            },
            None => {
                console_log!("❌ No mask for {:?} rot {} @x={}", piece_type, current_rotation, rust_x);
                for test_x in (rust_x-1)..=(rust_x+1) {
                    let test_piece_nearby = crate::pieces::Piece::new(piece_type, test_x, rust_y).with_rotation(current_rotation as usize);
                    if let Some(_) = test_piece_nearby.get_mask() {
                        console_log!("  ✅ mask@x={}", test_x);
                    }
                }
            }
        }
        
        let is_valid = rust_board.can_place_piece(&test_piece);
        
        console_log!("🔍 Coord: ({}, {}) rot {} → {}", rust_x, rust_y, current_rotation, if is_valid { "✅ VALID" } else { "❌ INVALID" });
        
        // DETAILED VALIDATION ANALYSIS
        if !is_valid {
            console_log!("❌ Invalid start pos @({}, {}) - returning empty sequence", rust_x, rust_y);
            return "ERROR:INVALID_POSITION".to_string();
        }
        
        let final_coordinates = if !is_valid {
            console_log!("  🔄 Coordinates invalid, using spawn position fallback...");
            let spawn_piece = crate::pieces::Piece::spawn(piece_type);
            console_log!("  ✅ Using spawn position: ({}, {})", spawn_piece.x, spawn_piece.y);
            console_log!("  ⚠️  CRITICAL WARNING: This means JavaScript will execute from ({}, {}) but Rust pathfinding is from ({}, {})!", 
                        current_x, current_y, spawn_piece.x, spawn_piece.y);
            console_log!("  🔧 This coordinate mismatch will cause execution errors!");
            (spawn_piece.x, spawn_piece.y)
        } else {
            console_log!("  ✅ Coordinates valid - no fallback needed");
            (rust_x, rust_y)
        };
        
        console_log!("🔧 Final: JS ({}, {}) → Rust ({}, {})", 
                     current_x, current_y, final_coordinates.0, final_coordinates.1);
        
        // COORDINATE CONSISTENCY CHECK
        if final_coordinates.0 != current_x || final_coordinates.1 != current_y {
            console_log!("🚨 Coord mismatch: JS({}, {}) vs Rust({}, {})", current_x, current_y, final_coordinates.0, final_coordinates.1);
        } else {
            console_log!("✅ Coord sync");
        }
        
        // Run the search using the engine's method with corrected coordinates
        let move_sequence = self.engine.get_full_move_sequence_with_position(&board, current_piece, final_coordinates.0, final_coordinates.1, current_rotation as usize, next_piece, strategy);
        console_log!("🎯 FINAL MOVE SEQUENCE: {}", move_sequence);

        move_sequence
    }

    // New: hold-aware bindings
    #[wasm_bindgen(js_name = getBestMoveWithPositionAndHold)]
    pub fn get_best_move_with_position_and_hold(&mut self, board: Vec<i32>, current_piece: i32, current_x: i32, current_y: i32, current_rotation: i32, next_piece: i32, held_piece: i32, can_hold: bool, strategy: Strategy) -> String {
        // Use direct mapping; JS passes visible-space coordinates consistently
        let (rust_x, rust_y) = (current_x, current_y);
        self.engine.get_best_move_with_position_and_hold(&board, current_piece, rust_x, rust_y, current_rotation as usize, next_piece, held_piece, can_hold, strategy)
    }

    #[wasm_bindgen(js_name = getFullMoveSequenceWithPositionAndHold)]
    pub fn get_full_move_sequence_with_position_and_hold(&mut self, board: Vec<i32>, current_piece: i32, current_x: i32, current_y: i32, current_rotation: i32, next_piece: i32, held_piece: i32, can_hold: bool, strategy: Strategy) -> String {
        // Use direct mapping; JS passes visible-space coordinates consistently
        let (rust_x, rust_y) = (current_x, current_y);
        self.engine.get_full_move_sequence_with_position_and_hold(&board, current_piece, rust_x, rust_y, current_rotation as usize, next_piece, held_piece, can_hold, strategy)
    }

    // Legacy methods for compatibility
    pub fn move_left(&mut self) -> bool {
        console_log!("WasmTetrisEngine::move_left() called");
        false
    }

    pub fn move_right(&mut self) -> bool {
        console_log!("WasmTetrisEngine::move_right() called");
        false
    }

    pub fn move_down(&mut self) -> bool {
        console_log!("WasmTetrisEngine::move_down() called");
        false
    }

    pub fn rotate(&mut self) -> bool {
        console_log!("WasmTetrisEngine::rotate() called");
        false
    }

    pub fn spawn_tetromino(&mut self, type_key: i32) -> bool {
        console_log!("WasmTetrisEngine::spawn_tetromino({}) called", type_key);
        false
    }

    pub fn get_game_state_json(&self) -> String {
        "{}".to_string()
    }
}

#[wasm_bindgen(start)]
pub fn start() {
    console_log!("🚀🚀🚀 WASM LOADED: {} - SMART FLAT BUILDER (GEOMETRY-AWARE) 🚀🚀🚀", "2024-06-06 18:05");
} 